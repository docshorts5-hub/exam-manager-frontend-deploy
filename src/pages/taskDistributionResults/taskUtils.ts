// src/pages/taskDistributionResults/taskUtils.ts
import type { TaskType } from "../../contracts/taskDistributionContract";
import { subjectColors } from "./constants";

export function taskLabel(t: TaskType | string): string {
  switch (t) {
    case "INVIGILATION":
      return "مراقبة";
    case "RESERVE":
      return "احتياط";
    case "REVIEW_FREE":
      return "مراجعة";
    case "CORRECTION_FREE":
      return "تصحيح";
    default:
      return String(t || "—");
  }
}

export function getSubjectBackground(subject: string = ""): string {
  // ✅ Keep the Results view consistent with the app theme (dark + gold)
  // and avoid distracting per-subject colors.
  return "rgba(212, 175, 55, 0.12)";
}

export function formatPeriod(period?: string): string {
  if (!period) return "";
  const p = String(period).trim().toUpperCase();
  if (p === "AM") return "الفترة الأولى";
  if (p === "PM" || p === "BM") return "الفترة الثانية";
  return String(period);
}

/* =======================
   ✅ استخراج رقم اللجنة/القاعة مهما كان اسم الحقل داخل Assignment
======================= */
export function getCommitteeNo(a: any): string | undefined {
  const v =
    a?.committeeNo ??
    a?.committeeNumber ??
    a?.committee ??
    a?.roomNo ??
    a?.roomNumber ??
    a?.room ??
    a?.hallNo ??
    a?.hallNumber ??
    a?.room?.number ??
    a?.room?.no ??
    a?.room?.id ??
    a?.committee?.no ??
    a?.committee?.number ??
    a?.committee?.id ??
    undefined;

  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

export function normalizeSubject(raw: string): string {
  const s = String(raw || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (
    String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[ـ\-_]/g, "")
      .includes("مجموعاللجان")
  )
    return "";
  return s;
}

export function formatDateWithDayAr(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  const day = d.toLocaleDateString("ar-EG", { weekday: "long" });
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  const full = `${dd}-${mm}-${yyyy}`;
  return { day, full, line: `${day} ${full}` };
}

export function shiftWeekendToSunday(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00");
  const wd = d.getDay(); // 0 Sun .. 6 Sat
  if (wd === 5) d.setDate(d.getDate() + 2); // Friday -> Sunday
  if (wd === 6) d.setDate(d.getDate() + 1); // Saturday -> Sunday

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function columnKeyOfAssignment(a: any): string {
  const dateISO = String(a?.dateISO || "").trim();
  const period = String(a?.period || "AM").trim().toUpperCase();
  const subject = normalizeSubject(String(a?.subject || "").trim());
  return `${dateISO}__${period}__${subject}`;
}
