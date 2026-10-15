import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProfileInteractionType, SocialVerificationStatus, UserRole } from "@prisma/client";
import { PrismaService } from "../../common/database/prisma.service.js";
import type { AuthPrincipal } from "../../common/auth/auth.types.js";
import type { ContentVerificationDto, ProfileDirectoryQueryDto, SocialAccountDto, UpdateProfileDto } from "./profiles.dto.js";
import { SocialProfileSyncService } from "./social-profile-sync.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { AdminChatService } from "../chat/admin-chat.service.js";

const directoryInclude = {
  profile: true,
  socialAccounts: {
    select: {
      platform: true,
      handle: true,
      profileUrl: true,
      displayName: true,
      followerCount: true,
      followingCount: true,
      postCount: true,
      profileImageUrl: true,
      profileMetadata: true,
      syncStatus: true,
      syncError: true,
      lastSyncedAt: true,
      verificationMethod: true,
      verificationStatus: true,
      verifiedAt: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.UserInclude;

type DirectoryUser = Prisma.UserGetPayload<{ include: typeof directoryInclude }>;

@Injectable()
export class ProfilesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SocialProfileSyncService) private readonly socialSync: SocialProfileSyncService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(AdminChatService) private readonly adminChat: AdminChatService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, socialAccounts: { orderBy: { createdAt: "asc" } } },
    });
    if (!user) throw new NotFoundException("Profile not found");
    return this.serialize(user);
  }

  async update(userId: string, dto: UpdateProfileDto) {
    const current = await this.prisma.userProfile.findUnique({ where: { userId } });
    const profile = {
      displayName: dto.displayName ?? current?.displayName ?? "",
      bio: dto.bio ?? current?.bio ?? "",
      city: dto.city ?? current?.city ?? "",
      focus: dto.focus ?? current?.focus ?? "",
      avatarUrl: dto.avatarUrl ?? current?.avatarUrl,
      websiteUrl: dto.websiteUrl ?? current?.websiteUrl,
      audienceSize: dto.audienceSize ?? current?.audienceSize,
      rateRange: dto.rateRange ?? current?.rateRange,
      teamSize: dto.teamSize ?? current?.teamSize,
      visibility: dto.visibility ?? current?.visibility ?? "PRIVATE",
      languages: dto.languages ?? current?.languages ?? undefined,
      locations: dto.locations ?? current?.locations ?? undefined,
      onboardingStep: dto.onboardingStep ?? current?.onboardingStep ?? "profile",
    };
    const completion = Math.round(
      ([profile.displayName, profile.bio, profile.city, profile.focus, profile.avatarUrl].filter(Boolean).length / 5) * 100,
    );
    await this.prisma.$transaction([
      this.prisma.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          ...profile,
          profileCompleted: completion,
        },
        update: {
          ...profile,
          profileCompleted: completion,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        // Progress saves must not mark onboarding complete before the final review.
        data: dto.onboardingStep === "success" ? { onboardingCompletedAt: new Date() } : {},
      }),
    ]);
    return this.getMe(userId);
  }

  async upsertSocialAccount(userId: string, dto: SocialAccountDto) {
    const platform = dto.platform.trim();
    const handle = dto.handle.trim();
    const profileUrl = dto.profileUrl?.trim() || (/^https?:\/\//i.test(handle) ? handle : null);
    const existing = await this.prisma.socialAccount.findUnique({ where: { userId_platform: { userId, platform } } });
    const changed = existing?.handle !== handle || existing?.profileUrl !== profileUrl;
    if (changed && existing) {
      await this.prisma.contentVerification.deleteMany({ where: { socialAccountId: existing.id, status: "PENDING" } });
    }
    const account = await this.prisma.socialAccount.upsert({
      where: { userId_platform: { userId, platform } },
      create: {
        userId,
        platform,
        handle,
        profileUrl,
      },
      update: {
        handle,
        profileUrl,
        ...(changed ? {
          displayName: null,
          followerCount: null,
          followingCount: null,
          postCount: null,
          profileImageUrl: null,
          profileMetadata: Prisma.JsonNull,
          syncStatus: "IDLE",
          syncError: null,
          lastSyncedAt: null,
          verificationMethod: null,
          verificationStatus: "UNVERIFIED" as const,
          verifiedAt: null,
        } : {}),
      },
    });
    const manualReview = await this.prisma.contentVerification.findFirst({
      where: { socialAccountId: account.id, status: "PENDING" },
      select: { id: true },
    });
    if (account.profileUrl && this.socialSync.supportsPlatform(account.platform) && (!manualReview || changed)) await this.socialSync.enqueue(account.id);
    return this.prisma.socialAccount.findUniqueOrThrow({ where: { id: account.id } });
  }

  async syncSocialAccount(userId: string, accountId: string) {
    const account = await this.prisma.socialAccount.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new NotFoundException("Social account not found");
    const manualReview = await this.prisma.contentVerification.findFirst({
      where: { socialAccountId: account.id, status: "PENDING" },
      select: { id: true },
    });
    if (account.profileUrl && this.socialSync.supportsPlatform(account.platform) && !manualReview) await this.socialSync.enqueue(account.id);
    return this.prisma.socialAccount.findUniqueOrThrow({ where: { id: account.id } });
  }

  async requestSocialVerification(userId: string, role: UserRole, accountId: string, dto: ContentVerificationDto) {
    const account = await this.prisma.socialAccount.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new NotFoundException("Social account not found");
    const existing = await this.prisma.contentVerification.findFirst({
      where: { socialAccountId: account.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      await this.adminChat.sendSocialReviewCard({ userId, role }, { requestId: existing.id, accountId: account.id, platform: account.platform, handle: account.handle, contentType: existing.contentType, contentUrl: existing.contentUrl });
      return existing;
    }
    const verification = await this.prisma.contentVerification.create({
      data: {
        userId,
        socialAccountId: account.id,
        contentType: dto.contentType,
        contentUrl: dto.contentUrl,
      },
    });
    await this.prisma.socialAccount.update({ where: { id: account.id }, data: { verificationStatus: "PENDING" } });
    await this.adminChat.sendSocialReviewCard({ userId, role }, { requestId: verification.id, accountId: account.id, platform: account.platform, handle: account.handle, contentType: verification.contentType, contentUrl: verification.contentUrl });
    return verification;
  }

  async listVerifications(status?: SocialVerificationStatus) {
    return this.prisma.contentVerification.findMany({
      where: status ? { status } : undefined,
      include: { user: { select: { id: true, email: true, phoneE164: true, profile: true } }, socialAccount: true },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
  }

  async reviewVerification(id: string, status: "VERIFIED" | "REJECTED", reviewerNote?: string) {
    const verification = await this.prisma.contentVerification.findUnique({
      where: { id },
      include: { socialAccount: { select: { platform: true } } },
    });
    if (!verification) throw new NotFoundException("Verification request not found");
    const updated = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.contentVerification.update({
        where: { id },
        data: { status, reviewerNote: reviewerNote ?? null, reviewedAt: new Date() },
      });
      if (verification.socialAccountId) {
        await transaction.socialAccount.update({
          where: { id: verification.socialAccountId },
          data: {
            verificationStatus: status,
            verifiedAt: status === "VERIFIED" ? new Date() : null,
            syncStatus: status === "VERIFIED" ? "SYNCED" : "FAILED",
            syncError: status === "VERIFIED" ? null : reviewerNote ?? "Rejected during manual review.",
            verificationMethod: "ADMIN_REVIEW",
          },
        });
      }
      return updated;
    });
    const platform = verification.socialAccount?.platform ?? "Social account";
    const reviewNote = reviewerNote?.trim();
    try {
      await this.notifications.create(verification.userId, {
        type: "SOCIAL_VERIFICATION",
        title: status === "VERIFIED" ? "Social account verified" : "Social account review updated",
        body: status === "VERIFIED"
          ? `${platform} was verified successfully.`
          : `${platform} needs attention.${reviewNote ? ` ${reviewNote}` : " Our team has updated the review status."}`,
        data: { screen: "Notifications", socialPlatform: platform, verificationStatus: status },
        channels: ["PUSH", "EMAIL", "WHATSAPP"],
      });
    } catch {
      // Verification remains complete even if every notification provider is unavailable.
    }
    return updated;
  }

  async listSocialReviews(take: number, offset: number) {
    const rows = await this.prisma.socialAccount.findMany({
      where: { verificationStatus: "PENDING", user: { status: { not: "DELETED" }, role: { in: [UserRole.BRAND, UserRole.CREATOR] } } },
      include: {
        user: { select: { id: true, role: true, status: true, email: true, phoneE164: true, createdAt: true, profile: true } },
        verifications: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, contentType: true, contentUrl: true, createdAt: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: offset,
      take: take + 1,
    });
    const hasMore = rows.length > take;
    if (hasMore) rows.pop();
    return {
      items: rows.map(({ user, verifications, ...account }) => ({
        id: account.id,
        platform: account.platform,
        handle: account.handle,
        profileUrl: account.profileUrl,
        displayName: account.displayName,
        followerCount: account.followerCount,
        followingCount: account.followingCount,
        postCount: account.postCount,
        profileImageUrl: account.profileImageUrl,
        syncStatus: account.syncStatus,
        syncError: account.syncError,
        createdAt: account.createdAt.toISOString(),
        user: {
          id: user.id,
          role: user.role === UserRole.BRAND ? "Brand" : "Creator",
          status: user.status,
          email: user.email,
          phone: user.phoneE164,
          joinedAt: user.createdAt.toISOString(),
          name: user.profile?.displayName || user.email || "Unnamed account",
          city: user.profile?.city || "",
          bio: user.profile?.bio || "",
          avatarUrl: user.profile?.avatarUrl,
          visibility: user.profile?.visibility ?? "PRIVATE",
          profileCompleted: user.profile?.profileCompleted ?? 0,
        },
        contentRequest: verifications[0] ? { ...verifications[0], createdAt: verifications[0].createdAt.toISOString() } : null,
      })),
      nextOffset: hasMore ? offset + take : null,
    };
  }

  async listSocialReviewUsers(take: number, offset: number, query = "") {
    const search = query.trim();
    const where: Prisma.UserWhereInput = {
      status: { not: "DELETED" },
      role: { in: [UserRole.BRAND, UserRole.CREATOR] },
      socialAccounts: { some: { verificationStatus: "PENDING" } },
      ...(search ? { OR: [
        { email: { contains: search, mode: "insensitive" } },
        { profile: { is: { displayName: { contains: search, mode: "insensitive" } } } },
        { socialAccounts: { some: { verificationStatus: "PENDING", OR: [
          { platform: { contains: search, mode: "insensitive" } },
          { handle: { contains: search, mode: "insensitive" } },
          { displayName: { contains: search, mode: "insensitive" } },
        ] } } },
      ] } : {}),
    };
    const rows = await this.prisma.user.findMany({
      where,
      select: {
        id: true, role: true, status: true, email: true, createdAt: true,
        profile: { select: { displayName: true, city: true, avatarUrl: true } },
        socialAccounts: {
          where: { verificationStatus: "PENDING" },
          select: { platform: true, syncStatus: true, syncError: true, createdAt: true },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: offset,
      take: take + 1,
    });
    const hasMore = rows.length > take;
    if (hasMore) rows.pop();
    return {
      items: rows.map(({ socialAccounts, ...user }) => ({
        id: user.id,
        name: user.profile?.displayName || user.email || "Unnamed account",
        email: user.email,
        role: user.role === UserRole.BRAND ? "Brand" : "Creator",
        status: user.status,
        city: user.profile?.city || "",
        avatarUrl: user.profile?.avatarUrl,
        joinedAt: user.createdAt.toISOString(),
        pendingCount: socialAccounts.length,
        platforms: [...new Set(socialAccounts.map((account) => account.platform))],
        needsAttention: socialAccounts.some((account) => Boolean(account.syncError) || account.syncStatus.toUpperCase() !== "SYNCED"),
        oldestPendingAt: socialAccounts[0]?.createdAt.toISOString() ?? null,
      })),
      nextOffset: hasMore ? offset + take : null,
    };
  }

  async getAdminSocialReviewUser(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: { not: "DELETED" }, role: { in: [UserRole.BRAND, UserRole.CREATOR] } },
      select: {
        id: true, role: true, status: true, email: true, phoneE164: true, createdAt: true,
        profile: { select: { displayName: true, city: true, bio: true, avatarUrl: true, profileCompleted: true } },
        socialAccounts: {
          select: {
            id: true, platform: true, handle: true, profileUrl: true, displayName: true,
            followerCount: true, followingCount: true, postCount: true, profileImageUrl: true,
            syncStatus: true, syncError: true, verificationStatus: true, createdAt: true,
            verifications: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, contentType: true, contentUrl: true, createdAt: true } },
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    });
    if (!user) throw new NotFoundException("Social review user not found");
    return {
      user: {
        id: user.id, name: user.profile?.displayName || user.email || "Unnamed account", email: user.email,
        phone: user.phoneE164, role: user.role === UserRole.BRAND ? "Brand" : "Creator", status: user.status,
        city: user.profile?.city || "", bio: user.profile?.bio || "", avatarUrl: user.profile?.avatarUrl,
        profileCompleted: user.profile?.profileCompleted ?? 0, joinedAt: user.createdAt.toISOString(),
      },
      accounts: user.socialAccounts.map(({ verifications, ...account }) => ({
        ...account, createdAt: account.createdAt.toISOString(),
        contentRequest: verifications[0] ? { ...verifications[0], createdAt: verifications[0].createdAt.toISOString() } : null,
      })),
    };
  }

  async reviewSocialAccount(id: string, reviewerId: string, followerCount?: number) {
    const reviewedAt = new Date();
    const account = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.socialAccount.findUnique({ where: { id }, select: { id: true, userId: true, platform: true, handle: true, followerCount: true } });
      if (!current) throw new NotFoundException("Social account review not found");
      const changed = await transaction.socialAccount.updateMany({
        where: { id, verificationStatus: "PENDING" },
        data: {
          verificationStatus: "VERIFIED",
          verifiedAt: reviewedAt,
          reviewedAt,
          reviewedBy: reviewerId,
          reviewerNote: null,
          verificationMethod: "ADMIN_REVIEW",
          ...(followerCount !== undefined ? { followerCount, followerCountVerifiedAt: reviewedAt } : {}),
        },
      });
      if (!changed.count) throw new ConflictException("This social account was already reviewed. Refresh the queue.");
      await transaction.contentVerification.updateMany({
        where: { socialAccountId: id, status: "PENDING" },
        data: { status: "VERIFIED", reviewerNote: null, reviewedAt },
      });
      return current;
    });
    let notificationQueued = false;
    try {
      await this.notifications.create(account.userId, {
        type: "SOCIAL_VERIFICATION",
        title: `${account.platform} account verified`,
        body: `${account.handle} on ${account.platform} was verified successfully.`,
        data: { screen: "Notifications", socialPlatform: account.platform, socialAccountId: account.id, socialHandle: account.handle, verificationStatus: "VERIFIED" },
        channels: ["PUSH", "EMAIL", "WHATSAPP"],
      });
      notificationQueued = true;
    } catch {
      // Keep the review decision if a notification provider is unavailable.
    }
    return { id, userId: account.userId, platform: account.platform, status: "VERIFIED" as const, followerCount: followerCount ?? account.followerCount, reviewedAt: reviewedAt.toISOString(), notificationQueued };
  }

  async getPublic(userId: string, viewerId: string) {
    if (userId === viewerId) throw new NotFoundException("Public profile not found");
    const blocked = await this.prisma.profileInteraction.findFirst({
      where: { type: ProfileInteractionType.BLOCKED, OR: [{ ownerId: viewerId, targetId: userId }, { ownerId: userId, targetId: viewerId }] },
      select: { id: true },
    });
    if (blocked) throw new NotFoundException("Public profile not found");
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: "ACTIVE", onboardingCompletedAt: { not: null }, profile: { visibility: "PUBLIC", onboardingStep: "success" } },
      include: {
        profile: true,
        socialAccounts: {
          select: {
            platform: true,
            handle: true,
            profileUrl: true,
            verificationStatus: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!user) throw new NotFoundException("Public profile not found");
    void this.socialSync.enqueueStaleAccounts(userId).catch(() => undefined);
    const reviewWhere = { subjectId: userId, application: { completedAt: { not: null } } };
    const [campaignReviews, reviewStats] = await Promise.all([
      this.prisma.campaignReview.findMany({ where: reviewWhere, include: { author: { include: { profile: true } }, application: { include: { campaign: { select: { title: true } } } } }, orderBy: { createdAt: "desc" }, take: 50 }),
      this.prisma.campaignReview.aggregate({ where: reviewWhere, _avg: { rating: true }, _count: { _all: true } }),
    ]);
    return {
      id: user.id,
      role: user.role,
      profile: user.profile,
      socialAccounts: user.socialAccounts,
      campaignReviews: campaignReviews.map((review) => ({ id: review.id, authorId: review.authorId, author: review.author.profile?.displayName || "User", rating: review.rating, text: review.text, date: review.createdAt.toISOString(), campaignTitle: review.application.campaign.title })),
      rating: reviewStats._avg.rating ?? 0,
      reviewCount: reviewStats._count._all,
    };
  }

  async listDirectory(user: AuthPrincipal, query: ProfileDirectoryQueryDto = {}) {
    const targetRole = query.role ?? this.directoryTargetRole(user.role);
    if (targetRole === UserRole.ADMIN) throw new BadRequestException("A public directory is not available for admin profiles");

    const blockedRelations = await this.prisma.profileInteraction.findMany({
      where: {
        type: ProfileInteractionType.BLOCKED,
        OR: [
          { ownerId: user.userId },
          { targetId: user.userId },
        ],
      },
      select: { ownerId: true, targetId: true },
    });
    const blockedIds = blockedRelations.map((interaction) =>
      interaction.ownerId === user.userId ? interaction.targetId : interaction.ownerId,
    );

    const where: Prisma.UserWhereInput = {
      id: { not: user.userId, notIn: blockedIds },
      role: targetRole,
      status: "ACTIVE",
      onboardingCompletedAt: { not: null },
      profile: {
        is: {
          visibility: "PUBLIC",
          onboardingStep: "success",
          profileCompleted: { gte: 80 },
          displayName: { not: "" },
          city: { not: "" },
          focus: { not: "" },
        },
      },
      ...(targetRole === UserRole.CREATOR ? { socialAccounts: { some: { handle: { not: "" } } } } : {}),
    };
    const search = query.search?.trim();
    if (search) {
      where.AND = [{
        OR: [
          { profile: { is: { displayName: { contains: search, mode: "insensitive" } } } },
          { profile: { is: { bio: { contains: search, mode: "insensitive" } } } },
          { profile: { is: { city: { contains: search, mode: "insensitive" } } } },
          { profile: { is: { focus: { contains: search, mode: "insensitive" } } } },
          { socialAccounts: { some: { platform: { contains: search, mode: "insensitive" } } } },
          { socialAccounts: { some: { handle: { contains: search, mode: "insensitive" } } } },
        ],
      }];
    }
    if (query.saved === "true") {
      where.profileInteractions = { some: { ownerId: user.userId, type: ProfileInteractionType.SAVED } };
    }

    const users = await this.prisma.user.findMany({
      where,
      include: directoryInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    const interactions = await this.prisma.profileInteraction.findMany({
      where: { ownerId: user.userId },
      select: { targetId: true, type: true },
    });
    return {
      profiles: users.map((item) => this.serializePublicUser(item)),
      interactions: this.serializeInteractionIds(interactions),
    };
  }

  async getInteractions(userId: string) {
    const interactions = await this.prisma.profileInteraction.findMany({
      where: { ownerId: userId },
      select: { targetId: true, type: true },
    });
    return this.serializeInteractionIds(interactions);
  }

  async setInteraction(user: AuthPrincipal, rawType: string, targetId: string, active: boolean) {
    const type = this.parseInteractionType(rawType);
    if (targetId === user.userId) throw new BadRequestException("You cannot interact with your own profile");
    const target = await this.prisma.user.findFirst({
      where: {
        id: targetId,
        status: "ACTIVE",
        role: this.directoryTargetRole(user.role),
        onboardingCompletedAt: { not: null },
        profile: { visibility: "PUBLIC", onboardingStep: "success", profileCompleted: { gte: 80 } },
      },
      select: { id: true },
    });
    if (!target) throw new NotFoundException("Public profile not found");

    await this.prisma.$transaction(async (transaction) => {
      if (active) {
        await transaction.profileInteraction.upsert({
          where: { ownerId_targetId_type: { ownerId: user.userId, targetId, type } },
          create: { ownerId: user.userId, targetId, type },
          update: {},
        });
        if (type === ProfileInteractionType.BLOCKED) {
          await transaction.profileInteraction.deleteMany({
            where: {
              ownerId: user.userId,
              targetId,
              type: { in: [ProfileInteractionType.SAVED, ProfileInteractionType.COMPARED] },
            },
          });
        }
      } else {
        await transaction.profileInteraction.deleteMany({ where: { ownerId: user.userId, targetId, type } });
      }
    });
    return this.getInteractions(user.userId);
  }

  private directoryTargetRole(role: AuthPrincipal["role"]): UserRole {
    if (role === "BRAND") return UserRole.CREATOR;
    if (role === "CREATOR") return UserRole.BRAND;
    return UserRole.CREATOR;
  }

  private parseInteractionType(rawType: string): ProfileInteractionType {
    const type = rawType.trim().toUpperCase() as ProfileInteractionType;
    if (!Object.values(ProfileInteractionType).includes(type)) throw new BadRequestException("Profile interaction type is invalid");
    return type;
  }

  private serializeInteractionIds(interactions: Array<{ targetId: string; type: ProfileInteractionType }>) {
    return {
      savedIds: interactions.filter((item) => item.type === ProfileInteractionType.SAVED).map((item) => item.targetId),
      blockedIds: interactions.filter((item) => item.type === ProfileInteractionType.BLOCKED).map((item) => item.targetId),
      comparedIds: interactions.filter((item) => item.type === ProfileInteractionType.COMPARED).map((item) => item.targetId),
    };
  }

  private serializePublicUser(user: DirectoryUser) {
    return {
      id: user.id,
      role: user.role,
      profile: user.profile,
      socialAccounts: user.socialAccounts,
    };
  }

  private serialize(user: {
      id: string;
      role: string;
      email: string | null;
      phoneE164: string | null;
      phoneVerifiedAt: Date | null;
      emailVerifiedAt: Date | null;
      onboardingCompletedAt: Date | null;
      profile: { onboardingStep?: string } | null;
      socialAccounts: unknown;
  }) {
    return {
      id: user.id,
      role: user.role,
      email: user.email,
      phone: user.phoneE164,
      phoneVerified: Boolean(user.phoneVerifiedAt),
      emailVerified: Boolean(user.emailVerifiedAt),
      onboardingComplete: Boolean(user.onboardingCompletedAt),
      onboardingStep: user.profile?.onboardingStep ?? "profile",
      profile: user.profile,
      socialAccounts: user.socialAccounts,
    };
  }
}
