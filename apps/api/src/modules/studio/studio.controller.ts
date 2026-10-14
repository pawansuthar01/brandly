import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../common/auth/auth.guard.js";
import { CurrentUser } from "../../common/auth/current-user.decorator.js";
import type { AuthPrincipal } from "../../common/auth/auth.types.js";
import { CreateStudioIdeaDto, StudioNoteDto, StudioStageDto, UpdateStudioIdeaDto, UpdateStudioProjectDto } from "./studio.dto.js";
import { StudioService } from "./studio.service.js";

@Controller("studio")
@UseGuards(AuthGuard)
export class StudioController {
  constructor(@Inject(StudioService) private readonly studio: StudioService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal) { return this.studio.list(user); }

  @Post("ideas")
  createIdea(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateStudioIdeaDto) { return this.studio.createIdea(user, dto); }

  @Patch("ideas/:id")
  updateIdea(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() dto: UpdateStudioIdeaDto) { return this.studio.updateIdea(user, id, dto); }

  @Post("ideas/:id/notes")
  addNote(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() dto: StudioNoteDto) { return this.studio.addNote(user, id, dto); }

  @Patch("ideas/:id/notes/:noteId")
  updateNote(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Param("noteId") noteId: string, @Body() dto: StudioNoteDto) { return this.studio.updateNote(user, id, noteId, dto); }

  @Delete("ideas/:id/notes/:noteId")
  removeNote(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Param("noteId") noteId: string) { return this.studio.removeNote(user, id, noteId); }

  @Post("ideas/:id/project")
  createProject(@CurrentUser() user: AuthPrincipal, @Param("id") ideaId: string) { return this.studio.createProject(user, ideaId); }

  @Patch("projects/:id")
  updateProject(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() dto: UpdateStudioProjectDto) { return this.studio.updateProject(user, id, dto); }

  @Patch("projects/:id/stages/:stage")
  updateStage(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Param("stage") stage: string, @Body() body: Omit<StudioStageDto, "stage">) { return this.studio.updateStage(user, id, { ...body, stage } as StudioStageDto); }
}
