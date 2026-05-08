export type Lang = "ar" | "en";
export type Period = "AM" | "PM";

export type DateWithDay = {
  day: string;
  full: string;
  line: string;
  toString: () => string;
  valueOf: () => string;
};

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseDateISO(dateISO: string): Date | null {
  const value = cleanText(dateISO);
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month, day));

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function toISODate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function makeDateWithDay(day: string, full: string): DateWithDay {
  const line = `${day} ${full}`.trim();

  return {
    day,
    full,
    line,
    toString: () => line,
    valueOf: () => line,
  };
}

export function normalizeSubject(subject: unknown): string {
  return cleanText(subject);
}

export function normalizePeriod(period: unknown): Period {
  const raw = cleanText(period).toUpperCase();

  if (raw === "PM" || raw === "BM" || raw === "SECOND" || raw === "2") {
    return "PM";
  }

  return "AM";
}

export function formatPeriod(period?: unknown, lang: Lang = "ar"): string {
  const normalized = normalizePeriod(period);

  if (lang === "en") {
    return normalized === "PM" ? "Second Period" : "First Period";
  }

  return normalized === "PM" ? "الفترة الثانية" : "الفترة الأولى";
}

export function taskLabel(taskType: unknown, lang: Lang = "ar"): string {
  const raw = cleanText(taskType).toUpperCase();

  if (lang === "en") {
    switch (raw) {
      case "INVIGILATION":
        return "Invigilation";
      case "RESERVE":
        return "Reserve";
      case "DUTY_INVIGILATOR":
      case "FLOOR_MONITOR":
      case "HALL_MONITOR":
      case "CORRIDOR_MONITOR":
        return "Duty Invigilator";
      case "REVIEW_FREE":
        return "Review Free";
      case "CORRECTION_FREE":
        return "Correction Free";
      default:
        return "Task";
    }
  }

  switch (raw) {
    case "INVIGILATION":
      return "مراقبة";
    case "RESERVE":
      return "احتياط";
    case "DUTY_INVIGILATOR":
    case "FLOOR_MONITOR":
    case "HALL_MONITOR":
    case "CORRIDOR_MONITOR":
      return "مراقب دور";
    case "REVIEW_FREE":
      return "مراجعة";
    case "CORRECTION_FREE":
      return "تصحيح";
    default:
      return "مهمة";
  }
}

export function taskTypeLabel(taskType: string): string {
  return taskLabel(taskType, "ar");
}

export function getCommitteeNo(assignment: any): string | undefined {
  const value =
    assignment?.committeeNo ??
    assignment?.committee ??
    assignment?.roomNo ??
    assignment?.room ??
    assignment?.committeeNumber ??
    assignment?.committeeIndex;

  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return String(value);
}

export function formatDateWithDay(dateISO: string, lang: Lang = "ar"): DateWithDay {
  const value = cleanText(dateISO);

  if (!value) {
    return makeDateWithDay("—", "—");
  }

  const date = parseDateISO(value);

  if (!date) {
    return makeDateWithDay(value, value);
  }

  const locale = lang === "en" ? "en" : "ar";

  const day = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC",
  }).format(date);

  const full = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);

  return makeDateWithDay(day, full);
}

export function formatDateWithDayAr(dateISO: string): DateWithDay {
  return formatDateWithDay(dateISO, "ar");
}

export function shiftWeekendToSunday(dateISO: string): string {
  const date = parseDateISO(dateISO);

  if (!date) {
    return cleanText(dateISO);
  }

  const day = date.getUTCDay();

  // Friday -> Sunday
  if (day === 5) {
    date.setUTCDate(date.getUTCDate() + 2);
    return toISODate(date);
  }

  // Saturday -> Sunday
  if (day === 6) {
    date.setUTCDate(date.getUTCDate() + 1);
    return toISODate(date);
  }

  return toISODate(date);
}

export function isSameSubject(a: unknown, b: unknown): boolean {
  return normalizeSubject(a).toLowerCase() === normalizeSubject(b).toLowerCase();
}

export function isInvigilationTask(taskType: unknown): boolean {
  return cleanText(taskType).toUpperCase() === "INVIGILATION";
}

export function isReserveTask(taskType: unknown): boolean {
  return cleanText(taskType).toUpperCase() === "RESERVE";
}

export function isDutyInvigilatorTask(taskType: unknown): boolean {
  const raw = cleanText(taskType).toUpperCase();

  return (
    raw === "DUTY_INVIGILATOR" ||
    raw === "FLOOR_MONITOR" ||
    raw === "HALL_MONITOR" ||
    raw === "CORRIDOR_MONITOR"
  );
}