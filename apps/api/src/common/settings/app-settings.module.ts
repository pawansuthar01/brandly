import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppSettingsService } from "./app-settings.service.js";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [AppSettingsService],
  exports: [AppSettingsService],
})
export class AppSettingsModule {}
