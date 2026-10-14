import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { AuthGuard } from "../../common/auth/auth.guard.js";
import { WhatsAppOtpService } from "../../common/auth/whatsapp-otp.service.js";
import { SmtpOtpService } from "../../common/auth/smtp-otp.service.js";

@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, WhatsAppOtpService, SmtpOtpService],
  exports: [AuthService, AuthGuard, WhatsAppOtpService, SmtpOtpService],
})
export class AuthModule {}
