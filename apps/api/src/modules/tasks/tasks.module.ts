import { Module } from "@nestjs/common";
import { OutboxService } from "../../common/events/outbox.service.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { TasksController } from "./tasks.controller.js";
import { TaskReminderService } from "./task-reminder.service.js";
import { TasksService } from "./tasks.service.js";

@Module({
  imports: [NotificationsModule],
  controllers: [TasksController],
  providers: [OutboxService, TasksService, TaskReminderService],
  exports: [TasksService, TaskReminderService],
})
export class TasksModule {}
