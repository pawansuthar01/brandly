import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../common/auth/auth.guard.js";
import { CurrentUser } from "../../common/auth/current-user.decorator.js";
import type { AuthPrincipal } from "../../common/auth/auth.types.js";
import { CreateTaskDto, TaskListQueryDto, TaskNoteDto, UpdateTaskDto } from "./tasks.dto.js";
import { TasksService } from "./tasks.service.js";

@Controller("tasks")
@UseGuards(AuthGuard)
export class TasksController {
  constructor(@Inject(TasksService) private readonly tasks: TasksService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query() query: TaskListQueryDto) { return this.tasks.list(user.userId, query); }

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateTaskDto) { return this.tasks.create(user, dto); }

  @Get(":id")
  get(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) { return this.tasks.get(user.userId, id); }

  @Get(":id/history")
  history(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) { return this.tasks.history(user.userId, id); }

  @Patch(":id")
  update(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() dto: UpdateTaskDto) { return this.tasks.update(user, id, dto); }

  @Delete(":id")
  remove(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) { return this.tasks.remove(user.userId, id); }

  @Post(":id/share")
  share(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body("userId") userId: string) { return this.tasks.share(user, id, userId); }

  @Post(":id/notes")
  addNote(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Body() dto: TaskNoteDto) { return this.tasks.addNote(user.userId, id, dto.text); }

  @Patch(":id/notes/:noteId")
  updateNote(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Param("noteId") noteId: string, @Body() dto: TaskNoteDto) { return this.tasks.updateNote(user.userId, id, noteId, dto.text); }

  @Delete(":id/notes/:noteId")
  removeNote(@CurrentUser() user: AuthPrincipal, @Param("id") id: string, @Param("noteId") noteId: string) { return this.tasks.removeNote(user.userId, id, noteId); }
}
