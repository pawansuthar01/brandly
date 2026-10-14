import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { AdminChatsController, ChatController } from "./chat.controller.js";
import { ChatGateway } from "./chat.gateway.js";
import { ChatRealtimeService } from "./chat.realtime.js";
import { ChatService } from "./chat.service.js";
import { AdminChatService } from "./admin-chat.service.js";

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [ChatController, AdminChatsController],
  providers: [ChatService, AdminChatService, ChatRealtimeService, ChatGateway],
  exports: [ChatService, AdminChatService, ChatRealtimeService],
})
export class ChatModule {}
