import { Module } from "@nestjs/common";
import { StudioController } from "./studio.controller.js";
import { StudioService } from "./studio.service.js";

@Module({ controllers: [StudioController], providers: [StudioService], exports: [StudioService] })
export class StudioModule {}
