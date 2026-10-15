import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CampaignApplicationStatus, CampaignStatus, CampaignVisibility, Prisma, UserRole } from "@prisma/client";
import { PrismaService } from "../../common/database/prisma.service.js";
import type { AuthPrincipal } from "../../common/auth/auth.types.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { ChatRealtimeService } from "../chat/chat.realtime.js";
import type { CampaignListQueryDto, CreateCampaignApplicationDto, CreateCampaignDto, CreateCampaignReviewDto, InviteCampaignCreatorDto, UpdateCampaignApplicationDto, UpdateCampaignDto, UpdateCampaignPaymentDto } from "./campaigns.dto.js";

const applicationInclude = {
  creator: { include: { profile: true, socialAccounts: { orderBy: { createdAt: "asc" as const } }, receivedCampaignReviews: { include: { author: { include: { profile: true } } }, orderBy: { createdAt: "desc" as const }, take: 50 } } },
  history: { orderBy: { occurredAt: "asc" as const } },
  payment: true,
  reviews: { include: { author: { include: { profile: true } }, subject: { include: { profile: true } } }, orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.CampaignApplicationInclude;
const campaignInclude = {
  brand: { include: { profile: true, socialAccounts: { orderBy: { createdAt: "asc" as const } }, receivedCampaignReviews: { include: { author: { include: { profile: true } } }, orderBy: { createdAt: "desc" as const }, take: 50 } } },
  applications: { include: applicationInclude, orderBy: { updatedAt: "desc" as const } },
} satisfies Prisma.CampaignInclude;

type CampaignRecord = Prisma.CampaignGetPayload<{ include: typeof campaignInclude }>;
type ApplicationRecord = CampaignRecord["applications"][number];
const applicationMessageSelect = {
  id: true,
  senderId: true,
  clientMessageId: true,
  text: true,
  attachments: true,
  deliveredAt: true,
  createdAt: true,
  updatedAt: true,
} as const;
type ApplicationMessageRecord = Prisma.ChatMessageGetPayload<{ select: typeof applicationMessageSelect }>;

const jsonInput = (value: unknown) => value as Prisma.InputJsonValue;
const strings = (value: Prisma.JsonValue | null | undefined) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const objects = (value: Prisma.JsonValue | null | undefined): Record<string, unknown>[] => Array.isArray(value)
  ? value.filter((item) => Boolean(item && typeof item === "object" && !Array.isArray(item))).map((item) => item as Record<string, unknown>)
  : [];

function parseDeadline(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const normalized = value.trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? new Date(`${normalized}T23:59:59.999Z`)
    : new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException("Deadline is invalid");
  return parsed;
}

function normalizedTerms(value: string | null | undefined): string[] {
  return (value ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((item) => item.length > 2);
}

function numericValues(value: string | null | undefined): number[] {
  const text = (value ?? "").toLowerCase().replace(/,/g, "");
  return Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*(k|thousand|l|lac|lakh|crore)?/g)).map((match) => {
    const base = Number(match[1]);
    const multiplier = match[2] === "k" || match[2] === "thousand" ? 1_000 : match[2] === "l" || match[2] === "lac" || match[2] === "lakh" ? 100_000 : match[2] === "crore" ? 10_000_000 : 1;
    return base * multiplier;
  }).filter((value) => Number.isFinite(value));
}

function scoreCreator(campaign: CampaignRecord, creator: ApplicationRecord["creator"]) {
  const profile = creator.profile;
  const targetLocations = strings(campaign.targetLocations).map((value) => value.toLowerCase());
  const creatorLocations = [profile?.city ?? "", ...strings(profile?.locations as Prisma.JsonValue | null | undefined)].map((value) => value.toLowerCase());
  const locationMatch = targetLocations.some((target) => target.includes("pan india") || creatorLocations.some((location) => location === target || location.includes(target) || target.includes(location))) ? 30 : 0;
  const campaignTerms = new Set(normalizedTerms(`${campaign.category} ${campaign.creatorRequirements}`));
  const creatorTerms = new Set(normalizedTerms(`${profile?.focus ?? ""} ${profile?.bio ?? ""}`));
  const categoryMatch = Array.from(campaignTerms).some((term) => creatorTerms.has(term)) ? 25 : 0;
  const campaignPlatforms = strings(campaign.platforms).map((value) => value.toLowerCase());
  const creatorPlatforms = creator.socialAccounts.map((account) => account.platform.toLowerCase());
  const platformOverlap = campaignPlatforms.filter((platform) => creatorPlatforms.includes(platform)).length;
  const platformMatch = campaignPlatforms.length ? Math.min(20, Math.round((platformOverlap / campaignPlatforms.length) * 20)) : 10;
  const budget = numericValues(campaign.budget);
  const creatorRate = numericValues(profile?.rateRange);
  const budgetMatch = !budget.length || !creatorRate.length || Math.max(...budget) >= Math.min(...creatorRate) ? 15 : 0;
  const completeness = profile && profile.displayName && profile.city && profile.focus && creator.socialAccounts.length ? 10 : 5;
  const score = Math.min(100, locationMatch + categoryMatch + platformMatch + budgetMatch + completeness);
  const reasons = [
    locationMatch ? "Location match" : "Location can be discussed",
    categoryMatch ? "Niche matches the brief" : "Review the brief for niche fit",
    platformMatch >= 15 ? "Preferred platform match" : "Platform flexibility recommended",
  ];
  return { score, reasons };
}

const SYNCED_FOLLOWER_COUNT_MAX_AGE_MS = 7 * 60 * 60 * 1_000;
const REVIEWED_FOLLOWER_COUNT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;

export function freshVerifiedFollowerCount(accounts: ReadonlyArray<{ verificationStatus: string; syncStatus: string; followerCount: number | null; lastSyncedAt: Date | null; followerCountVerifiedAt?: Date | null }>, now = Date.now()) {
  const freshVerifiedCounts = accounts
    .filter((account) => {
      const manuallyChecked = Boolean(account.followerCountVerifiedAt);
      const checkedAt = account.followerCountVerifiedAt ?? (account.syncStatus === "SYNCED" ? account.lastSyncedAt : null);
      const age = checkedAt ? now - checkedAt.getTime() : -1;
      const maxAge = manuallyChecked ? REVIEWED_FOLLOWER_COUNT_MAX_AGE_MS : SYNCED_FOLLOWER_COUNT_MAX_AGE_MS;
      return account.verificationStatus === "VERIFIED" && account.followerCount !== null && account.followerCount >= 0 && age >= 0 && age <= maxAge;
    })
    .map((account) => account.followerCount ?? 0);
  return Math.max(0, ...freshVerifiedCounts);
}

function creatorFollowerCount(creator: ApplicationRecord["creator"]) {
  return freshVerifiedFollowerCount(creator.socialAccounts);
}

function meetsMinimumFollowers(campaign: CampaignRecord, creator: ApplicationRecord["creator"]) {
  return creatorFollowerCount(creator) >= (campaign.minimumFollowers ?? 0);
}

const MATCH_THRESHOLD = 50;
const conversationPairKey = (brandId: string, creatorId: string) => `${brandId}:${creatorId}`;
function activeApplications(campaign: CampaignRecord) {
  return campaign.applications.filter((application) => application.status === CampaignApplicationStatus.PENDING || application.status === CampaignApplicationStatus.ACCEPTED);
}

function approvedApplications(campaign: CampaignRecord) {
  return campaign.applications.filter((application) => application.status === CampaignApplicationStatus.ACCEPTED);
}

function isCreatorMatch(campaign: CampaignRecord, creator: ApplicationRecord["creator"]) {
  return meetsMinimumFollowers(campaign, creator) && scoreCreator(campaign, creator).score >= MATCH_THRESHOLD;
}

@Injectable()
export class CampaignsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(ChatRealtimeService) private readonly realtime: ChatRealtimeService,
  ) {}

  async list(user: AuthPrincipal, query: CampaignListQueryDto = {}) {
    if (query.creatorId) this.assertBrand(user);
    await this.closeExpiredCampaigns();
    const search = query.search?.trim();
    const blockedUserIds = await this.blockedUserIds(user.userId);
    if (query.creatorId && user.role === "BRAND" && blockedUserIds.includes(query.creatorId)) return { campaigns: [], applications: [] };
    const where: Prisma.CampaignWhereInput = user.role === "BRAND"
      ? { brandId: user.userId, ...(query.creatorId ? { status: CampaignStatus.PUBLISHED } : {}) }
      : {
          AND: [
            { OR: [
              { status: CampaignStatus.PUBLISHED, visibility: CampaignVisibility.PUBLIC },
              { applications: { some: { creatorId: user.userId } } },
            ] },
            ...(blockedUserIds.length ? [{ brandId: { notIn: blockedUserIds } }] : []),
          ],
        };
    if (search) {
      const searchFilter: Prisma.CampaignWhereInput = { OR: [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
      ] };
      where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), searchFilter];
    }
    const campaigns = await this.prisma.campaign.findMany({ where, include: campaignInclude, orderBy: [{ updatedAt: "desc" }] });
    const creator = user.role === "CREATOR" || query.creatorId
      ? await this.prisma.user.findUnique({ where: { id: query.creatorId ?? user.userId }, include: { profile: true, socialAccounts: { orderBy: { createdAt: "asc" } } } })
      : null;
    if (query.creatorId && (!creator || creator.role !== UserRole.CREATOR || creator.status !== "ACTIVE")) throw new NotFoundException("Creator not found");
    const discoverableCampaigns = query.creatorId && creator
      ? campaigns.filter((campaign) => this.isDiscoverable(campaign) && isCreatorMatch(campaign, creator as ApplicationRecord["creator"]))
      : user.role === "CREATOR" && creator
      ? campaigns.filter((campaign) => {
          const ownApplication = campaign.applications.some((application) => application.creatorId === user.userId);
          return ownApplication || this.isDiscoverable(campaign) && Boolean(creator && meetsMinimumFollowers(campaign, creator as ApplicationRecord["creator"]));
        })
      : campaigns;
    const conversationIds = new Map<string, { id: string; submittedAt: Date }>();
    for (const campaign of discoverableCampaigns) {
      for (const application of campaign.applications) {
        if (application.status !== CampaignApplicationStatus.ACCEPTED) continue;
        const key = conversationPairKey(campaign.brandId, application.creatorId);
        const current = conversationIds.get(key);
        if (!current || application.submittedAt < current.submittedAt || (application.submittedAt.getTime() === current.submittedAt.getTime() && application.id < current.id)) {
          conversationIds.set(key, { id: application.id, submittedAt: application.submittedAt });
        }
      }
    }
    const applications = discoverableCampaigns.flatMap((campaign) => campaign.applications
      .filter((application) => user.role === "BRAND" ? campaign.brandId === user.userId : application.creatorId === user.userId)
      .map((application) => this.serializeApplication(application, campaign, conversationIds.get(conversationPairKey(campaign.brandId, application.creatorId))?.id)));
    return {
      campaigns: discoverableCampaigns
        .filter((campaign) => query.includeClosed === "true" || campaign.status !== CampaignStatus.CLOSED || campaign.brandId === user.userId)
        .map((campaign) => this.serializeCampaign(campaign, user, creator as ApplicationRecord["creator"] | null))
        .sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1)),
      applications: query.creatorId ? [] : applications,
    };
  }

  async get(user: AuthPrincipal, id: string) {
    await this.closeExpiredCampaigns();
    const campaign = await this.findAccessible(user, id);
    const creator = user.role === "CREATOR" ? await this.prisma.user.findUnique({ where: { id: user.userId }, include: { profile: true, socialAccounts: { orderBy: { createdAt: "asc" } } } }) : null;
    return this.serializeCampaign(campaign, user, creator as ApplicationRecord["creator"] | null);
  }

  async create(user: AuthPrincipal, dto: CreateCampaignDto) {
    this.assertBrand(user);
    const publish = dto.publish === true;
    const deadlineAt = parseDeadline(dto.deadlineAt);
    if (publish && (!deadlineAt || deadlineAt.getTime() <= Date.now())) throw new BadRequestException("Choose a future campaign deadline before publishing");
    const campaign = await this.prisma.campaign.create({
      data: {
        brandId: user.userId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        targetLocations: jsonInput(this.locations(dto)),
        category: dto.category.trim(),
        budget: dto.budget.trim(),
        deadlineAt,
        status: publish ? CampaignStatus.PUBLISHED : CampaignStatus.DRAFT,
        visibility: dto.visibility === "PRIVATE" ? CampaignVisibility.PRIVATE : CampaignVisibility.PUBLIC,
        platforms: jsonInput(dto.platforms ?? []),
        deliverables: dto.deliverables?.trim() ?? "",
        requirements: jsonInput(dto.requirements ?? []),
        creatorRequirements: dto.creatorRequirements?.trim() ?? "",
        media: jsonInput(dto.media ?? []),
        collaborationVideoUrl: dto.collaborationVideoUrl?.trim() || null,
        collaborationVideoLabel: dto.collaborationVideoLabel?.trim() || null,
        applicationLimit: dto.applicationLimit ?? null,
        minimumFollowers: dto.minimumFollowers ?? null,
        approvalLimit: dto.approvalLimit ?? null,
        closeOnApplicationLimit: dto.closeOnApplicationLimit ?? true,
        closeOnApprovalLimit: dto.closeOnApprovalLimit ?? true,
        publishedAt: publish ? new Date() : null,
      },
      include: campaignInclude,
    });
    return this.serializeCampaign(campaign, user);
  }

  async update(user: AuthPrincipal, id: string, dto: UpdateCampaignDto) {
    this.assertBrand(user);
    const current = await this.findOwned(user.userId, id);
    const publish = dto.publish === true || dto.status === "PUBLISHED" || current.status === CampaignStatus.PUBLISHED && dto.publish !== false;
    const deadlineAt = dto.deadlineAt === undefined ? current.deadlineAt : parseDeadline(dto.deadlineAt);
    if (publish && (!deadlineAt || deadlineAt.getTime() <= Date.now())) throw new BadRequestException("Choose a future campaign deadline before publishing");
    const status = dto.status === "ARCHIVED" ? CampaignStatus.ARCHIVED : dto.status === "CLOSED" ? CampaignStatus.CLOSED : publish ? CampaignStatus.PUBLISHED : CampaignStatus.DRAFT;
    const campaignData: Prisma.CampaignUpdateInput = {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.targetLocations !== undefined || dto.city !== undefined ? { targetLocations: jsonInput(this.locations(dto)) } : {}),
        ...(dto.category !== undefined ? { category: dto.category.trim() } : {}),
        ...(dto.budget !== undefined ? { budget: dto.budget.trim() } : {}),
        ...(dto.deadlineAt !== undefined ? { deadlineAt } : {}),
        status,
        visibility: dto.visibility === "PRIVATE" ? CampaignVisibility.PRIVATE : dto.visibility === "PUBLIC" ? CampaignVisibility.PUBLIC : current.visibility,
        ...(dto.platforms !== undefined ? { platforms: jsonInput(dto.platforms) } : {}),
        ...(dto.deliverables !== undefined ? { deliverables: dto.deliverables.trim() } : {}),
        ...(dto.requirements !== undefined ? { requirements: jsonInput(dto.requirements) } : {}),
        ...(dto.creatorRequirements !== undefined ? { creatorRequirements: dto.creatorRequirements.trim() } : {}),
        ...(dto.media !== undefined ? { media: jsonInput(dto.media) } : {}),
        ...(dto.collaborationVideoUrl !== undefined ? { collaborationVideoUrl: dto.collaborationVideoUrl.trim() || null } : {}),
        ...(dto.collaborationVideoLabel !== undefined ? { collaborationVideoLabel: dto.collaborationVideoLabel.trim() || null } : {}),
        ...(dto.applicationLimit !== undefined ? { applicationLimit: dto.applicationLimit ?? null } : {}),
        ...(dto.minimumFollowers !== undefined ? { minimumFollowers: dto.minimumFollowers ?? null } : {}),
        ...(dto.approvalLimit !== undefined ? { approvalLimit: dto.approvalLimit ?? null } : {}),
        ...(dto.closeOnApplicationLimit !== undefined ? { closeOnApplicationLimit: dto.closeOnApplicationLimit } : {}),
        ...(dto.closeOnApprovalLimit !== undefined ? { closeOnApprovalLimit: dto.closeOnApprovalLimit } : {}),
        ...(publish && !current.publishedAt ? { publishedAt: new Date() } : {}),
        ...(status === CampaignStatus.CLOSED ? { closedAt: new Date() } : status === CampaignStatus.PUBLISHED ? { closedAt: null } : {}),
      };
    const campaign = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "campaigns" WHERE id = CAST(${id} AS uuid) FOR UPDATE`;
      return transaction.campaign.update({ where: { id }, data: campaignData, include: campaignInclude });
    });
    return this.serializeCampaign(campaign, user);
  }

  async archive(user: AuthPrincipal, id: string) {
    this.assertBrand(user);
    const campaign = await this.prisma.campaign.updateMany({ where: { id, brandId: user.userId }, data: { status: CampaignStatus.ARCHIVED, closedAt: new Date() } });
    if (!campaign.count) throw new NotFoundException("Campaign not found");
    return this.get(user, id);
  }

  async matches(user: AuthPrincipal, campaignId: string) {
    this.assertBrand(user);
    const campaign = await this.findOwned(user.userId, campaignId);
    const creators = await this.prisma.user.findMany({
      where: { id: { not: user.userId, notIn: await this.blockedUserIds(user.userId) }, role: UserRole.CREATOR, status: "ACTIVE", profile: { isNot: null } },
      include: { profile: true, socialAccounts: { orderBy: { createdAt: "asc" } }, receivedCampaignReviews: { include: { author: { include: { profile: true } } }, orderBy: { createdAt: "desc" }, take: 50 } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return creators
      .map((creator) => ({ creator, score: scoreCreator(campaign, creator as ApplicationRecord["creator"]) }))
      .filter((item) => item.score.score >= MATCH_THRESHOLD)
      .map(({ creator, score }) => ({ ...this.serializeCreator(creator), ...score }))
      .sort((a, b) => b.score - a.score);
  }

  async apply(user: AuthPrincipal, campaignId: string, dto: CreateCampaignApplicationDto) {
    this.assertCreator(user);
    const campaign = await this.findPublicCampaign(campaignId, user.userId);
    if (campaign.deadlineAt && campaign.deadlineAt.getTime() <= Date.now()) throw new BadRequestException("This campaign deadline has passed");
    const creator = await this.prisma.user.findUnique({ where: { id: user.userId }, include: { profile: true, socialAccounts: { orderBy: { createdAt: "asc" } } } });
    if (!creator || !meetsMinimumFollowers(campaign, creator as ApplicationRecord["creator"])) throw new ForbiddenException("Your follower count does not meet this campaign's minimum requirement");
    this.assertApplicationCapacity(campaign);
    const application = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "campaigns" WHERE id = CAST(${campaignId} AS uuid) FOR UPDATE`;
      const lockedCampaign = await transaction.campaign.findUnique({ where: { id: campaignId }, include: campaignInclude });
      if (!lockedCampaign || !this.isDiscoverable(lockedCampaign)) throw new ConflictException("This campaign is no longer accepting applications");
      this.assertApplicationCapacity(lockedCampaign);
      const existing = await transaction.campaignApplication.findUnique({ where: { campaignId_creatorId: { campaignId, creatorId: user.userId } } });
      if (existing && existing.status !== CampaignApplicationStatus.DECLINED && existing.status !== CampaignApplicationStatus.WITHDRAWN) throw new ConflictException("You already applied to this campaign");
      const saved = await transaction.campaignApplication.upsert({
        where: { campaignId_creatorId: { campaignId, creatorId: user.userId } },
        create: { campaignId, creatorId: user.userId, message: dto.message?.trim() ?? "", responses: jsonInput(dto.responses ?? {}), attachments: jsonInput(dto.attachments ?? []), contactShared: dto.contactShared === true },
        update: { status: CampaignApplicationStatus.PENDING, invitedByBrand: false, message: dto.message?.trim() ?? "", responses: jsonInput(dto.responses ?? {}), attachments: jsonInput(dto.attachments ?? []), contactShared: dto.contactShared === true, rejectionReason: null, allowReapply: false },
        include: applicationInclude,
      });
      const event = await transaction.campaignApplicationEvent.create({
        data: {
          applicationId: saved.id,
          campaignId,
          creatorId: user.userId,
          actorId: user.userId,
          actorRole: UserRole.CREATOR,
          status: CampaignApplicationStatus.PENDING,
          invitedByBrand: false,
        },
      });
      return { ...saved, history: [...saved.history, event] };
    });
    const conversationId = await this.resolveConversationId(application.creatorId, campaign.brandId, application.id);
    const message = await this.persistApplicationMessage(conversationId, user.userId, application.message, dto.attachments, application.id);
    if (conversationId !== application.id && message) this.broadcastApplicationMessage(message, conversationId, application.id, user.userId, campaign.brandId, UserRole.CREATOR);
    await this.notify(campaign.brandId, "New campaign application", `${application.creator.profile?.displayName || "A creator"} applied to ${campaign.title}.`, { campaignId, applicationId: application.id, conversationId, event: "created", status: CampaignApplicationStatus.PENDING });
    this.realtime.send(campaign.brandId, { type: "campaign.application.created", applicationId: application.id, conversationId, campaignId, status: CampaignApplicationStatus.PENDING });
    return this.serializeApplication(application, campaign, conversationId);
  }

  async invite(user: AuthPrincipal, campaignId: string, dto: InviteCampaignCreatorDto) {
    this.assertBrand(user);
    const campaign = await this.findOwned(user.userId, campaignId);
    if (campaign.status !== CampaignStatus.PUBLISHED || (campaign.deadlineAt && campaign.deadlineAt.getTime() <= Date.now())) throw new BadRequestException("Publish the campaign with a future deadline before inviting creators");
    const creator = await this.prisma.user.findFirst({ where: { id: dto.creatorId, role: UserRole.CREATOR, status: "ACTIVE" }, include: { profile: true, socialAccounts: { orderBy: { createdAt: "asc" } } } });
    if (!creator) throw new NotFoundException("Creator not found");
    if ((await this.blockedUserIds(user.userId)).includes(creator.id)) throw new NotFoundException("Creator not found");
    if (!isCreatorMatch(campaign, creator as ApplicationRecord["creator"])) throw new ForbiddenException("This creator does not match the campaign");
    this.assertApplicationCapacity(campaign);
    const application = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "campaigns" WHERE id = CAST(${campaignId} AS uuid) FOR UPDATE`;
      const lockedCampaign = await transaction.campaign.findUnique({ where: { id: campaignId }, include: campaignInclude });
      if (!lockedCampaign) throw new NotFoundException("Campaign not found");
      this.assertApplicationCapacity(lockedCampaign);
      const existing = await transaction.campaignApplication.findUnique({ where: { campaignId_creatorId: { campaignId, creatorId: dto.creatorId } } });
      if (existing && existing.status !== CampaignApplicationStatus.DECLINED && existing.status !== CampaignApplicationStatus.WITHDRAWN) throw new ConflictException("Campaign already sent to this creator");
      const saved = await transaction.campaignApplication.upsert({
        where: { campaignId_creatorId: { campaignId, creatorId: dto.creatorId } },
        create: { campaignId, creatorId: dto.creatorId, invitedByBrand: true, message: dto.message?.trim() || `Campaign invitation for ${campaign.title}`, responses: {}, attachments: [] },
        update: { status: CampaignApplicationStatus.PENDING, invitedByBrand: true, message: dto.message?.trim() || `Campaign invitation for ${campaign.title}`, responses: {}, attachments: [], rejectionReason: null, allowReapply: false },
        include: applicationInclude,
      });
      const event = await transaction.campaignApplicationEvent.create({
        data: {
          applicationId: saved.id,
          campaignId,
          creatorId: dto.creatorId,
          actorId: user.userId,
          actorRole: UserRole.BRAND,
          status: CampaignApplicationStatus.PENDING,
          invitedByBrand: true,
        },
      });
      return { ...saved, history: [...saved.history, event] };
    });
    const conversationId = await this.resolveConversationId(application.creatorId, campaign.brandId, application.id);
    const message = await this.persistApplicationMessage(conversationId, user.userId, application.message, [], application.id);
    if (conversationId !== application.id && message) this.broadcastApplicationMessage(message, conversationId, application.id, user.userId, dto.creatorId, UserRole.BRAND);
    await this.notify(dto.creatorId, "New campaign invitation", `${campaign.brand.profile?.displayName || "A brand"} invited you to ${campaign.title}.`, { campaignId, applicationId: application.id, conversationId, event: "created", status: CampaignApplicationStatus.PENDING });
    this.realtime.send(dto.creatorId, { type: "campaign.application.created", applicationId: application.id, conversationId, campaignId, status: CampaignApplicationStatus.PENDING });
    return this.serializeApplication(application, campaign, conversationId);
  }

  async updateApplication(user: AuthPrincipal, applicationId: string, dto: UpdateCampaignApplicationDto) {
    const application = await this.prisma.campaignApplication.findUnique({ where: { id: applicationId }, include: { ...applicationInclude, campaign: { include: { brand: campaignInclude.brand } } } });
    if (!application) throw new NotFoundException("Campaign application not found");
    const isBrand = application.campaign.brandId === user.userId && user.role === "BRAND";
    const isCreator = application.creatorId === user.userId && user.role === "CREATOR";
    if (!isBrand && !isCreator) throw new ForbiddenException("You cannot update this application");
    const canReview = (isBrand && !application.invitedByBrand) || (isCreator && application.invitedByBrand);
    const canWithdraw = (isBrand && application.invitedByBrand) || (isCreator && !application.invitedByBrand);
    if ((dto.status === "ACCEPTED" || dto.status === "DECLINED") && !canReview) throw new ForbiddenException("Only the receiving side can approve or decline this application");
    if (dto.status === "WITHDRAWN" && !canWithdraw) throw new ForbiddenException("Only the sender can withdraw this application");
    const nextStatus = dto.status as CampaignApplicationStatus;
    if (application.status === CampaignApplicationStatus.ACCEPTED && nextStatus !== CampaignApplicationStatus.ACCEPTED) throw new ConflictException("Accepted collaborations stay open; block the profile to stop chat");
    if (nextStatus === CampaignApplicationStatus.ACCEPTED && application.campaign.deadlineAt && application.campaign.deadlineAt.getTime() <= Date.now()) throw new BadRequestException("This campaign deadline has passed");
    const updated = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "campaigns" WHERE id = CAST(${application.campaignId} AS uuid) FOR UPDATE`;
      if (nextStatus === CampaignApplicationStatus.ACCEPTED && application.status !== CampaignApplicationStatus.ACCEPTED) {
        const campaign = await transaction.campaign.findUnique({ where: { id: application.campaignId }, select: { visibility: true, approvalLimit: true } });
        if (!campaign) throw new NotFoundException("Campaign not found");
        if (campaign.visibility === CampaignVisibility.PRIVATE) throw new ConflictException("This campaign is private and can no longer be accepted");
        if (campaign.approvalLimit !== null) {
          const approvedCount = await transaction.campaignApplication.count({ where: { campaignId: application.campaignId, status: CampaignApplicationStatus.ACCEPTED, id: { not: applicationId } } });
          if (approvedCount >= campaign.approvalLimit) throw new ConflictException("This campaign has reached its approval limit");
        }
      }
      const saved = await transaction.campaignApplication.update({
        where: { id: applicationId },
        data: {
          status: nextStatus,
          ...(nextStatus === CampaignApplicationStatus.DECLINED ? { rejectionReason: dto.rejectionReason?.trim() || null, allowReapply: dto.allowReapply === true } : nextStatus === CampaignApplicationStatus.PENDING ? { rejectionReason: null, allowReapply: false } : {}),
        },
        include: applicationInclude,
      });
      const event = await transaction.campaignApplicationEvent.create({
        data: {
          applicationId,
          campaignId: application.campaignId,
          creatorId: application.creatorId,
          actorId: user.userId,
          actorRole: isBrand ? UserRole.BRAND : UserRole.CREATOR,
          status: nextStatus,
          invitedByBrand: application.invitedByBrand,
          rejectionReason: nextStatus === CampaignApplicationStatus.DECLINED ? dto.rejectionReason?.trim() || null : null,
        },
      });
      return { ...saved, history: [...saved.history, event] };
    });
    const conversationId = await this.resolveConversationId(application.creatorId, application.campaign.brandId, application.id);
    const notifyUserId = isBrand ? application.creatorId : application.campaign.brandId;
    const reapplyText = nextStatus === CampaignApplicationStatus.DECLINED && dto.allowReapply === true ? " You can apply again." : "";
    await this.notify(notifyUserId, `Campaign application ${nextStatus.toLowerCase()}`, `${application.campaign.title} was updated to ${nextStatus.toLowerCase()}.${reapplyText}`, { campaignId: application.campaignId, applicationId, conversationId, event: "updated", status: nextStatus });
    this.realtime.send(application.creatorId, { type: "campaign.application.updated", applicationId, conversationId, campaignId: application.campaignId, status: nextStatus });
    this.realtime.send(application.campaign.brandId, { type: "campaign.application.updated", applicationId, conversationId, campaignId: application.campaignId, status: nextStatus });
    return this.serializeApplication(updated, application.campaign, conversationId);
  }

  async completeApplication(user: AuthPrincipal, applicationId: string) {
    const application = await this.prisma.campaignApplication.findUnique({ where: { id: applicationId }, include: { campaign: true } });
    if (!application) throw new NotFoundException("Campaign application not found");
    const isBrand = user.role === "BRAND" && application.campaign.brandId === user.userId;
    const isCreator = user.role === "CREATOR" && application.creatorId === user.userId;
    if (!isBrand && !isCreator) throw new ForbiddenException("Only collaboration participants can confirm completion");
    if (application.status !== CampaignApplicationStatus.ACCEPTED) throw new ConflictException("Only accepted collaborations can be completed");
    const updated = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "campaign_applications" WHERE id = CAST(${applicationId} AS uuid) FOR UPDATE`;
      const current = await transaction.campaignApplication.findUniqueOrThrow({ where: { id: applicationId } });
      const now = new Date();
      const brandCompletedAt = isBrand ? current.brandCompletedAt ?? now : current.brandCompletedAt;
      const creatorCompletedAt = isCreator ? current.creatorCompletedAt ?? now : current.creatorCompletedAt;
      return transaction.campaignApplication.update({
        where: { id: applicationId },
        data: { brandCompletedAt, creatorCompletedAt, completedAt: brandCompletedAt && creatorCompletedAt ? current.completedAt ?? now : null },
        select: { id: true, completedAt: true, brandCompletedAt: true, creatorCompletedAt: true },
      });
    });
    const otherUserId = isBrand ? application.creatorId : application.campaign.brandId;
    await this.notify(otherUserId, updated.completedAt ? "Collaboration completed" : "Confirm collaboration completion", updated.completedAt ? `${application.campaign.title} is complete. Reviews are now available in your collaboration chat.` : `${application.campaign.title} is marked complete. Confirm it in your collaboration chat to unlock reviews.`, { campaignId: application.campaignId, applicationId, event: updated.completedAt ? "completed" : "completion-confirmation" });
    this.realtime.send(otherUserId, { type: "campaign.application.completion", applicationId, completedAt: updated.completedAt?.toISOString() ?? null, brandConfirmed: Boolean(updated.brandCompletedAt), creatorConfirmed: Boolean(updated.creatorCompletedAt) });
    return { applicationId, completedAt: updated.completedAt?.toISOString() ?? null, brandConfirmed: Boolean(updated.brandCompletedAt), creatorConfirmed: Boolean(updated.creatorCompletedAt) };
  }

  async createReview(user: AuthPrincipal, applicationId: string, dto: CreateCampaignReviewDto) {
    const application = await this.prisma.campaignApplication.findUnique({ where: { id: applicationId }, include: { campaign: true } });
    if (!application) throw new NotFoundException("Campaign application not found");
    if (!application.completedAt) throw new ConflictException("Both participants must confirm completion before reviewing");
    const isBrand = user.role === "BRAND" && application.campaign.brandId === user.userId;
    const isCreator = user.role === "CREATOR" && application.creatorId === user.userId;
    if (!isBrand && !isCreator) throw new ForbiddenException("Only collaboration participants can review each other");
    try {
      const review = await this.prisma.campaignReview.create({
        data: { applicationId, authorId: user.userId, subjectId: isBrand ? application.creatorId : application.campaign.brandId, rating: dto.rating, text: dto.text.trim() },
        include: { author: { include: { profile: true } } },
      });
      return { id: review.id, applicationId, authorId: review.authorId, author: review.author.profile?.displayName || "User", subjectId: review.subjectId, rating: review.rating, text: review.text, createdAt: review.createdAt.toISOString() };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("You have already reviewed this collaboration");
      throw error;
    }
  }

  async updatePayment(user: AuthPrincipal, applicationId: string, dto: UpdateCampaignPaymentDto) {
    if (user.role !== "BRAND") throw new ForbiddenException("Only the brand can update payment records");
    const application = await this.prisma.campaignApplication.findFirst({ where: { id: applicationId, campaign: { brandId: user.userId } }, select: { id: true, status: true } });
    if (!application) throw new NotFoundException("Campaign application not found");
    if (application.status !== CampaignApplicationStatus.ACCEPTED) throw new ConflictException("Payment records are available for accepted collaborations");
    const payment = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.campaignPayment.findUnique({ where: { applicationId }, select: { paidAt: true } });
      return transaction.campaignPayment.upsert({
        where: { applicationId },
        create: { applicationId, amount: new Prisma.Decimal(dto.amount), paidAt: dto.paid ? new Date() : null },
        update: { amount: new Prisma.Decimal(dto.amount), paidAt: dto.paid ? current?.paidAt ?? new Date() : null },
      });
    });
    return { applicationId, amount: payment.amount.toFixed(2), paidAt: payment.paidAt?.toISOString() ?? null, updatedAt: payment.updatedAt.toISOString() };
  }

  private async closeExpiredCampaigns() {
    await this.prisma.campaign.updateMany({ where: { status: CampaignStatus.PUBLISHED, deadlineAt: { lt: new Date() } }, data: { status: CampaignStatus.CLOSED, closedAt: new Date() } });
  }

  private async findOwned(brandId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, brandId }, include: campaignInclude });
    if (!campaign) throw new NotFoundException("Campaign not found");
    return campaign;
  }

  private async findAccessible(user: AuthPrincipal, id: string) {
    const blockedUserIds = user.role === "CREATOR" ? await this.blockedUserIds(user.userId) : [];
    const campaign = await this.prisma.campaign.findFirst({ where: user.role === "BRAND" ? { id, brandId: user.userId } : { id, ...(blockedUserIds.length ? { brandId: { notIn: blockedUserIds } } : {}), OR: [{ status: CampaignStatus.PUBLISHED, visibility: CampaignVisibility.PUBLIC }, { applications: { some: { creatorId: user.userId } } }] }, include: campaignInclude });
    if (!campaign) throw new NotFoundException("Campaign not found");
    return campaign;
  }

  private async findPublicCampaign(id: string, creatorId: string) {
    const blockedBrandIds = await this.blockedUserIds(creatorId);
    const campaign = await this.prisma.campaign.findFirst({ where: { id, status: CampaignStatus.PUBLISHED, visibility: CampaignVisibility.PUBLIC, ...(blockedBrandIds.length ? { brandId: { notIn: blockedBrandIds } } : {}) }, include: campaignInclude });
    if (!campaign) throw new NotFoundException("Campaign is not available");
    return campaign;
  }

  private locations(dto: Pick<CreateCampaignDto, "targetLocations" | "city">) {
    const locations = (dto.targetLocations ?? []).map((value) => value.trim()).filter(Boolean);
    if (locations.length) return Array.from(new Set(locations));
    return [dto.city?.trim() || "Pan India"];
  }

  private async blockedUserIds(userId: string) {
    const rows = await this.prisma.profileInteraction.findMany({
      where: { type: "BLOCKED", OR: [{ ownerId: userId }, { targetId: userId }] },
      select: { ownerId: true, targetId: true },
    });
    return rows.map((row) => row.ownerId === userId ? row.targetId : row.ownerId);
  }

  private assertBrand(user: AuthPrincipal) { if (user.role !== "BRAND") throw new ForbiddenException("Brand access required"); }
  private assertCreator(user: AuthPrincipal) { if (user.role !== "CREATOR") throw new ForbiddenException("Creator access required"); }

  private serializeCampaign(campaign: CampaignRecord, viewer: AuthPrincipal, creatorOverride?: ApplicationRecord["creator"] | null) {
    const deadline = campaign.deadlineAt?.toISOString() ?? "";
    const mobileStatus = campaign.status === CampaignStatus.DRAFT ? "Draft" : campaign.status === CampaignStatus.PUBLISHED ? "Published" : campaign.status === CampaignStatus.CLOSED ? "Closed" : "Archived";
    const match = viewer.role === "CREATOR" ? campaign.applications.find((item) => item.creatorId === viewer.userId) : undefined;
    const creator = viewer.role === "CREATOR" ? match?.creator ?? creatorOverride : undefined;
    const matchData = creator ? scoreCreator(campaign, creator) : undefined;
    const activeCount = activeApplications(campaign).length;
    const approvedCount = approvedApplications(campaign).length;
    const applicationLimitReached = campaign.applicationLimit !== null && activeCount >= campaign.applicationLimit;
    const approvalLimitReached = campaign.approvalLimit !== null && approvedCount >= campaign.approvalLimit;
    return {
      id: campaign.id,
      brandId: campaign.brandId,
      brandInitials: this.initials(campaign.brand.profile?.displayName || "Brand"),
      brand: campaign.brand.profile?.displayName || "Brand",
      title: campaign.title,
      description: campaign.description,
      city: strings(campaign.targetLocations)[0] || "Pan India",
      targetLocations: strings(campaign.targetLocations),
      category: campaign.category,
      budget: campaign.budget,
      deadline: deadline || "Flexible",
      deadlineAt: campaign.deadlineAt?.toISOString() ?? null,
      status: mobileStatus,
      platforms: strings(campaign.platforms),
      deliverables: campaign.deliverables,
      requirements: strings(campaign.requirements),
      creatorRequirements: campaign.creatorRequirements,
      media: objects(campaign.media),
      brandDescription: campaign.brand.profile?.bio || "",
      brandLogoUrl: campaign.brand.profile?.avatarUrl || undefined,
      brandReviews: campaign.brand.receivedCampaignReviews.map((review) => ({ id: review.id, creatorName: review.author.profile?.displayName || "User", rating: review.rating, text: review.text, date: review.createdAt.toISOString() })),
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      publishedAt: campaign.publishedAt?.toISOString(),
      archived: campaign.status === CampaignStatus.ARCHIVED,
      visibility: campaign.visibility === CampaignVisibility.PRIVATE ? "private" : "public",
      collaborationVideoUrl: campaign.collaborationVideoUrl || undefined,
      collaborationVideoLabel: campaign.collaborationVideoLabel || undefined,
      applicationCount: activeCount,
      applicationLimit: campaign.applicationLimit ?? undefined,
      minimumFollowers: campaign.minimumFollowers ?? undefined,
      minimumFollowersMet: viewer.role !== "CREATOR" || Boolean(creator && meetsMinimumFollowers(campaign, creator as ApplicationRecord["creator"])),
      approvalLimit: campaign.approvalLimit ?? undefined,
      approvedCount,
      applicationsOpen: this.isDiscoverable(campaign),
      applicationLimitReached,
      approvalLimitReached,
      closeOnApplicationLimit: campaign.closeOnApplicationLimit,
      closeOnApprovalLimit: campaign.closeOnApprovalLimit,
      applicationStatus: match?.status ? this.mobileApplicationStatus(match.status) : undefined,
      matchScore: matchData?.score,
      matchReasons: matchData?.reasons,
    };
  }

  private serializeApplication(application: ApplicationRecord, campaign: Pick<CampaignRecord, "id" | "brandId" | "title" | "brand">, conversationId = application.id) {
    const creator = application.creator;
    const creatorProfile = this.serializeCreator(creator);
    return {
      id: application.id,
      briefId: campaign.id,
      campaignId: campaign.id,
      brandId: campaign.brandId,
      briefTitle: campaign.title,
      brandName: campaign.brand.profile?.displayName || "Brand",
      brandInitials: this.initials(campaign.brand.profile?.displayName || "Brand"),
      creatorId: application.creatorId,
      creatorName: creator.profile?.displayName || "Creator",
      creatorInitials: this.initials(creator.profile?.displayName || "Creator"),
      creatorProfile,
      contactShared: application.contactShared,
      responses: application.responses as Record<string, string>,
      attachments: objects(application.attachments),
      status: this.mobileApplicationStatus(application.status),
      completedAt: application.completedAt?.toISOString() ?? null,
      completionConfirmedBy: { brand: Boolean(application.brandCompletedAt), creator: Boolean(application.creatorCompletedAt) },
      payment: application.payment ? { amount: application.payment.amount.toFixed(2), paidAt: application.payment.paidAt?.toISOString() ?? null, updatedAt: application.payment.updatedAt.toISOString() } : null,
      reviews: application.reviews.map((review) => ({ id: review.id, authorId: review.authorId, author: review.author.profile?.displayName || "User", subjectId: review.subjectId, subject: review.subject.profile?.displayName || "User", rating: review.rating, text: review.text, createdAt: review.createdAt.toISOString() })),
      submittedAt: application.submittedAt.toISOString(),
      conversationId,
      message: application.message,
      direction: application.invitedByBrand ? "brand-to-creator" : "creator-to-brand",
      rejectionReason: application.rejectionReason ?? undefined,
      canReapply: application.status === CampaignApplicationStatus.DECLINED && application.allowReapply,
      history: application.history.map((event) => ({
        id: event.id,
        status: this.mobileApplicationStatus(event.status),
        actorId: event.actorId,
        actorRole: event.actorRole === UserRole.BRAND ? "Brand" : "Influencer",
        invitedByBrand: event.invitedByBrand,
        rejectionReason: event.rejectionReason ?? undefined,
        occurredAt: event.occurredAt.toISOString(),
      })),
    };
  }

  private serializeCreator(creator: ApplicationRecord["creator"]) {
    const profile = creator.profile;
    return {
      id: creator.id,
      name: profile?.displayName || "Creator",
      initials: this.initials(profile?.displayName || "Creator"),
      avatarUrl: profile?.avatarUrl || undefined,
      city: profile?.city || "India",
      state: "",
      niche: profile?.focus || "Creator",
      rating: creator.receivedCampaignReviews.length ? creator.receivedCampaignReviews.reduce((sum, review) => sum + review.rating, 0) / creator.receivedCampaignReviews.length : 0,
      reviews: creator.receivedCampaignReviews.length,
      reviewItems: creator.receivedCampaignReviews.map((review) => ({ id: review.id, author: review.author.profile?.displayName || "User", rating: review.rating, text: review.text, date: review.createdAt.toISOString() })),
      followers: profile?.audienceSize || "Growing audience",
      price: profile?.rateRange || "Discussed privately",
      platforms: creator.socialAccounts.map((account) => account.platform),
      contentTypes: [],
      bio: profile?.bio || "",
      socialAccounts: Object.fromEntries(creator.socialAccounts.map((account) => [account.platform, account.profileUrl || account.handle])),
    };
  }

  private mobileApplicationStatus(status: CampaignApplicationStatus) {
    return status === CampaignApplicationStatus.ACCEPTED ? "Accepted" : status === CampaignApplicationStatus.DECLINED ? "Declined" : status === CampaignApplicationStatus.WITHDRAWN ? "Declined" : "Pending";
  }

  private initials(value: string) {
    return value.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "BR";
  }

  private isDiscoverable(campaign: CampaignRecord) {
    if (campaign.status !== CampaignStatus.PUBLISHED || campaign.visibility !== CampaignVisibility.PUBLIC) return false;
    if (campaign.deadlineAt && campaign.deadlineAt.getTime() <= Date.now()) return false;
    const reached = campaign.applicationLimit !== null && activeApplications(campaign).length >= campaign.applicationLimit;
    const approvalReached = campaign.approvalLimit !== null && approvedApplications(campaign).length >= campaign.approvalLimit;
    return !((reached && campaign.closeOnApplicationLimit) || (approvalReached && campaign.closeOnApprovalLimit));
  }

  private assertApplicationCapacity(campaign: CampaignRecord) {
    if (campaign.applicationLimit !== null && activeApplications(campaign).length >= campaign.applicationLimit) throw new ConflictException("This campaign is no longer accepting applications");
  }

  private async notify(userId: string, title: string, body: string, data: Record<string, string>) {
    try { await this.notifications.create(userId, { type: "CAMPAIGN_UPDATE", title, body, data, channels: ["PUSH"] }); } catch { /* Campaign state remains durable if push is unavailable. */ }
  }

  private async resolveConversationId(creatorId: string, brandId: string, fallbackId: string) {
    const accepted = await this.prisma.campaignApplication.findFirst({
      where: { status: CampaignApplicationStatus.ACCEPTED, creatorId, campaign: { brandId } },
      select: { id: true },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
    });
    return accepted?.id ?? fallbackId;
  }

  private async persistApplicationMessage(conversationId: string, senderId: string, message?: string, attachments?: Record<string, unknown>[], campaignApplicationId?: string): Promise<ApplicationMessageRecord | null> {
    const text = message?.trim() ?? "";
    const saved = await this.prisma.chatMessage.upsert({
      where: { applicationId_senderId_clientMessageId: { applicationId: conversationId, senderId, clientMessageId: `application:${campaignApplicationId ?? conversationId}` } },
      create: { applicationId: conversationId, senderId, clientMessageId: `application:${campaignApplicationId ?? conversationId}`, campaignApplicationId: campaignApplicationId ?? conversationId, text, attachments: attachments?.length ? attachments as Prisma.InputJsonValue : undefined, deliveredAt: new Date() },
      update: { text, campaignApplicationId: campaignApplicationId ?? conversationId, attachments: attachments?.length ? attachments as Prisma.InputJsonValue : undefined },
      select: applicationMessageSelect,
    });
    await this.prisma.campaignApplication.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    return saved;
  }

  private broadcastApplicationMessage(message: ApplicationMessageRecord, conversationId: string, campaignApplicationId: string, senderId: string, recipientId: string, senderRole: UserRole) {
    const serialize = (viewerId: string) => ({
      id: message.id,
      clientMessageId: message.clientMessageId ?? undefined,
      text: message.text,
      mine: message.senderId === viewerId,
      senderId: message.senderId,
      senderRole: senderRole === UserRole.BRAND ? "Brand" : "Influencer",
      time: new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(message.createdAt),
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
      status: "delivered",
      attachments: objects(message.attachments),
      campaignRequestId: campaignApplicationId,
    });
    this.realtime.send(recipientId, { type: "message.created", conversationId, message: serialize(recipientId) });
    this.realtime.send(senderId, { type: "message.created", conversationId, message: serialize(senderId) });
  }
}
