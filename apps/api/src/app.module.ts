import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./common/database/prisma.module.js";
import { RedisModule } from "./common/cache/redis.module.js";
import { HealthModule } from "./common/health/health.module.js";
import { validateEnv } from "./common/config/env.js";
import { AppSettingsModule } from "./common/settings/app-settings.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { ProfilesModule } from "./modules/profiles/profiles.module.js";
import { NotificationsModule } from "./modules/notifications/notifications.module.js";
import { AppConfigModule } from "./modules/app-config/app-config.module.js";
import { MediaModule } from "./modules/media/media.module.js";
import { TasksModule } from "./modules/tasks/tasks.module.js";
import { StudioModule } from "./modules/studio/studio.module.js";
import { CampaignsModule } from "./modules/campaigns/campaigns.module.js";
import { ChatModule } from "./modules/chat/chat.module.js";
import { ThemesModule } from "./modules/themes/themes.module.js";
import { AdminModule } from "./modules/admin/admin.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    PrismaModule,
    RedisModule,
    AppSettingsModule,
    AuthModule,
    ProfilesModule,
    NotificationsModule,
    AppConfigModule,
    MediaModule,
    TasksModule,
    StudioModule,
    CampaignsModule,
    ChatModule,
    ThemesModule,
    AdminModule,
    HealthModule,
  ],
})
export class AppModule {}
