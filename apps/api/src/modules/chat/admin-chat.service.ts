import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, UserRole, UserStatus } from "@prisma/client";
import { isUUID } from "class-validator";
import { randomUUID } from "node:crypto";
import { RedisService } from "../../common/cache/redis.service.js";
import { PrismaService } from "../../common/database/prisma.service.js";
import type { AuthPrincipal } from "../../common/auth/auth.types.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { ChatRealtimeService } from "./chat.realtime.js";

const PRESENCE_TTL = 75;
const threadInclude = { user: { select: { id: true, role: true, email: true, profile: { select: { displayName: true, avatarUrl: true, city: true } } } } } as const;
const messageInclude = { sender: { select: { id: true, role: true, profile: { select: { displayName: true } } } } } as const;
type Thread = Prisma.AdminChatConversationGetPayload<{ include: typeof threadInclude }>;
type Message = Prisma.AdminChatMessageGetPayload<{ include: typeof messageInclude }>;
const MAX_ADMIN_CHAT_ATTACHMENTS = 12;

@Injectable()
export class AdminChatService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(ChatRealtimeService) private readonly realtime: ChatRealtimeService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async users(search = "", offset = 0, requestedTake = 30) {
    const take = Math.min(100, Math.max(1, Math.floor(requestedTake) || 30));
    const skip = Math.max(0, Math.floor(offset) || 0);
    const term = search.trim().slice(0, 120);
    const users = await this.prisma.user.findMany({
      where: { role: { in: [UserRole.BRAND, UserRole.CREATOR] }, status: { not: UserStatus.DELETED }, ...(term ? { OR: [...(isUUID(term) ? [{ id: term }] : []), { email: { contains: term, mode: "insensitive" as const } }, { profile: { is: { displayName: { contains: term, mode: "insensitive" as const } } } }] } : {}) },
      select: { id: true, role: true, email: true, status: true, profile: { select: { displayName: true, avatarUrl: true, city: true } }, adminChatThreads: { take: 1, include: { messages: { take: 1, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { text: true, attachments: true, createdAt: true, senderRole: true } } } } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip, take: take + 1,
    });
    const hasMore = users.length > take;
    if (hasMore) users.pop();
    const conversationIds = users.flatMap((item) => item.adminChatThreads.map((thread) => thread.id));
    const unread = conversationIds.length ? await this.prisma.adminChatMessage.groupBy({ by: ["conversationId"], where: { conversationId: { in: conversationIds }, senderRole: { not: UserRole.ADMIN }, readAt: null }, _count: { _all: true } }) : [];
    const unreadByThread = new Map(unread.map((item) => [item.conversationId, item._count._all]));
    const online = await this.onlineIds(users.map((item) => item.id));
    return {
      items: users.map((item) => {
        const thread = item.adminChatThreads[0];
        return {
          id: item.id,
          name: item.profile?.displayName || item.email || "User",
          email: item.email,
          role: item.role === UserRole.BRAND ? "Brand" : "Creator",
          status: item.status,
          avatarUrl: item.profile?.avatarUrl,
          city: item.profile?.city,
          conversationId: thread?.id ?? null,
          preview: thread?.messages[0]?.text || this.attachmentPreview(thread?.messages[0]?.attachments) || "Start a conversation",
          updatedAt: thread?.messages[0]?.createdAt.toISOString() ?? null,
          unreadCount: thread ? unreadByThread.get(thread.id) ?? 0 : 0,
          online: online.has(item.id),
        };
      }),
      nextOffset: hasMore ? skip + take : null,
    };
  }

  async conversationForUser(user: AuthPrincipal) {
    this.assertUser(user);
    const thread = await this.prisma.adminChatConversation.findUnique({ where: { userId: user.userId }, include: threadInclude });
    if (!thread) return null;
    const online = user.role === "ADMIN" ? true : (await this.onlineIds(this.configuredAdminIds())).size > 0;
    const [last, unreadCount] = await Promise.all([
      this.prisma.adminChatMessage.findFirst({ where: { conversationId: thread.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { text: true, createdAt: true } }),
      this.prisma.adminChatMessage.count({ where: { conversationId: thread.id, senderRole: UserRole.ADMIN, readAt: null } }),
    ]);
    return { ...this.serializeThread(thread, user.userId, online), preview: last?.text ?? "Message Brandly", updatedAt: last?.createdAt.toISOString() ?? thread.updatedAt.toISOString(), unreadCount };
  }

  async openForUser(user: AuthPrincipal) {
    this.assertUser(user);
    const thread = await this.prisma.adminChatConversation.upsert({ where: { userId: user.userId }, create: { userId: user.userId }, update: {}, include: threadInclude });
    const online = (await this.onlineIds(this.configuredAdminIds())).size > 0;
    return this.serializeThread(thread, user.userId, online);
  }

  async openForAdmin(admin: AuthPrincipal, userId: string) {
    this.assertAdmin(admin);
    if (!isUUID(userId)) throw new BadRequestException("Invalid user ID");
    const user = await this.prisma.user.findFirst({ where: { id: userId, role: { in: [UserRole.BRAND, UserRole.CREATOR] }, status: { not: "DELETED" } }, select: { id: true } });
    if (!user) throw new NotFoundException("User not found");
    const thread = await this.prisma.adminChatConversation.upsert({ where: { userId }, create: { userId }, update: {}, include: threadInclude });
    const online = (await this.onlineIds([thread.userId])).has(thread.userId);
    return this.serializeThread(thread, admin.userId, online);
  }

  async messages(user: AuthPrincipal, conversationId: string, before?: string) {
    const thread = await this.authorizedThread(user, conversationId);
    if (before && !isUUID(before)) throw new BadRequestException("Invalid message cursor");
    const cursor = before ? await this.prisma.adminChatMessage.findFirst({ where: { id: before, conversationId }, select: { id: true, createdAt: true } }) : null;
    if (before && !cursor) throw new BadRequestException("Message cursor not found");
    const rows = await this.prisma.adminChatMessage.findMany({ where: { conversationId, ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}) }, include: messageInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 31 });
    const hasMore = rows.length > 30;
    const page = rows.slice(0, 30).reverse();
    const online = user.role === "ADMIN" ? (await this.onlineIds([thread.userId])).has(thread.userId) : (await this.onlineIds(this.configuredAdminIds())).size > 0;
    return { ...this.serializeThread(thread, user.userId, online), messages: page.map((item) => this.serializeMessage(item, user.role)), hasMore, nextCursor: hasMore ? page[0]?.id : undefined };
  }

  async send(user: AuthPrincipal, conversationId: string, text = "", clientMessageId?: string, inputAttachments?: Record<string, unknown>[]) {
    const thread = await this.authorizedThread(user, conversationId);
    const content = text.trim();
    const attachments = this.normalizeAttachments(inputAttachments);
    if ((!content && !attachments.length) || content.length > 5_000) throw new BadRequestException("Add a message or attachment (up to 5000 characters)");
    const clientId = clientMessageId?.trim() || randomUUID();
    if (clientId.length > 120) throw new BadRequestException("Invalid client message ID");
    const role = user.role as UserRole;
    // Config-based admin principals use `admin:<email>`, but message.senderId
    // is a UUID foreign key. Attribute storage to the thread owner and use the
    // role plus an admin-prefixed client ID to distinguish/idempotently track it.
    const senderId = role === UserRole.ADMIN ? thread.userId : user.userId;
    const storedClientId = role === UserRole.ADMIN ? `admin:${clientId}` : clientId;
    const existing = await this.prisma.adminChatMessage.findUnique({ where: { conversationId_senderId_clientMessageId: { conversationId, senderId, clientMessageId: storedClientId } }, include: messageInclude });
    if (existing) return this.serializeMessage(existing, role);
    const saved = await this.prisma.$transaction(async (tx) => {
      const message = await tx.adminChatMessage.create({ data: { conversationId, senderId, senderRole: role, clientMessageId: storedClientId, text: content, attachments: attachments as Prisma.InputJsonValue }, include: messageInclude });
      await tx.adminChatConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      return message;
    });
    const realtimeRecipients = role === UserRole.ADMIN ? [thread.userId] : this.configuredAdminIds();
    for (const recipientId of realtimeRecipients) {
      this.realtime.send(recipientId, { type: "message.created", channel: "ADMIN_CHAT", conversationId, message: this.serializeMessage(saved, recipientId === thread.userId ? thread.user.role : UserRole.ADMIN) });
    }
    this.realtime.send(user.userId, { type: "message.created", channel: "ADMIN_CHAT", conversationId, message: this.serializeMessage(saved, role) });
    const recipients = role === UserRole.ADMIN ? [thread.userId] : await this.persistedAdminIds();
    const preview = attachments.find((attachment) => attachment.type === "image") ?? attachments[0];
    void Promise.all(recipients.map((recipientId) => this.notifications.create(recipientId, {
      type: "CHAT_MESSAGE", title: user.role === "ADMIN" ? "Brandly" : this.senderName(saved), body: (content || this.attachmentPreview(attachments) || "Sent an attachment").slice(0, 240),
      data: { type: "CHAT_MESSAGE", screen: "chat", adminChat: "true", conversationId, ...(preview ? { mediaUri: preview.uri, mediaType: preview.type, mediaName: preview.name } : {}) }, channelId: "chat-messages", dedupeKey: `admin-chat:${saved.id}:${recipientId}`, channels: ["PUSH"],
    }))).catch(() => undefined);
    return this.serializeMessage(saved, role);
  }

  async markRead(user: AuthPrincipal, conversationId: string) {
    await this.authorizedThread(user, conversationId);
    const result = await this.prisma.adminChatMessage.updateMany({ where: { conversationId, senderRole: { not: user.role as UserRole }, readAt: null }, data: { readAt: new Date() } });
    if (result.count) {
      const recipientIds = user.role === "ADMIN" ? (await this.prisma.adminChatConversation.findUnique({ where: { id: conversationId }, select: { userId: true } }).then((item) => item ? [item.userId] : [])) : this.configuredAdminIds();
      for (const recipientId of recipientIds) this.realtime.send(recipientId, { type: "conversation.read", channel: "ADMIN_CHAT", conversationId, readerId: user.userId });
    }
    return { read: result.count };
  }

  async reports(type = "ALL", before?: string, requestedTake = 25) {
    const normalizedType = type.trim().toUpperCase();
    if (!["ALL", "FEEDBACK", "BUG_REPORT"].includes(normalizedType)) throw new BadRequestException("Report type must be ALL, FEEDBACK, or BUG_REPORT");
    const take = Math.min(100, Math.max(1, Math.floor(requestedTake) || 25));
    const cursor = before ? await this.prisma.adminChatMessage.findFirst({ where: { id: before }, select: { id: true, createdAt: true } }) : null;
    if (before && !cursor) throw new BadRequestException("Report cursor not found");
    const reportTypes = normalizedType === "ALL" ? ["Feedback", "Bug report"] : [normalizedType === "FEEDBACK" ? "Feedback" : "Bug report"];
    const rows = await this.prisma.adminChatMessage.findMany({
      where: { AND: [
        { OR: reportTypes.map((name) => ({ text: { startsWith: `[${name}]` } })) },
        ...(cursor ? [{ OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }] : []),
      ] },
      include: { conversation: { include: { user: { select: { id: true, role: true, email: true, profile: { select: { displayName: true, avatarUrl: true } } } } } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: take + 1,
    });
    const hasMore = rows.length > take;
    const page = rows.slice(0, take);
    return {
      items: page.map((item) => {
        const typeName = reportTypes.find((name) => item.text.startsWith(`[${name}]`)) ?? "Feedback";
        const user = item.conversation.user;
        return {
          id: item.id, conversationId: item.conversationId, userId: user.id,
          userName: user.profile?.displayName || user.email || "User", email: user.email,
          role: user.role === UserRole.BRAND ? "Brand" : "Creator", type: typeName === "Bug report" ? "BUG_REPORT" : "FEEDBACK",
          message: item.text.slice(`[${typeName}]`.length).trim(), attachments: Array.isArray(item.attachments) ? item.attachments : [],
          createdAt: item.createdAt.toISOString(),
        };
      }),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
    };
  }

  async heartbeat(user: AuthPrincipal, conversationId?: string) {
    if (conversationId) await this.authorizedThread(user, conversationId);
    const client = this.redis.getClient();
    try { if (client && await this.redis.connect()) await client.set(this.presenceKey(user.userId), String(Date.now()), "EX", PRESENCE_TTL); } catch { /* Online state falls back to the authenticated chat socket. */ }
    const otherIds = user.role === "ADMIN" ? conversationId ? [((await this.authorizedThread(user, conversationId)).userId)] : [] : this.configuredAdminIds();
    for (const otherId of otherIds) this.realtime.send(otherId, { type: "presence", channel: "ADMIN_CHAT", conversationId, userId: user.userId, online: true });
    return { online: true, expiresInSeconds: PRESENCE_TTL };
  }

  async onlineIds(userIds: string[]) {
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
    } catch { /* Use this process's WebSocket state if Redis is unavailable. */ }
    ids.forEach((id) => { if (this.realtime.isConnected(id)) online.add(id); });
    return online;
  }

  private async authorizedThread(user: AuthPrincipal, conversationId: string): Promise<Thread> {
    if (!isUUID(conversationId)) throw new BadRequestException("Invalid conversation ID");
    const thread = await this.prisma.adminChatConversation.findUnique({ where: { id: conversationId }, include: threadInclude });
    if (!thread) throw new NotFoundException("Admin chat not found");
    if (user.role !== "ADMIN" && (thread.userId !== user.userId || !["BRAND", "CREATOR"].includes(user.role))) throw new ForbiddenException("You cannot access this admin chat");
    return thread;
  }

  private serializeThread(thread: Thread, viewerId: string, online: boolean) {
    return { id: thread.id, conversationId: thread.id, participant: { id: viewerId === thread.userId ? "brandly" : thread.user.id, name: viewerId === thread.userId ? "Brandly" : thread.user.profile?.displayName || thread.user.email || "User", role: thread.user.role === UserRole.BRAND ? "Brand" : "Creator", avatarUrl: viewerId === thread.userId ? null : thread.user.profile?.avatarUrl ?? null }, online };
  }

  private serializeMessage(message: Message, viewerRole: UserRole) {
    const mine = message.senderRole === viewerRole;
    return { id: message.id, text: message.text, mine, senderId: message.senderId, senderRole: message.senderRole, senderName: this.senderName(message), clientMessageId: message.clientMessageId, attachments: Array.isArray(message.attachments) ? message.attachments : [], createdAt: message.createdAt.toISOString(), time: message.createdAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), status: mine ? message.readAt ? "seen" : "delivered" : "delivered", readAt: message.readAt?.toISOString() ?? null };
  }

  private senderName(message: Message) { return message.senderRole === UserRole.ADMIN ? "Brandly" : message.sender.profile?.displayName || "User"; }
  private normalizeAttachments(items?: Record<string, unknown>[]) {
    if (items && items.length > MAX_ADMIN_CHAT_ATTACHMENTS) throw new BadRequestException(`Send at most ${MAX_ADMIN_CHAT_ATTACHMENTS} attachments per message`);
    return (items ?? []).map((item) => {
      const id = typeof item.id === "string" ? item.id.slice(0, 120) : randomUUID();
      const name = typeof item.name === "string" ? item.name.slice(0, 180) : "Attachment";
      const type = item.type === "image" || item.type === "video" || item.type === "file" ? item.type : null;
      const uri = typeof item.uri === "string" ? item.uri : "";
      if (!type || !uri || !/^https?:\/\//i.test(uri)) throw new BadRequestException("Each attachment must be an uploaded file URL");
      return { id, name, type, uri };
    });
  }
  private attachmentPreview(value: unknown) { return Array.isArray(value) && value.length ? `${value.length} attachment${value.length === 1 ? "" : "s"}` : ""; }
  private configuredAdminIds() {
    const production = this.config.get<string>("NODE_ENV") === "production";
    return [
      this.config.get<string>("ADMIN_OWNER_EMAIL") || (production ? "" : "owner@brandly.demo"),
      this.config.get<string>("ADMIN_MODERATOR_EMAIL") || (production ? "" : "moderator@brandly.demo"),
    ].map((email) => email.trim().toLowerCase()).filter(Boolean).map((email) => `admin:${email}`);
  }
  private async persistedAdminIds() { return (await this.prisma.user.findMany({ where: { role: UserRole.ADMIN, status: "ACTIVE" }, select: { id: true } })).map((item) => item.id); }
  private presenceKey(userId: string) { return `brandly:chat:presence:${userId}`; }
  private assertAdmin(user: AuthPrincipal) { if (user.role !== "ADMIN") throw new ForbiddenException("Admin access required"); }
  private assertUser(user: AuthPrincipal) { if (user.role !== "BRAND" && user.role !== "CREATOR") throw new ForbiddenException("User access required"); }
}
