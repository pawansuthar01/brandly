import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import {
  DELIVERY_REMINDER_SNOOZE_ACTION,
  DELIVERY_REMINDER_STOP_ACTION,
  snoozeReminderFromNotification,
  stopReminderFromNotification,
  syncReminderActions,
} from "./reminders.service";

export const REMINDER_NOTIFICATION_TASK = "brandly-reminder-notification-actions";

// This module is imported by App.tsx at module scope. Expo can therefore load
// it in a headless Android JS runtime when a notification action is pressed.
if (Platform.OS !== "web") {
  try {
    if (!TaskManager.isTaskDefined(REMINDER_NOTIFICATION_TASK)) {
      TaskManager.defineTask<Notifications.NotificationTaskPayload>(
        REMINDER_NOTIFICATION_TASK,
        async ({ data, error }) => {
          if (error) throw new Error(error.message);
          if (!data) return;
          if (!("actionIdentifier" in data)) return;
          if (
            data.actionIdentifier !== DELIVERY_REMINDER_SNOOZE_ACTION
            && data.actionIdentifier !== DELIVERY_REMINDER_STOP_ACTION
          ) return;
          const result = await (data.actionIdentifier === DELIVERY_REMINDER_STOP_ACTION
            ? stopReminderFromNotification(data.notification)
            : snoozeReminderFromNotification(data.notification));
          if (result?.ownerId) await syncReminderActions(result.ownerId).catch(() => undefined);
        },
      );
    }

    void Notifications.registerTaskAsync(REMINDER_NOTIFICATION_TASK).catch(() => undefined);
  } catch {
    // Notification actions are a best-effort enhancement. They must not block
    // normal app startup when the runtime has no task-manager support.
  }
}
