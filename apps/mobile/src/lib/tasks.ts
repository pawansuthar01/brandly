import type { TodoTask } from "../types/marketplace";

const pad = (value: number) => String(value).padStart(2, "0");

export function taskDateKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function taskDateKey(value: string) {
  const prefix = value.trim().match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (prefix) return prefix;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.trim();
  return taskDateKeyFromDate(parsed);
}

export function normalizeTodoTask<T extends TodoTask>(task: T): T {
  const safeString = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
  const safeArray = <TValue,>(value: unknown): TValue[] => Array.isArray(value) ? value as TValue[] : [];
  return {
    ...task,
    title: safeString(task.title, "Untitled task"),
    owner: safeString(task.owner, "You"),
    dueDate: taskDateKey(safeString(task.dueDate)),
    dueTime: safeString(task.dueTime, "Anytime"),
    notes: safeString(task.notes),
    links: safeArray<string>(task.links),
    attachments: safeArray(task.attachments),
  };
}

export function taskDateRange(date = new Date(), beforeDays = 30, afterDays = 90) {
  const from = new Date(date.getFullYear(), date.getMonth(), date.getDate() - beforeDays);
  const to = new Date(date.getFullYear(), date.getMonth(), date.getDate() + afterDays);
  return {
    from: taskDateKeyFromDate(from),
    to: taskDateKeyFromDate(to),
  };
}
