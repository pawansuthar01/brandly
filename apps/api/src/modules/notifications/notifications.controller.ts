import { Body, Controller, ForbiddenException, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../common/auth/auth.guard.js";
import { CurrentUser } from "../../common/auth/current-user.decorator.js";
import type { AuthPrincipal } from "../../common/auth/auth.types.js";
import { NotificationsService } from "./notifications.service.js";
import { AdminNotificationDto, CreateNotificationDto, RegisterDeviceDto } from "./notifications.dto.js";

@Controller("notifications")
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Post("devices")
  registerDevice(@CurrentUser() user: AuthPrincipal, @Body() dto: RegisterDeviceDto) {
    return this.notifications.registerDevice(user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthPrincipal) {
    return this.notifications.list(user.userId);
  }

  @Patch(":id/read")
  markRead(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    return this.notifications.markRead(user.userId, id);
  }

  @Post("admin/send")
  sendFromAdmin(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateNotificationDto) {
    if (user.role !== "ADMIN") throw new ForbiddenException("Admin access required");
    return this.notifications.create(dto.userId, dto);
  }

  @Get("admin/logs")
  adminLogs(@CurrentUser() user: AuthPrincipal) {
    if (user.role !== "ADMIN") throw new ForbiddenException("Admin access required");
    return this.notifications.adminLogs();
  }

  @Post("admin/send-bulk")
  sendBulkFromAdmin(@CurrentUser() user: AuthPrincipal, @Body() dto: AdminNotificationDto) {
    if (user.role !== "ADMIN") throw new ForbiddenException("Admin access required");
    return this.notifications.sendBulk(dto);
  }
}
