import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { ChatModule } from "../chat/chat.module.js";
import { CampaignsController } from "./campaigns.controller.js";
import { CampaignsService } from "./campaigns.service.js";

@Module({ imports: [NotificationsModule, ChatModule], controllers: [CampaignsController], providers: [CampaignsService], exports: [CampaignsService] })
export class CampaignsModule {}
