import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { ProfilesController } from "./profiles.controller.js";
import { ProfilesService } from "./profiles.service.js";
import { SocialProfileSyncService } from "./social-profile-sync.service.js";

@Module({ imports: [NotificationsModule], controllers: [ProfilesController], providers: [ProfilesService, SocialProfileSyncService], exports: [ProfilesService, SocialProfileSyncService] })
export class ProfilesModule {}
