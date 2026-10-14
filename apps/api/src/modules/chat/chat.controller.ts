import { Body, Controller, Delete, ForbiddenException, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../common/auth/auth.guard.js";
import { CurrentUser } from "../../common/auth/current-user.decorator.js";
import type { AuthPrincipal } from "../../common/auth/auth.types.js";
import { AdminChatHeartbeatDto, AdminChatMessageDto, ChatPresenceDto, ChatTypingDto, CreateChatMessageDto, UpdateChatMessageDto } from "./chat.dto.js";
import { AdminChatService } from "./admin-chat.service.js";
import { ChatService } from "./chat.service.js";

@Controller("chat")
@UseGuards(AuthGuard)
export class ChatController {
  constructor(@Inject(ChatService) private readonly chat: ChatService, @Inject(AdminChatService) private readonly adminChat: AdminChatService) {}

  @Get("admin/conversation") adminConversation(@CurrentUser() user: AuthPrincipal) { return this.adminChat.conversationForUser(user); }
  @Post("admin/conversation") openAdminConversation(@CurrentUser() user: AuthPrincipal) { return this.adminChat.openForUser(user); }
  @Get("admin/conversations/:conversationId/messages") adminMessages(@CurrentUser() user: AuthPrincipal, @Param("conversationId") id: string, @Query("before") before?: string) { return this.adminChat.messages(user, id, before); }
  @Post("admin/conversations/:conversationId/messages") sendAdminMessage(@CurrentUser() user: AuthPrincipal, @Param("conversationId") id: string, @Body() dto: AdminChatMessageDto) { return this.adminChat.send(user, id, dto.text, dto.clientMessageId, dto.attachments); }
  @Post("admin/conversations/:conversationId/read") readAdminConversation(@CurrentUser() user: AuthPrincipal, @Param("conversationId") id: string) { return this.adminChat.markRead(user, id); }
  @Post("admin/presence/heartbeat") adminChatHeartbeat(@CurrentUser() user: AuthPrincipal, @Body() body: AdminChatHeartbeatDto) { return this.adminChat.heartbeat(user, body.conversationId); }

  @Get("conversations")
  list(@CurrentUser() user: AuthPrincipal, @Query("offset") offset?: string, @Query("search") search?: string) {
    return this.chat.listConversations(user, Number(offset) || 0, search);
  }

  @Get("conversations/:applicationId/messages")
  messages(@CurrentUser() user: AuthPrincipal, @Param("applicationId") applicationId: string, @Query("limit") limit?: string, @Query("before") before?: string) {
    return this.chat.getMessages(user, applicationId, Number(limit), before);
  }

  @Post("conversations/:applicationId/messages")
  send(@CurrentUser() user: AuthPrincipal, @Param("applicationId") applicationId: string, @Body() dto: CreateChatMessageDto) {
    return this.chat.createMessage(user, applicationId, dto);
  }

  @Patch("conversations/:applicationId/messages/:messageId")
  update(@CurrentUser() user: AuthPrincipal, @Param("applicationId") applicationId: string, @Param("messageId") messageId: string, @Body() dto: UpdateChatMessageDto) {
    return this.chat.updateMessage(user, applicationId, messageId, dto);
  }

  @Delete("conversations/:applicationId/messages/:messageId")
  remove(@CurrentUser() user: AuthPrincipal, @Param("applicationId") applicationId: string, @Param("messageId") messageId: string) {
    return this.chat.deleteMessage(user, applicationId, messageId);
  }

  @Post("conversations/:applicationId/read")
  read(@CurrentUser() user: AuthPrincipal, @Param("applicationId") applicationId: string) {
    return this.chat.markRead(user, applicationId);
  }

  @Post("presence/heartbeat")
  heartbeat(@CurrentUser() user: AuthPrincipal, @Body() dto: ChatPresenceDto) { return this.chat.heartbeat(user, dto); }

  @Post("presence/offline")
  offline(@CurrentUser() user: AuthPrincipal) { return this.chat.offline(user); }

  @Get("presence/:applicationId")
  presence(@CurrentUser() user: AuthPrincipal, @Param("applicationId") applicationId: string) { return this.chat.presence(user, applicationId); }

  @Post("typing")
  typing(@CurrentUser() user: AuthPrincipal, @Body() dto: ChatTypingDto) { return this.chat.typing(user, dto); }
}

@Controller("admin/chats")
@UseGuards(AuthGuard)
export class AdminChatsController {
  constructor(@Inject(AdminChatService) private readonly chat: AdminChatService) {}
  private assertAdmin(user: AuthPrincipal) { if (user.role !== "ADMIN") throw new ForbiddenException("Admin access required"); }
  @Get("users") users(@CurrentUser() user: AuthPrincipal, @Query("search") search?: string, @Query("offset") offset?: string, @Query("take") take?: string) { this.assertAdmin(user); return this.chat.users(search, Number(offset) || 0, Number(take) || 30); }
  @Get("reports") reports(@CurrentUser() user: AuthPrincipal, @Query("type") type?: string, @Query("before") before?: string, @Query("take") take?: string) { this.assertAdmin(user); return this.chat.reports(type, before, Number(take) || 25); }
  @Post("users/:userId/conversation") open(@CurrentUser() user: AuthPrincipal, @Param("userId") userId: string) { this.assertAdmin(user); return this.chat.openForAdmin(user, userId); }
  @Get("conversations/:conversationId/messages") messages(@CurrentUser() user: AuthPrincipal, @Param("conversationId") id: string, @Query("before") before?: string) { this.assertAdmin(user); return this.chat.messages(user, id, before); }
  @Post("conversations/:conversationId/messages") send(@CurrentUser() user: AuthPrincipal, @Param("conversationId") id: string, @Body() dto: AdminChatMessageDto) { this.assertAdmin(user); return this.chat.send(user, id, dto.text, dto.clientMessageId, dto.attachments); }
  @Post("conversations/:conversationId/read") read(@CurrentUser() user: AuthPrincipal, @Param("conversationId") id: string) { this.assertAdmin(user); return this.chat.markRead(user, id); }
  @Post("conversations/:conversationId/heartbeat") heartbeat(@CurrentUser() user: AuthPrincipal, @Param("conversationId") id: string) { this.assertAdmin(user); return this.chat.heartbeat(user, id); }
}
