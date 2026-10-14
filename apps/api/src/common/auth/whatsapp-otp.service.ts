import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { AppSettingsService } from "../settings/app-settings.service.js";

type CopyButton = { type: "copy"; text: string; code: string };

@Injectable()
export class WhatsAppOtpService {
  constructor(@Inject(AppSettingsService) private readonly settings: AppSettingsService) {}

  async send(phoneE164: string, code: string, requestId: string): Promise<void> {
    await this.sendMessage(
      phoneE164,
      `Your Brandly verification code is ${code}. It expires in 5 minutes. Never share this code.`,
      requestId,
      "Brandly",
      {
        header: "Brandly verification code",
        footer: "Tap Copy code to use your OTP.",
        buttons: [{ type: "copy", text: "Copy code", code }],
      },
    );
  }

  async sendMessage(
    phoneE164: string,
    message: string,
    requestId: string,
    contactName = "Brandly",
    interactive?: { header: string; footer: string; buttons: CopyButton[] },
  ): Promise<void> {
    const config = await this.settings.getWhatsApp();
    if (!config?.enabled || !config.baseUrl || !config.apiKey || !config.session) {
      throw new ServiceUnavailableException("WhatsApp delivery is not configured by an administrator");
    }

    const baseUrl = config.baseUrl.replace(/\/$/, "");
    try {
      const response = await fetch(`${baseUrl}/api/messages/send`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": config.apiKey,
          authorization: `Bearer ${config.apiKey}`,
          "x-idempotency-key": requestId,
        },
        body: JSON.stringify(interactive
          ? {
              session: config.session,
              to: phoneE164.replace(/^\+/, ""),
              header: interactive.header,
              message,
              footer: interactive.footer,
              buttons: interactive.buttons,
            }
          : {
              session: config.session,
              to: phoneE164.replace(/^\+/, ""),
              contactName: config.senderName ?? contactName,
              message,
            }),
        signal: AbortSignal.timeout(8_000),
      });

      if (!response.ok) {
        throw new ServiceUnavailableException("WhatsApp could not deliver the verification code");
      }
    } catch (error) {
      throw error;
    }
  }
}
