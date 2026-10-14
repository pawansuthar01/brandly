import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../common/database/prisma.service.js";
import type { AuthPrincipal } from "../../common/auth/auth.types.js";
import { STUDIO_STAGES, type CreateStudioIdeaDto, type StudioNoteDto, type StudioStageDto, type UpdateStudioIdeaDto, type UpdateStudioProjectDto } from "./studio.dto.js";

const json = (value: unknown) => value as Prisma.InputJsonValue;
const isRecord = (value: Prisma.JsonValue | null | undefined): value is Prisma.JsonObject => Boolean(value && typeof value === "object" && !Array.isArray(value));
const record = (value: Prisma.JsonValue | null | undefined): Record<string, unknown> => isRecord(value) ? { ...value } : {};
const records = (value: Prisma.JsonValue | null | undefined): Record<string, unknown>[] => Array.isArray(value) ? value.filter((item) => Boolean(item && typeof item === "object" && !Array.isArray(item))) as Record<string, unknown>[] : [];
const unknownRecord = (value: unknown): Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value)) ? value as Record<string, unknown> : {};
const stageIndex = (stage: string) => STUDIO_STAGES.indexOf(stage as typeof STUDIO_STAGES[number]);

const stageRequired: Partial<Record<typeof STUDIO_STAGES[number], Array<[string, string]>>> = {
  Idea: [["concept", "Idea / concept"], ["title", "Title"], ["description", "Description"]],
  Scripting: [["hook", "Hook"], ["script", "Script"]],
  Shooting: [["shootDate", "Shoot date"], ["shootLocation", "Shoot location"], ["equipment", "Equipment"]],
  Editing: [["editingNotes", "Editing notes"], ["editor", "Editor / status owner"]],
  Thumbnail: [["thumbnailUrl", "Thumbnail link"]],
  Scheduled: [["scheduledDate", "Scheduled date"], ["scheduledTime", "Scheduled time"], ["platform", "Platform"]],
  Published: [["publishedUrl", "Published URL"], ["publishedDate", "Published date"], ["publishedTime", "Published time"], ["platform", "Platform"]],
};

function validateStage(stage: string, data: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  for (const [key, label] of stageRequired[stage as typeof STUDIO_STAGES[number]] ?? []) {
    if (typeof data[key] !== "string" || !data[key].trim()) errors[key] = `${label} is required.`;
  }
  return errors;
}

function workflowSteps(currentStage: string, stageData: Record<string, unknown>, saved: Record<string, unknown>[] = []) {
  const current = Math.max(0, stageIndex(currentStage));
  return STUDIO_STAGES.map((stage, index) => {
    const previous = saved.find((item) => item.stage === stage);
    const status = index < current ? "completed" : index > current ? "locked" : previous?.status === "completed" ? "completed" : stageData[stage] ? "draft" : "current";
    return { stage, completed: status === "completed", status, ...(typeof previous?.notes === "string" ? { notes: previous.notes } : {}) };
  });
}

const ideaInclude = { project: { select: { id: true } } } satisfies Prisma.StudioIdeaInclude;
const projectInclude = { idea: true } satisfies Prisma.StudioProjectInclude;

@Injectable()
export class StudioService {
  constructor(private readonly prisma: PrismaService) {}

  private assertCreator(user: AuthPrincipal) {
    if (user.role !== "CREATOR") throw new ForbiddenException("Creator Studio is available for creator accounts only");
  }

  private async idea(userId: string, id: string, transaction: Prisma.TransactionClient | PrismaService = this.prisma) {
    const item = await transaction.studioIdea.findFirst({ where: { id, ownerId: userId }, include: ideaInclude });
    if (!item) throw new NotFoundException("Idea not found");
    return item;
  }

  private async project(userId: string, id: string, transaction: Prisma.TransactionClient | PrismaService = this.prisma) {
    const item = await transaction.studioProject.findFirst({ where: { id, ownerId: userId }, include: projectInclude });
    if (!item) throw new NotFoundException("Project not found");
    return item;
  }

  private serializeIdea(item: Prisma.StudioIdeaGetPayload<{ include: typeof ideaInclude }>) {
    return {
      id: item.id,
      title: item.title,
      concept: item.concept,
      description: item.description,
      ideaNotes: item.ideaNotes,
      platform: item.platform,
      archived: item.archived,
      ...(item.project ? { projectId: item.project.id } : {}),
      ...(item.budget ? { budget: item.budget } : {}),
      ...(item.reminderDate ? { reminderDate: item.reminderDate } : {}),
      ...(item.shootLocation ? { shootLocation: item.shootLocation } : {}),
      ...(item.equipment ? { equipment: item.equipment } : {}),
      ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}),
      ...(item.attachment ? { attachment: item.attachment } : {}),
      notes: records(item.notes),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private serializeProject(item: Prisma.StudioProjectGetPayload<{ include: typeof projectInclude }>) {
    return {
      id: item.id,
      ideaId: item.ideaId,
      title: item.title,
      description: item.description,
      platform: item.platform,
      ...(item.budget ? { budget: item.budget } : {}),
      ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}),
      ...(item.attachment ? { attachment: item.attachment } : {}),
      ...(item.reminderDate ? { reminderDate: item.reminderDate } : {}),
      ...(item.shootLocation ? { shootLocation: item.shootLocation } : {}),
      ...(item.equipment ? { equipment: item.equipment } : {}),
      ...(item.dueDate ? { dueDate: item.dueDate } : {}),
      assignedTo: item.assignedTo,
      currentStage: item.currentStage,
      workflowSteps: records(item.workflowSteps),
      stageData: record(item.stageData),
      validationErrors: record(item.validationErrors),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  async list(user: AuthPrincipal) {
    this.assertCreator(user);
    const [ideas, projects] = await Promise.all([
      this.prisma.studioIdea.findMany({ where: { ownerId: user.userId }, include: ideaInclude, orderBy: { updatedAt: "desc" } }),
      this.prisma.studioProject.findMany({ where: { ownerId: user.userId }, include: projectInclude, orderBy: { updatedAt: "desc" } }),
    ]);
    return { ideas: ideas.map((item) => this.serializeIdea(item)), projects: projects.map((item) => this.serializeProject(item)) };
  }

  async createIdea(user: AuthPrincipal, dto: CreateStudioIdeaDto) {
    this.assertCreator(user);
    const item = await this.prisma.studioIdea.create({ data: {
      ownerId: user.userId,
      title: dto.title.trim(), concept: dto.concept?.trim() ?? "", description: dto.description?.trim() ?? "", ideaNotes: dto.ideaNotes?.trim() ?? "",
      platform: dto.platform, archived: dto.archived === true, budget: dto.budget?.trim() || null, reminderDate: dto.reminderDate?.trim() || null,
      shootLocation: dto.shootLocation?.trim() || null, equipment: dto.equipment?.trim() || null, sourceUrl: dto.sourceUrl?.trim() || null,
      attachment: dto.attachment ? json(dto.attachment) : undefined, notes: json([]),
    }, include: ideaInclude });
    return this.serializeIdea(item);
  }

  async updateIdea(user: AuthPrincipal, id: string, dto: UpdateStudioIdeaDto) {
    this.assertCreator(user);
    await this.idea(user.userId, id);
    const item = await this.prisma.studioIdea.update({ where: { id }, data: {
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}), ...(dto.concept !== undefined ? { concept: dto.concept.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description.trim() } : {}), ...(dto.ideaNotes !== undefined ? { ideaNotes: dto.ideaNotes.trim() } : {}),
      ...(dto.platform !== undefined ? { platform: dto.platform } : {}), ...(dto.archived !== undefined ? { archived: dto.archived } : {}),
      ...(dto.budget !== undefined ? { budget: dto.budget.trim() || null } : {}), ...(dto.reminderDate !== undefined ? { reminderDate: dto.reminderDate.trim() || null } : {}),
      ...(dto.shootLocation !== undefined ? { shootLocation: dto.shootLocation.trim() || null } : {}), ...(dto.equipment !== undefined ? { equipment: dto.equipment.trim() || null } : {}),
      ...(dto.sourceUrl !== undefined ? { sourceUrl: dto.sourceUrl.trim() || null } : {}), ...(dto.attachment !== undefined ? { attachment: dto.attachment ? json(dto.attachment) : Prisma.DbNull } : {}),
      ...(dto.notes !== undefined ? { notes: json(dto.notes) } : {}),
    }, include: ideaInclude });
    const project = await this.prisma.studioProject.findUnique({ where: { ideaId: id } });
    if (project) {
      const projectStageData = record(project.stageData);
      const ideaStageData = unknownRecord(projectStageData.Idea);
      const stageData = {
        ...projectStageData,
        Idea: { ...ideaStageData, title: item.title, concept: item.concept, description: item.description, notes: item.ideaNotes, referenceUrl: item.sourceUrl ?? "", budget: item.budget ?? "", reminderDate: item.reminderDate ?? "", shootLocation: item.shootLocation ?? "", equipment: item.equipment ?? "", attachments: item.attachment ? [item.attachment] : [] },
      };
      await this.prisma.studioProject.update({ where: { id: project.id }, data: { title: item.title, description: item.description, platform: item.platform === "Instagram" || item.platform === "YouTube" ? item.platform : "Other", budget: item.budget, sourceUrl: item.sourceUrl, attachment: item.attachment ?? Prisma.DbNull, reminderDate: item.reminderDate, shootLocation: item.shootLocation, equipment: item.equipment, stageData: json(stageData) } });
    }
    return this.serializeIdea(item);
  }

  async addNote(user: AuthPrincipal, id: string, dto: StudioNoteDto) {
    this.assertCreator(user);
    const item = await this.idea(user.userId, id);
    const notes = [...records(item.notes), { id: randomUUID(), text: dto.text.trim(), createdAt: new Date().toISOString() }];
    return this.updateIdea(user, id, { notes } as UpdateStudioIdeaDto);
  }

  async updateNote(user: AuthPrincipal, id: string, noteId: string, dto: StudioNoteDto) {
    this.assertCreator(user);
    const item = await this.idea(user.userId, id);
    const notes = records(item.notes).map((note) => note.id === noteId ? { ...note, text: dto.text.trim() } : note);
    return this.updateIdea(user, id, { notes } as UpdateStudioIdeaDto);
  }

  async removeNote(user: AuthPrincipal, id: string, noteId: string) {
    this.assertCreator(user);
    const item = await this.idea(user.userId, id);
    return this.updateIdea(user, id, { notes: records(item.notes).filter((note) => note.id !== noteId) } as UpdateStudioIdeaDto);
  }

  async createProject(user: AuthPrincipal, ideaId: string) {
    this.assertCreator(user);
    return this.prisma.$transaction(async (transaction) => {
      const idea = await this.idea(user.userId, ideaId, transaction);
      const existing = await transaction.studioProject.findUnique({ where: { ideaId }, include: projectInclude });
      if (existing) return this.serializeProject(existing);
      const stageData = { Idea: { concept: idea.concept || idea.description, title: idea.title, description: idea.description, notes: idea.ideaNotes, referenceUrl: idea.sourceUrl ?? "", budget: idea.budget ?? "", reminderDate: idea.reminderDate ?? "", shootLocation: idea.shootLocation ?? "", equipment: idea.equipment ?? "", attachments: idea.attachment ? [idea.attachment] : [] } };
      const project = await transaction.studioProject.create({ data: {
        ownerId: user.userId, ideaId, title: idea.title, description: idea.description, platform: idea.platform === "Instagram" || idea.platform === "YouTube" ? idea.platform : "Other", budget: idea.budget, sourceUrl: idea.sourceUrl, attachment: idea.attachment ?? undefined,
        reminderDate: idea.reminderDate, shootLocation: idea.shootLocation, equipment: idea.equipment, dueDate: idea.reminderDate, assignedTo: "You", currentStage: "Idea",
        workflowSteps: json(workflowSteps("Idea", stageData)), stageData: json(stageData), validationErrors: json({}),
      }, include: projectInclude });
      return this.serializeProject(project);
    });
  }

  async updateProject(user: AuthPrincipal, id: string, dto: UpdateStudioProjectDto) {
    this.assertCreator(user);
    await this.project(user.userId, id);
    const project = await this.prisma.studioProject.update({ where: { id }, data: {
      ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate?.trim() || null } : {}), ...(dto.assignedTo !== undefined ? { assignedTo: dto.assignedTo.trim() || "You" } : {}), ...(dto.archived !== undefined ? { archived: dto.archived } : {}),
    }, include: projectInclude });
    return this.serializeProject(project);
  }

  async updateStage(user: AuthPrincipal, id: string, dto: StudioStageDto) {
    this.assertCreator(user);
    const current = await this.project(user.userId, id);
    const currentIndex = stageIndex(current.currentStage);
    const targetIndex = stageIndex(dto.stage);
    if (targetIndex > currentIndex) throw new BadRequestException("Complete the previous stage first");
    const stageData = { ...record(current.stageData), [dto.stage]: dto.data };
    const validationErrors = { ...record(current.validationErrors) } as Record<string, unknown>;
    const errors = validateStage(dto.stage, dto.data);
    if (dto.complete && Object.keys(errors).length) {
      validationErrors[dto.stage] = errors;
      throw new BadRequestException({ message: "Complete the required stage fields before continuing", errors });
    }
    if (!Object.keys(errors).length) delete validationErrors[dto.stage];
    let nextStage = current.currentStage;
    if (dto.complete && targetIndex === currentIndex && targetIndex < STUDIO_STAGES.length - 1) nextStage = STUDIO_STAGES[targetIndex + 1];
    const savedSteps = records(current.workflowSteps);
    const steps = workflowSteps(nextStage, stageData, savedSteps).map((step) => {
      if (step.stage === dto.stage && dto.complete) return { ...step, completed: true, status: "completed" };
      if (step.stage === current.currentStage && dto.complete && targetIndex === currentIndex && targetIndex < STUDIO_STAGES.length - 1) return { ...step, completed: true, status: "completed" };
      return step;
    });
    const project = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.studioProject.update({ where: { id }, data: { stageData: json(stageData), validationErrors: json(validationErrors), currentStage: nextStage, workflowSteps: json(steps), ...(dto.stage === "Idea" ? {
        title: typeof dto.data.title === "string" ? dto.data.title : current.title,
        description: typeof dto.data.description === "string" ? dto.data.description : current.description,
        ...(Array.isArray(dto.data.attachments) ? { attachment: dto.data.attachments[0] ? json(dto.data.attachments[0]) : Prisma.DbNull } : {}),
      } : {}) }, include: projectInclude });
      if (dto.stage === "Idea") {
        await transaction.studioIdea.update({ where: { id: current.ideaId }, data: {
          ...(typeof dto.data.title === "string" ? { title: dto.data.title.trim() } : {}),
          ...(typeof dto.data.concept === "string" ? { concept: dto.data.concept.trim() } : {}),
          ...(typeof dto.data.description === "string" ? { description: dto.data.description.trim() } : {}),
          ...(typeof dto.data.notes === "string" ? { ideaNotes: dto.data.notes.trim() } : {}),
          ...(typeof dto.data.referenceUrl === "string" ? { sourceUrl: dto.data.referenceUrl.trim() || null } : {}),
          ...(typeof dto.data.budget === "string" ? { budget: dto.data.budget.trim() || null } : {}),
          ...(typeof dto.data.reminderDate === "string" ? { reminderDate: dto.data.reminderDate.trim() || null } : {}),
          ...(typeof dto.data.shootLocation === "string" ? { shootLocation: dto.data.shootLocation.trim() || null } : {}),
          ...(typeof dto.data.equipment === "string" ? { equipment: dto.data.equipment.trim() || null } : {}),
          ...(Array.isArray(dto.data.attachments) ? { attachment: dto.data.attachments[0] ? json(dto.data.attachments[0]) : Prisma.DbNull } : {}),
        } });
      }
      return updated;
    });
    return this.serializeProject(project);
  }
}
