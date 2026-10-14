import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/database/prisma.service.js";
import { WhatsAppOtpService } from "../../common/auth/whatsapp-otp.service.js";
import { SmtpOtpService } from "../../common/auth/smtp-otp.service.js";
import type { RegisterDeviceDto } from "./notifications.dto.js";
import type { AdminNotificationDto } from "./notifications.dto.js";

type NotificationInput = {
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  channels?: ("PUSH" | "WHATSAPP" | "EMAIL")[];
  sound?: string | null;
  channelId?: string;
  categoryIdentifier?: string;
  requirePushDelivery?: boolean;
  preferLocalDelivery?: boolean;
  allowExternalFallback?: boolean;
  reminderDueAt?: string;
  dedupeKey?: string;
};

type ExpoTicket = {
  status?: string;
  id?: string;
  message?: string;
  details?: { error?: string };
};

type ExpoReceipt = {
  status?: string;
  message?: string;
  details?: { error?: string };
};

type TicketToken = { ticketId: string; token: string };

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WhatsAppOtpService) private readonly whatsapp: WhatsAppOtpService,
    @Inject(SmtpOtpService) private readonly smtp: SmtpOtpService,
  ) {}

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    return this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform,
        appVersion: dto.appVersion,
        supportsLocalReminders: dto.supportsLocalReminders === true,
        sessionActive: dto.sessionActive !== false,
      },
      update: {
        userId,
        platform: dto.platform,
        appVersion: dto.appVersion,
        supportsLocalReminders: dto.supportsLocalReminders === true,
        sessionActive: dto.sessionActive !== false,
        lastSeenAt: new Date(),
      },
    });
  }

  async list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async adminLogs() {
    const records = await this.prisma.notification.findMany({
      include: { user: { select: { id: true, email: true, profile: { select: { displayName: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return records.map((item) => {
      const data = item.data && typeof item.data === "object" && !Array.isArray(item.data) ? item.data as Record<string, unknown> : {};
      return ({
      id: item.id,
      userId: item.userId,
      userName: item.user.profile?.displayName || item.user.email || "Account",
      title: item.title,
      message: item.body,
      type: item.type,
      source: item.type.startsWith("ADMIN_") ? "Admin" : "App",
      channel: item.channel === "PUSH" ? "Push" : item.channel === "EMAIL" ? "Email" : "WhatsApp",
      sentBy: item.type.startsWith("ADMIN_") ? "Admin" : "Brandly",
      createdAt: item.createdAt.toISOString(),
      read: item.readAt !== null,
      deliveryStatus: item.deliveryStatus,
      deliveredAt: item.deliveredAt?.toISOString() ?? null,
      lastDeliveryError: item.lastDeliveryError,
      actionLabel: typeof data.actionLabel === "string" ? data.actionLabel : undefined,
      actionUrl: typeof data.actionUrl === "string" ? data.actionUrl : undefined,
    });
    });
  }

  async sendBulk(dto: AdminNotificationDto) {
    if (!dto.userIds.length) throw new BadRequestException("Select at least one recipient");
    const recipients = await this.prisma.user.findMany({
      where: { id: { in: dto.userIds }, role: { in: ["BRAND", "CREATOR"] }, status: "ACTIVE" },
      select: { id: true },
    });
    if (recipients.length !== dto.userIds.length) throw new BadRequestException("One or more recipients are missing or inactive; no notifications were sent");
    const results = await Promise.allSettled(recipients.map(({ id }) => this.create(id, {
      type: "ADMIN_ANNOUNCEMENT",
      title: dto.title.trim(),
      body: dto.body.trim(),
      data: dto.data,
      channels: dto.channels,
    })));
    const persisted = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    const delivery = {
      delivered: persisted.filter((item) => item.deliveredAt !== null || item.deliveryStatus === "DELIVERED").length,
      accepted: persisted.filter((item) => item.deliveredAt === null && item.deliveryStatus === "ACCEPTED").length,
      pending: persisted.filter((item) => item.deliveredAt === null && item.deliveryStatus === "PENDING").length,
      failed: persisted.filter((item) => item.deliveredAt === null && item.deliveryStatus === "FAILED").length,
    };
    return {
      requested: recipients.length,
      completed: results.filter((item) => item.status === "fulfilled").length,
      failed: results.filter((item) => item.status === "rejected").length,
      delivery,
    };
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (!notification.count) throw new NotFoundException("Notification not found");
    return { id, read: true };
  }

  async create(userId: string, input: NotificationInput) {
    if (input.type.startsWith("TASK_REMINDER")) {
      return [await this.createNotificationRecord(userId, "PUSH", { ...input, preferLocalDelivery: true })];
    }
    const channels = input.channels?.length ? input.channels : ["PUSH" as const];
    const notifications = await Promise.all(channels.map((channel) => this.createNotificationRecord(userId, channel, input)));
    const pushNotification = notifications.find((notification) => notification.channel === "PUSH");
    if (pushNotification && !pushNotification.deliveredAt && pushNotification.deliveryStatus !== "ACCEPTED") {
      await this.deliverExpoPush(
        pushNotification.id,
        userId,
        pushNotification.title,
        pushNotification.body,
        input.data,
        input.sound,
        input.channelId,
        input.categoryIdentifier,
        input.requirePushDelivery === true,
        input.preferLocalDelivery === true,
      );
    }
    const emailNotification = notifications.find((notification) => notification.channel === "EMAIL");
    const whatsappNotification = notifications.find((notification) => notification.channel === "WHATSAPP");
    if (emailNotification || whatsappNotification) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, phoneE164: true, profile: { select: { displayName: true } } } });
      if (emailNotification && !emailNotification.deliveredAt) {
        if (!user?.email) await this.markDeliveryFailed(emailNotification.id, "Recipient has no email address");
        else try {
          await this.smtp.sendNotification(user.email, emailNotification.title, emailNotification.body, `notification-${emailNotification.id}`);
          await this.prisma.notification.update({ where: { id: emailNotification.id }, data: { deliveredAt: new Date(), deliveryStatus: "DELIVERED", lastDeliveryError: null } });
        } catch (error) {
          await this.markDeliveryFailed(emailNotification.id, error instanceof Error ? error.message : "Email delivery failed");
        }
      }
      if (whatsappNotification && !whatsappNotification.deliveredAt) {
        if (!user?.phoneE164) await this.markDeliveryFailed(whatsappNotification.id, "Recipient has no phone number");
        else try {
            await this.whatsapp.sendMessage(
              user.phoneE164,
              `${whatsappNotification.title}\n\n${whatsappNotification.body}`,
              `notification-${whatsappNotification.id}`,
              user.profile?.displayName,
            );
            await this.prisma.notification.update({ where: { id: whatsappNotification.id }, data: { deliveredAt: new Date(), deliveryStatus: "DELIVERED", lastDeliveryError: null } });
          } catch (error) {
            await this.markDeliveryFailed(whatsappNotification.id, error instanceof Error ? error.message : "WhatsApp delivery failed");
        }
      }
    }
    return this.prisma.notification.findMany({ where: { id: { in: notifications.map(({ id }) => id) } } });
  }

  /**
   * Deliver a reminder through the best available channel. Local schedules
   * remain the first choice, but a missing permission/token never makes the
   * worker silently lose the reminder: email/WhatsApp are durable fallbacks.
   */
  async createReliable(userId: string, input: NotificationInput) {
    if (input.type.startsWith("TASK_REMINDER")) return this.create(userId, input);
    if (input.dedupeKey) {
      const deliveredFallback = await this.prisma.notification.findFirst({
        where: {
          userId,
          dedupeKey: { in: [`${input.dedupeKey}:fallback:EMAIL`, `${input.dedupeKey}:fallback:WHATSAPP`] },
          deliveredAt: { not: null },
        },
      });
      if (deliveredFallback) return [deliveredFallback];
    }
    const devices = await this.prisma.deviceToken.findMany({ where: { userId } });
    const now = Date.now();
    const reminderDueAt = input.reminderDueAt ? Date.parse(input.reminderDueAt) : Number.NaN;
    const staleReminder = Number.isFinite(reminderDueAt) && now - reminderDueAt >= 10 * 60_000;
    const hasLocalReminderDevice = !staleReminder && input.preferLocalDelivery === true && devices.some((device) => device.supportsLocalReminders);
    // A logged-in app session is the user's explicit choice of delivery
    // channel. Do not fall back to WhatsApp/email merely because the app has
    // been backgrounded for more than 15 minutes.
    const hasActiveSessionDevice = devices.some((device) => device.sessionActive);
    if (hasLocalReminderDevice) {
      return this.create(userId, {
        ...input,
        channels: ["PUSH"],
        requirePushDelivery: false,
      });
    }

    try {
      return await this.create(userId, {
        ...input,
        channels: ["PUSH"],
        requirePushDelivery: true,
        preferLocalDelivery: false,
      });
    } catch (pushError) {
      if (input.allowExternalFallback !== true || !hasActiveSessionDevice) throw pushError;
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, phoneE164: true } });
      const fallbackChannels = [
        ...(user?.email ? (["EMAIL"] as const) : []),
        ...(user?.phoneE164 ? (["WHATSAPP"] as const) : []),
      ];
      if (!fallbackChannels.length) throw pushError;
      try {
        const fallback = await this.create(userId, {
          ...input,
          channels: fallbackChannels,
          requirePushDelivery: false,
          preferLocalDelivery: false,
          dedupeKey: input.dedupeKey ? `${input.dedupeKey}:fallback` : undefined,
        });
        if (!fallback.some((notification) => notification.deliveredAt)) {
          throw new Error("Reminder fallback channels are temporarily unavailable");
        }
        return fallback;
      } catch (fallbackError) {
        const message = fallbackError instanceof Error ? fallbackError.message : "Reminder fallback delivery failed";
        throw new Error(`${pushError instanceof Error ? pushError.message : "Push delivery failed"}; ${message}`);
      }
    }
  }

  private async createNotificationRecord(userId: string, channel: "PUSH" | "WHATSAPP" | "EMAIL", input: NotificationInput) {
    const dedupeKey = input.dedupeKey ? `${input.dedupeKey}:${channel}` : undefined;
    if (dedupeKey) {
      const existing = await this.prisma.notification.findUnique({ where: { dedupeKey } });
      if (existing) return existing;
    }
    try {
      return await this.prisma.notification.create({
        data: {
          userId,
          dedupeKey,
          channel,
          type: input.type,
          title: input.title,
          body: input.body,
          data: input.data,
          sound: input.sound,
          channelId: input.channelId,
          categoryIdentifier: input.categoryIdentifier,
          preferLocalDelivery: input.preferLocalDelivery === true,
        },
      });
    } catch (error) {
      if (dedupeKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.prisma.notification.findUnique({ where: { dedupeKey } });
        if (existing) return existing;
      }
      throw error;
    }
  }

  private async markDeliveryFailed(notificationId: string, message: string) {
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { deliveryStatus: "FAILED", lastDeliveryError: message.slice(0, 500), deliveryAttempts: { increment: 1 } },
    });
  }

  private async deliverExpoPush(
    notificationId: string,
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
    sound?: string | null,
    channelId?: string,
    categoryIdentifier?: string,
    requireDelivery = false,
    preferLocalDelivery = false,
  ): Promise<void> {
    const devices = await this.prisma.deviceToken.findMany({ where: { userId, sessionActive: true } });
    const hasLocalReminderDevice = preferLocalDelivery && devices.some((device) => device.supportsLocalReminders);
    const targets = devices
      .filter((device) => !preferLocalDelivery || !device.supportsLocalReminders)
      .filter((device) => device.token.startsWith("ExponentPushToken[") || device.token.startsWith("ExpoPushToken["))
      .map((device) => ({ token: device.token, platform: device.platform.toLowerCase() }));
    if (!targets.length) {
      if (hasLocalReminderDevice) {
        await this.prisma.notification.update({
          where: { id: notificationId },
          data: {
            provider: "LOCAL",
            deliveryStatus: "DELIVERED",
            deliveredAt: new Date(),
            acceptedAt: new Date(),
            deliveryAttempts: { increment: 1 },
          },
        });
        return;
      }
      await this.markDeliveryFailed(notificationId, "No registered push device");
      if (requireDelivery) throw new Error("No registered push device for task reminder");
      return;
    }
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(targets.map(({ token, platform }) => ({
          to: token,
          title,
          body,
          data,
          ...(sound !== null ? {
            sound: sound
              ? platform === "android" ? sound : sound.replace(/_alarm\.wav$/i, ".wav")
              : "default",
          } : {}),
          ...(channelId ? { channelId } : {}),
          ...(categoryIdentifier ? { categoryId: categoryIdentifier } : {}),
        }))),
        signal: AbortSignal.timeout(8_000),
      });
      const result = await response.json().catch(() => null) as { data?: ExpoTicket[] } | null;
      const tickets = Array.isArray(result?.data) ? result.data : [];
      const ticketEntries = tickets.map((ticket, index) => ({ ticket, token: targets[index]?.token }));
      const accepted = ticketEntries.filter(({ ticket }) => ticket.status === "ok" && typeof ticket.id === "string");
      const failed = ticketEntries.filter(({ ticket }) => ticket.status === "error" || !ticket.id);
      const firstError = failed[0]?.ticket;
      const failedTicket = firstError;
      const unregisteredTokens = failed
        .filter(({ ticket }) => ticket.details?.error === "DeviceNotRegistered")
        .map(({ token }) => token)
        .filter((token): token is string => Boolean(token));
      if (unregisteredTokens.length) {
        await this.prisma.deviceToken.deleteMany({ where: { token: { in: unregisteredTokens } } });
      }
      if (!response.ok || !accepted.length) {
        await this.prisma.notification.update({
          where: { id: notificationId },
          data: {
            provider: "EXPO",
            deliveryStatus: "FAILED",
            lastDeliveryError: failedTicket?.message || failedTicket?.details?.error || "Push delivery failed",
            deliveryAttempts: { increment: 1 },
          },
        });
        if (requireDelivery) {
          throw new Error(failedTicket?.message || `Push delivery failed (${response.status})`);
        }
        return;
      }
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          provider: "EXPO",
          providerTicketIds: accepted.map(({ ticket }) => ticket.id as string),
          providerTicketTokens: accepted.map(({ ticket, token }) => ({ ticketId: ticket.id as string, token })),
          deliveryStatus: "ACCEPTED",
          acceptedAt: new Date(),
          nextReceiptCheckAt: new Date(Date.now() + 15 * 60_000),
          lastDeliveryError: failed.length ? (firstError?.message || firstError?.details?.error || "One or more push tickets failed") : null,
          deliveryAttempts: { increment: 1 },
        },
      });
    } catch (error) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          provider: "EXPO",
          deliveryStatus: "FAILED",
          lastDeliveryError: error instanceof Error ? error.message.slice(0, 500) : "Push delivery failed",
          deliveryAttempts: { increment: 1 },
        },
      }).catch(() => undefined);
      if (requireDelivery) throw error;
      // Notifications are persisted even when the external push gateway is unavailable.
    }
  }

  async processPushReceipts(now = new Date()): Promise<number> {
    const notifications = await this.prisma.notification.findMany({
      where: {
        channel: "PUSH",
        provider: "EXPO",
        deliveryStatus: "ACCEPTED",
        nextReceiptCheckAt: { lte: now },
      },
      orderBy: { nextReceiptCheckAt: "asc" },
      take: 100,
    });
    let processed = 0;
    for (const notification of notifications) {
      const ticketIds = this.stringArray(notification.providerTicketIds);
      if (!ticketIds.length) {
        await this.markReceiptFailed(notification.id, "Expo did not return a push receipt ticket");
        continue;
      }
      try {
        const response = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ids: ticketIds }),
          signal: AbortSignal.timeout(8_000),
        });
        const result = await response.json().catch(() => null) as { data?: Record<string, ExpoReceipt> } | null;
        if (!response.ok || !result?.data) throw new Error("Push receipt lookup failed (" + response.status + ")");
        const entries = ticketIds.map((id) => ({ id, receipt: result.data?.[id] }));
        if (entries.some(({ receipt }) => !receipt)) {
          await this.rescheduleReceiptCheck(notification.id, notification.deliveryAttempts, "Expo receipt is not available yet", now);
          continue;
        }
        const failures = entries.filter(({ receipt }) => receipt?.status === "error");
        if (failures.length) {
          const error = failures[0]?.receipt;
          const message = error?.message || error?.details?.error || "Push receipt reported a delivery failure";
          const failedTokens = this.ticketTokens(notification.providerTicketTokens)
            .filter((entry) => failures.some(({ id }) => id === entry.ticketId))
            .map((entry) => entry.token);
          if (failures.some(({ receipt }) => receipt?.details?.error === "DeviceNotRegistered") && failedTokens.length) {
            await this.prisma.deviceToken.deleteMany({ where: { token: { in: failedTokens } } });
          }
          await this.markReceiptFailed(notification.id, message);
          await this.retryReminderFallback(notification).catch((fallbackError) => {
            const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : "Reminder fallback failed";
            this.logger.warn("Reminder " + notification.id + " receipt fallback failed: " + fallbackMessage);
          });
          processed += 1;
          continue;
        }
        if (entries.every(({ receipt }) => receipt?.status === "ok")) {
          await this.prisma.notification.update({
            where: { id: notification.id },
            data: {
              deliveryStatus: "DELIVERED",
              deliveredAt: notification.deliveredAt ?? now,
              receiptCheckedAt: now,
              nextReceiptCheckAt: null,
              lastDeliveryError: null,
            },
          });
          processed += 1;
          continue;
        }
        await this.rescheduleReceiptCheck(notification.id, notification.deliveryAttempts, "Expo returned an unknown receipt state", now);
      } catch (error) {
        await this.rescheduleReceiptCheck(notification.id, notification.deliveryAttempts, error instanceof Error ? error.message : "Push receipt lookup failed", now);
      }
    }
    return processed;
  }

  private async markReceiptFailed(notificationId: string, message: string) {
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        deliveryStatus: "FAILED",
        receiptCheckedAt: new Date(),
        nextReceiptCheckAt: null,
        lastDeliveryError: message.slice(0, 500),
      },
    });
  }

  private async rescheduleReceiptCheck(notificationId: string, attempts: number, message: string, now: Date) {
    const nextAttempt = attempts + 1;
    const delay = Math.min(15 * 60_000, Math.max(15_000, 15_000 * 2 ** Math.min(nextAttempt, 6)));
    if (nextAttempt >= 96) {
      await this.markReceiptFailed(notificationId, message + "; receipt lookup timed out");
      return;
    }
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        receiptCheckedAt: now,
        nextReceiptCheckAt: new Date(now.getTime() + delay),
        deliveryAttempts: nextAttempt,
        lastDeliveryError: message.slice(0, 500),
      },
    });
  }

  private async retryReminderFallback(notification: Prisma.NotificationGetPayload<{}>) {
    if (!notification.type.startsWith("TASK_REMINDER") || !notification.dedupeKey) return;
    await this.createReliable(notification.userId, {
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: this.stringRecord(notification.data),
      channels: ["PUSH"],
      sound: notification.sound,
      channelId: notification.channelId ?? undefined,
      categoryIdentifier: notification.categoryIdentifier ?? undefined,
      preferLocalDelivery: notification.preferLocalDelivery,
      requirePushDelivery: true,
      dedupeKey: notification.dedupeKey.replace(/:PUSH$/, ""),
    });
  }

  private stringArray(value: Prisma.JsonValue | null): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  }

  private ticketTokens(value: Prisma.JsonValue | null): TicketToken[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is TicketToken => Boolean(item) && typeof item === "object" && !Array.isArray(item) && typeof (item as { ticketId?: unknown }).ticketId === "string" && typeof (item as { token?: unknown }).token === "string");
  }

  private stringRecord(value: Prisma.JsonValue | null): Record<string, string> | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    return Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === "string")) as Record<string, string>;
  }
}
