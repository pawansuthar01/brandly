const malformedIso = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\d{3})Z$/;

function normalizeDateValue(value: string): string {
  const match = malformedIso.exec(value.trim());
  return match ? `${match[1]}.${match[2]}Z` : value.trim();
}

export function formatDisplayDateTime(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : new Intl.DateTimeFormat("en-IN", {
      day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
    }).format(value);
  }
  if (typeof value !== "string" && typeof value !== "number") return "";
  if (typeof value === "string" && !/^\d{4}-\d{2}-\d{2}/.test(value.trim()) && !/^\d{1,2}[\s/-]/.test(value.trim())) return value.trim();
  const parsed = new Date(typeof value === "string" ? normalizeDateValue(value) : value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(parsed);
}

export function formatDisplayDate(value: unknown): string {
  const full = formatDisplayDateTime(value);
  if (!full || !/[,:]/.test(full)) return full;
  return full.split(",")[0];
}

const localDateInput = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function formatCampaignDeadline(value: unknown): string {
  if (value === undefined || value === null || value === "" || value === "Flexible") return "Flexible";
  let date: Date;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const [year, month, day] = value.trim().split("-").map(Number);
    date = new Date(year, month - 1, day, 23, 59);
  } else {
    date = value instanceof Date ? value : new Date(typeof value === "string" ? normalizeDateValue(value) : value as number);
  }
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(date);
}

export function campaignDeadlineInputs(value?: string): { date: string; time: string } {
  if (!value?.trim() || value.trim() === "Flexible") return { date: "", time: "11:59 PM" };
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return { date: value.trim(), time: "11:59 PM" };
  const parsed = new Date(normalizeDateValue(value.trim()));
  if (Number.isNaN(parsed.getTime())) return { date: value.trim(), time: "11:59 PM" };
  return {
    date: localDateInput(parsed),
    time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(parsed),
  };
}

export function combineCampaignDeadline(dateValue: string, timeValue: string): string {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue.trim());
  const time = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(timeValue.trim());
  if (!date || !time) return "";
  if (Number(time[1]) < 1 || Number(time[1]) > 12 || Number(time[2]) > 59) return "";
  let hour = Number(time[1]) % 12;
  if (time[3].toUpperCase() === "PM") hour += 12;
  const year = Number(date[1]);
  const month = Number(date[2]);
  const day = Number(date[3]);
  const value = new Date(year, month - 1, day, hour, Number(time[2]), 0, 0);
  if (value.getFullYear() !== year || value.getMonth() !== month - 1 || value.getDate() !== day || Number(time[2]) > 59) return "";
  return value.toISOString();
}
