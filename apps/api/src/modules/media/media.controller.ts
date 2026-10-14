import { Body, Controller, Delete, Get, Inject, NotFoundException, Param, Post, Req, Res, StreamableFile, UseGuards } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AuthGuard } from "../../common/auth/auth.guard.js";
import { CurrentUser } from "../../common/auth/current-user.decorator.js";
import type { AuthPrincipal } from "../../common/auth/auth.types.js";
import { PrismaService } from "../../common/database/prisma.service.js";
import { MediaStorageService } from "./media-storage.service.js";

@Controller("media")
export class MediaController {
  constructor(@Inject(MediaStorageService) private readonly media: MediaStorageService, @Inject(PrismaService) private readonly prisma: PrismaService) {}

  @UseGuards(AuthGuard)
  @Post("upload")
  async upload(@CurrentUser() user: AuthPrincipal, @Req() request: FastifyRequest) {
    const part = await request.file();
    if (!part) throw new NotFoundException("No file provided.");
    const owner = await this.owner(user.userId, user.role === "ADMIN");
    const categoryPart = part.fields.category;
    const category = categoryPart && !Array.isArray(categoryPart) && categoryPart.type === "field" ? String(categoryPart.value) : "misc";
    const stored = await this.media.saveStream(owner, category, part.filename, part.mimetype, part.file);
    return { ...stored, url: this.url(request, stored.key) };
  }

  @UseGuards(AuthGuard)
  @Post("upload-base64")
  async uploadBase64(@CurrentUser() user: AuthPrincipal, @Req() request: FastifyRequest, @Body() body: unknown) {
    if (!body || typeof body !== "object") throw new NotFoundException("No file provided.");
    const input = body as Record<string, unknown>;
    const data = typeof input.data === "string" ? input.data.replace(/^data:[^;]+;base64,/, "") : "";
    if (!data || data.length > 8 * 1024 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) {
      throw new NotFoundException("The selected file could not be uploaded.");
    }
    const owner = await this.owner(user.userId, user.role === "ADMIN");
    const name = typeof input.name === "string" && input.name.trim() ? input.name : "attachment";
    const type = typeof input.type === "string" && input.type.trim() ? input.type : "application/octet-stream";
    const stored = await this.media.save(owner, typeof input.category === "string" ? input.category : "misc", name, type, Buffer.from(data, "base64"));
    return { ...stored, url: this.url(request, stored.key) };
  }

  @Get("files/:userFolder/:category/:fileName")
  async file(@Param("userFolder") userFolder: string, @Param("category") category: string, @Param("fileName") fileName: string, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const range = this.parseRange(request.headers.range);
    const result = await this.media.readStream(["user", userFolder, category, fileName].join("/"), range ?? undefined);
    const start = range?.start ?? 0;
    const end = range?.end ?? result.size - 1;
    reply.header("Accept-Ranges", "bytes").header("Cache-Control", "public, max-age=31536000, immutable").header("Content-Length", String(end - start + 1));
    if (range) reply.code(206).header("Content-Range", `bytes ${start}-${end}/${result.size}`);
    return new StreamableFile(result.stream, { type: result.mimeType });
  }

  @UseGuards(AuthGuard)
  @Delete("files/:userFolder/:category/:fileName")
  async remove(@CurrentUser() user: AuthPrincipal, @Param("userFolder") userFolder: string, @Param("category") category: string, @Param("fileName") fileName: string) {
    const owner = await this.owner(user.userId);
    await this.media.deleteOwned(owner, ["user", userFolder, category, fileName].join("/"));
    return { deleted: true };
  }

  private async owner(userId: string, admin = false) {
    if (admin) return { id: "brandly-admin", phoneE164: null, displayName: "Brandly" };
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, phoneE164: true, profile: { select: { displayName: true } } } });
    if (!user) throw new NotFoundException("User not found.");
    return { id: user.id, phoneE164: user.phoneE164, displayName: user.profile?.displayName ?? null };
  }

  private url(request: FastifyRequest, key: string): string {
    const configured = process.env.MEDIA_PUBLIC_URL?.trim().replace(/\/+$/, "");
    const forwardedProto = request.headers["x-forwarded-proto"];
    const protocol = typeof forwardedProto === "string" ? forwardedProto.split(",")[0] : "http";
    const host = request.headers.host || `localhost:${process.env.PORT ?? 3000}`;
    const base = configured || `${protocol}://${host}/v1`;
    return `${base}/media/files/${key.split("/").slice(1).map(encodeURIComponent).join("/")}`;
  }

  private parseRange(value: string | undefined): { start: number; end: number } | null {
    if (!value) return null;
    const match = /^bytes=(\d+)-(\d*)$/.exec(value.trim());
    if (!match) return null;
    const start = Number(match[1]);
    const requestedEnd = match[2] ? Number(match[2]) : Number.MAX_SAFE_INTEGER;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start < 0 || requestedEnd < start) return null;
    return { start, end: requestedEnd };
  }
}
