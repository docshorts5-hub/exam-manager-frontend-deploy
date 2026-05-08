import { formatDateWithDayAr, formatPeriod } from "../taskUtils";

export type ResultsExamRow = {
  dateISO: string;
  period: string;
  subject: string;
};

function isEnglishLang(): boolean {
  try {
    const lang = String(document?.documentElement?.lang || "").toLowerCase();
    return lang.startsWith("en");
  } catch {}
  return false;
}

const SUBJECT_TRANSLATIONS: Record<string, string> = {
  "الرياضيات": "Mathematics",
  "الرياضيات 11": "Mathematics 11",
  "الرياضيات المدرسية": "School Sports",
  "الرياضيات المدرسية 11": "School Sports 11",
  "الرياضيات المدرسية 12": "School Sports 12",
  "اللغة العربية": "Arabic Language",
  "اللغة العربية 10": "Arabic Language 10",
  "اللغة العربية 11": "Arabic Language 11",
  "اللغة الإنجليزية": "English Language",
  "اللغة الإنجليزية 11": "English Language 11",
  "التربية الإسلامية": "Islamic Education",
  "التربية الإسلامية 10": "Islamic Education 10",
  "التربية الإسلامية 11": "Islamic Education 11",
  "الجغرافيا البشرية": "Human Geography",
  "الجغرافيا البشرية 11": "Human Geography 11",
  "المهارات الموسيقية": "Musical Skills",
  "المهارات الموسيقية 11": "Musical Skills 11",
  "الفنون التشكيلية": "Fine Arts",
  "الفنون التشكيلية 11": "Fine Arts 11",
  "التاريخ والحضارة الإسلامية": "Islamic History and Civilization",
  "التاريخ والحضارة الإسلامية 11": "Islamic History and Civilization 11",
  "تقنية المعلومات": "Information Technology",
  "تقنية المعلومات 11": "Information Technology 11",
  "تقنية المعلوماتScience 11": "Information Technology Science 11",
  "العلوم البيئية": "Environmental Science",
  "العلوم البيئية 11": "Environmental Science 11",
  "الكيمياء": "Chemistry",
  "الكيمياء 11": "Chemistry 11",
};

function translateSubject(subject: string): string {
  const value = String(subject || "").trim();
  if (!value) return value;
  if (!isEnglishLang()) return value;
  return SUBJECT_TRANSLATIONS[value] || value;
}

function formatDateLine(dateISO: string): string {
  const raw = String(dateISO || "").trim();
  if (!raw) return "—";

  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return raw;

  if (!isEnglishLang()) {
    return formatDateWithDayAr(raw).line;
  }

  const day = new Intl.DateTimeFormat("en", { weekday: "long" }).format(d);
  const full = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
  return `${day} ${full}`;
}

function formatWarningPeriod(period: string): string {
  if (!isEnglishLang()) return formatPeriod(period);
  const p = String(period || "AM").toUpperCase();
  return p === "PM" || p === "BM" ? "Second Period" : "First Period";
}

export function buildResultsWarnings({
  assignments,
  examsFromStorage,
  normalizeSubject,
}: {
  assignments: any[];
  examsFromStorage: ResultsExamRow[];
  normalizeSubject: (subject: string) => string;
}) {
  if (!examsFromStorage.length) return [] as string[];
  const allowed = new Set<string>();
  for (const ex of examsFromStorage) {
    const k = `${ex.dateISO}__${ex.period}__${normalizeSubject(ex.subject)}`;
    allowed.add(k);
  }
  const bad = new Map<string, number>();
  for (const a of assignments as any[]) {
    if (false) continue;
    const dateISO = String(a.dateISO || "").trim();
    const subject = normalizeSubject(String(a.subject || "").trim());
    const period = String(a.period || "AM").toUpperCase() || "AM";
    if (!dateISO || !subject) continue;
    const k = `${dateISO}__${period}__${subject}`;
    if (!allowed.has(k)) bad.set(k, (bad.get(k) || 0) + 1);
  }
  return [...bad.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([k, n]) => {
      const [dateISO, period, subject] = k.split("__");
      const translatedSubject = translateSubject(subject);
      const translatedPeriod = formatWarningPeriod(period);
      const dateLine = formatDateLine(dateISO);

      if (isEnglishLang()) {
        return `⚠️ Assignment does not match Exam Schedule: (${translatedSubject}) • ${translatedPeriod} • ${dateLine} — Count: ${n}`;
      }

      return `⚠️ تكليف غير مطابق لجدول الامتحانات: (${translatedSubject}) • ${translatedPeriod} • ${dateLine} — عدد: ${n}`;
    });
}

export function buildResultsConflictUids(run: { assignments?: any[] } | null | undefined) {
  const m = new Map<string, string[]>();
  for (const a of run?.assignments || []) {
    const tt = String((a as any)?.taskType || "");
    if (tt !== "INVIGILATION" && tt !== "RESERVE") continue;
    const teacher = String((a as any)?.teacherName || "");
    const dateISO = String((a as any)?.dateISO || "");
    const period = String((a as any)?.period || "AM").toUpperCase();
    const uid = String((a as any)?.__uid || (a as any)?.id || "");
    if (!teacher || !dateISO || !uid) continue;
    const key = `${teacher}||${dateISO}||${period}`;
    const arr = m.get(key) || [];
    arr.push(uid);
    m.set(key, arr);
  }
  const conflicts = new Set<string>();
  for (const [, uids] of m) if (uids.length > 1) uids.forEach((u) => conflicts.add(u));
  return conflicts;
}
