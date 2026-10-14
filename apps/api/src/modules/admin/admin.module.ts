import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AdminController } from "./admin.controller.js";
import { AdminService } from "./admin.service.js";
import { ChatModule } from "../chat/chat.module.js";

@Module({ imports: [AuthModule, ChatModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
