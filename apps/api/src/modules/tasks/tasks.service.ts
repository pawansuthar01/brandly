import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, TaskReminderStatus } from "@prisma/client";
import { PrismaService } from "../../common/database/prisma.service.js";
import { OutboxService } from "../../common/events/outbox.service.js";
import type { AuthPrincipal } from "../../common/auth/auth.types.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import type { CreateTaskDto, TaskListQueryDto, UpdateTaskDto } from "./tasks.dto.js";

const taskInclude = {
  createdBy: { select: { id: true, profile: { select: { displayName: true } } } },
  brand: { select: { id: true, profile: { select: { displayName: true } } } },
  creator: { select: { id: true, profile: { select: { displayName: true } } } },
  recipients: { select: { userId: true, sharedAt: true, user: { select: { role: true } } } },
  activities: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.TaskInclude;

type TaskRecord = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

const jsonInput = (value: unknown) => value as Prisma.InputJsonValue;

function strings(value: Prisma.JsonValue | null | undefined): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function objects(value: Prisma.JsonValue | null | undefined): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item) => Boolean(item && typeof item === "object" && !Array.isArray(item))) as Record<string, unknown>[]
    : [];
}

function parseDate(value: string | null | undefined): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (!/T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) throw new BadRequestException("Reminder time must include a timezone offset");
  const parsed = new Date(value);
  const datePart = value.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (!datePart) throw new BadRequestException("Reminder time must be a complete ISO timestamp");
  const calendar = new Date(Date.UTC(Number(datePart[1]), Number(datePart[2]) - 1, Number(datePart[3])));
  if (calendar.getUTCFullYear() !== Number(datePart[1]) || calendar.getUTCMonth() !== Number(datePart[2]) - 1 || calendar.getUTCDate() !== Number(datePart[3])) {
    throw new BadRequestException("Reminder date is invalid");
  }
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException("Reminder time is invalid");
  return parsed;
}

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

@Injectable()
export class TasksService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
  ) {}

  async list(userId: string, query: TaskListQueryDto = {}) {
    const search = query.search?.trim();
    const where: Prisma.TaskWhereInput = {
      AND: [
        this.accessibleWhere(userId),
        ...(query.from ? [{ dueDate: { gte: query.from } }] : []),
        ...(query.to ? [{ dueDate: { lte: query.to } }] : []),
        ...(search ? [{ OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { notes: { contains: search, mode: "insensitive" as const } },
        ] }] : []),
        ...(query.remindersOnly === "true" ? [{ OR: [
          { reminderEnabled: true },
          { dueAt: { not: null } },
          { reminderStatus: { not: "NONE" as const } },
        ] }] : []),
      ],
    };
    const tasks = await this.prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    });
    return tasks.map((task) => this.serialize(task));
  }

  async get(userId: string, id: string) {
    return this.serialize(await this.findAccessible(userId, id));
  }

  async history(userId: string, id: string) {
    const task = await this.findAccessible(userId, id);
    return task.activities.map((activity) => ({
      id: activity.id,
      action: activity.action,
      message: activity.message,
      details: activity.details,
      createdAt: activity.createdAt.toISOString(),
    }));
  }

  async create(user: AuthPrincipal, dto: CreateTaskDto) {
    if (dto.clientId) {
      const existing = await this.prisma.task.findUnique({ where: { id: dto.clientId } });
      if (existing) {
        if (existing.createdById !== user.userId) throw new BadRequestException("Task ID is already in use");
        return this.get(user.userId, existing.id);
      }
    }
    const reminderEnabled = dto.reminderEnabled === true && dto.dueTime.trim().toLowerCase() !== "anytime";
    const reminderAt = reminderEnabled ? parseDate(dto.reminderAt) : null;
    if (reminderEnabled && (!reminderAt || reminderAt.getTime() <= Date.now())) throw new BadRequestException("Choose a future reminder time");
    const brandId = user.role === "BRAND" ? user.userId : await this.assertParticipant(dto.brandId, "BRAND");
    const creatorId = user.role === "CREATOR" ? user.userId : await this.assertParticipant(dto.creatorId, "CREATOR");
    if (brandId && creatorId) await this.assertAcceptedCollaboration(brandId, creatorId);
    const sourceTaskId = dto.sourceTaskId ? (await this.findAccessible(user.userId, dto.sourceTaskId)).id : null;
    let createdNew = false;
    const task = await this.prisma.$transaction(async (transaction) => {
      if (dto.clientId) {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dto.clientId}))`;
        const existing = await transaction.task.findUnique({ where: { id: dto.clientId } });
        if (existing) {
          if (existing.createdById !== user.userId) throw new BadRequestException("Task ID is already in use");
          return existing;
        }
      }
      createdNew = true;
      const created = await transaction.task.create({
        data: {
          ...(dto.clientId ? { id: dto.clientId } : {}),
          kind: dto.kind ?? "task",
          title: dto.title.trim(),
          notes: dto.notes?.trim() ?? "",
          dueDate: dto.dueDate.trim(),
          dueTime: dto.dueTime.trim(),
          dueAt: reminderAt,
          reminderEnabled,
          reminderTone: dto.reminderTone?.trim() || "default",
          reminderStatus: reminderEnabled ? TaskReminderStatus.PENDING : TaskReminderStatus.NONE,
          reminderGeneration: reminderEnabled ? 1 : 0,
          links: jsonInput(dto.links ?? []),
          attachments: jsonInput(dto.attachments ?? []),
          projectId: dto.projectId?.trim() || null,
          stage: dto.stage?.trim() || null,
          campaignId: dto.campaignId?.trim() || null,
          conversationId: dto.conversationId?.trim() || null,
          sourceTaskId,
          createdById: user.userId,
          brandId,
          creatorId,
        },
      });
      await this.outbox.enqueueTaskReminderEvents(transaction, created);
      await transaction.taskActivity.create({ data: { taskId: created.id, actorId: user.userId, action: "CREATED", message: "Task created" } });
      return created;
    });
    if (createdNew) await this.notifyParticipants(task, user.userId, "New task", `${task.title} is due ${task.dueDate} at ${task.dueTime}.`);
    return this.get(user.userId, task.id);
  }

  async update(user: AuthPrincipal, id: string, dto: UpdateTaskDto) {
    return this.prisma.$transaction(async (transaction) => {
      // All edits/stop/completion operations for this task observe the latest
      // committed state, so a concurrent stale PATCH cannot rearm completion.
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
      return this.updateLocked(user, id, dto, transaction);
    });
  }

  private async updateLocked(user: AuthPrincipal, id: string, dto: UpdateTaskDto, transaction: Prisma.TransactionClient) {
    const current = await this.findAccessible(user.userId, id, transaction);
    if (dto.expectedReminderAt !== undefined) {
      const expected = parseDate(dto.expectedReminderAt);
      const desired = parseDate(dto.reminderAt);
      const alreadyApplied = current.reminderEnabled === (dto.reminderEnabled === true)
        && (current.dueAt?.getTime() ?? null) === (desired?.getTime() ?? null);
      if (alreadyApplied || current.dueAt?.getTime() !== expected?.getTime()) return this.serialize(current);
    }
    const data: Prisma.TaskUpdateInput = {};
    const changedFields: string[] = [];
    if (dto.kind !== undefined) { data.kind = dto.kind; changedFields.push("kind"); }
    if (dto.title !== undefined) { data.title = dto.title.trim(); changedFields.push("title"); }
    if (dto.notes !== undefined) { data.notes = dto.notes.trim(); changedFields.push("notes"); }
    if (dto.dueDate !== undefined) { data.dueDate = dto.dueDate.trim(); changedFields.push("dueDate"); }
    if (dto.dueTime !== undefined) { data.dueTime = dto.dueTime.trim(); changedFields.push("dueTime"); }
    if (dto.links !== undefined) { data.links = jsonInput(dto.links); changedFields.push("links"); }
    if (dto.attachments !== undefined) { data.attachments = jsonInput(dto.attachments); changedFields.push("attachments"); }
    if (dto.projectId !== undefined) { data.projectId = dto.projectId.trim() || null; changedFields.push("projectId"); }
    if (dto.stage !== undefined) { data.stage = dto.stage.trim() || null; changedFields.push("stage"); }
    if (dto.campaignId !== undefined) { data.campaignId = dto.campaignId.trim() || null; changedFields.push("campaignId"); }
    if (dto.conversationId !== undefined) { data.conversationId = dto.conversationId.trim() || null; changedFields.push("conversationId"); }

    const nextReminderAt = dto.reminderAt === undefined ? current.dueAt : parseDate(dto.reminderAt);
    if ((dto.dueDate !== undefined && dto.dueDate !== current.dueDate
      || dto.dueTime !== undefined && dto.dueTime !== current.dueTime)
      && (dto.reminderEnabled ?? current.reminderEnabled) && dto.reminderAt === undefined
      && (dto.dueTime ?? current.dueTime).trim().toLowerCase() !== "anytime") {
      throw new BadRequestException("Provide reminderAt with the updated date and time");
    }
    const wasCompleted = Boolean(current.completedAt);
    // A completed task cannot be re-armed by a stale reminder/settings PATCH.
    // The user must reopen it first, then choose a new reminder explicitly.
    const nextDueTime = dto.dueTime ?? current.dueTime;
    const nextReminderEnabled = nextDueTime.trim().toLowerCase() === "anytime" ? false : dto.completed === false
      ? (dto.reminderEnabled ?? current.reminderEnabled)
      : wasCompleted || dto.completed === true
        ? false
        : (dto.reminderEnabled ?? current.reminderEnabled);
    // A completion update wins over reminder fields from an older client
    // request. Without this guard, an in-flight reminder/settings PATCH could
    // re-arm a task after the user had already completed it.
    if (dto.completed !== true && (dto.reminderAt !== undefined || dto.reminderEnabled !== undefined || dto.reminderTone !== undefined || dto.dueDate !== undefined || dto.dueTime !== undefined)) {
      if (dto.reminderTone !== undefined) { data.reminderTone = dto.reminderTone.trim() || "default"; changedFields.push("reminderTone"); }
      if (nextReminderEnabled && (!nextReminderAt || nextReminderAt.getTime() <= Date.now())) throw new BadRequestException("Choose a future reminder time");
      data.dueAt = nextReminderEnabled ? nextReminderAt : null;
      data.reminderEnabled = nextReminderEnabled;
      data.reminderStatus = data.reminderEnabled ? TaskReminderStatus.PENDING : dto.reminderEnabled === false ? TaskReminderStatus.STOPPED : current.reminderStatus;
      data.reminderSentAt = data.reminderEnabled ? null : current.reminderSentAt;
      data.reminderStoppedAt = data.reminderEnabled ? null : dto.reminderEnabled === false ? new Date() : current.reminderStoppedAt;
      data.reminderClaimedAt = null;
      data.reminderAttempts = 0;
      data.lastReminderError = null;
      data.reminderUpcomingSentAt = null;
      changedFields.push("reminder");
    }

    if (dto.completed !== undefined && dto.completed !== Boolean(current.completedAt)) {
      data.completedAt = dto.completed ? new Date() : null;
      data.reminderEnabled = dto.completed ? false : nextReminderEnabled;
      data.reminderStatus = dto.completed ? TaskReminderStatus.STOPPED : (nextReminderEnabled ? TaskReminderStatus.PENDING : TaskReminderStatus.NONE);
      data.reminderStoppedAt = dto.completed ? new Date() : null;
      data.dueAt = dto.completed ? null : nextReminderAt;
      data.reminderSentAt = null;
      data.reminderClaimedAt = null;
      data.reminderAttempts = 0;
      data.lastReminderError = null;
      data.reminderUpcomingSentAt = null;
      changedFields.push(dto.completed ? "COMPLETED" : "REOPENED");
    }

    if (changedFields.includes("reminder") || changedFields.includes("COMPLETED") || changedFields.includes("REOPENED")) {
      data.reminderGeneration = { increment: 1 };
    }

    const updated = await (async () => {
      const result = await transaction.task.update({ where: { id: current.id }, data });
      await this.outbox.enqueueTaskReminderEvents(transaction, result);
      if (changedFields.length) {
        await transaction.taskActivity.create({
          data: {
            taskId: current.id,
            actorId: user.userId,
            action: changedFields.includes("COMPLETED") || changedFields.includes("REOPENED") ? changedFields.at(-1)! : "UPDATED",
            message: changedFields.join(", "),
            details: jsonInput(changedFields),
          },
        });
      }
      return result;
    })();
    return this.serialize(await this.findAccessible(user.userId, updated.id, transaction));
  }

  async remove(userId: string, id: string) {
    const task = await this.findAccessible(userId, id);
    if (task.createdById !== userId) throw new BadRequestException("Only the task owner can delete this task");
    await this.prisma.$transaction(async (transaction) => {
      await transaction.outboxEvent.deleteMany({ where: { aggregateType: "Task", aggregateId: id } });
      await transaction.task.delete({ where: { id } });
    });
    return { id, deleted: true };
  }

  async share(user: AuthPrincipal, id: string, recipientId: string) {
    const task = await this.findAccessible(user.userId, id);
    if (!isUuid(recipientId)) throw new BadRequestException("Task participant ID is invalid");
    const recipient = await this.prisma.user.findFirst({ where: { id: recipientId, status: "ACTIVE" }, select: { id: true, role: true, profile: { select: { displayName: true } } } });
    if (!recipient || (user.role === "BRAND" && recipient.role !== "CREATOR") || (user.role === "CREATOR" && recipient.role !== "BRAND")) throw new BadRequestException("Choose an active participant with the opposite account type");
    const brandId = user.role === "BRAND" ? user.userId : task.brandId;
    const creatorId = user.role === "BRAND" ? recipient.id : user.userId;
    if (!brandId || !creatorId) throw new ForbiddenException("An accepted campaign collaboration is required before sharing a task");
    await this.assertAcceptedCollaboration(brandId, creatorId);
    await this.prisma.$transaction([
      this.prisma.task.update({ where: { id: task.id }, data: user.role === "BRAND" ? { creatorId: recipient.id } : { brandId: recipient.id } }),
      this.prisma.taskRecipient.upsert({
        where: { taskId_userId: { taskId: task.id, userId: recipient.id } },
        create: { taskId: task.id, userId: recipient.id },
        update: { sharedAt: new Date() },
      }),
      this.prisma.taskActivity.create({ data: { taskId: task.id, actorId: user.userId, action: "SHARED", message: `Task shared with ${recipient.profile?.displayName || recipient.id}` } }),
    ]);
    const refreshed = await this.findAccessible(user.userId, task.id);
    await this.notifyParticipants(refreshed, user.userId, "Task shared with you", `${task.title} was shared with you.`);
    return this.serialize(refreshed);
  }

  async addNote(userId: string, id: string, text: string) {
    const task = await this.findAccessible(userId, id);
    await this.prisma.taskActivity.create({ data: { taskId: task.id, actorId: userId, action: "NOTE_ADDED", message: text.trim() } });
    return this.get(userId, task.id);
  }

  async updateNote(userId: string, id: string, noteId: string, text: string) {
    const task = await this.findAccessible(userId, id);
    const note = task.activities.find((activity) => activity.id === noteId && activity.action === "NOTE_ADDED");
    if (!note) throw new NotFoundException("Task note not found");
    await this.prisma.taskActivity.update({ where: { id: note.id }, data: { message: text.trim(), details: jsonInput({ edited: true }) } });
    return this.get(userId, task.id);
  }

  async removeNote(userId: string, id: string, noteId: string) {
    const task = await this.findAccessible(userId, id);
    const note = task.activities.find((activity) => activity.id === noteId && activity.action === "NOTE_ADDED");
    if (!note) throw new NotFoundException("Task note not found");
    await this.prisma.taskActivity.delete({ where: { id: note.id } });
    return this.get(userId, task.id);
  }

  private accessibleWhere(userId: string): Prisma.TaskWhereInput {
    return { OR: [{ createdById: userId }, { brandId: userId }, { creatorId: userId }, { recipients: { some: { userId } } }] };
  }

  private async findAccessible(userId: string, id: string, database: Prisma.TransactionClient = this.prisma): Promise<TaskRecord> {
    if (!isUuid(id)) throw new NotFoundException("Task not found");
    const task = await database.task.findFirst({ where: { id, ...this.accessibleWhere(userId) }, include: taskInclude });
    if (!task) throw new NotFoundException("Task not found");
    return task;
  }

  private async assertParticipant(id: string | undefined, role: "BRAND" | "CREATOR"): Promise<string | null> {
    if (!id) return null;
    if (!isUuid(id)) throw new BadRequestException("Task participant ID is invalid");
    const participant = await this.prisma.user.findFirst({ where: { id, role, status: "ACTIVE" }, select: { id: true } });
    if (!participant) throw new BadRequestException("Task participant is not available");
    return participant.id;
  }

  private async assertAcceptedCollaboration(brandId: string, creatorId: string) {
    const application = await this.prisma.campaignApplication.findFirst({
      where: { status: "ACCEPTED", creatorId, campaign: { brandId } },
      select: { id: true },
    });
    if (!application) throw new ForbiddenException("An accepted campaign collaboration is required before sharing a task");
    return application.id;
  }

  private async notifyParticipants(task: { id: string; title: string; dueDate: string; dueTime: string; createdById: string; brandId?: string | null; creatorId?: string | null; recipients?: Array<{ userId: string }> }, actorId: string, title: string, body: string) {
    const recipientIds = Array.from(new Set([task.createdById, task.brandId, task.creatorId, ...(task.recipients ?? []).map((recipient) => recipient.userId)].filter((id): id is string => Boolean(id) && id !== actorId)));
    await Promise.all(recipientIds.map((userId) => this.notifications.create(userId, {
      type: "TASK_UPDATED",
      title,
      body,
      data: { screen: "Task", taskId: task.id },
      channels: ["PUSH"],
    }).catch(() => undefined)));
  }

  private serialize(task: TaskRecord) {
    const owner = task.creator?.profile?.displayName || task.brand?.profile?.displayName || task.createdBy.profile?.displayName || "You";
    const sharedCreatorIds = Array.from(new Set([
      ...(task.creatorId ? [task.creatorId] : []),
      ...task.recipients.filter((recipient) => recipient.user.role === "CREATOR").map((recipient) => recipient.userId),
    ]));
    const firstCreatorShare = task.recipients.find((recipient) => recipient.user.role === "CREATOR");
    return {
      id: task.id,
      kind: task.kind,
      title: task.title,
      owner,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      notes: task.notes,
      reminderEnabled: task.reminderEnabled,
      reminderTone: task.reminderTone,
      reminderStatus: task.reminderStatus,
      reminderAt: task.dueAt?.toISOString() ?? null,
      reminderSentAt: task.reminderSentAt?.toISOString() ?? null,
      reminderStoppedAt: task.reminderStoppedAt?.toISOString() ?? null,
      completed: Boolean(task.completedAt),
      links: strings(task.links),
      attachments: objects(task.attachments),
      projectId: task.projectId ?? undefined,
      stage: task.stage ?? undefined,
      campaignId: task.campaignId ?? undefined,
      conversationId: task.conversationId ?? undefined,
      sourceTaskId: task.sourceTaskId ?? undefined,
      brandId: task.brandId ?? undefined,
      creatorId: task.creatorId ?? undefined,
      senderName: task.brand?.profile?.displayName ?? undefined,
      sentAt: sharedCreatorIds.length ? (firstCreatorShare?.sharedAt ?? task.createdAt).toISOString() : undefined,
      sharedWithCreatorAt: sharedCreatorIds.length ? (firstCreatorShare?.sharedAt ?? task.createdAt).toISOString() : undefined,
      sharedWithCreatorIds: sharedCreatorIds,
      noteHistory: task.activities.filter((activity) => activity.action === "NOTE_ADDED").map((activity) => ({ id: activity.id, text: activity.message ?? "", createdAt: activity.createdAt.toISOString() })),
      history: task.activities.map((activity) => ({ id: activity.id, action: activity.action, message: activity.message, details: activity.details, createdAt: activity.createdAt.toISOString() })),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }
}
