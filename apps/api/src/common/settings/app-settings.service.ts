import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service.js";
import { decryptJson, encryptJson } from "../security/secret-box.js";

export type WhatsAppProviderSettings = {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  session: string;
  senderName?: string;
};

export type SmtpProviderSettings = {
  enabled: boolean;
  host: string;
  port: number | string;
  encryption: "TLS" | "SSL" | "None";
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
};

export type AdminAppSettingsDocument = {
  settings: Record<string, unknown>;
  versions: unknown[];
};

@Injectable()
export class AppSettingsService {
  private readonly encryptionKey: string;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {
    // Keep a separate APP_CONFIG_ENCRYPTION_KEY in production; the JWT secret
    // fallback keeps the existing local installation able to persist settings.
    this.encryptionKey = this.config.get<string>("APP_CONFIG_ENCRYPTION_KEY")
      ?? this.config.get<string>("JWT_REFRESH_SECRET")
      ?? "";
  }

  async get<T>(key: string): Promise<T | undefined> {
    const setting = await this.prisma.appSetting.findUnique({ where: { key } });
    if (!setting) return undefined;
    try {
      return decryptJson<T>(
        { value: setting.encryptedValue, nonce: setting.nonce, authTag: setting.authTag },
        this.encryptionKey,
      );
    } catch {
      throw new ServiceUnavailableException("Sensitive setting could not be decrypted");
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (!this.encryptionKey) {
      throw new ServiceUnavailableException("Sensitive settings are not configured on this server");
    }
    const encrypted = encryptJson(value, this.encryptionKey);
    await this.prisma.appSetting.upsert({
      where: { key },
      create: { key, encryptedValue: encrypted.value, nonce: encrypted.nonce, authTag: encrypted.authTag },
      update: { encryptedValue: encrypted.value, nonce: encrypted.nonce, authTag: encrypted.authTag },
    });
  }

  async getAdminAppSettings(): Promise<AdminAppSettingsDocument | undefined> {
    return this.get<AdminAppSettingsDocument>("admin.app-settings");
  }

  async setAdminAppSettings(value: AdminAppSettingsDocument): Promise<void> {
    await this.set("admin.app-settings", value);
  }

  async delete(key: string): Promise<void> {
    await this.prisma.appSetting.deleteMany({ where: { key } });
  }

  async getWhatsApp(): Promise<WhatsAppProviderSettings | undefined> {
    const stored = await this.get<WhatsAppProviderSettings>("notifications.whatsapp");
    if (stored) return stored;

    const apiKey = this.config.get<string>("WHATSAPP_API_KEY")?.trim() ?? "";
    const session = this.config.get<string>("WHATSAPP_SESSION")?.trim() ?? "";
    const baseUrl = this.config.get<string>("WHATSAPP_API_BASE_URL")?.trim() || "https://wa-api.suthartech.com";
    const senderName = this.config.get<string>("WHATSAPP_SENDER_NAME")?.trim() || undefined;
    if (!apiKey && !session) return undefined;

    return {
      enabled: this.config.get<string>("WHATSAPP_ENABLED")?.trim().toLowerCase() === "true",
      baseUrl,
      apiKey,
      session,
      senderName,
    };
  }

  async getSmtp(): Promise<SmtpProviderSettings | undefined> {
    const stored = await this.get<SmtpProviderSettings>("notifications.smtp");
    if (stored) return stored;

    const host = this.config.get<string>("SMTP_HOST")?.trim() ?? "";
    const username = this.config.get<string>("SMTP_USERNAME")?.trim() ?? "";
    const password = this.config.get<string>("SMTP_PASSWORD") ?? "";
    const fromEmail = this.config.get<string>("SMTP_FROM_EMAIL")?.trim() ?? "";
    if (!host && !username && !password && !fromEmail) return undefined;

    const encryption = this.config.get<string>("SMTP_ENCRYPTION")?.trim();
    return {
      enabled: this.config.get<string>("SMTP_ENABLED")?.trim().toLowerCase() === "true",
      host: host || "smtp.gmail.com",
      port: this.config.get<string>("SMTP_PORT")?.trim() || "587",
      encryption: encryption === "SSL" || encryption === "None" ? encryption : "TLS",
      username,
      password,
      fromName: this.config.get<string>("SMTP_FROM_NAME")?.trim() || "Brandly",
      fromEmail,
      replyTo: this.config.get<string>("SMTP_REPLY_TO")?.trim() || undefined,
    };
  }
}
