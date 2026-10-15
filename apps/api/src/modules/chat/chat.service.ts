import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma, UserRole } from "@prisma/client";
import { isUUID } from "class-validator";
import { RedisService } from "../../common/cache/redis.service.js";
import { PrismaService } from "../../common/database/prisma.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import type { AuthPrincipal } from "../../common/auth/auth.types.js";
import { ChatRealtimeService } from "./chat.realtime.js";
import type { ChatPresenceDto, ChatTypingDto, CreateChatMessageDto, UpdateChatMessageDto } from "./chat.dto.js";

const CHAT_PRESENCE_TTL_SECONDS = 75;
const MAX_MESSAGE_ATTACHMENTS = 12;
const applicationInclude = {
  campaign: {
    select: {
      id: true,
      title: true,
      brandId: true,
      brand: { select: { profile: { select: { displayName: true, avatarUrl: true } } } },
    },
  },
  creator: { select: { id: true, role: true, profile: { select: { displayName: true, avatarUrl: true } } } },
} as const;
const messageInclude = {
  sender: { select: { id: true, role: true, profile: { select: { displayName: true } } } },
} as const;
const replyInclude = {
  id: true,
  applicationId: true,
  senderId: true,
  text: true,
  attachments: true,
  deletedAt: true,
  sender: { select: { id: true, profile: { select: { displayName: true } } } },
} as const;

type ApplicationRecord = Prisma.CampaignApplicationGetPayload<{ include: typeof applicationInclude }>;
type MessageRecord = Prisma.ChatMessageGetPayload<{ include: typeof messageInclude }>;
type ReplyRecord = Prisma.ChatMessageGetPayload<{ select: typeof replyInclude }>;

@Injectable()
export class ChatService {
  private readonly memoryPresence = new Map<string, { lastSeenAt: number; applicationId?: string }>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(ChatRealtimeService) private readonly realtime: ChatRealtimeService,
  ) {}

  async listConversations(user: AuthPrincipal, offset = 0, search = "") {
    if (user.role === "ADMIN") return [];
    const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
    // Resolve shared-chat anchors before paging, so multiple campaigns between
    // the same two people cannot split or duplicate their accepted conversation.
    const threads = await this.prisma.$queryRaw<Array<{ anchorId: string; latestId: string; applicationIds: string[] }>>(Prisma.sql`
      WITH owned AS (
        SELECT a.id, a.creator_id, a.status, a.submitted_at, a.updated_at, c.brand_id,
          c.title, p.display_name
        FROM campaign_applications a JOIN campaigns c ON c.id = a.campaign_id
        LEFT JOIN user_profiles p ON p.user_id = CASE WHEN ${user.role} = 'BRAND' THEN a.creator_id ELSE c.brand_id END
        WHERE ${user.role === "BRAND" ? Prisma.sql`c.brand_id = ${user.userId}::uuid` : Prisma.sql`a.creator_id = ${user.userId}::uuid`}
      ), anchors AS (
        SELECT DISTINCT ON (brand_id, creator_id) brand_id, creator_id, id
        FROM owned WHERE status = 'ACCEPTED' ORDER BY brand_id, creator_id, submitted_at, id
      ), grouped AS (
        SELECT COALESCE(anchor.id, o.id) AS "anchorId",
          (array_agg(o.id ORDER BY o.updated_at DESC, o.id DESC))[1] AS "latestId",
          array_agg(o.id) AS "applicationIds", max(o.updated_at) AS updated_at,
          bool_or(COALESCE(o.display_name, '') ILIKE ${`%${search.trim().slice(0, 120)}%`} OR o.title ILIKE ${`%${search.trim().slice(0, 120)}%`}) AS matches
        FROM owned o LEFT JOIN anchors anchor USING (brand_id, creator_id)
        GROUP BY COALESCE(anchor.id, o.id)
      ) SELECT "anchorId", "latestId", "applicationIds" FROM grouped WHERE matches
        ORDER BY updated_at DESC, "anchorId" DESC LIMIT 30 OFFSET ${safeOffset}
    `);
    if (!threads.length) return [];
    const applications = await this.prisma.campaignApplication.findMany({
      where: { id: { in: threads.flatMap((thread) => [thread.anchorId, thread.latestId]) } },
      include: {
        ...applicationInclude,
      },
      orderBy: { updatedAt: "desc" },
    });
    const messageApplications = await this.prisma.campaignApplication.findMany({
      where: { id: { in: threads.flatMap((thread) => thread.applicationIds) } },
      select: {
        id: true,
        chatMessages: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: { text: true, attachments: true, createdAt: true },
        },
      },
    });
    const lastByApplication = new Map(messageApplications.map((item) => [item.id, item.chatMessages[0]]));

    const unread = await this.prisma.chatMessage.groupBy({
      by: ["applicationId"], where: { applicationId: { in: threads.flatMap((thread) => thread.applicationIds) }, senderId: { not: user.userId }, readAt: null }, _count: { _all: true },
    });
    const unreadByApplication = new Map(unread.map((item) => [item.applicationId, item._count._all]));
    const byId = new Map(applications.map((item) => [item.id, item]));
    const participants = threads.map((thread) => this.participant(byId.get(thread.anchorId)!, user));
    const onlineIds = await this.onlineIds(participants.map((participant) => participant.id));
    const blockedRelations = participants.length ? await this.prisma.profileInteraction.findMany({
      where: { type: "BLOCKED", OR: [{ ownerId: user.userId, targetId: { in: participants.map((item) => item.id) } }, { targetId: user.userId, ownerId: { in: participants.map((item) => item.id) } }] },
      select: { ownerId: true, targetId: true },
    }) : [];
    return threads.map((thread) => {
      const anchor = byId.get(thread.anchorId)!;
      const latest = byId.get(thread.latestId)!;
      const unreadCount = thread.applicationIds.reduce((count, applicationId) => count + (unreadByApplication.get(applicationId) ?? 0), 0);
      const participant = this.participant(anchor, user);
      const blockedBy = blockedRelations.filter((item) => item.ownerId === participant.id || item.targetId === participant.id)
        .map((item) => item.ownerId === anchor.campaign.brandId ? "brand" as const : "creator" as const);
      const last = thread.applicationIds
        .map((applicationId) => lastByApplication.get(applicationId))
        .filter((message): message is NonNullable<typeof message> => Boolean(message))
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
      const preview = last?.text?.trim() || this.attachmentPreview(last?.attachments) || latest.message || "No messages yet";
      return {
        id: anchor.id,
        applicationId: anchor.id,
        campaignId: anchor.campaignId,
        brandId: anchor.campaign.brandId,
        creatorId: anchor.creatorId,
        participantName: participant.name,
        participantInitials: this.initials(participant.name),
        participantAvatarUrl: participant.avatarUrl,
        briefTitle: latest.campaign.title,
        preview,
        status: this.mobileStatus(anchor.status),
        blockedBy: Array.from(new Set(blockedBy)),
        updatedAt: (last?.createdAt && last.createdAt > latest.updatedAt ? last.createdAt : latest.updatedAt).toISOString(),
        unreadCount,
        online: onlineIds.has(participant.id),
      };
    });
  }

  async getMessages(user: AuthPrincipal, applicationId: string, limit = 30, before?: string) {
    const application = await this.conversationApplication(user, applicationId);
    applicationId = application.id;
    const accepted = application.status === "ACCEPTED";
    const blockedBy = await this.blockedBy(application.campaign.brandId, application.creatorId);
    const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
    const recentCutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    if (before && before !== "older" && !isUUID(before)) throw new BadRequestException("Invalid message cursor");
    const syncedAt = new Date().toISOString();
    const cursor = before && before !== "older" ? await this.prisma.chatMessage.findFirst({ where: { id: before, applicationId }, select: { id: true, createdAt: true } }) : null;
    if (before && before !== "older" && !cursor) throw new BadRequestException("Message cursor not found");
    const olderWindow = before === "older" || Boolean(cursor && cursor.createdAt < recentCutoff);
    const records = accepted
      ? await this.prisma.chatMessage.findMany({
          where: { applicationId, ...(olderWindow ? { createdAt: { lt: recentCutoff } } : { createdAt: { gte: recentCutoff } }), ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}) },
          include: messageInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: safeLimit + 1,
        })
      : [];
    const hasOlderHistory = accepted && !olderWindow && records.length <= safeLimit
      ? Boolean(await this.prisma.chatMessage.findFirst({ where: { applicationId, createdAt: { lt: recentCutoff } }, select: { id: true } }))
      : false;
    const hasMore = records.length > safeLimit || hasOlderHistory;
    const page = records.slice(0, safeLimit);
    page.reverse();
    const participant = this.participant(application, user);
    return {
      conversationId: application.id,
      applicationId: application.id,
      campaignId: application.campaignId,
      status: this.mobileStatus(application.status),
      canSend: accepted && !blockedBy.length,
      blockedBy,
      participant: { id: participant.id, name: participant.name, avatarUrl: participant.avatarUrl, online: await this.isOnline(participant.id) },
      messages: await this.serializeMessagesWithReplies(page, user.userId),
      hasMore,
      nextCursor: records.length > safeLimit ? page[0]?.id : hasOlderHistory ? "older" : undefined,
      syncedAt,
    };
  }

  async createMessage(user: AuthPrincipal, applicationId: string, dto: CreateChatMessageDto) {
    const application = await this.conversationApplication(user, applicationId);
    applicationId = application.id;
    this.assertAccepted(application);
    const content = dto.text?.trim() ?? "";
    const attachments = this.normalizeAttachments(dto.attachments);
    if (!content && !attachments.length) throw new BadRequestException("Add a message or attachment before sending");
    await this.assertCardReferences(user, application, dto);
    if (dto.replyToId && !await this.prisma.chatMessage.findFirst({ where: { id: dto.replyToId, applicationId } })) throw new BadRequestException("The replied message is not part of this chat");
    if ((await this.blockedBy(application.campaign.brandId, application.creatorId)).length) throw new ForbiddenException("Messaging is blocked for this collaboration");
    if (dto.clientMessageId) {
      const existing = await this.prisma.chatMessage.findFirst({ where: { applicationId, senderId: user.userId, clientMessageId: dto.clientMessageId }, include: messageInclude });
      if (existing) return this.serializeMessageWithReply(existing, user.userId);
    }
    const clientMessageId = dto.clientMessageId?.trim() || randomUUID();
    let record: MessageRecord;
    try {
      record = await this.prisma.$transaction(async (transaction) => {
        const saved = await transaction.chatMessage.create({ data: {
          applicationId,
          senderId: user.userId,
          clientMessageId,
          taskId: dto.taskId,
          campaignApplicationId: dto.campaignApplicationId,
          text: content,
          attachments: attachments.length ? (attachments as Prisma.InputJsonValue) : undefined,
          replyToId: dto.replyToId,
          deliveredAt: new Date(),
        }, include: messageInclude });
        await transaction.campaignApplication.update({ where: { id: applicationId }, data: { updatedAt: new Date() } });
        return saved;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const saved = await this.prisma.chatMessage.findUnique({ where: { applicationId_senderId_clientMessageId: { applicationId, senderId: user.userId, clientMessageId } }, include: messageInclude });
        if (saved) return this.serializeMessageWithReply(saved, user.userId);
      }
      throw error;
    }
    const recipientId = application.creatorId === user.userId ? application.campaign.brandId : application.creatorId;
    const reply = await this.loadReply(record);
    const serialized = this.serializeMessage(record, user.userId, reply);
    const recipientMessage = this.serializeMessage(record, recipientId, reply);
    this.realtime.send(recipientId, { type: "message.created", conversationId: application.id, message: recipientMessage });
    this.realtime.send(user.userId, { type: "message.created", conversationId: application.id, message: serialized });
    // Do not hold the message response on Redis presence or push delivery.
    // The message is already committed and realtime delivery is fire-and-forget;
    // notification delivery can finish independently without making chat feel slow.
    void this.notifyIfRecipientAway(recipientId, application.id, record.id, record.sender.profile?.displayName || "New message", content || this.attachmentPreview(attachments) || "Sent an attachment", attachments);
    return serialized;
  }

  private async notifyIfRecipientAway(recipientId: string, applicationId: string, messageId: string, senderName: string, body: string, attachments: Array<{ name: string; type: string; uri: string }> = []) {
    if (await this.isInConversation(recipientId, applicationId).catch(() => false)) return;
    const preview = attachments.find((attachment) => attachment.type === "image") ?? attachments[0];
    await this.notifications.create(recipientId, {
      type: "CHAT_MESSAGE",
      title: senderName,
      body,
      data: { type: "CHAT_MESSAGE", screen: "chat", applicationId, conversationId: applicationId, messageId, ...(preview ? { mediaUri: preview.uri, mediaType: preview.type, mediaName: preview.name } : {}) },
      channelId: "chat-messages",
      dedupeKey: `chat-message:${messageId}`,
      channels: ["PUSH"],
    }).catch(() => undefined);
  }

  async updateMessage(user: AuthPrincipal, applicationId: string, messageId: string, dto: UpdateChatMessageDto) {
    const application = await this.conversationApplication(user, applicationId);
    applicationId = application.id;
    this.assertAccepted(application);
    const current = await this.prisma.chatMessage.findFirst({ where: { id: messageId, applicationId, senderId: user.userId, deletedAt: null }, include: messageInclude });
    if (!current) throw new NotFoundException("Message not found");
    const content = dto.text?.trim() ?? current.text;
    const attachments = dto.attachments === undefined ? current.attachments : this.normalizeAttachments(dto.attachments);
    if (!content && !this.hasAttachments(attachments)) throw new BadRequestException("A message cannot be empty");
    const record = await this.prisma.chatMessage.update({ where: { id: current.id }, data: { text: content, attachments: attachments as Prisma.InputJsonValue, editedAt: new Date() }, include: messageInclude });
    const recipientId = application.creatorId === user.userId ? application.campaign.brandId : application.creatorId;
    const reply = await this.loadReply(record);
    this.realtime.send(recipientId, { type: "message.updated", conversationId: application.id, message: this.serializeMessage(record, recipientId, reply) });
    return this.serializeMessage(record, user.userId, reply);
  }

  async deleteMessage(user: AuthPrincipal, applicationId: string, messageId: string) {
    const application = await this.conversationApplication(user, applicationId);
    applicationId = application.id;
    this.assertAccepted(application);
    const current = await this.prisma.chatMessage.findFirst({ where: { id: messageId, applicationId, senderId: user.userId, deletedAt: null } });
    if (!current) throw new NotFoundException("Message not found");
    await this.prisma.chatMessage.update({ where: { id: current.id }, data: { text: "", attachments: [], deletedAt: new Date() } });
    const recipientId = application.creatorId === user.userId ? application.campaign.brandId : application.creatorId;
    this.realtime.send(recipientId, { type: "message.deleted", conversationId: application.id, messageId });
    return { id: messageId, deleted: true };
  }

  async markRead(user: AuthPrincipal, applicationId: string) {
    const application = await this.conversationApplication(user, applicationId);
    applicationId = application.id;
    this.assertAccepted(application);
    const result = await this.prisma.chatMessage.updateMany({ where: { applicationId, senderId: { not: user.userId }, readAt: null }, data: { readAt: new Date() } });
    const recipientId = application.creatorId === user.userId ? application.campaign.brandId : application.creatorId;
    if (result.count) this.realtime.send(recipientId, { type: "conversation.read", conversationId: application.id, readerId: user.userId });
    return { read: result.count };
  }

  async heartbeat(user: AuthPrincipal, dto: ChatPresenceDto) {
    const applications = dto.applicationId
      ? [await this.conversationApplication(user, dto.applicationId)]
      : await this.prisma.campaignApplication.findMany({
          where: user.role === "BRAND" ? { campaign: { brandId: user.userId }, status: "ACCEPTED" } : { creatorId: user.userId, status: "ACCEPTED" },
          include: applicationInclude,
        });
    await this.setPresence(user.userId, dto.applicationId ? applications[0]?.id : undefined);
    for (const application of applications) {
      const participant = this.participant(application, user);
      this.realtime.send(participant.id, {
        type: "presence",
        conversationId: application.id,
        userId: user.userId,
        online: true,
      });
    }
    return { online: true, expiresInSeconds: CHAT_PRESENCE_TTL_SECONDS };
  }

  async offline(user: AuthPrincipal) {
    const applications = await this.prisma.campaignApplication.findMany({
      where: user.role === "BRAND" ? { campaign: { brandId: user.userId }, status: "ACCEPTED" } : { creatorId: user.userId, status: "ACCEPTED" },
      include: applicationInclude,
    });
    await this.clearPresence(user.userId);
    for (const application of applications) {
      const participant = this.participant(application, user);
      this.realtime.send(participant.id, {
        type: "presence",
        conversationId: application.id,
        userId: user.userId,
        online: false,
      });
    }
    return { online: false };
  }

  async presence(user: AuthPrincipal, applicationId: string) {
    const application = await this.conversationApplication(user, applicationId);
    const participant = this.participant(application, user);
    return { userId: participant.id, online: await this.isOnline(participant.id) };
  }

  async typing(user: AuthPrincipal, dto: ChatTypingDto) {
    const application = await this.conversationApplication(user, dto.applicationId);
    this.assertAccepted(application);
    const recipientId = application.creatorId === user.userId ? application.campaign.brandId : application.creatorId;
    this.realtime.send(recipientId, {
      type: "typing",
      conversationId: application.id,
      userId: user.userId,
      typing: dto.typing,
    });
    return { typing: dto.typing };
  }

  private async authorizedApplication(user: AuthPrincipal, applicationId: string): Promise<ApplicationRecord> {
    if (!isUUID(applicationId)) throw new BadRequestException("Invalid conversation ID");
    const application = await this.prisma.campaignApplication.findUnique({ where: { id: applicationId }, include: applicationInclude });
    if (!application) throw new NotFoundException("Chat conversation not found");
    const isBrand = user.role === "BRAND" && application.campaign.brandId === user.userId;
    const isCreator = user.role === "CREATOR" && application.creatorId === user.userId;
    if (!isBrand && !isCreator) throw new ForbiddenException("You cannot access this chat");
    return application;
  }

  private async conversationApplication(user: AuthPrincipal, applicationId: string): Promise<ApplicationRecord> {
    const application = await this.authorizedApplication(user, applicationId);
    const accepted = await this.prisma.campaignApplication.findFirst({
      where: {
        status: "ACCEPTED",
        creatorId: application.creatorId,
        campaign: { brandId: application.campaign.brandId },
      },
      include: applicationInclude,
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
    });
    return accepted ?? application;
  }

  private assertAccepted(application: ApplicationRecord) {
    if (application.status !== "ACCEPTED") throw new ConflictException("Chat is available after the campaign application is accepted");
  }

  private participant(application: ApplicationRecord, user: AuthPrincipal) {
    if (application.creatorId === user.userId) {
      return { id: application.campaign.brandId, name: application.campaign.brand.profile?.displayName || "Brand", avatarUrl: application.campaign.brand.profile?.avatarUrl ?? null };
    }
    return { id: application.creatorId, name: application.creator.profile?.displayName || "Creator", avatarUrl: application.creator.profile?.avatarUrl ?? null };
  }

  private async blockedBy(brandId: string, creatorId: string): Promise<Array<"brand" | "creator">> {
    const rows = await this.prisma.profileInteraction.findMany({
      where: { type: "BLOCKED", OR: [{ ownerId: brandId, targetId: creatorId }, { ownerId: creatorId, targetId: brandId }] },
      select: { ownerId: true },
    });
    return rows.map((item) => item.ownerId === brandId ? "brand" : "creator");
  }

  private async serializeMessageWithReply(record: MessageRecord, viewerId: string) {
    return this.serializeMessage(record, viewerId, await this.loadReply(record));
  }

  private async serializeMessagesWithReplies(records: MessageRecord[], viewerId: string) {
    const replyIds = [...new Set(records.map((record) => record.replyToId).filter((id): id is string => Boolean(id)))];
    const replies = replyIds.length && records[0]
      ? await this.prisma.chatMessage.findMany({ where: { applicationId: records[0].applicationId, id: { in: replyIds } }, select: replyInclude })
      : [];
    const byId = new Map(replies.map((reply) => [reply.id, reply]));
    return records.map((record) => this.serializeMessage(record, viewerId, record.replyToId ? byId.get(record.replyToId) : undefined));
  }

  private loadReply(record: MessageRecord): Promise<ReplyRecord | null> {
    if (!record.replyToId) return Promise.resolve(null);
    return this.prisma.chatMessage.findFirst({
      where: { id: record.replyToId, applicationId: record.applicationId },
      select: replyInclude,
    });
  }

  private serializeMessage(record: MessageRecord, viewerId: string, reply?: ReplyRecord | null) {
    const attachments = Array.isArray(record.attachments) ? record.attachments : undefined;
    return {
      id: record.id,
      clientMessageId: record.clientMessageId ?? undefined,
      text: record.deletedAt ? "This message was deleted" : record.text,
      mine: record.senderId === viewerId,
      senderId: record.senderId,
      senderRole: record.sender.role === UserRole.CREATOR ? "Influencer" : "Brand",
      time: new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(record.createdAt),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      status: record.readAt ? "seen" : record.deliveredAt ? "delivered" : "sent",
      attachmentName: attachments?.map((item) => typeof item === "object" && item && "name" in item ? String(item.name) : "Attachment").join(", "),
      attachments,
      edited: Boolean(record.editedAt),
      deleted: Boolean(record.deletedAt),
      replyToId: record.replyToId ?? undefined,
      replyTo: reply ? {
        author: reply.senderId === viewerId ? "You" : reply.sender.profile?.displayName || "Participant",
        text: reply.deletedAt ? "This message was deleted" : reply.text.trim() || this.attachmentPreview(reply.attachments) || "Attachment",
      } : undefined,
      taskId: record.taskId ?? undefined,
      campaignRequestId: record.campaignApplicationId ?? undefined,
    };
  }

  private async assertCardReferences(user: AuthPrincipal, conversation: ApplicationRecord, dto: CreateChatMessageDto) {
    const recipientId = conversation.creatorId === user.userId ? conversation.campaign.brandId : conversation.creatorId;
    if (dto.taskId) {
      const task = await this.prisma.task.findFirst({
        where: {
          id: dto.taskId,
          OR: [
            { createdById: user.userId },
            { brandId: user.userId },
            { creatorId: user.userId },
            { recipients: { some: { userId: user.userId } } },
          ],
        },
        select: { creatorId: true, brandId: true, recipients: { where: { userId: recipientId }, select: { userId: true } } },
      });
      if (!task || (task.creatorId !== recipientId && !task.recipients.length)) throw new ForbiddenException("Share the task only after the collaboration is accepted");
    }
    if (dto.campaignApplicationId) {
      const cardApplication = await this.prisma.campaignApplication.findUnique({
        where: { id: dto.campaignApplicationId },
        select: { creatorId: true, campaign: { select: { brandId: true } } },
      });
      if (!cardApplication || cardApplication.creatorId !== recipientId || cardApplication.campaign.brandId !== conversation.campaign.brandId) {
        throw new ForbiddenException("This campaign request is not part of the conversation");
      }
    }
  }

  private normalizeAttachments(items?: Record<string, unknown>[]) {
    if (items && items.length > MAX_MESSAGE_ATTACHMENTS) throw new BadRequestException("Send at most 12 attachments per message");
    return (items ?? []).map((item) => {
      const id = typeof item.id === "string" ? item.id : randomUUID();
      const name = typeof item.name === "string" ? item.name.slice(0, 180) : "Attachment";
      const type = item.type === "image" || item.type === "video" || item.type === "file" ? item.type : null;
      const uri = typeof item.uri === "string" ? item.uri : "";
      if (!type || !uri || !/^https?:\/\//i.test(uri)) throw new BadRequestException("Each attachment must be an uploaded file URL");
      return { id, name, type, uri };
    });
  }

  private hasAttachments(value: unknown) { return Array.isArray(value) && value.length > 0; }

  private attachmentPreview(value: unknown) {
    return this.hasAttachments(value) ? `${(value as unknown[]).length} attachment${(value as unknown[]).length === 1 ? "" : "s"}` : "";
  }

  private mobileStatus(value: string) {
    return value === "ACCEPTED" ? "Accepted" : value === "DECLINED" || value === "WITHDRAWN" ? "Declined" : "Pending";
  }

  private initials(value: string) { return value.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "BR"; }

  private presenceKey(userId: string) { return `brandly:chat:presence:${userId}`; }
  private activeKey(userId: string) { return `brandly:chat:active:${userId}`; }

  private async setPresence(userId: string, applicationId?: string) {
    const now = Date.now();
    this.memoryPresence.set(userId, { lastSeenAt: now, applicationId });
    const client = this.redis.getClient();
    try { if (client && await this.redis.connect()) {
      await client.set(this.presenceKey(userId), String(now), "EX", CHAT_PRESENCE_TTL_SECONDS);
      if (applicationId) await client.set(this.activeKey(userId), applicationId, "EX", CHAT_PRESENCE_TTL_SECONDS);
      else await client.del(this.activeKey(userId));
    } } catch { /* In-memory presence remains available when Redis disconnects. */ }
  }

  private async clearPresence(userId: string) {
    this.memoryPresence.delete(userId);
    const client = this.redis.getClient();
    try { if (client && await this.redis.connect()) await client.del(this.presenceKey(userId), this.activeKey(userId)); }
    catch { /* Presence expires through its TTL on other instances. */ }
  }

  private async isOnline(userId: string) {
    const client = this.redis.getClient();
    try { if (client && await this.redis.connect()) return Boolean(await client.get(this.presenceKey(userId))); }
    catch { /* Fall back to this instance's recent presence. */ }
    const presence = this.memoryPresence.get(userId);
    if (!presence || Date.now() - presence.lastSeenAt > CHAT_PRESENCE_TTL_SECONDS * 1_000) {
      this.memoryPresence.delete(userId);
      return false;
    }
    return true;
  }

  private async onlineIds(userIds: string[]) {
    const ids = [...new Set(userIds)];
    const online = new Set<string>();
    if (!ids.length) return online;
    const client = this.redis.getClient();
    try {
      if (client && await this.redis.connect()) {
        const values = await client.mget(...ids.map((id) => this.presenceKey(id)));
        ids.forEach((id, index) => { if (values[index]) online.add(id); });
        return online;
      }
    } catch { /* Fall back to this instance's recent presence. */ }
    const now = Date.now();
    ids.forEach((id) => {
      const presence = this.memoryPresence.get(id);
      if (presence && now - presence.lastSeenAt <= CHAT_PRESENCE_TTL_SECONDS * 1_000) online.add(id);
      else this.memoryPresence.delete(id);
    });
    return online;
  }

  private async isInConversation(userId: string, applicationId: string) {
    const client = this.redis.getClient();
    try { if (client && await this.redis.connect()) return (await client.get(this.activeKey(userId))) === applicationId; }
    catch { /* Do not fail an already saved message because presence is unavailable. */ }
    const presence = this.memoryPresence.get(userId);
    return Boolean(presence && presence.applicationId === applicationId && Date.now() - presence.lastSeenAt <= CHAT_PRESENCE_TTL_SECONDS * 1_000);
  }
}
