import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module.js";
import { TaskReminderService } from "../modules/tasks/task-reminder.service.js";
import { NotificationsService } from "../modules/notifications/notifications.service.js";

const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
const reminders = app.get(TaskReminderService);
const notifications = app.get(NotificationsService);
let running = false;
let receiptsRunning = false;
const tick = async () => {
  if (running) return;
  running = true;
  try { await reminders.processDueReminders(); } finally { running = false; }
};
const receiptTick = async () => {
  if (receiptsRunning) return;
  receiptsRunning = true;
  try { await notifications.processPushReceipts(); } finally { receiptsRunning = false; }
};
await tick();
await receiptTick();
const timer = setInterval(() => void tick(), 1_000) as unknown as NodeJS.Timeout;
const receiptTimer = setInterval(() => void receiptTick(), 60_000) as unknown as NodeJS.Timeout;
timer.unref();
receiptTimer.unref();
const shutdown = async () => { clearInterval(timer); clearInterval(receiptTimer); await app.close(); process.exit(0); };
process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());
