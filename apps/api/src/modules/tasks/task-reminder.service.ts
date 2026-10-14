import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { OutboxService, TASK_REMINDER_DUE_EVENT, TASK_REMINDER_UPCOMING_EVENT } from "../../common/events/outbox.service.js";
import { PrismaService } from "../../common/database/prisma.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";

const toneFile = (tone: string) => tone === "silent"
  ? null
  : tone === "default"
    ? "soft_chime_alarm.wav"
    : `${tone.replace(/-/g, "_")}_alarm.wav`;
const toneChannel = (tone: string) => `delivery-reminders-v4-${tone || "default"}-vibrate`;

type ReminderEvent = Prisma.OutboxEventGetPayload<{}>;

@Injectable()
export class TaskReminderService {
  private readonly logger = new Logger(TaskReminderService.name);
  private nextBackfillAt = 0;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
  ) {}

  async processDueReminders(now = new Date()): Promise<number> {
    await this.outbox.recoverStale(now);
    await this.notifications.processPushReceipts(now).catch((error) => {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Push receipt processing failed";
      this.logger.warn(message);
    });
    // Backfill reminders created before the outbox migration or while the API
    // was temporarily unavailable. createMany(skipDuplicates) makes this safe
    // to run on every worker tick.
    if (now.getTime() >= this.nextBackfillAt) {
      this.nextBackfillAt = now.getTime() + 30_000;
      await this.outbox.backfillTaskReminderEvents(now).catch((error) => {
        const message = error instanceof Error ? error.message.slice(0, 500) : "Reminder event backfill failed";
        this.logger.warn(message);
      });
    }
    return this.outbox.processAvailable(now, (event) => this.processEvent(event, now));
  }

  private async processEvent(event: ReminderEvent, now: Date): Promise<void> {
    if (event.type !== TASK_REMINDER_UPCOMING_EVENT && event.type !== TASK_REMINDER_DUE_EVENT) return;
    const payload = event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
      ? event.payload as { taskId?: unknown; generation?: unknown }
      : {};
    const taskId = typeof payload.taskId === "string" ? payload.taskId : "";
    const generation = typeof payload.generation === "number" ? payload.generation : -1;
    if (!taskId || generation < 0) return;

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        notes: true,
        dueDate: true,
        dueTime: true,
        dueAt: true,
        reminderTone: true,
        reminderEnabled: true,
        reminderGeneration: true,
        completedAt: true,
        createdById: true,
        brandId: true,
        creatorId: true,
        recipients: { select: { userId: true } },
      },
    });

    // Old events are intentionally acknowledged. A newer reminder generation
    // owns the task after an edit/stop, so the old event must not resurrect it.
    if (!task || !task.reminderEnabled || task.completedAt || !task.dueAt || task.reminderGeneration !== generation) return;
    const dueAt = task.dueAt;
    const recipients = Array.from(new Set([
      task.createdById,
      task.brandId,
      task.creatorId,
      ...task.recipients.map((recipient) => recipient.userId),
    ].filter((id): id is string => Boolean(id))));

    if (event.type === TASK_REMINDER_UPCOMING_EVENT) {
      // The early alert is informational only. It must be silent and must not
      // use WhatsApp/email; the due event remains the only alarm delivery.
      // createReliable is intentionally used with a non-TASK_REMINDER type:
      // TASK_REMINDER records are local-only by design, while this upcoming
      // push is needed when the app is backgrounded or reopened later.
      if (dueAt.getTime() <= now.getTime()) return;
      const deliveries = await Promise.allSettled(recipients.map((userId) => this.notifications.createReliable(userId, {
        type: "UPCOMING_TASK_REMINDER",
        title: "Upcoming task reminder",
        body: `${task.title} is due in about 2 minutes (${task.dueDate} at ${task.dueTime}).`,
        data: { screen: "Task", taskId: task.id, phase: "upcoming", soundTone: "silent" },
        channels: ["PUSH"],
        sound: null,
        requirePushDelivery: true,
        preferLocalDelivery: false,
        allowExternalFallback: false,
        reminderDueAt: dueAt.toISOString(),
        dedupeKey: `${event.dedupeKey}:${userId}`,
      })));
      this.throwIfAllDeliveriesFailed(deliveries, "No push delivery channel is available for the upcoming reminder");
      return;
    }

    if (dueAt.getTime() > now.getTime()) throw new Error("Reminder event is not due yet");
    const deliveries = await Promise.allSettled(recipients.map((userId) => this.notifications.createReliable(userId, {
      type: "TASK_REMINDER",
      title: "Task reminder",
      body: `${task.title} is due ${task.dueDate} at ${task.dueTime}.${task.notes ? ` ${task.notes.slice(0, 180)}` : " Open the task to review the details."}`,
      data: {
        screen: "Task",
        type: "task-reminder",
        taskId: task.id,
        reminderId: `task-reminder-${task.id}`,
        ownerId: userId,
        phase: "due",
        dueAt: String(dueAt.getTime()),
        snoozeMinutes: "5",
        soundTone: task.reminderTone,
        soundEnabled: task.reminderTone === "silent" ? "false" : "true",
        vibrationEnabled: "true",
        channelId: toneChannel(task.reminderTone),
        categoryIdentifier: "delivery_reminder",
      },
      channels: ["PUSH"],
      sound: toneFile(task.reminderTone),
      channelId: toneChannel(task.reminderTone),
      categoryIdentifier: "delivery_reminder",
      requirePushDelivery: true,
      preferLocalDelivery: true,
      allowExternalFallback: false,
      reminderDueAt: dueAt.toISOString(),
      dedupeKey: `${event.dedupeKey}:${userId}`,
    })));
    this.throwIfAllDeliveriesFailed(deliveries, "No task reminder delivery channel is available");
    await this.prisma.$transaction([
      this.prisma.task.updateMany({
        where: { id: task.id, reminderGeneration: generation, reminderEnabled: true },
        data: {
          reminderStatus: "SENT",
          reminderSentAt: now,
          reminderClaimedAt: null,
          lastReminderError: null,
        },
      }),
      this.prisma.taskActivity.create({ data: { taskId: task.id, action: "REMINDER_SENT", message: "Reminder due; alarm delivery is handled locally on the device", details: { sentAt: now.toISOString(), eventId: event.id } } }),
    ]);
  }

  private throwIfAllDeliveriesFailed(deliveries: PromiseSettledResult<unknown>[], fallback: string) {
    const failures = deliveries.filter((delivery): delivery is PromiseRejectedResult => delivery.status === "rejected");
    if (failures.length > 0) {
      const first = failures[0]?.reason;
      throw first instanceof Error ? first : new Error(fallback);
    }
  }
}
