import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../../common/database/prisma.service.js";
import { defaultTheme, validateTheme } from "./theme-schema.js";

const scope = "mobile";
function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function note(value: unknown) { const text = asRecord(value).changeNote; if (text !== undefined && (typeof text !== "string" || text.length > 500)) throw new BadRequestException("Change note must be 500 characters or fewer"); return (text as string | undefined) ?? ""; }
function validCursor(value?: string) { if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new BadRequestException("Invalid history cursor"); }
function isUniqueConstraintError(error: unknown) { return !!error && typeof error === "object" && "code" in error && error.code === "P2002"; }
function pageSize(value?: string) { return Math.min(100, Math.max(1, Number.parseInt(value ?? "20", 10) || 20)); }

@Injectable()
export class ThemesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async active() {
    const current = await this.prisma.appThemeCurrent.findUnique({ where: { scope } });
    const version = current ? await this.prisma.appThemeVersion.findUnique({ where: { id: current.versionId } }) : null;
    const id = version?.id ?? "bundled-default-v1";
    const body = { id, name: version?.name ?? defaultTheme.name, revision: version?.revision ?? 1, published: Boolean(version), updatedAt: current?.updatedAt.toISOString() ?? version?.createdAt.toISOString() ?? null, theme: version?.document ?? defaultTheme };
    const etag = `"${createHash("sha256").update(JSON.stringify(body)).digest("hex")}"`;
    return { etag, body };
  }
  async drafts(cursor?: string, requestedTake?: string) {
    validCursor(cursor);
    const take = pageSize(requestedTake);
    const items = await this.prisma.appThemeDraft.findMany({ where: { scope }, select: { id: true, name: true, changeNote: true, revision: true, publishedRevision: true, updatedAt: true, updatedBy: true }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: take + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    const hasMore = items.length > take; if (hasMore) items.pop();
    return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
  }
  async draft(id: string) {
    const draft = await this.prisma.appThemeDraft.findFirst({ where: { id, scope } });
    if (!draft) throw new NotFoundException("Theme draft not found");
    return draft;
  }
  async createDraft(actorId: string, input: unknown) {
    const body = asRecord(input); const theme = validateTheme(body.theme ?? defaultTheme, { allowLowContrast: true }); const name = typeof body.name === "string" ? body.name.trim() : theme.name;
    if (!name || name.length > 80) throw new ConflictException("Theme name must be 1 to 80 characters");
    try { return await this.prisma.appThemeDraft.create({ data: { scope, name, document: { ...theme, name }, changeNote: note(body), updatedBy: actorId } }); }
    catch (error) { if (isUniqueConstraintError(error)) throw new ConflictException("A draft with this name already exists"); throw error; }
  }
  async updateDraft(actorId: string, id: string, input: unknown) {
    const body = asRecord(input); const current = await this.prisma.appThemeDraft.findFirst({ where: { id, scope } });
    if (!current) throw new NotFoundException("Theme draft not found");
    if (body.expectedRevision !== current.revision) throw new ConflictException("Draft changed since it was loaded; refresh before saving");
    const theme = validateTheme(body.theme, { allowLowContrast: true }); const name = typeof body.name === "string" ? body.name.trim() : current.name;
    if (!name || name.length > 80) throw new ConflictException("Theme name must be 1 to 80 characters");
    const result = await this.prisma.appThemeDraft.updateMany({ where: { id, scope, revision: current.revision }, data: { name, document: { ...theme, name }, changeNote: note(body), revision: { increment: 1 }, updatedBy: actorId } });
    if (!result.count) throw new ConflictException("Draft changed since it was loaded; refresh before saving");
    return this.prisma.appThemeDraft.findUniqueOrThrow({ where: { id } });
  }
  async publish(actorId: string, id: string, input: unknown) {
    const body = asRecord(input);
    try { return await this.prisma.$transaction(async (tx) => {
      const draft = await tx.appThemeDraft.findFirst({ where: { id, scope } });
      if (!draft) throw new NotFoundException("Theme draft not found");
      if (body.expectedRevision !== draft.revision) throw new ConflictException("Draft changed since it was loaded; refresh before publishing");
      if (draft.publishedRevision === draft.revision) throw new ConflictException("This draft revision has already been published; save a new revision first");
      const claimed = await tx.appThemeDraft.updateMany({ where: { id, scope, revision: draft.revision, publishedRevision: draft.publishedRevision }, data: { publishedRevision: draft.revision } });
      if (!claimed.count) throw new ConflictException("Draft changed while publishing; refresh before retrying");
      const last = await tx.appThemeVersion.findFirst({ where: { scope, name: draft.name }, orderBy: { revision: "desc" } });
      const current = await tx.appThemeCurrent.findUnique({ where: { scope } });
      const version = await tx.appThemeVersion.create({ data: { scope, name: draft.name, revision: (last?.revision ?? 0) + 1, document: validateTheme(draft.document), changeNote: note(body) || draft.changeNote, sourceId: current?.versionId ?? null, authorId: actorId } });
      await tx.appThemeActivation.create({ data: { scope, versionId: version.id, actorId, action: "PUBLISH" } });
      await tx.appThemeCurrent.upsert({ where: { scope }, create: { scope, versionId: version.id, actorId }, update: { versionId: version.id, actorId } });
      return version;
    }); } catch (error) { if (isUniqueConstraintError(error)) throw new ConflictException("A concurrent publish used this revision; refresh history before retrying"); throw error; }
  }
  async versions(cursor?: string, requestedTake?: string) {
    validCursor(cursor);
    const take = pageSize(requestedTake);
    const [items, active] = await Promise.all([
      this.prisma.appThemeVersion.findMany({ where: { scope }, select: { id: true, name: true, revision: true, changeNote: true, sourceId: true, authorId: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: take + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) }),
      this.prisma.appThemeCurrent.findUnique({ where: { scope } }),
    ]);
    const hasMore = items.length > take; if (hasMore) items.pop();
    return { items: items.map((item) => ({ ...item, active: item.id === active?.versionId })), nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
  }
  async version(id: string) { const item = await this.prisma.appThemeVersion.findFirst({ where: { id, scope } }); if (!item) throw new NotFoundException("Theme version not found"); return item; }
  async activations(cursor?: string, requestedTake?: string) {
    validCursor(cursor);
    const take = pageSize(requestedTake);
    const items = await this.prisma.appThemeActivation.findMany({ where: { scope }, select: { id: true, actorId: true, action: true, createdAt: true, version: { select: { id: true, name: true, revision: true, changeNote: true, authorId: true, createdAt: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: take + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    const hasMore = items.length > take; if (hasMore) items.pop();
    return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
  }
  async activate(actorId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const version = await tx.appThemeVersion.findFirst({ where: { id, scope } });
      if (!version) throw new NotFoundException("Theme version not found");
      await tx.appThemeActivation.create({ data: { scope, versionId: version.id, actorId, action: "RESTORE" } });
      await tx.appThemeCurrent.upsert({ where: { scope }, create: { scope, versionId: version.id, actorId }, update: { versionId: version.id, actorId } });
      return { version, restored: true };
    });
  }
}
