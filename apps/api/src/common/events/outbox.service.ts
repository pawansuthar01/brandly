import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";

export const TASK_REMINDER_UPCOMING_EVENT = "TASK_REMINDER_UPCOMING";
export const TASK_REMINDER_DUE_EVENT = "TASK_REMINDER_DUE";

type ReminderTask = {
  id: string;
  dueAt: Date | null;
  reminderEnabled: boolean;
  reminderGeneration: number;
  reminderUpcomingSentAt?: Date | null;
};

type EventHandler = (event: Prisma.OutboxEventGetPayload<{}>) => Promise<void>;

const staleLock = 5 * 60 * 1_000;

@Injectable()
export class OutboxService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async enqueueTaskReminderEvents(transaction: Prisma.TransactionClient, task: ReminderTask) {
    if (!task.reminderEnabled || !task.dueAt) return;
    const generation = task.reminderGeneration;
    const base = `task-reminder:${task.id}:${generation}`;
    const now = Date.now();
    const upcomingAt = task.dueAt.getTime() - 2 * 60_000;
    const events = [
      {
        type: TASK_REMINDER_UPCOMING_EVENT,
        aggregateType: "Task",
        aggregateId: task.id,
        dedupeKey: `${base}:upcoming`,
        payload: { taskId: task.id, generation, phase: "upcoming" },
        availableAt: new Date(Math.max(now, upcomingAt)),
      },
      {
        type: TASK_REMINDER_DUE_EVENT,
        aggregateType: "Task",
        aggregateId: task.id,
        dedupeKey: `${base}:due`,
        payload: { taskId: task.id, generation, phase: "due" },
        availableAt: new Date(Math.max(now, task.dueAt.getTime())),
      },
    ];
    await transaction.outboxEvent.createMany({
      data: events,
      skipDuplicates: true,
    });
  }

  async recoverStale(now = new Date()) {
    await this.prisma.outboxEvent.updateMany({
      where: { status: "PROCESSING", lockedAt: { lt: new Date(now.getTime() - staleLock) } },
      data: { status: "PENDING", lockedAt: null, availableAt: now, lastError: "Recovered after worker interruption" },
    });
  }

  async processAvailable(now: Date, handler: EventHandler, limit = 50): Promise<number> {
    const candidates = await this.prisma.outboxEvent.findMany({
      where: {
        OR: [
          { status: "PENDING", availableAt: { lte: now } },
          { status: "PROCESSING", lockedAt: { lt: new Date(now.getTime() - staleLock) } },
        ],
      },
      orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
      take: limit,
    });
    let processed = 0;
    for (const candidate of candidates) {
      const claimed = await this.prisma.outboxEvent.updateMany({
        where: {
          id: candidate.id,
          OR: [
            { status: "PENDING", availableAt: { lte: now } },
            { status: "PROCESSING", lockedAt: { lt: new Date(now.getTime() - staleLock) } },
          ],
        },
        data: { status: "PROCESSING", lockedAt: now, attempts: { increment: 1 } },
      });
      if (!claimed.count) continue;
      const event = await this.prisma.outboxEvent.findUnique({ where: { id: candidate.id } });
      if (!event) continue;
      try {
        await handler(event);
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: "COMPLETED", processedAt: new Date(), lockedAt: null, lastError: null },
        });
        processed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 500) : "Event processing failed";
        const delay = Math.min(15 * 60 * 1_000, Math.max(5_000, 2 ** Math.min(event.attempts, 8) * 1_000));
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: "PENDING", lockedAt: null, availableAt: new Date(Date.now() + delay), lastError: message },
        }).catch(() => undefined);
      }
    }
    return processed;
  }

  async backfillTaskReminderEvents(now = new Date(), limit = 100) {
    const tasks = await this.prisma.task.findMany({
      where: { reminderEnabled: true, completedAt: null, dueAt: { not: null } },
      select: { id: true, dueAt: true, reminderEnabled: true, reminderGeneration: true, reminderUpcomingSentAt: true },
      orderBy: { dueAt: "asc" },
      take: limit,
    });
    for (const task of tasks) {
      await this.prisma.$transaction((transaction) => this.enqueueTaskReminderEvents(transaction, task));
    }
    return tasks.length;
  }
}
