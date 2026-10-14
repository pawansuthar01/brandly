import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Inject, Put, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../common/auth/auth.guard.js";
import { CurrentUser } from "../../common/auth/current-user.decorator.js";
import type { AuthPrincipal } from "../../common/auth/auth.types.js";
import { AppSettingsService, type AdminAppSettingsDocument } from "../../common/settings/app-settings.service.js";
import { AdminAppSettingsDto, SmtpSettingsDto, WhatsAppSettingsDto } from "./app-config.dto.js";

type ReleasePlatform = "Android" | "iOS";
type ReleaseSource = "apk" | "playStore" | "appStore";
type ReleaseVersion = {
  platform: ReleasePlatform;
  minimumVersion: string;
  latestVersion: string;
  updateType: "None" | "Optional" | "Mandatory";
  sourceType: ReleaseSource;
  storeUrl: string;
  message: string;
  releaseNotes: string;
};

const defaultReleaseVersions: ReleaseVersion[] = [
  {
    platform: "Android",
    minimumVersion: "0.1.0",
    latestVersion: "0.1.0",
    updateType: "None",
    sourceType: "playStore",
    storeUrl: "https://play.google.com/store",
    message: "A newer version of Brandly is available.",
    releaseNotes: "",
  },
  {
    platform: "iOS",
    minimumVersion: "0.1.0",
    latestVersion: "0.1.0",
    updateType: "None",
    sourceType: "appStore",
    storeUrl: "https://apps.apple.com",
    message: "A newer version of Brandly is available.",
    releaseNotes: "",
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function isAllowedReleaseUrl(platform: ReleasePlatform, sourceType: ReleaseSource, value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (platform === "iOS") return sourceType === "appStore" && (url.hostname === "apps.apple.com" || url.hostname === "itunes.apple.com");
    if (sourceType === "apk") return url.pathname.toLowerCase().endsWith(".apk");
    return sourceType === "playStore" && (url.hostname === "play.google.com" || url.hostname === "market.android.com");
  } catch {
    return false;
  }
}

function normalizeReleaseVersions(value: unknown): ReleaseVersion[] {
  const records = Array.isArray(value) ? value.filter(isRecord) : [];
  return defaultReleaseVersions.map((fallback) => {
    const stored = records.find((item) => item.platform === fallback.platform);
    const sourceType: ReleaseSource = fallback.platform === "iOS"
      ? "appStore"
      : itemSource(stored?.sourceType, stored?.storeUrl);
    const storeUrl = textValue(stored?.storeUrl, fallback.storeUrl);
    const hasSafeUrl = isAllowedReleaseUrl(fallback.platform, sourceType, storeUrl);
    return {
      ...fallback,
      ...(stored ?? {}),
      platform: fallback.platform,
      sourceType: hasSafeUrl ? sourceType : fallback.sourceType,
      minimumVersion: textValue(stored?.minimumVersion, fallback.minimumVersion),
      latestVersion: textValue(stored?.latestVersion, fallback.latestVersion),
      updateType: stored?.updateType === "Optional" || stored?.updateType === "Mandatory" ? stored.updateType : fallback.updateType,
      storeUrl: hasSafeUrl ? storeUrl : fallback.storeUrl,
      message: textValue(stored?.message, fallback.message),
      releaseNotes: Array.isArray(stored?.releaseNotes)
        ? stored.releaseNotes.filter((note): note is string => typeof note === "string").join("\n")
        : textValue(stored?.releaseNotes, fallback.releaseNotes),
    };
  });
}

function itemSource(value: unknown, storeUrl: unknown): ReleaseSource {
  if (value === "playStore" || value === "apk") return value;
  return typeof storeUrl === "string" && /play\.google\.com|market\.android\.com/i.test(storeUrl) ? "playStore" : "apk";
}

function validateReleaseVersions(versions: ReleaseVersion[]): void {
  for (const version of versions) {
    if (!isAllowedReleaseUrl(version.platform, version.sourceType, version.storeUrl)) {
      throw new BadRequestException(
        version.platform === "Android"
          ? "Android update URL must be a secure .apk URL or Google Play Store URL"
          : "iOS update URL must be an Apple App Store URL",
      );
    }
  }
}

function validateSubmittedReleaseVersions(value: unknown): void {
  if (!Array.isArray(value)) throw new BadRequestException("Release versions are required");
  for (const item of value) {
    if (!isRecord(item) || (item.platform !== "Android" && item.platform !== "iOS")) {
      throw new BadRequestException("Release platform must be Android or iOS");
    }
    const platform = item.platform as ReleasePlatform;
    const sourceType = platform === "iOS" ? "appStore" : item.sourceType;
    if (platform === "Android" && sourceType !== "apk" && sourceType !== "playStore") {
      throw new BadRequestException("Android update source must be APK or Google Play Store");
    }
    if (platform === "iOS" && item.sourceType !== undefined && item.sourceType !== "appStore") {
      throw new BadRequestException("iOS update source must be Apple App Store");
    }
    if (!isAllowedReleaseUrl(platform, sourceType as ReleaseSource, textValue(item.storeUrl, ""))) {
      throw new BadRequestException(
        platform === "Android"
          ? "Android update URL must be a secure .apk URL or Google Play Store URL"
          : "iOS update URL must be an Apple App Store URL",
      );
    }
  }
}

@Controller("admin/settings")
@UseGuards(AuthGuard)
export class AppConfigController {
  constructor(@Inject(AppSettingsService) private readonly settings: AppSettingsService) {}

  @Get("whatsapp")
  async getWhatsApp(@CurrentUser() user: AuthPrincipal) {
    this.assertAdmin(user);
    const value = await this.settings.getWhatsApp();
    return {
      enabled: Boolean(value?.enabled),
      baseUrl: value?.baseUrl ?? "https://wa-api.suthartech.com",
      session: value?.session ?? "",
      apiKeyConfigured: Boolean(value?.apiKey),
    };
  }

  @Get("app")
  async getApp(@CurrentUser() user: AuthPrincipal) {
    this.assertAdmin(user);
    return this.readAppSettings();
  }

  @Put("app")
  async updateApp(@CurrentUser() user: AuthPrincipal, @Body() dto: AdminAppSettingsDto) {
    this.assertAdmin(user);
    const existing = await this.settings.getAdminAppSettings();
    const currentSmtp = await this.settings.getSmtp();
    const currentWhatsApp = await this.settings.getWhatsApp();
    const settings = this.asRecord(dto.settings);
    const smtp = this.asRecord(settings.smtp);
    const whatsapp = this.asRecord(settings.whatsapp);
    const smtpSettings = { ...smtp };
    const whatsappSettings = { ...whatsapp };
    delete smtpSettings.passwordConfigured;
    delete whatsappSettings.apiKeyConfigured;
    validateSubmittedReleaseVersions(dto.versions);
    const versions = normalizeReleaseVersions(dto.versions);
    validateReleaseVersions(versions);
    const document: AdminAppSettingsDocument = {
      settings: {
        ...settings,
        smtp: {
          ...smtpSettings,
          password: this.stringValue(smtp.password) || this.stringValue(this.asRecord(existing?.settings).smtp && this.asRecord(this.asRecord(existing?.settings).smtp).password) || currentSmtp?.password || "",
        },
        whatsapp: {
          ...whatsappSettings,
          apiKey: this.stringValue(whatsapp.apiKey) || this.stringValue(this.asRecord(existing?.settings).whatsapp && this.asRecord(this.asRecord(existing?.settings).whatsapp).apiKey) || currentWhatsApp?.apiKey || "",
        },
      },
      versions,
    };
    await this.settings.setAdminAppSettings(document);
    await this.settings.set("notifications.smtp", document.settings.smtp);
    await this.settings.set("notifications.whatsapp", document.settings.whatsapp);
    return this.readAppSettings();
  }

  @Delete("app")
  async deleteApp(@CurrentUser() user: AuthPrincipal) {
    this.assertAdmin(user);
    await Promise.all([
      this.settings.delete("admin.app-settings"),
      this.settings.delete("notifications.smtp"),
      this.settings.delete("notifications.whatsapp"),
    ]);
    return this.readAppSettings();
  }

  @Put("whatsapp")
  async updateWhatsApp(@CurrentUser() user: AuthPrincipal, @Body() dto: WhatsAppSettingsDto) {
    this.assertAdmin(user);
    await this.settings.set("notifications.whatsapp", dto);
    return { enabled: dto.enabled, baseUrl: dto.baseUrl, session: dto.session, apiKeyConfigured: true };
  }

  @Get("smtp")
  async getSmtp(@CurrentUser() user: AuthPrincipal) {
    this.assertAdmin(user);
    const value = await this.settings.getSmtp();
    return {
      enabled: Boolean(value?.enabled),
      host: value?.host ?? "",
      port: value?.port ?? "587",
      encryption: value?.encryption ?? "TLS",
      username: value?.username ?? "",
      passwordConfigured: Boolean(value?.password),
      fromName: value?.fromName ?? "Brandly",
      fromEmail: value?.fromEmail ?? "",
      replyTo: value?.replyTo ?? "",
    };
  }

  @Put("smtp")
  async updateSmtp(@CurrentUser() user: AuthPrincipal, @Body() dto: SmtpSettingsDto) {
    this.assertAdmin(user);
    await this.settings.set("notifications.smtp", dto);
    return {
      enabled: dto.enabled,
      host: dto.host,
      port: dto.port,
      encryption: dto.encryption,
      username: dto.username,
      passwordConfigured: true,
      fromName: dto.fromName,
      fromEmail: dto.fromEmail,
      replyTo: dto.replyTo ?? "",
    };
  }

  private assertAdmin(user: AuthPrincipal): void {
    if (user.role !== "ADMIN") throw new ForbiddenException("Admin access required");
  }

  private async readAppSettings() {
    const stored = await this.settings.getAdminAppSettings();
    const storedSettings = this.asRecord(stored?.settings);
    const storedSmtp = this.asRecord(storedSettings.smtp);
    const storedWhatsApp = this.asRecord(storedSettings.whatsapp);
    const smtp = await this.settings.getSmtp();
    const whatsapp = await this.settings.getWhatsApp();
    const smtpPassword = this.stringValue(storedSmtp.password) || smtp?.password || "";
    const whatsappApiKey = this.stringValue(storedWhatsApp.apiKey) || whatsapp?.apiKey || "";
    return {
      settings: {
        runtime: { environment: "Development", apiBaseUrl: "", webBaseUrl: "", mediaBaseUrl: "", timezone: "Asia/Kolkata", logLevel: "Info", ...this.asRecord(storedSettings.runtime) },
        smtp: { enabled: false, provider: "SMTP relay", host: "", port: "587", encryption: "TLS", username: "", fromName: "Brandly", fromEmail: "", replyTo: "", ...smtp, ...storedSmtp, password: "", passwordConfigured: Boolean(smtpPassword) },
        whatsapp: { enabled: false, baseUrl: "https://wa-api.suthartech.com", session: "", senderName: "Brandly", ...whatsapp, ...storedWhatsApp, apiKey: "", apiKeyConfigured: Boolean(whatsappApiKey) },
        product: { maintenance: false, publicDiscovery: true, supportEmail: "", supportHours: "", privacyUrl: "", termsUrl: "", guidelinesUrl: "", ...this.asRecord(storedSettings.product) },
      },
      versions: normalizeReleaseVersions(stored?.versions),
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }

  private stringValue(value: unknown): string {
    return typeof value === "string" ? value : "";
  }
}

@Controller("app-config")
export class PublicAppConfigController {
  constructor(@Inject(AppSettingsService) private readonly settings: AppSettingsService) {}

  @Get("version")
  async getVersion(@Query("platform") platform?: string) {
    const requestedPlatform: ReleasePlatform = platform?.toLowerCase() === "ios" ? "iOS" : "Android";
    const stored = await this.settings.getAdminAppSettings();
    const version = normalizeReleaseVersions(stored?.versions).find((item) => item.platform === requestedPlatform)!;
    return {
      platform: requestedPlatform.toLowerCase(),
      minimumVersion: version.minimumVersion,
      latestVersion: version.latestVersion,
      mode: version.updateType.toLowerCase(),
      sourceType: version.sourceType,
      message: version.message,
      releaseNotes: version.releaseNotes.split("\n").map((note) => note.trim()).filter(Boolean),
      storeUrl: version.storeUrl,
    };
  }
}
