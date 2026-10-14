import { Module } from "@nestjs/common";
import { AppConfigController, PublicAppConfigController } from "./app-config.controller.js";

@Module({ controllers: [AppConfigController, PublicAppConfigController] })
export class AppConfigModule {}
