export function parseReminderDateTime(
  dateValue: string,
  timeValue: string,
  now = Date.now(),
) {
  const date = dateValue.trim();
  const time = timeValue.trim();
  if (!date || !time) return null;

  const current = new Date(now);
  const isoMatch = date.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  const dateMatch = date.match(/^(\d{1,2})[\s/-]+([A-Za-z]+|\d{1,2})(?:[\s/-]+(\d{4}))?$/);
  const day = isoMatch ? Number(isoMatch[3]) : dateMatch ? Number(dateMatch[1]) : 0;
  const monthValue = isoMatch ? Number(isoMatch[2]) - 1 : dateMatch ? (/^\d+$/.test(dateMatch[2]) ? Number(dateMatch[2]) - 1 : dateMatch[2]) : "";
  const month = typeof monthValue === "number"
    ? monthValue
    : ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
        .findIndex((name) => monthValue.toLowerCase().slice(0, 3) === name);
  const explicitYear = isoMatch?.[1] ?? dateMatch?.[3];
  const year = explicitYear ? Number(explicitYear) : current.getFullYear();
  const timeMatch = time.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!day || month < 0 || month > 11 || !timeMatch) return null;
  let hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2] ?? "0");
  const meridiem = timeMatch[3]?.toUpperCase();
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
  }
  if (hours > 23 || minutes > 59) return null;
  const candidate = new Date(year, month, day, hours, minutes, 0, 0);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month ||
    candidate.getDate() !== day ||
    candidate.getHours() !== hours ||
    candidate.getMinutes() !== minutes
  ) return null;
  return candidate.getTime() > now ? candidate.getTime() : null;
}

export function formatReminderDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(timestamp);
}

export function formatReminderTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}
