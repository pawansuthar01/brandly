import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/database/prisma.service.js";
import { ChatRealtimeService } from "../chat/chat.realtime.js";

function mediaFiles(value: Prisma.JsonValue): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Prisma.JsonObject => Boolean(item && typeof item === "object" && !Array.isArray(item) && typeof item.url === "string"));
}

@Injectable()
export class AdminService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(ChatRealtimeService) private readonly chatRealtime: ChatRealtimeService) {}

  async overview(take: number) {
    const [users, campaigns, applications] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: { in: ["BRAND", "CREATOR"] } },
        include: { profile: true, socialAccounts: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" }, take,
      }),
      this.prisma.campaign.findMany({
        include: { brand: { include: { profile: true } }, _count: { select: { applications: true } } },
        orderBy: { updatedAt: "desc" }, take,
      }),
      this.prisma.campaignApplication.findMany({
        include: { campaign: { include: { brand: { include: { profile: true } } } }, creator: { include: { profile: true } } },
        orderBy: { updatedAt: "desc" }, take,
      }),
    ]);
    return {
      users: users.map((user) => ({
        id: user.id,
        name: user.profile?.displayName || user.email || "Unnamed account",
        email: user.email ?? "",
        role: user.role === "BRAND" ? "Brand" : "Creator",
        location: [user.profile?.city, ...(Array.isArray(user.profile?.locations) ? user.profile.locations.filter((value): value is string => typeof value === "string") : [])].filter(Boolean).join(", ") || "Not provided",
        status: user.status === "SUSPENDED" ? "Suspended" : user.status === "ACTIVE" ? "Active" : user.status === "DELETED" ? "Deleted" : "Pending review",
        profileVisible: user.profile?.visibility === "PUBLIC",
        followers: user.profile?.audienceSize ?? "—",
        joined: user.createdAt.toISOString(),
        avatar: (user.profile?.displayName || user.email || "U").slice(0, 2).toUpperCase(),
        categories: user.profile?.focus ? [user.profile.focus] : [],
        phone: user.phoneE164 ?? undefined,
        state: "",
        city: user.profile?.city ?? "",
        bio: user.profile?.bio ?? "",
        languages: Array.isArray(user.profile?.languages) ? user.profile.languages.filter((value): value is string => typeof value === "string") : [],
        contentTypes: [],
        priceRange: user.profile?.rateRange ?? undefined,
        website: user.profile?.websiteUrl ?? undefined,
        lastActive: user.updatedAt.toISOString(),
        socialAccounts: user.socialAccounts.map((account) => ({ platform: account.platform, handle: account.handle, url: account.profileUrl ?? "", verified: account.verificationStatus === "VERIFIED" })),
      })),
      campaigns: campaigns.map((campaign) => ({
        id: campaign.id,
        title: campaign.title,
        brand: campaign.brand.profile?.displayName || campaign.brand.email || "Brand",
        category: campaign.category,
        location: Array.isArray(campaign.targetLocations) ? campaign.targetLocations.filter((value): value is string => typeof value === "string").join(", ") : "",
        status: campaign.status === "PUBLISHED" ? "Published" : campaign.status === "CLOSED" ? "Completed" : campaign.status === "ARCHIVED" ? "Archived" : campaign.status === "DRAFT" ? "Draft" : campaign.visibility === "PRIVATE" ? "Private" : "Active",
        proposals: campaign._count.applications,
        budget: campaign.budget,
        deadlineAt: campaign.deadlineAt?.toISOString() ?? null,
        updated: campaign.updatedAt.toISOString(),
        media: mediaFiles(campaign.media),
      })),
      proposals: applications.map((application) => ({
        id: application.id,
        title: application.campaign.title,
        campaign: application.campaign.title,
        from: application.creator.profile?.displayName || application.creator.email || "Creator",
        to: application.campaign.brand.profile?.displayName || application.campaign.brand.email || "Brand",
        status: application.status === "PENDING" ? "New" : application.status === "ACCEPTED" ? "Accepted" : application.status === "WITHDRAWN" ? "Withdrawn" : "Declined",
        budget: application.responses && typeof application.responses === "object" && !Array.isArray(application.responses) && typeof application.responses.budget === "string" ? application.responses.budget : "Not provided",
        updated: application.updatedAt.toISOString(),
        hasMedia: mediaFiles(application.attachments).length > 0,
        media: mediaFiles(application.attachments),
      })),
    };
  }

  async setSuspended(id: string, suspended: boolean, reason?: string) {
    if (suspended && (!reason?.trim() || reason.trim().length < 5 || reason.trim().length > 500)) throw new BadRequestException("A suspension reason between 5 and 500 characters is required");
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({ where: { id, role: { in: ["BRAND", "CREATOR"] } }, select: { id: true } });
      if (!user) throw new NotFoundException("Account not found");
      const current = await tx.user.findUnique({ where: { id }, select: { status: true } });
      if (current?.status === "DELETED") throw new NotFoundException("Deleted accounts cannot be restored from the admin console");
      const updated = await tx.user.update({ where: { id }, data: { status: suspended ? "SUSPENDED" : "ACTIVE", suspensionReason: suspended ? reason!.trim() : null, suspendedAt: suspended ? new Date() : null } });
      if (suspended) await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      return updated;
    });
    if (suspended) this.chatRealtime.expireUserSession(id, reason!.trim());
    return { id: result.id, status: result.status === "SUSPENDED" ? "Suspended" : "Active" };
  }

  async accountReactivationRequests(requestedTake = 25, offset = 0) {
    const take = Math.min(100, Math.max(1, Math.floor(requestedTake) || 25));
    const skip = Math.max(0, Math.floor(offset) || 0);
    const rows = await this.prisma.accountReactivationRequest.findMany({
      include: { user: { select: { id: true, role: true, status: true, email: true, suspensionReason: true, suspendedAt: true, profile: { select: { displayName: true, avatarUrl: true } } } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip, take: take + 1,
    });
    const hasMore = rows.length > take;
    if (hasMore) rows.pop();
    return { items: rows, nextOffset: hasMore ? skip + take : null };
  }

  async reviewAccountReactivation(id: string, reviewerId: string, status: "APPROVED" | "REJECTED", resolutionNote?: string) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.accountReactivationRequest.findUnique({ where: { id } });
      if (!request) throw new NotFoundException("Reactivation request not found");
      if (request.status !== "PENDING") throw new BadRequestException("This request has already been reviewed");
      const user = await tx.user.findUnique({ where: { id: request.userId }, select: { status: true } });
      if (!user || user.status !== "SUSPENDED") throw new BadRequestException("The account is no longer suspended");
      const now = new Date();
      const changed = await tx.accountReactivationRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status, reviewerId, reviewedAt: now, resolutionNote: resolutionNote?.trim() || null },
      });
      if (!changed.count) throw new BadRequestException("This request has already been reviewed");
      if (status === "APPROVED") {
        await tx.user.update({ where: { id: request.userId }, data: { status: "ACTIVE", suspensionReason: null, suspendedAt: null } });
      }
      return tx.accountReactivationRequest.findUniqueOrThrow({ where: { id } });
    });
  }

  async setCampaignStatus(id: string, status: "ARCHIVED" | "PRIVATE") {
    const campaign = await this.prisma.campaign.findUnique({ where: { id }, select: { id: true } });
    if (!campaign) throw new NotFoundException("Campaign not found");
    const updated = await this.prisma.campaign.update({ where: { id }, data: status === "ARCHIVED" ? { status } : { visibility: "PRIVATE" } });
    return { id: updated.id, status: updated.status === "ARCHIVED" ? "Archived" : updated.status === "CLOSED" ? "Completed" : updated.visibility === "PRIVATE" ? "Private" : "Published" };
  }
}
