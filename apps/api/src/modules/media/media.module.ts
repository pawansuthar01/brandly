import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/database/prisma.module.js";
import { MediaController } from "./media.controller.js";
import { MediaStorageService } from "./media-storage.service.js";

@Module({ imports: [PrismaModule], controllers: [MediaController], providers: [MediaStorageService], exports: [MediaStorageService] })
export class MediaModule {}
