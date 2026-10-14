import { Body, Controller, ForbiddenException, Get, Headers, Inject, Param, Post, Put, Query, Res, UseGuards } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { AuthGuard } from "../../common/auth/auth.guard.js";
import { CurrentUser } from "../../common/auth/current-user.decorator.js";
import type { AuthPrincipal } from "../../common/auth/auth.types.js";
import { ThemesService } from "./themes.service.js";

@Controller("app-themes")
export class PublicThemesController {
  constructor(@Inject(ThemesService) private readonly themes: ThemesService) {}
  @Get("active")
  async active(@Headers("if-none-match") etag: string | undefined, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.themes.active();
    reply.header("ETag", result.etag).header("Cache-Control", "public, max-age=0, s-maxage=30, must-revalidate");
    const validators = etag?.split(",").map((item) => item.trim()) ?? [];
    if (validators.includes("*") || validators.some((item) => item.replace(/^W\//, "") === result.etag)) { reply.code(304); return undefined; }
    return result.body;
  }
}

@Controller("admin/themes")
@UseGuards(AuthGuard)
export class AdminThemesController {
  constructor(@Inject(ThemesService) private readonly themes: ThemesService) {}
  private assertAdmin(user: AuthPrincipal) { if (user.role !== "ADMIN") throw new ForbiddenException("Admin access required"); }
  @Get("drafts") drafts(@CurrentUser() user: AuthPrincipal, @Query("cursor") cursor?: string, @Query("take") take?: string) { this.assertAdmin(user); return this.themes.drafts(cursor, take); }
  @Get("drafts/:id") draft(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) { this.assertAdmin(user); return this.themes.draft(id); }
  @Post("drafts") create(@CurrentUser() user: AuthPrincipal, @Body() body: unknown) { this.assertAdmin(user); return this.themes.createDraft(user.userId, body); }
  @Put("drafts/:id") update(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() body: unknown) { this.assertAdmin(user); return this.themes.updateDraft(user.userId, id, body); }
  @Post("drafts/:id/publish") publish(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() body: unknown) { this.assertAdmin(user); return this.themes.publish(user.userId, id, body); }
  @Get("versions") versions(@CurrentUser() user: AuthPrincipal, @Query("cursor") cursor?: string, @Query("take") take?: string) { this.assertAdmin(user); return this.themes.versions(cursor, take); }
  @Get("versions/:id") version(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) { this.assertAdmin(user); return this.themes.version(id); }
  @Get("activations") activations(@CurrentUser() user: AuthPrincipal, @Query("cursor") cursor?: string, @Query("take") take?: string) { this.assertAdmin(user); return this.themes.activations(cursor, take); }
  @Post("versions/:id/activate") activate(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) { this.assertAdmin(user); return this.themes.activate(user.userId, id); }
}
