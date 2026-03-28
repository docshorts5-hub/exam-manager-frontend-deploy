import { formatDateWithDayAr, formatPeriod } from "../taskUtils";

export type ResultsExamRow = {
  dateISO: string;
  period: string;
  subject: string;
};

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
    if (String(a?.taskType || "") === "CORRECTION_FREE") continue;
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
      const f = formatDateWithDayAr(dateISO);
      return `⚠️ تكليف غير مطابق لجدول الامتحانات: (${subject}) • ${formatPeriod(period)} • ${f.line} — عدد: ${n}`;
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
