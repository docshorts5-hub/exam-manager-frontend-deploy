// src/pages/taskDistributionResults/excelHelpers.ts
import type { Assignment, TaskType } from "../../../contracts/taskDistributionContract";
import { readJson } from "./basicUtils";
import { EXAMS_KEY } from "./constants";
import { normalizeSubject, shiftWeekendToSunday } from "./taskUtils";

// Re-export (legacy API)
// بعض الملفات (excelImport.ts) تستورد هذه الدوال من excelHelpers
export { normalizeSubject, shiftWeekendToSunday };

/* =======================
   Excel import helpers
======================= */
export function normKey(s: any) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[ـ\-_]/g, "");
}

export function excelSerialToISO(n: number): string {
  const utc = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function parseMaybeDateToISO(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" && isFinite(v)) return excelSerialToISO(v);

  const s = String(v).trim();
  if (!s) return "";

  const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (mIso) return `${mIso[1]}-${mIso[2]}-${mIso[3]}`;

  // dd-mm-yyyy or dd/mm/yyyy
  const mDMY = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mDMY) {
    const dd = String(parseInt(mDMY[1], 10)).padStart(2, "0");
    const mm = String(parseInt(mDMY[2], 10)).padStart(2, "0");
    const yyyy = mDMY[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return "";
}

export function mapTaskTypeFromText(v: any): TaskType | string {
  const s = String(v || "").trim();
  if (!s) return "INVIGILATION";
  const k = normKey(s);

  if (k.includes("احتياط")) return "RESERVE";
  if (k.includes("مراجعة") || k.includes("مراجعه")) return "REVIEW_FREE";
  if (k.includes("تصحيح")) return "CORRECTION_FREE";
  if (k.includes("مراقبة") || k.includes("مراقب")) return "INVIGILATION";

  return s;
}

export function mapPeriodFromText(v: any): string {
  const s = String(v || "").trim();
  if (!s) return "AM";
  const k = normKey(s);

  if (k.includes("الأولى") || k.includes("اولى") || k === "am" || k === "p1") return "AM";
  if (k.includes("الثانية") || k.includes("ثانيه") || k === "pm" || k === "bm" || k === "p2") return "PM";

  return s;
}

export function inferBaseYearFromRun(currentRun: any): number {
  const dates = (currentRun?.assignments || [])
    .map((x: any) => String(x?.dateISO || ""))
    .filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  if (dates.length) return parseInt(dates[0].slice(0, 4), 10);
  return new Date().getFullYear();
}

export function parseMatrixCellToAssignments(cellText: string, teacherName: string, dateISO: string): Assignment[] {
  const raw = String(cellText || "").trim();
  if (!raw || raw === "—" || raw === "-" || raw === "–") return [];

  const chunks = raw
    .split(/\n+/g)
    .map((x) => x.trim())
    .filter(Boolean);

  const out: Assignment[] = [];

  for (const chunk0 of chunks.length ? chunks : [raw]) {
    const chunk = chunk0.replace(/\s+/g, " ").trim();
    if (!chunk || chunk === "—") continue;

    const taskType = mapTaskTypeFromText(chunk);

    const mCommittee =
      chunk.match(/رقم\s*اللجنة\s*[:：]?\s*([0-9]+)/) ||
      chunk.match(/رقم\s*القاعة\s*[:：]?\s*([0-9]+)/) ||
      chunk.match(/committee\s*[:：]?\s*([0-9]+)/i) ||
      chunk.match(/room\s*[:：]?\s*([0-9]+)/i);

    const committeeNo = mCommittee ? String(mCommittee[1]).trim() : "";

    let period = "";
    if (chunk.includes("الفترة الأولى")) period = "AM";
    else if (chunk.includes("الفترة الثانية")) period = "PM";
    else if (chunk.match(/\bAM\b/i)) period = "AM";
    else if (chunk.match(/\bPM\b/i) || chunk.match(/\bBM\b/i)) period = "PM";

    let cleaned = chunk;
    cleaned = cleaned.replace(/•/g, " • ");
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    cleaned = cleaned.replace(/مراقبة/g, "").replace(/احتياط/g, "").replace(/مراجعة/g, "").replace(/تصحيح/g, "");
    cleaned = cleaned.replace(/رقم\s*اللجنة\s*[:：]?\s*[0-9]+/g, "");
    cleaned = cleaned.replace(/رقم\s*القاعة\s*[:：]?\s*[0-9]+/g, "");
    cleaned = cleaned.replace(/الفترة\s*الأولى/g, "");
    cleaned = cleaned.replace(/الفترة\s*الثانية/g, "");
    cleaned = cleaned.replace(/\bAM\b/gi, "");
    cleaned = cleaned.replace(/\bPM\b/gi, "");
    cleaned = cleaned.replace(/\bBM\b/gi, "");

    cleaned = cleaned
      .split("•")
      .map((x) => x.trim())
      .filter(Boolean)
      .join(" • ");

    const subject = normalizeSubject(cleaned.replace(/\s+/g, " ").trim());

    const a: any = {
      teacherName,
      dateISO: shiftWeekendToSunday(dateISO),
      taskType,
      period: period || "AM",
      subject: subject || "",
      notes: "",
    };

    if (committeeNo) {
      a.committeeNo = committeeNo;
      a.committeeNumber = committeeNo;
      a.roomNo = committeeNo;
      a.roomNumber = committeeNo;
    }

    out.push(a as Assignment);
  }

  return out;
}

export type ExamLike = {
  dateISO?: string;
  date?: string;
  day?: string;
  period?: string;
  subject?: string;
  name?: string;
  roomsCount?: number;
  committeesCount?: number;
  hallsCount?: number;
  rooms?: any[];
  committees?: any[];
  halls?: any[];
  hallsOrRooms?: any[];
  [k: string]: any;
};

export function extractExamDateISO(x: ExamLike): string {
  const iso = parseMaybeDateToISO(x.dateISO ?? x.date ?? "");
  return iso ? shiftWeekendToSunday(iso) : "";
}

export function extractExamSubject(x: ExamLike): string {
  return normalizeSubject(x.subject ?? x.name ?? "");
}

export function extractExamPeriod(x: ExamLike): string {
  return mapPeriodFromText(x.period ?? "") || "AM";
}

export function extractExamCommitteesCount(x: ExamLike): number {
  const n =
    (typeof x.committeesCount === "number" ? x.committeesCount : undefined) ??
    (typeof x.roomsCount === "number" ? x.roomsCount : undefined) ??
    (typeof x.hallsCount === "number" ? x.hallsCount : undefined) ??
    (Array.isArray(x.committees) ? x.committees.length : undefined) ??
    (Array.isArray(x.rooms) ? x.rooms.length : undefined) ??
    (Array.isArray(x.halls) ? x.halls.length : undefined) ??
    (Array.isArray(x.hallsOrRooms) ? x.hallsOrRooms.length : undefined) ??
    undefined;

  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v : 0;
}

/* =======================
   ✅ قراءة "مجموع اللجان" من هيدر الامتحان
======================= */
export function parseCommitteesCountFromExamHeaderCell(examCellText: string): number | null {
  const s = String(examCellText || "");
  const m = s.match(/مجموع\s*اللجان\s*[:：]?\s*([0-9]+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/* =======================
   ✅ بناء خريطة من جدول الامتحانات: (subject + period + committees) -> dateISO
======================= */
export function buildExamLookupFromStorage(): {
  bySPC: Record<string, string>; // subject__period__committees -> dateISO
  bySP: Record<string, string>; // subject__period -> dateISO (أول تطابق)
} {
  const raw = readJson<any>(EXAMS_KEY);
  const list: ExamLike[] =
    Array.isArray(raw) ? raw : Array.isArray(raw?.exams) ? raw.exams : Array.isArray(raw?.rows) ? raw.rows : [];

  const cleaned = list
    .map((x) => ({
      dateISO: extractExamDateISO(x),
      subject: extractExamSubject(x),
      period: extractExamPeriod(x),
      committees: extractExamCommitteesCount(x),
    }))
    .filter((x) => x.dateISO && x.subject);

  const bySPC: Record<string, string> = {};
  const bySP: Record<string, string> = {};

  cleaned.sort((a, b) => String(a.dateISO).localeCompare(String(b.dateISO)));

  for (const ex of cleaned) {
    const sp = `${ex.subject}__${ex.period}`;
    const spc = `${ex.subject}__${ex.period}__${ex.committees}`;
    if (!bySP[sp]) bySP[sp] = ex.dateISO!;
    if (!bySPC[spc]) bySPC[spc] = ex.dateISO!;
  }

  return { bySPC, bySP };
}
