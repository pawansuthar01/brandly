import type { TodoTask } from "../types/marketplace";

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function getTaskCompletionDays(tasks: TodoTask[]) {
  const completedDays = new Set<string>();
  for (const task of tasks) {
    const lastActionByDay = new Map<string, { action: string; at: number }>();
    for (const activity of task.history ?? []) {
      if (activity.action !== "COMPLETED" && activity.action !== "REOPENED") continue;
      const at = Date.parse(activity.createdAt);
      if (!Number.isFinite(at)) continue;
      const key = dateKey(new Date(at));
      const previous = lastActionByDay.get(key);
      if (!previous || at >= previous.at) lastActionByDay.set(key, { action: activity.action, at });
    }
    for (const [key, activity] of lastActionByDay) {
      if (activity.action === "COMPLETED") completedDays.add(key);
    }
  }
  return completedDays;
}

export function getDailyStreak(tasks: TodoTask[], now = new Date()) {
  const completedDays = getTaskCompletionDays(tasks);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = dateKey(today);
  const todayCompleted = completedDays.has(todayKey);
  const cursor = new Date(today);
  if (!todayCompleted) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (completedDays.has(dateKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { completedDays, todayKey, todayCompleted, current };
}

export function streakReminderDate(now = new Date(), todayCompleted = false) {
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (todayCompleted) target.setDate(target.getDate() + 1);
  target.setHours(23, 0, 0, 0);
  return target;
}
