import { Module } from "@nestjs/common";
import { AdminThemesController, PublicThemesController } from "./themes.controller.js";
import { ThemesService } from "./themes.service.js";

@Module({ controllers: [PublicThemesController, AdminThemesController], providers: [ThemesService] })
export class ThemesModule {}
