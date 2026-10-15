import { Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import nodemailer from "nodemailer";
import { AppSettingsService } from "../settings/app-settings.service.js";
import { formatBrandlyEmail, type BrandlyNotificationContent } from "../notification-templates.js";

@Injectable()
export class SmtpOtpService {
  private readonly logger = new Logger(SmtpOtpService.name);

  constructor(@Inject(AppSettingsService) private readonly settings: AppSettingsService) {}

  async send(email: string, code: string, requestId: string): Promise<void> {
    await this.sendMail(
      email,
      "Your Brandly verification code",
      `Your Brandly verification code is ${code}. It expires in 5 minutes. Never share this code.`,
      `<p>Your Brandly verification code is <strong>${code}</strong>.</p><p>It expires in 5 minutes. Never share this code.</p>`,
      requestId,
    );
  }

  async sendNotification(email: string, subject: string, body: string, requestId: string, action?: Pick<BrandlyNotificationContent, "actionLabel" | "actionUrl">): Promise<void> {
    const message = formatBrandlyEmail({ title: subject, body, ...action });
    await this.sendMail(email, subject, message.text, message.html, requestId);
  }

  private async sendMail(email: string, subject: string, text: string, html: string, requestId: string): Promise<void> {
    const config = await this.settings.getSmtp();
    if (!config?.enabled || !config.host || !config.fromEmail || !config.password) {
      throw new ServiceUnavailableException("Email delivery is not configured by an administrator");
    }

    const port = Number(config.port);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new ServiceUnavailableException("Email delivery has an invalid SMTP port");
    }

    let lastCode = "unknown";
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const transport = nodemailer.createTransport({
        host: config.host,
        port,
        secure: config.encryption === "SSL",
        ignoreTLS: config.encryption === "None",
        auth: { user: config.username, pass: config.password },
        connectionTimeout: 12_000,
        greetingTimeout: 12_000,
        socketTimeout: 15_000,
      });

      try {
        await transport.sendMail({
          from: `${config.fromName} <${config.fromEmail}>`,
          to: email,
          replyTo: config.replyTo || undefined,
          subject,
          text,
          html,
          messageId: `<${requestId}@brandly>`,
        });
        return;
      } catch (error) {
        lastCode = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "unknown";
        this.logger.warn(`SMTP notification delivery attempt ${attempt} failed (${lastCode})`);
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 400));
      } finally {
        transport.close();
      }
    }

    throw new ServiceUnavailableException("Email delivery is temporarily unavailable. Please try again.");
  }
}
