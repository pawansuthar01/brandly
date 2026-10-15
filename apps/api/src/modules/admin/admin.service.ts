import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/database/prisma.service.js";
import { ChatRealtimeService } from "../chat/chat.realtime.js";

function mediaFiles(value: Prisma.JsonValue): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Prisma.JsonObject => Boolean(item && typeof item === "object" && !Array.isArray(item) && typeof item.url === "string"));
}

function jsonStrings(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function jsonRecord(value: Prisma.JsonValue): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}

type AdminCampaignRecord = Prisma.CampaignGetPayload<{
  include: { brand: { include: { profile: true } }; _count: { select: { applications: true } } };
}>;
type AdminApplicationRecord = Prisma.CampaignApplicationGetPayload<{
  include: { campaign: { include: { brand: { include: { profile: true } } } }; creator: { include: { profile: true } } };
}>;

function campaignRecord(campaign: AdminCampaignRecord) {
  const targetLocations = jsonStrings(campaign.targetLocations);
  const status = campaign.status === "ARCHIVED" ? "Archived"
    : campaign.status === "CLOSED" ? "Completed"
      : campaign.status === "DRAFT" ? "Draft"
        : campaign.visibility === "PRIVATE" ? "Private"
          : campaign.status === "PUBLISHED" ? "Published" : "Active";
  return {
    id: campaign.id,
    brandId: campaign.brandId,
    title: campaign.title,
    description: campaign.description,
    brand: campaign.brand.profile?.displayName || campaign.brand.email || "Brand",
    category: campaign.category,
    location: targetLocations.join(", ") || "Not specified",
    targetLocations,
    platforms: jsonStrings(campaign.platforms),
    status,
    proposals: campaign._count.applications,
    budget: campaign.budget,
    deadlineAt: campaign.deadlineAt?.toISOString() ?? null,
    deliverables: campaign.deliverables,
    requirements: jsonStrings(campaign.requirements),
    creatorRequirements: campaign.creatorRequirements,
    collaborationVideoUrl: campaign.collaborationVideoUrl,
    collaborationVideoLabel: campaign.collaborationVideoLabel,
    applicationLimit: campaign.applicationLimit,
    approvalLimit: campaign.approvalLimit,
    closeOnApplicationLimit: campaign.closeOnApplicationLimit,
    closeOnApprovalLimit: campaign.closeOnApprovalLimit,
    publishedAt: campaign.publishedAt?.toISOString() ?? null,
    closedAt: campaign.closedAt?.toISOString() ?? null,
    createdAt: campaign.createdAt.toISOString(),
    updated: campaign.updatedAt.toISOString(),
    media: mediaFiles(campaign.media),
  };
}

function applicationRecord(application: AdminApplicationRecord) {
  const responses = jsonRecord(application.responses);
  return {
    id: application.id,
    campaignId: application.campaignId,
    creatorId: application.creatorId,
    brandId: application.campaign.brandId,
    title: application.campaign.title,
    campaign: application.campaign.title,
    from: application.creator.profile?.displayName || application.creator.email || "Creator",
    to: application.campaign.brand.profile?.displayName || application.campaign.brand.email || "Brand",
    status: application.completedAt ? "Completed" : application.status === "PENDING" ? "New" : application.status === "ACCEPTED" ? "Accepted" : application.status === "WITHDRAWN" ? "Withdrawn" : "Declined",
    budget: typeof responses.budget === "string" || typeof responses.budget === "number" ? String(responses.budget) : "Not provided",
    invitedByBrand: application.invitedByBrand,
    submittedAt: application.submittedAt.toISOString(),
    completedAt: application.completedAt?.toISOString() ?? null,
    updated: application.updatedAt.toISOString(),
    hasMedia: mediaFiles(application.attachments).length > 0,
    media: mediaFiles(application.attachments),
  };
}

const applicationIncludes = {
  campaign: { include: { brand: { include: { profile: true } } } },
  creator: { include: { profile: true } },
} satisfies Prisma.CampaignApplicationInclude;

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
        location: user.profile?.city?.trim() || "Not provided",
        status: user.status === "SUSPENDED" ? "Suspended" : user.status === "ACTIVE" ? "Active" : user.status === "DELETED" ? "Deleted" : "Pending review",
        profileVisible: user.profile?.visibility === "PUBLIC",
        followers: user.profile?.audienceSize ?? "—",
        joined: user.createdAt.toISOString(),
        avatar: (user.profile?.displayName || user.email || "U").slice(0, 2).toUpperCase(),
        avatarUrl: user.profile?.avatarUrl ?? undefined,
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
      campaigns: campaigns.map(campaignRecord),
      proposals: applications.map(applicationRecord),
    };
  }

  async analytics(days: number) {
    const end = new Date();
    const from = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - days + 1));
    const previousFrom = new Date(from.getTime() - days * 86_400_000);
    const unit = days > 90 ? "month" : "day";
    const current = { gte: from, lte: end };
    const previous = { gte: previousFrom, lt: from };
    type TrendRow = { bucket: Date; count: number | bigint };
    const [
      totalUsers, activeUsers, brandUsers, creatorUsers, newUsers, previousNewUsers,
      newCampaigns, previousCampaigns, campaignStatuses,
      applications, previousApplications, applicationStatuses, completedApplications,
      payments, previousPayments, tasks, completedTasks, chatMessages, supportMessages,
      notifications, devices, profileCompletion, categories,
      userTrend, campaignTrend, applicationTrend, paymentTrend,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: { in: ["BRAND", "CREATOR"] }, status: { not: "DELETED" } } }),
      this.prisma.user.count({ where: { role: { in: ["BRAND", "CREATOR"] }, status: "ACTIVE" } }),
      this.prisma.user.count({ where: { role: "BRAND", status: { not: "DELETED" } } }),
      this.prisma.user.count({ where: { role: "CREATOR", status: { not: "DELETED" } } }),
      this.prisma.user.count({ where: { role: { in: ["BRAND", "CREATOR"] }, createdAt: current } }),
      this.prisma.user.count({ where: { role: { in: ["BRAND", "CREATOR"] }, createdAt: previous } }),
      this.prisma.campaign.count({ where: { createdAt: current } }),
      this.prisma.campaign.count({ where: { createdAt: previous } }),
      this.prisma.campaign.groupBy({ by: ["status"], where: { createdAt: current }, _count: { _all: true } }),
      this.prisma.campaignApplication.count({ where: { submittedAt: current } }),
      this.prisma.campaignApplication.count({ where: { submittedAt: previous } }),
      this.prisma.campaignApplication.groupBy({ by: ["status"], where: { submittedAt: current }, _count: { _all: true } }),
      this.prisma.campaignApplication.count({ where: { completedAt: current } }),
      this.prisma.campaignPayment.aggregate({ where: { paidAt: current }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.campaignPayment.aggregate({ where: { paidAt: previous }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.task.count({ where: { createdAt: current } }),
      this.prisma.task.count({ where: { completedAt: current } }),
      this.prisma.chatMessage.count({ where: { createdAt: current } }),
      this.prisma.adminChatMessage.count({ where: { createdAt: current } }),
      this.prisma.notification.count({ where: { createdAt: current } }),
      this.prisma.deviceToken.count({ where: { sessionActive: true } }),
      this.prisma.userProfile.aggregate({ _avg: { profileCompleted: true } }),
      this.prisma.campaign.groupBy({ by: ["category"], where: { createdAt: current }, _count: { _all: true } }),
      this.prisma.$queryRaw<TrendRow[]>(Prisma.sql`SELECT DATE_TRUNC(${unit}, "created_at") AS bucket, COUNT(*)::int AS count FROM "users" WHERE "role" IN ('BRAND', 'CREATOR') AND "created_at" >= ${from} AND "created_at" <= ${end} GROUP BY 1 ORDER BY 1`),
      this.prisma.$queryRaw<TrendRow[]>(Prisma.sql`SELECT DATE_TRUNC(${unit}, "created_at") AS bucket, COUNT(*)::int AS count FROM "campaigns" WHERE "created_at" >= ${from} AND "created_at" <= ${end} GROUP BY 1 ORDER BY 1`),
      this.prisma.$queryRaw<TrendRow[]>(Prisma.sql`SELECT DATE_TRUNC(${unit}, "submitted_at") AS bucket, COUNT(*)::int AS count FROM "campaign_applications" WHERE "submitted_at" >= ${from} AND "submitted_at" <= ${end} GROUP BY 1 ORDER BY 1`),
      this.prisma.$queryRaw<Array<{ bucket: Date; amount: Prisma.Decimal | null }>>(Prisma.sql`SELECT DATE_TRUNC(${unit}, "paid_at") AS bucket, SUM("amount") AS amount FROM "campaign_payments" WHERE "paid_at" >= ${from} AND "paid_at" <= ${end} GROUP BY 1 ORDER BY 1`),
    ]);
    const fillTrend = (rows: TrendRow[]) => {
      const values = new Map(rows.map((row) => [row.bucket.toISOString().slice(0, 10), Number(row.count)]));
      const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), unit === "month" ? 1 : from.getUTCDate()));
      const buckets: Array<{ date: string; value: number }> = [];
      while (cursor <= end) {
        const key = cursor.toISOString().slice(0, 10);
        buckets.push({ date: key, value: values.get(key) ?? 0 });
        if (unit === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        else cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      return buckets;
    };
    const statusRows = (rows: Array<{ status: string; _count: { _all: number } }>) => rows.map((row) => ({ label: row.status, value: row._count._all }));
    return {
      period: { days, from: from.toISOString(), to: end.toISOString(), bucket: unit },
      summary: {
        totalUsers, activeUsers, brands: brandUsers, creators: creatorUsers,
        newUsers, previousNewUsers, newCampaigns, previousCampaigns,
        applications, previousApplications,
        acceptedApplications: applicationStatuses.find((row) => row.status === "ACCEPTED")?._count._all ?? 0,
        completedApplications,
        paidAmount: Number(payments._sum.amount ?? 0), paidCount: payments._count._all,
        previousPaidAmount: Number(previousPayments._sum.amount ?? 0), previousPaidCount: previousPayments._count._all,
        tasks, completedTasks, chatMessages: chatMessages + supportMessages, notifications,
        registeredDevices: devices, averageProfileCompletion: Math.round(profileCompletion._avg.profileCompleted ?? 0),
      },
      trends: { users: fillTrend(userTrend), campaigns: fillTrend(campaignTrend), applications: fillTrend(applicationTrend), payments: fillTrend(paymentTrend.map((row) => ({ bucket: row.bucket, count: Number(row.amount ?? 0) }))) },
      breakdowns: {
        campaigns: statusRows(campaignStatuses),
        applications: statusRows(applicationStatuses),
        categories: categories.map((row) => ({ label: row.category, value: row._count._all })).sort((a, b) => b.value - a.value).slice(0, 8),
      },
    };
  }

  async campaignApplications(id: string, requestedTake = 20, requestedOffset = 0) {
    const take = Math.min(100, Math.max(1, Math.floor(requestedTake) || 20));
    const offset = Math.max(0, Math.floor(requestedOffset) || 0);
    const campaign = await this.prisma.campaign.findUnique({ where: { id }, select: { id: true, _count: { select: { applications: true } } } });
    if (!campaign) throw new NotFoundException("Campaign not found");
    const items = await this.prisma.campaignApplication.findMany({
      where: { campaignId: id },
      include: { campaign: { include: { brand: { include: { profile: true } } } }, creator: { include: { profile: true } } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: offset, take,
    });
    return { items: items.map(applicationRecord), total: campaign._count.applications, take, offset };
  }

  async proposals(requestedTake = 20, requestedOffset = 0, query = "", status = "All", media = "All") {
    const take = Math.min(100, Math.max(1, Math.floor(requestedTake) || 20));
    const offset = Math.max(0, Math.floor(requestedOffset) || 0);
    const search = query.trim();
    const where: Prisma.CampaignApplicationWhereInput = {};
    if (search) {
      const contains = { contains: search, mode: "insensitive" as const };
      const searchable: Prisma.CampaignApplicationWhereInput[] = [
        { message: contains },
        { campaign: { title: contains } },
        { creator: { email: contains } },
        { creator: { profile: { is: { displayName: contains } } } },
        { campaign: { brand: { email: contains } } },
        { campaign: { brand: { profile: { is: { displayName: contains } } } } },
      ];
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(search)) searchable.push({ id: search });
      where.OR = searchable;
    }
    if (status === "New") { where.status = "PENDING"; where.completedAt = null; }
    else if (status === "Accepted") { where.status = "ACCEPTED"; where.completedAt = null; }
    else if (status === "Declined") { where.status = "DECLINED"; where.completedAt = null; }
    else if (status === "Withdrawn") { where.status = "WITHDRAWN"; where.completedAt = null; }
    else if (status === "Completed") where.completedAt = { not: null };
    if (media === "With media") where.attachments = { not: [] };
    if (media === "No media") where.attachments = { equals: [] };

    const [items, total] = await Promise.all([
      this.prisma.campaignApplication.findMany({ where, include: applicationIncludes, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: offset, take }),
      this.prisma.campaignApplication.count({ where }),
    ]);
    return { items: items.map(applicationRecord), total, take, offset };
  }

  async proposal(id: string) {
    const application = await this.prisma.campaignApplication.findUnique({
      where: { id },
      include: {
        ...applicationIncludes,
        history: { orderBy: [{ occurredAt: "desc" }, { id: "desc" }] },
      },
    });
    if (!application) throw new NotFoundException("Proposal not found");
    const responses = jsonRecord(application.responses);
    return {
      ...applicationRecord(application),
      message: application.message,
      responses,
      contactShared: application.contactShared,
      rejectionReason: application.rejectionReason,
      allowReapply: application.allowReapply,
      brandCompletedAt: application.brandCompletedAt?.toISOString() ?? null,
      creatorCompletedAt: application.creatorCompletedAt?.toISOString() ?? null,
      campaignDetails: {
        description: application.campaign.description,
        category: application.campaign.category,
        budget: application.campaign.budget,
        deadlineAt: application.campaign.deadlineAt?.toISOString() ?? null,
        targetLocations: jsonStrings(application.campaign.targetLocations),
        platforms: jsonStrings(application.campaign.platforms),
        deliverables: application.campaign.deliverables,
        requirements: jsonStrings(application.campaign.requirements),
      },
      history: application.history.map((event) => ({
        id: event.id,
        actorId: event.actorId,
        actorRole: event.actorRole,
        status: event.status === "PENDING" ? "New" : event.status === "ACCEPTED" ? "Accepted" : event.status === "WITHDRAWN" ? "Withdrawn" : "Declined",
        invitedByBrand: event.invitedByBrand,
        rejectionReason: event.rejectionReason,
        occurredAt: event.occurredAt.toISOString(),
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
