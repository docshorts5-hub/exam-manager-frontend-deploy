// ✅ src/pages/TaskDistributionPrint.tsx  (الملف كامل بعد التعديل)
// ✅ FIX 1: الطباعة الآن تطبع "التقرير فقط" (بدون القوائم/الواجهة) عبر نافذة طباعة مستقلة
// ✅ FIX 2: تقرير المعلم (فردي) يتم Auto-Fit ليصبح "صفحة واحدة" A4 قدر الإمكان
// ✅ FIX 3: حل مشكلة "صفحة بيضاء" في بعض المتصفحات (لم نعد نعتمد على visibility/fixed داخل نفس الصفحة)
// ✅ FIX 4: زر واتساب: فتح مباشر + Fallbacks متعددة (wa.me / api.whatsapp.com / web.whatsapp.com / whatsapp://)
// ✅ FIX 5: عمود "المادة" في تقرير المعلم أصبح بنفس عرض عمود "الفترة" لتجنب تكسير النص
// ✅ NEW: إظهار الرقم الوظيفي للمعلم في تقرير المعلم (فردي) عبر صفحة الكادر التعليمي employeeNo
// ✅ تحديث تلقائي لصفحة التقرير عند تغيّر: Run + master/all/results + الشعار + بيانات المدرسة + الامتحانات + الكادر التعليمي
// ✅ NEW: طباعة الكل تتكيّف تلقائيًا مع A4 بحيث لا ينقسم تقرير المعلم الواحد إلى صفحتين
// ✅ FIX: الكشوف اليومية الطويلة لا تنكسر بين صفحتين؛ كل كشف يومي يتم ضغطه داخل صفحة A4 واحدة
// ✅ PERFORMANCE: إزالة التحديث السحابي المتكرر كل 2.5 ثانية حتى لا تتجمد صفحة التقارير
// ✅ FIX: الفارغ للمراجعة يظهر في كشف مادته فقط، وليس في كل كشوف نفس اليوم
// عبر: RUN_UPDATED_EVENT + focus + storage + تحديث دوري خفيف جدًا بدون ضغط على Firestore

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { loadTenantArray, writeTenantAudit } from "../services/tenantData";
import { loadRun, RUN_UPDATED_EVENT, taskDistributionKey } from "../utils/taskDistributionStorage";
import { loadUnavailability, syncUnavailabilityFromTenant, UNAVAIL_UPDATED_EVENT } from "../utils/taskDistributionUnavailability";
import type { TaskType } from "../contracts/taskDistributionContract";

/** -------------------------------------------
 * ✅ Keys
 * ------------------------------------------ */
const SCHOOL_DATA_KEY = "exam-manager:school-data:v1";
const LOGO_KEY = "exam-manager:app-logo";
const DEFAULT_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const EXAMS_SUB = "exams";
const TEACHERS_SUB = "teachers";

/** ✅ نوع بيانات الامتحان المستخدم خارج وداخل component حتى لا يظهر خطأ ExamMeta */
type ExamMeta = {
  id: string;
  subject: string;
  dateISO: string;
  period: string;
  periodKey: string;
  dayLabel: string;
  time: string;
};



/** ✅ Phone access gate helpers for sensitive school print pages */
function printPhoneDigitsOnly(value: unknown): string {
  return String(value ?? "")
    .replace(/[^\d٠-٩۰-۹]/g, "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

function printMaskPhoneFirstLast(value: unknown): string {
  const digits = printPhoneDigitsOnly(value);
  if (!digits) return "";
  if (digits.length <= 2) return digits[0] ? `${digits[0]}x` : "";
  return `${digits.slice(0, 1)}${"x".repeat(Math.max(1, digits.length - 2))}${digits.slice(-1)}`;
}

function printPickRegisteredPhone(data: any): string {
  if (!data || typeof data !== "object") return "";
  const direct = [
    data.phone,
    data.phoneNumber,
    data.mobile,
    data.mobileNumber,
    data.schoolPhone,
    data.centerPhone,
    data.contactPhone,
    data.officialPhone,
    data.settingsPhone,
    data.registeredPhone,
  ];
  for (const value of direct) {
    const digits = printPhoneDigitsOnly(value);
    if (digits) return digits;
  }
  return "";
}

function printReadLocalRegisteredPhone(): string {
  const candidates = [
    SCHOOL_DATA_KEY,
    "exam-manager:settings1:school-data:v1",
    "exam-manager:school-data:v1",
    "exam-manager:school-settings:v1",
    "exam-manager:settings:school:v1",
  ];
  for (const key of candidates) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const fromRoot = printPickRegisteredPhone(parsed);
      if (fromRoot) return fromRoot;
      const fromPayload = printPickRegisteredPhone(parsed?.data || parsed?.settings || parsed?.center || parsed?.school || parsed?.config);
      if (fromPayload) return fromPayload;
    } catch {
      // ignore malformed localStorage values
    }
  }
  return "";
}

function PrintPhoneGateScreen(props: {
  tenantId: string;
  registeredPhone: string;
  loading: boolean;
  error: string;
  value: string;
  setValue: (value: string) => void;
  onVerify: () => void;
  onGoSettings: () => void;
}) {
  const isAr = true;
  const masked = printMaskPhoneFirstLast(props.registeredPhone);
  return (
    <div
      style={{
        minHeight: "100vh",
        direction: "rtl",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background:
          "radial-gradient(circle at top, rgba(212,175,55,.20), transparent 36%), linear-gradient(135deg,#fff8e1 0%,#fffdf7 55%,#f8ecd0 100%)",
        color: "#000000",
        fontWeight: 900,
      }}
    >
      <div
        style={{
          width: "min(760px, 100%)",
          border: "3px solid #d6b24a",
          borderRadius: 28,
          background: "rgba(255,255,255,.94)",
          boxShadow: "0 22px 55px rgba(81,58,8,.18)",
          padding: 28,
          color: "#000000",
          fontWeight: 900,
        }}
      >
        <div style={{ display: "inline-flex", border: "1.5px solid #d6b24a", borderRadius: 999, padding: "8px 16px", background: "#fff8df", color: "#000000", fontWeight: 1000 }}>
          حماية الدخول
        </div>
        <h1 style={{ margin: "18px 0 10px", color: "#000000", fontWeight: 1000, fontSize: 30 }}>التحقق من رقم الهاتف</h1>
        <p style={{ margin: 0, color: "#000000", fontWeight: 900, lineHeight: 1.9 }}>
          للوصول إلى بوابة تقارير توزيع المهام، أدخل رقم الهاتف المسجل في إعدادات المدرسة.
        </p>

        <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
          <div style={{ border: "1.5px solid #e5cf87", borderRadius: 18, padding: 14, background: "#fffaf0", color: "#000000", fontWeight: 1000 }}>
            الرقم المسجل: <span style={{ color: "#000000", fontWeight: 1000 }}>{masked || (props.loading ? "جاري التحميل..." : "—")}</span>
          </div>

          {!props.loading && !props.registeredPhone ? (
            <div style={{ border: "2px solid #b91c1c", borderRadius: 18, padding: 14, background: "#fff1f2", color: "#000000", fontWeight: 1000 }}>
              لا يوجد رقم هاتف مسجل في إعدادات المدرسة. يرجى تسجيل الرقم أولًا.
            </div>
          ) : null}

          <input
            value={props.value}
            onChange={(e) => props.setValue(e.target.value)}
            inputMode="numeric"
            placeholder="أدخل رقم الهاتف المسجل"
            onKeyDown={(e) => {
              if (e.key === "Enter") props.onVerify();
            }}
            disabled={props.loading || !props.registeredPhone}
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "2px solid #d6b24a",
              borderRadius: 18,
              padding: "15px 18px",
              fontSize: 18,
              color: "#000000",
              fontWeight: 1000,
              outline: "none",
              background: "#ffffff",
            }}
          />

          {props.error ? (
            <div style={{ border: "2px solid #b91c1c", borderRadius: 18, padding: 12, background: "#fff1f2", color: "#000000", fontWeight: 1000 }}>
              {props.error}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 6 }}>
            <button
              type="button"
              onClick={props.onVerify}
              disabled={props.loading || !props.registeredPhone}
              style={{
                minWidth: 190,
                border: "2px solid #b88700",
                borderRadius: 18,
                padding: "13px 20px",
                background: "linear-gradient(180deg,#fff4c2,#d6a921)",
                color: "#000000",
                fontWeight: 1000,
                cursor: props.loading || !props.registeredPhone ? "not-allowed" : "pointer",
              }}
            >
              دخول الصفحة
            </button>
            <button
              type="button"
              onClick={props.onGoSettings}
              style={{
                minWidth: 190,
                border: "2px solid #111827",
                borderRadius: 18,
                padding: "13px 20px",
                background: "#ffffff",
                color: "#000000",
                fontWeight: 1000,
                cursor: "pointer",
              }}
            >
              العودة لإعدادات المدرسة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** -------------------------------------------
 * Helpers: safe localStorage JSON read
 * ------------------------------------------ */
function readJson<T = any>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeText(s: string) {
  return (s || "").toString().trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeISODate(d: string) {
  if (!d) return "";
  const m = String(d).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : String(d);
}

/** ✅ Period helpers: قراءة الفترة الثانية بشكل موحد داخل صفحة التقارير */
function normalizePeriodRaw(p: any) {
  return String(p || "")
    .trim()
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

function compactPeriodValue(p: any) {
  return normalizePeriodRaw(p)
    .toLowerCase()
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/[\.\s_\-:،/]+/g, "")
    .trim();
}

function isSecondPeriodValue(p: any) {
  const raw = normalizePeriodRaw(p).toLowerCase();
  const compact = compactPeriodValue(p);

  return (
    raw.includes("الثاني") ||
    raw.includes("ثاني") ||
    raw.includes("مسائي") ||
    raw.includes("بعد الظهر") ||
    raw.includes("مساء") ||
    compact === "pm" ||
    compact === "p" ||
    compact === "bm" ||
    compact === "b" ||
    compact === "p2" ||
    compact === "period2" ||
    compact === "second" ||
    compact === "secondperiod" ||
    compact === "2" ||
    compact === "02"
  );
}

function isFirstPeriodValue(p: any) {
  const raw = normalizePeriodRaw(p).toLowerCase();
  const compact = compactPeriodValue(p);

  return (
    raw.includes("الاول") ||
    raw.includes("اول") ||
    raw.includes("صباح") ||
    compact === "am" ||
    compact === "a" ||
    compact === "p1" ||
    compact === "period1" ||
    compact === "first" ||
    compact === "firstperiod" ||
    compact === "1" ||
    compact === "01"
  );
}

/** ✅ convert AM/BM/PM/Arabic variants to Arabic periods */
function formatPeriod(p: string) {
  const raw = (p || "").toString().trim();
  if (!raw) return "—";
  if (isSecondPeriodValue(raw)) return "الفترة الثانية";
  if (isFirstPeriodValue(raw)) return "الفترة الأولى";
  return raw;
}

/** ✅ period key for exam matching */
function normalizePeriodKey(p: string) {
  if (isSecondPeriodValue(p)) return "p2";
  if (isFirstPeriodValue(p)) return "p1";
  return normalizeText(formatPeriod(p || ""));
}

/** ✅ ترتيب الفترات في التقارير اليومية: الأولى ثم الثانية */
function periodOrderValue(p: string) {
  const key = normalizePeriodKey(p || "");
  if (key === "p1") return 1;
  if (key === "p2") return 2;
  return 9;
}

/** ✅ ترتيب أسماء المراقبين داخل كل تقرير حسب رقم اللجنة ثم الاسم */
function sortInvigilatorsByCommittee(rows: AnyAssignment[]) {
  return [...(rows || [])].sort((a, b) => {
    const ra = parseCommitteeNumber(getRoomNumber(a));
    const rb = parseCommitteeNumber(getRoomNumber(b));
    if (ra.num !== rb.num) return ra.num - rb.num;
    if (ra.raw !== rb.raw) return ra.raw.localeCompare(rb.raw, "ar");
    return (getTeacherName(a) || "").localeCompare(getTeacherName(b) || "", "ar");
  });
}

/** ✅ مفتاح موحد للتاريخ + الفترة حتى يظهر احتياط الفترة في كل كشوف نفس اليوم والفترة */
function datePeriodKey(dateISO: string, period: string) {
  return `${normalizeISODate(dateISO || "") || "no-date"}|${normalizePeriodKey(period || "") || "no-period"}`;
}

/** ✅ مفتاح موحد للتاريخ + المادة حتى يظهر الفارغ للمراجعة في تقرير مادته فقط */
function normalizeSubjectKeyForPrint(subject: any) {
  return String(subject || "")
    .trim()
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/[\.\s_\-:،/]+/g, " ")
    .toLowerCase()
    .trim();
}

function dateSubjectKey(dateISO: string, subject: any) {
  return `${normalizeISODate(dateISO || "") || "no-date"}|${normalizeSubjectKeyForPrint(subject) || "no-subject"}`;
}

/** ✅ استخراج مادة الفارغ للمراجعة من صف المهمة بدون الاعتماد على الفترة */
function getReviewFreeSubjectForPrint(row: AnyAssignment, meta?: ExamMeta | null) {
  return (
    meta?.subject ||
    row?.reviewSubject ||
    row?.reviewFreeSubject ||
    row?.subject1 ||
    row?.teacherSubject ||
    row?.teacherSubject1 ||
    row?.mainSubject ||
    getExamSubject(row) ||
    ""
  );
}

/** ✅ منع تكرار اسم الاحتياط إذا تكرر داخليًا في أكثر من مادة لنفس الفترة */
function uniqueAssignmentsByTeacherName(rows: AnyAssignment[]) {
  const map = new Map<string, AnyAssignment>();
  for (const row of rows || []) {
    const name = (getTeacherName(row) || "").trim();
    if (!name) continue;
    const key = normalizeText(name);
    if (!map.has(key)) map.set(key, row);
  }
  return Array.from(map.values()).sort((a, b) => (getTeacherName(a) || "").localeCompare(getTeacherName(b) || "", "ar"));
}

function taskLabel(t: TaskType | string) {
  const task = normalizePrintTaskType(t);
  switch (task) {
    case "INVIGILATION":
      return "مراقبة";
    case "RESERVE":
      return "احتياط";
    case "REVIEW_FREE":
      return "فاضي للمراجعة";
    case "CORRECTION_FREE":
      return "فاضي للتصحيح";
    case "LEAVE":
      return "غياب";
    default:
      return typeof t === "string" && String(t).trim() ? String(t) : "فارغ";
  }
}

/** ✅ توحيد نوع المهمة داخل صفحة الطباعة، حتى تظهر مهام الغياب القادمة من Unavailability.tsx */
function normalizePrintTaskType(value: any): string {
  const rawOriginal = String(value ?? "").trim();
  const raw = rawOriginal.toUpperCase();
  if (!raw) return "";

  if (raw === "INVIGILATION" || raw === "RESERVE" || raw === "REVIEW_FREE" || raw === "CORRECTION_FREE") return raw;
  if (raw === "LEAVE" || raw === "ABSENCE" || raw === "UNAVAILABILITY_LEAVE" || raw === "UNAVAILABILITY_ABSENCE" || raw === "UNAVAILABLE") return "LEAVE";

  const ar = rawOriginal.replace(/[إأآ]/g, "ا").replace(/ة/g, "ه").toLowerCase();
  if (ar.includes("اجازه") || ar.includes("غياب") || ar.includes("عدم توفر") || ar.includes("leave")) return "LEAVE";
  if (ar.includes("مراقبه")) return "INVIGILATION";
  if (ar.includes("احتياط")) return "RESERVE";
  if (ar.includes("مراجعه")) return "REVIEW_FREE";
  if (ar.includes("تصحيح")) return "CORRECTION_FREE";

  return rawOriginal;
}

function isLeaveAssignmentForPrint(row: AnyAssignment): boolean {
  if (!row) return false;
  // ✅ مهم: بعض خلايا الغياب تأتي من الجدول الشامل بقيمة subject/cellText فقط،
  // أو taskType فارغ. لذلك نستخدم || وليس ?? حتى لا يمنع الفراغ قراءة الحقول التالية.
  const task = normalizePrintTaskType(
    row?.taskType ||
      row?.type ||
      row?.role ||
      row?.assignmentType ||
      row?.dutyType ||
      row?.taskTypeLabelAr ||
      row?.displayText ||
      row?.cellText ||
      row?.subject ||
      row?.examSubject ||
      ""
  );
  return (
    task === "LEAVE" ||
    row?.source === "UNAVAILABILITY" ||
    row?.lockedByUnavailability === true ||
    row?.nonEditable === true && task === "LEAVE"
  );
}

function arabicDayLabelFromISO(value: any): string {
  const d = normalizeISODate(String(value || ""));
  if (!d) return "";
  const parts = d.split("-").map(Number);
  if (parts.length !== 3 || parts.some((x) => !Number.isFinite(x))) return "";
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  return days[date.getDay()] || "";
}

/** -------------------------------------------
 * Shapes
 * ------------------------------------------ */
type SchoolData = {
  name: string;
  governorate: string;
  semester: string;
  phone: string;
  address: string;
};

type Exam = {
  subject: string;
  dateISO: string; // YYYY-MM-DD
  dayLabel: string; // الأحد..الخ
  time: string; // 08:00
  durationMinutes?: number;
  period: string; // الفترة الأولى/الثانية أو AM/PM/BM...
  roomsCount?: number;
};

type Teacher = {
  id: string;
  employeeNo: string; // ✅ الرقم الوظيفي
  fullName: string;
  phone: string;
};

type AnyAssignment = any;

function getTeacherName(a: AnyAssignment): string {
  return (
    a?.__printResolvedTeacherName ||
    a?.teacherFullName ||
    a?.fullTeacherName ||
    a?.teacherNameFull ||
    a?.teacherName ||
    a?.teacher?.fullName ||
    a?.teacher?.name ||
    a?.teacher ||
    a?.name ||
    a?.teacherLabel ||
    ""
  );
}

function getAssignmentTeacherId(a: AnyAssignment): string {
  return String(
    a?.teacherId ??
      a?.teacherID ??
      a?.teacher_id ??
      a?.teacher?.id ??
      a?.teacher?.teacherId ??
      a?.assignment?.teacherId ??
      a?.assignment?.teacher?.id ??
      ""
  ).trim();
}

function getTaskType(a: AnyAssignment): TaskType | string {
  if (isLeaveAssignmentForPrint(a)) return "LEAVE" as any;
  return normalizePrintTaskType(
    a?.taskType ||
      a?.type ||
      a?.role ||
      a?.assignmentType ||
      a?.dutyType ||
      a?.taskTypeLabelAr ||
      a?.displayText ||
      a?.cellText ||
      a?.subject ||
      a?.examSubject ||
      "INVIGILATION"
  ) as any;
}

/** ✅ FIX: Strong committee/room number extraction */
function getRoomNumber(a: AnyAssignment): string {
  const direct =
    a?.committeeNumber ??
    a?.committeeNo ??
    a?.committee ??
    a?.committeeId ??
    a?.roomNumber ??
    a?.roomNo ??
    a?.room ??
    a?.roomId ??
    a?.roomLabel ??
    a?.roomName ??
    a?.hallNumber ??
    a?.hallNo ??
    a?.committeeLabel ??
    "";

  if (direct !== null && direct !== undefined && String(direct).trim() !== "") {
    return String(direct).trim();
  }

  const nested =
    a?.assignment?.committeeNumber ??
    a?.assignment?.committeeNo ??
    a?.assignment?.roomNumber ??
    a?.assignment?.roomNo ??
    a?.duty?.committeeNumber ??
    a?.duty?.committeeNo ??
    a?.duty?.roomNumber ??
    a?.duty?.roomNo ??
    "";

  if (nested !== null && nested !== undefined && String(nested).trim() !== "") {
    return String(nested).trim();
  }

  const examNested =
    a?.exam?.committeeNumber ??
    a?.exam?.committeeNo ??
    a?.exam?.roomNumber ??
    a?.exam?.roomNo ??
    a?.slot?.committeeNumber ??
    a?.slot?.committeeNo ??
    a?.slot?.roomNumber ??
    a?.slot?.roomNo ??
    a?.room?.number ??
    a?.room?.no ??
    a?.room?.name ??
    "";

  if (examNested !== null && examNested !== undefined && String(examNested).trim() !== "") {
    return String(examNested).trim();
  }

  const roomIndex = a?.roomIndex ?? a?.committeeIndex ?? a?.roomIdx ?? a?.committeeIdx ?? null;
  const rooms = a?.exam?.rooms || a?.rooms || a?.examRooms || null;

  if (roomIndex !== null && Array.isArray(rooms) && rooms[roomIndex]) {
    const rr = rooms[roomIndex];
    const v =
      rr?.committeeNumber ??
      rr?.committeeNo ??
      rr?.roomNumber ??
      rr?.roomNo ??
      rr?.name ??
      rr?.label ??
      rr?.roomName ??
      "";
    if (String(v).trim()) return String(v).trim();
  }

  return "";
}

/** ✅ NEW: تحويل رقم اللجنة لرقم للمقارنة والترتيب */
function parseCommitteeNumber(v: any): { num: number; raw: string } {
  const raw = (v ?? "").toString().trim();
  if (!raw) return { num: Number.POSITIVE_INFINITY, raw: "" };
  const m = raw.match(/\d+/);
  const num = m ? Number(m[0]) : Number.POSITIVE_INFINITY;
  return { num: Number.isFinite(num) ? num : Number.POSITIVE_INFINITY, raw };
}

function getExamSubject(a: AnyAssignment): string {
  return a?.subject || a?.examSubject || a?.exam?.subject || "";
}
function getExamDateISO(a: AnyAssignment): string {
  return a?.dateISO || a?.examDateISO || a?.exam?.dateISO || a?.date || "";
}
function getExamDayLabel(a: AnyAssignment): string {
  return a?.dayLabel || a?.examDayLabel || a?.exam?.dayLabel || "";
}
function getExamPeriod(a: AnyAssignment): string {
  return a?.period || a?.examPeriod || a?.exam?.period || "";
}
function getExamTime(a: AnyAssignment): string {
  return a?.time || a?.examTime || a?.exam?.time || "";
}
function getAssignmentExamId(a: AnyAssignment): string {
  return String(a?.examId ?? a?.examID ?? a?.exam?.id ?? a?.slot?.examId ?? "").trim();
}


/** -------------------------------------------
 * ✅ Unavailability / Absence helpers for Print
 * حتى لو لم تُحفظ خلايا الغياب داخل Run، صفحة الطباعة تقرأ سجل Unavailability.tsx مباشرة
 * وتبني كشف غياب مستقل بدون الاعتماد على جدول النتائج فقط.
 * ------------------------------------------ */
function printPad2(value: number) {
  return String(value).padStart(2, "0");
}

function normalizePrintUnavailabilityDateISO(value: any) {
  const text = String(value ?? "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slash = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const year = Number(slash[3]);
    if (year > 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${printPad2(month)}-${printPad2(day)}`;
    }
  }

  return normalizeISODate(text);
}

function addPrintDaysISO(isoDate: string, days: number) {
  const normalized = normalizePrintUnavailabilityDateISO(isoDate);
  if (!normalized) return "";
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${printPad2(date.getMonth() + 1)}-${printPad2(date.getDate())}`;
}

function periodToPrintAMPM(value: any): "AM" | "PM" {
  return isSecondPeriodValue(value) ? "PM" : "AM";
}

function printPeriodLabelAr(period: any) {
  return periodToPrintAMPM(period) === "PM" ? "الفترة الثانية" : "الفترة الأولى";
}

function getTeacherNameFromPrintUnavailabilityRule(rule: any): string {
  return String(
    rule?.teacherName ??
      rule?.fullName ??
      rule?.teacherFullName ??
      rule?.name ??
      rule?.staffName ??
      rule?.teacher?.fullName ??
      rule?.teacher?.name ??
      ""
  ).trim();
}

function getTeacherIdFromPrintUnavailabilityRule(rule: any): string {
  return String(
    rule?.teacherId ?? rule?.teacherID ?? rule?.idTeacher ?? rule?.staffId ?? rule?.employeeId ?? rule?.teacher?.id ?? ""
  ).trim();
}

function getPrintUnavailabilityRuleDates(rule: any): string[] {
  const direct = [rule?.dateISO, rule?.date]
    .map((value) => normalizePrintUnavailabilityDateISO(value))
    .filter(Boolean);
  if (direct.length) return Array.from(new Set(direct));

  const from = normalizePrintUnavailabilityDateISO(rule?.dateFromISO || rule?.fromDateISO || rule?.dateFrom || rule?.from);
  const to = normalizePrintUnavailabilityDateISO(rule?.dateToISO || rule?.toDateISO || rule?.dateTo || rule?.to || from);
  if (!from || !to || to < from) return [];

  const out: string[] = [];
  let cursor = from;
  while (cursor && cursor <= to && out.length < 140) {
    out.push(cursor);
    cursor = addPrintDaysISO(cursor, 1);
  }
  return out;
}

function getPrintUnavailabilityRulePeriods(rule: any): ("AM" | "PM")[] {
  const raw = String(rule?.period ?? rule?.periodCode ?? rule?.shift ?? rule?.periodLabel ?? rule?.periodName ?? "").trim();
  const lower = raw.toLowerCase();
  if (
    rule?.fullDay ||
    rule?.isFullDay ||
    raw === "FULL_DAY" ||
    !raw ||
    lower.includes("full") ||
    lower.includes("all") ||
    raw.includes("كامل") ||
    raw.includes("كل")
  ) {
    return ["AM", "PM"];
  }
  return [periodToPrintAMPM(raw)];
}

function isLikelyPrintUnavailabilityRule(rule: any) {
  if (!rule || typeof rule !== "object") return false;
  const hasTeacher = !!(getTeacherIdFromPrintUnavailabilityRule(rule) || getTeacherNameFromPrintUnavailabilityRule(rule));
  const hasDate = getPrintUnavailabilityRuleDates(rule).length > 0;
  return hasTeacher && hasDate;
}

function extractPrintUnavailabilityRulesDeep(input: any, depth = 0): any[] {
  if (!input || depth > 4) return [];
  if (Array.isArray(input)) return input.flatMap((item) => extractPrintUnavailabilityRulesDeep(item, depth + 1));
  if (typeof input !== "object") return [];
  if (isLikelyPrintUnavailabilityRule(input)) return [input];

  const candidates = [input.rules, input.rows, input.data, input.items, input.records, input.unavailability, input.unavailabilityRules];
  return candidates.flatMap((part) => extractPrintUnavailabilityRulesDeep(part, depth + 1));
}

function dedupePrintUnavailabilityRules(rules: any[]) {
  const out: any[] = [];
  const seen = new Set<string>();
  for (const rule of Array.isArray(rules) ? rules : []) {
    if (!isLikelyPrintUnavailabilityRule(rule)) continue;
    const teacherKey = getTeacherIdFromPrintUnavailabilityRule(rule) || normalizeTeacherNameForMatch(getTeacherNameFromPrintUnavailabilityRule(rule));
    const dates = getPrintUnavailabilityRuleDates(rule).join(",");
    const periods = getPrintUnavailabilityRulePeriods(rule).join(",");
    const reason = String(rule?.reason || "").trim();
    const key = `${teacherKey}__${dates}__${periods}__${reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(rule);
  }
  return out;
}

function loadUnavailabilityForPrint(tenantId?: string) {
  const rows: any[] = [];

  try {
    rows.push(...extractPrintUnavailabilityRulesDeep(loadUnavailability(String(tenantId || "").trim() || undefined)));
  } catch {}

  try {
    rows.push(...extractPrintUnavailabilityRulesDeep(loadUnavailability(undefined)));
  } catch {}

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = String(window.localStorage.key(i) || "");
        if (!/(unavail|availability|غياب|عدم)/i.test(key)) continue;
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        try {
          rows.push(...extractPrintUnavailabilityRulesDeep(JSON.parse(raw)));
        } catch {}
      }
    }
  } catch {}

  return dedupePrintUnavailabilityRules(rows);
}

function isPrintTeacherBlockedByUnavailability(rules: any[], teacherId: string, teacherName: string, dateISO: string, period: any) {
  const wantedDate = normalizePrintUnavailabilityDateISO(dateISO);
  const wantedPeriod = periodToPrintAMPM(period);
  const wantedId = String(teacherId || "").trim();
  const wantedName = normalizeTeacherNameForMatch(teacherName || "");
  if (!wantedDate || (!wantedId && !wantedName)) return false;

  return (Array.isArray(rules) ? rules : []).some((rule) => {
    if (!isLikelyPrintUnavailabilityRule(rule)) return false;

    const ruleId = getTeacherIdFromPrintUnavailabilityRule(rule);
    const ruleName = normalizeTeacherNameForMatch(getTeacherNameFromPrintUnavailabilityRule(rule));
    const sameTeacher = (!!wantedId && !!ruleId && wantedId === ruleId) || (!!wantedName && !!ruleName && wantedName === ruleName);
    if (!sameTeacher) return false;

    const dates = getPrintUnavailabilityRuleDates(rule);
    if (!dates.includes(wantedDate)) return false;

    const periods = getPrintUnavailabilityRulePeriods(rule);
    return periods.includes(wantedPeriod);
  });
}

function assignmentPeriodsForPrintUnavailability(row: AnyAssignment, taskType: string): ("AM" | "PM")[] {
  const covers = Array.isArray(row?.coversPeriods)
    ? row.coversPeriods.map((p: any) => periodToPrintAMPM(p)).filter(Boolean)
    : [];
  if (covers.length) return Array.from(new Set(covers));
  if (row?.fullDay || taskType === "REVIEW_FREE" || taskType === "CORRECTION_FREE") return ["AM", "PM"];
  return [periodToPrintAMPM(getExamPeriod(row) || row?.period || "AM")];
}

function buildPrintUnavailabilityAbsenceAssignments(rules: any[], teachers: Teacher[]) {
  const byId = new Map<string, Teacher>();
  const byName = new Map<string, Teacher>();

  for (const t of Array.isArray(teachers) ? teachers : []) {
    const id = String(t.id || "").trim();
    const name = String(t.fullName || "").trim();
    if (id) byId.set(id, t);
    const nameKey = normalizeTeacherNameForMatch(name);
    if (nameKey) byName.set(nameKey, t);
  }

  const out: AnyAssignment[] = [];
  const seen = new Set<string>();

  for (const rule of Array.isArray(rules) ? rules : []) {
    if (!isLikelyPrintUnavailabilityRule(rule)) continue;

    const rawTeacherId = getTeacherIdFromPrintUnavailabilityRule(rule);
    const rawTeacherName = getTeacherNameFromPrintUnavailabilityRule(rule);
    const teacher = (rawTeacherId && byId.get(rawTeacherId)) || byName.get(normalizeTeacherNameForMatch(rawTeacherName)) || null;

    const teacherId = String(teacher?.id || rawTeacherId || "").trim();
    const teacherName = String(teacher?.fullName || rawTeacherName || teacherId || "").trim();
    if (!teacherId && !teacherName) continue;

    const dates = getPrintUnavailabilityRuleDates(rule);
    const periods = getPrintUnavailabilityRulePeriods(rule);
    const reason = normalizeLeaveReasonForPrint(rule?.reason || rule?.absenceReason || rule?.excuseReason || rule?.excuse || "إجازة");

    for (const dateISO of dates) {
      for (const period of periods) {
        const key = `${teacherId || normalizeTeacherNameForMatch(teacherName)}__${dateISO}__${period}`;
        if (seen.has(key)) continue;
        seen.add(key);

        out.push({
          id: `absence-${key}`,
          __uid: `absence-${key}`,
          teacherId,
          teacherName,
          taskType: "LEAVE",
          role: "LEAVE",
          type: "LEAVE",
          taskTypeLabelAr: "غياب",
          taskTypeLabelEn: "Absence",
          subject: reason,
          examSubject: reason,
          dateISO,
          date: dateISO,
          period,
          periodLabelAr: printPeriodLabelAr(period),
          source: "UNAVAILABILITY",
          reason,
          locked: true,
          readOnly: true,
          nonEditable: true,
          lockedByUnavailability: true,
          preventEdit: true,
          preventMove: true,
          preventDelete: true,
          cellText: reason,
          displayText: reason,
          cellBackground: "#ede9fe",
          backgroundColor: "#ede9fe",
          color: "#3b0764",
          borderColor: "#a78bfa",
          meta: {
            source: "Unavailability.tsx",
            lockedByUnavailability: true,
            originalRuleId: String(rule?.id || "").trim() || undefined,
          },
        });
      }
    }
  }

  return out;
}


/** ✅ توحيد سبب الغياب في الطباعة:
 * المطلوب ظهور الصف مرة واحدة فقط بشكل: طبيعة العمل = غياب، والسبب = إجازة.
 * أي قيمة عامة مثل "غياب" أو "leave" يتم تحويلها إلى "إجازة" حتى لا يظهر "غياب - غياب".
 */
function normalizeLeaveReasonForPrint(value: any): string {
  const raw = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!raw) return "إجازة";

  const ar = raw
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();

  if (ar.includes("اجازه")) return "إجازة";
  if (ar === "غياب" || ar.includes("غياب") || ar.includes("عدم توفر") || ar.includes("leave") || ar.includes("absence")) {
    return "إجازة";
  }

  return raw;
}

function shouldAlwaysShowLeaveAsVacationForPrint(): boolean {
  // ✅ دالة منفصلة حتى لا يعتبر TypeScript بقية الكود داخل getLeaveReasonForPrint كودًا غير قابل للوصول.
  // ✅ آخر تعديل: لا نثبت السبب على "إجازة"؛ نعرض سبب الغياب الحقيقي المسجل في Unavailability.tsx.
  return false;
}

function getLeaveReasonForPrint(row: AnyAssignment): string {
  // ✅ في كشف المعلم: طبيعة العمل = غياب، والمادة/السبب = سبب الغياب الحقيقي من Unavailability.tsx.
  // ✅ إذا لم يوجد سبب واضح، نستخدم "إجازة" كقيمة احتياطية فقط.
  if (shouldAlwaysShowLeaveAsVacationForPrint()) return "إجازة";

  const candidates = [
    row?.reason,
    row?.absenceReason,
    row?.unavailabilityReason,
    row?.excuseReason,
    row?.excuse,
    row?.leaveReason,
    row?.meta?.reason,
    row?.meta?.absenceReason,
    row?.subject,
    row?.examSubject,
    row?.displayText,
    row?.cellText,
  ];

  // إذا وُجد سبب واضح غير عام نعرضه كما هو.
  for (const value of candidates) {
    const raw = String(value ?? "").trim();
    if (!raw) continue;

    const normalized = normalizeLeaveReasonForPrint(raw);
    const ar = raw
      .replace(/[إأآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .toLowerCase();

    if (normalized !== "إجازة" && !ar.includes("غياب") && !ar.includes("leave") && !ar.includes("absence")) {
      return normalized;
    }
  }

  // إذا كانت إحدى القيم تذكر إجازة صراحة نثبتها.
  for (const value of candidates) {
    const raw = String(value ?? "").trim();
    const ar = raw.replace(/[إأآ]/g, "ا").replace(/ة/g, "ه").toLowerCase();
    if (ar.includes("اجازه")) return "إجازة";
  }

  return "إجازة";
}

// ✅ ملاحظة: هذا التعديل مبني على آخر نسخة تعمل، ولم يتم حذف منطق التقارير أو الطباعة.
// ✅ الغياب في كشف المعلم يظهر الآن: طبيعة العمل = غياب، والسبب = النص المسجل في صفحة غياب الكادر التعليمي.

function normalizeLeaveAssignmentForPrint(row: AnyAssignment): AnyAssignment {
  if (!isLeaveAssignmentForPrint(row)) return row;

  const reason = getLeaveReasonForPrint(row);

  return {
    ...row,
    taskType: "LEAVE",
    role: "LEAVE",
    type: "LEAVE",
    taskTypeLabelAr: "غياب",
    taskTypeLabelEn: "Absence",
    subject: reason,
    examSubject: reason,
    reason,
    cellText: reason,
    displayText: reason,
    locked: true,
    readOnly: true,
    nonEditable: true,
    lockedByUnavailability: true,
    preventEdit: true,
    preventMove: true,
    preventDelete: true,
    cellBackground: row?.cellBackground || "#ede9fe",
    backgroundColor: row?.backgroundColor || "#ede9fe",
    color: row?.color || "#3b0764",
    borderColor: row?.borderColor || "#a78bfa",
  };
}

function leaveAssignmentDedupeKeyForPrint(row: AnyAssignment): string {
  // ✅ مفتاح الدمج يجب أن يعتمد على اسم المعلم أولًا.
  // السبب: أحيانًا نفس المعلم يأتي من Run و Unavailability بمعرّفين مختلفين،
  // فيظهر مكررًا في نفس التاريخ والفترة إذا اعتمدنا على teacherId فقط.
  const teacherNameKey = normalizeTeacherNameForMatch(getTeacherName(row));
  const teacherIdKey = getAssignmentTeacherId(row);
  const teacherKey = teacherNameKey || teacherIdKey || "unknown-teacher";

  const date =
    normalizePrintUnavailabilityDateISO(getExamDateISO(row)) ||
    normalizePrintUnavailabilityDateISO(row?.examDate) ||
    normalizePrintUnavailabilityDateISO(row?.assignmentDate) ||
    normalizePrintUnavailabilityDateISO(row?.meta?.dateISO) ||
    normalizePrintUnavailabilityDateISO(row?.meta?.date) ||
    "unknown-date";

  const period = periodToPrintAMPM(
    getExamPeriod(row) ||
      row?.period ||
      row?.periodLabel ||
      row?.taskPeriod ||
      row?.meta?.period ||
      "AM"
  );

  return `${teacherKey}__${date}__${period}`;
}

function leaveAssignmentPriorityForPrint(row: AnyAssignment): number {
  const reason = getLeaveReasonForPrint(row);
  const rawText = [
    row?.reason,
    row?.absenceReason,
    row?.unavailabilityReason,
    row?.excuseReason,
    row?.excuse,
    row?.leaveReason,
    row?.subject,
    row?.examSubject,
    row?.displayText,
    row?.cellText,
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .join(" ");

  const ar = rawText.replace(/[إأآ]/g, "ا").replace(/ة/g, "ه").toLowerCase();

  let score = 0;
  if (ar.includes("اجازه")) score += 100;
  if (String(row?.source || "").toUpperCase().includes("UNAVAIL")) score += 40;
  if (row?.lockedByUnavailability === true) score += 20;
  if (reason && reason !== "إجازة") score += 10;
  return score;
}

function mergePrintLeaveDuplicates(rows: AnyAssignment[]): AnyAssignment[] {
  const input = Array.isArray(rows) ? rows : [];
  const bestByKey = new Map<string, AnyAssignment>();

  for (const row of input) {
    if (!isLeaveAssignmentForPrint(row)) continue;

    const normalized = normalizeLeaveAssignmentForPrint(row);
    const key = leaveAssignmentDedupeKeyForPrint(normalized);
    if (!key || key.includes("____")) continue;

    const current = bestByKey.get(key);
    if (!current || leaveAssignmentPriorityForPrint(normalized) >= leaveAssignmentPriorityForPrint(current)) {
      bestByKey.set(key, normalized);
    }
  }

  const emitted = new Set<string>();
  const out: AnyAssignment[] = [];

  for (const row of input) {
    if (!isLeaveAssignmentForPrint(row)) {
      out.push(row);
      continue;
    }

    const normalized = normalizeLeaveAssignmentForPrint(row);
    const key = leaveAssignmentDedupeKeyForPrint(normalized);
    if (emitted.has(key)) continue;

    emitted.add(key);
    out.push(bestByKey.get(key) || normalized);
  }

  return out;
}

function dedupeTeacherRowsForPrint(rows: AnyAssignment[]): AnyAssignment[] {
  // ✅ حماية إضافية لتقرير المعلم الفردي: لا نسمح بتكرار نفس الغياب لنفس المعلم
  // في نفس التاريخ ونفس الفترة، حتى لو وصل الصف مرتين من مصدرين مختلفين.
  return mergePrintLeaveDuplicates(Array.isArray(rows) ? rows : []);
}


/** -------------------------------------------
 * ✅ Print helpers (تقرير فقط + صفحة واحدة للمعلم الفردي)
 * ------------------------------------------ */

const printWindowCss = `
@page { size: A4 portrait; margin: 8mm; }

html, body {
  margin: 0;
  padding: 0;
  background: #fff;
  direction: rtl;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  font-family: system-ui, -apple-system, "Segoe UI", Tahoma, Arial, sans-serif;
}

/* ✅ الحاوية العامة لا تتحكم في القص؛ كل كشف يتحكم في صفحة A4 الخاصة به */
#print-page {
  width: 194mm;          /* 210 - (8*2) */
  height: auto !important;
  overflow: visible !important;
  margin: 0 auto;
  position: relative;
}

#fit-target {
  width: 194mm !important;
  transform: none !important;
  transform-origin: top right;
}

/* ✅ كل كشف/تقرير = صفحة A4 واحدة داخل مساحة الطباعة */
.print-root .print-sheet {
  box-shadow: none !important;
  border-radius: 0 !important;
  width: 194mm !important;
  height: 281mm !important;       /* 297 - (8*2) */
  min-height: 281mm !important;
  max-height: 281mm !important;
  margin: 0 auto !important;
  background: #fff !important;
  padding: 0 !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
  position: relative !important;
  page-break-after: always !important;
  break-after: page !important;
  page-break-inside: avoid !important;
  break-inside: avoid !important;
}

.print-root .print-sheet:last-child {
  page-break-after: auto !important;
  break-after: auto !important;
}

/* ✅ يتم لف محتوى كل كشف داخله ثم تصغيره تلقائيًا */
.print-root .sheet-fit-inner {
  width: 194mm !important;
  min-width: 194mm !important;
  max-width: 194mm !important;
  transform-origin: top right !important;
  box-sizing: border-box !important;
}

/* تنظيف */
.no-print { display: none !important; }

/* ضغط عام لزيادة فرصة بقاء التقرير داخل صفحة واحدة */
.print-root table {
  width: 100% !important;
  table-layout: fixed !important;
  border-collapse: collapse !important;
}
.print-root th {
  padding: 4px 5px !important;
  font-size: 10.5px !important;
  line-height: 1.15 !important;
}
.print-root td {
  padding: 4px 5px !important;
  font-size: 10.5px !important;
  height: 22px !important;
  line-height: 1.15 !important;
}
.print-root th, .print-root td {
  word-break: break-word;
  overflow-wrap: anywhere;
}

/* ضغط إضافي للكشف اليومي لأنه أكثر عرضة للكسر بسبب كثرة المراقبين */
.print-root .print-daily table { margin-top: 0 !important; }
.print-root .print-daily th {
  padding: 3px 4px !important;
  font-size: 10px !important;
  line-height: 1.1 !important;
}
.print-root .print-daily td {
  padding: 3px 4px !important;
  font-size: 10px !important;
  height: 19px !important;
  line-height: 1.1 !important;
}
.print-root .print-daily img {
  max-width: 58px !important;
  max-height: 58px !important;
}

/* منع فواصل غريبة */
.print-root * {
  box-shadow: none !important;
}
`;

/** ✅ حذف الرقم النهائي فقط من اسم المعلم داخل نافذة الطباعة، بدون قطع الاسم الكامل */
function stripDigitsFromPrintedTeacherName(value: any): string {
  return String(value || "")
    .replace(/\s*[0-9٠-٩۰-۹]+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTeacherNameForMatch(value: any): string {
  return normalizeText(stripDigitsFromPrintedTeacherName(value));
}

/** ✅ يطبّق حذف الأرقام على العناصر المعلّمة كأسماء معلمين داخل نسخة الطباعة فقط */
function sanitizeTeacherNamesForPrintOnly(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-print-teacher-name='true']").forEach((node) => {
    node.textContent = stripDigitsFromPrintedTeacherName(node.textContent || "");
  });
}

/** ✅ اطبع عنصر فقط (بدون القوائم/الواجهة) + اجعله صفحة واحدة إذا كانت صفحة واحدة فقط */
async function printOnlyElement(el: HTMLElement, title = "report") {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".no-print").forEach((n) => n.remove());
  sanitizeTeacherNamesForPrintOnly(clone);

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${String(title).replace(/</g, "&lt;")}</title>
  <style>${printWindowCss}</style>
</head>
<body>
  <div id="print-page">
    <div id="fit-target" class="print-root">${clone.outerHTML}</div>
  </div>

  <script>
    (function () {
      var pxPerMm = 96 / 25.4; // px per mm at 96dpi
      var maxW = 194 * pxPerMm; // printable area
      var maxH = 281 * pxPerMm;

      function wrapSheetContent(sheet) {
        if (!sheet) return null;
        var existing = sheet.querySelector(':scope > .sheet-fit-inner');
        if (existing) return existing;

        var inner = document.createElement('div');
        inner.className = 'sheet-fit-inner';
        while (sheet.firstChild) inner.appendChild(sheet.firstChild);
        sheet.appendChild(inner);
        return inner;
      }

      function measureInner(inner) {
        if (!inner) return { width: 0, height: 0 };
        inner.style.transform = 'none';
        inner.style.transformOrigin = 'top right';

        var rect = inner.getBoundingClientRect();
        return {
          width: Math.max(rect.width || 0, inner.scrollWidth || 0),
          height: Math.max(rect.height || 0, inner.scrollHeight || 0)
        };
      }

      function fitOneSheetToA4(sheet) {
        if (!sheet) return;

        sheet.style.width = '194mm';
        sheet.style.height = '281mm';
        sheet.style.minHeight = '281mm';
        sheet.style.maxHeight = '281mm';
        sheet.style.overflow = 'hidden';
        sheet.style.boxSizing = 'border-box';
        sheet.style.pageBreakInside = 'avoid';
        sheet.style.breakInside = 'avoid';

        var inner = wrapSheetContent(sheet);
        if (!inner) return;
        inner.style.width = '194mm';
        inner.style.maxWidth = '194mm';
        inner.style.transform = 'none';
        inner.style.transformOrigin = 'top right';
        inner.style.boxSizing = 'border-box';

        var size = measureInner(inner);
        if (!size.width || !size.height) return;

        var scaleW = maxW / size.width;
        var scaleH = maxH / size.height;
        var scale = Math.min(scaleW, scaleH, 1);

        // أمان بسيط حتى لا يلامس آخر سطر نهاية الصفحة في Chrome Print Preview
        if (scale < 1) scale = Math.max(scale - 0.015, 0.55);

        inner.style.transform = 'scale(' + scale + ')';
        sheet.setAttribute('data-a4-fit-scale', String(Math.round(scale * 1000) / 1000));
      }

      function fitAllSheetsToA4(sheets) {
        var page = document.getElementById('print-page');
        if (page) page.className = 'a4-pages-ready';

        Array.prototype.forEach.call(sheets || [], function (sheet) {
          fitOneSheetToA4(sheet);
        });
      }

      function fitToOnePage() {
        var target = document.getElementById('fit-target');
        if (!target) return;

        var sheets = target.querySelectorAll('.print-sheet');
        if (sheets && sheets.length) {
          // ✅ مهم: نطبّق التكييف على كل كشف حتى لو كان كشفًا واحدًا فقط.
          // الاعتماد على scale للحاوية العامة قد يجعل Chrome يكسر الكشف الطويل إلى صفحتين.
          fitAllSheetsToA4(sheets);
          return;
        }
      }

      function whenImagesReady(cb) {
        var imgs = Array.prototype.slice.call(document.images || []);
        if (!imgs.length) return cb();

        var left = imgs.length;
        function done() { left--; if (left <= 0) cb(); }

        imgs.forEach(function (img) {
          if (img.complete) return done();
          img.onload = done;
          img.onerror = done;
        });
      }

      window.addEventListener('load', function () {
        whenImagesReady(function () {
          fitToOnePage();
          setTimeout(fitToOnePage, 80);
          setTimeout(function () {
            fitToOnePage();
            window.focus();
            window.print();
          }, 220);
        });
      });
    })();
  </script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=950,height=720,top=80,left=120,resizable=yes,scrollbars=yes");
  if (!w) {
    // fallback أخير
    window.print();
    return;
  }

  w.opener = null;
  w.document.open();
  w.document.write(html);
  w.document.close();

  // اغلاق بعد الطباعة (اختياري)
  setTimeout(() => {
    try {
      w.close();
    } catch {}
  }, 1800);
}

/** -------------------------------------------
 * WhatsApp helpers (FIX: فتح مباشر + فوالباك)
 * ------------------------------------------ */
function sanitizePhoneToWhatsApp(phoneRaw: string): string {
  let p = String(phoneRaw || "").trim();
  if (!p) return "";
  p = p.replace(/[^\d]/g, "");

  // ✅ عمان غالباً 8 أرقام → نضيف 968
  if (p.length === 8) p = `968${p}`;
  if (p.startsWith("0") && p.length >= 9) p = `968${p.slice(1)}`;

  return p;
}

function openWhatsAppWindow({ text, phone }: { text: string; phone?: string }) {
  const cleanPhone = (phone || "").replace(/[^\d]/g, "");
  const encoded = encodeURIComponent(text || "");

  const urls = [
    // 1) محاولة فتح التطبيق مباشرة (قد يعمل على بعض الأنظمة)
    `whatsapp://send?${cleanPhone ? `phone=${cleanPhone}&` : ""}text=${encoded}`,

    // 2) wa.me
    cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`,

    // 3) api.whatsapp.com
    cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`,

    // 4) web.whatsapp.com (مفيد على الكمبيوتر)
    cleanPhone
      ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://web.whatsapp.com/send?text=${encoded}`,
  ];

  const features = "noopener,noreferrer,width=980,height=760,top=70,left=120,resizable=yes,scrollbars=yes";

  // ✅ نفتح الرابط مباشرة (بدون about:blank ثم location) لتفادي مشاكل/حظر/ERR_CONNECTION_RESET أحيانًا
  for (const url of urls) {
    try {
      const w = window.open(url, "_blank", features);
      if (w) return true;
    } catch {
      // نكمل للفallback التالي
    }
  }

  // ✅ آخر حل: افتح في نفس الصفحة (إذا المتصفح منع الـpopup)
  window.location.href = urls[1];
  return false;
}

/** -------------------------------------------
 * PNG export (بدون مكتبات)
 * ------------------------------------------ */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportElementToPng(el: HTMLElement, filename: string) {
  const rect = el.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));

  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".no-print").forEach((n) => n.remove());

  const serializer = new XMLSerializer();
  const xhtml = serializer.serializeToString(clone);

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <foreignObject width="100%" height="100%">
      <div xmlns="http://www.w3.org/1999/xhtml">${xhtml}</div>
    </foreignObject>
  </svg>`.trim();

  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.decoding = "async";

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("PNG_EXPORT_FAILED"));
    img.src = svgUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("NO_CTX");

  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(svgUrl);

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1));
  if (!blob) throw new Error("NO_BLOB");

  downloadBlob(blob, filename);
}

/** -------------------------------------------
 * Main
 * ------------------------------------------ */
export default function TaskDistributionPrint() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user, effectiveTenantId } = useAuth() as any;
  const tenantId = String(effectiveTenantId || user?.tenantId || "").trim() || "default";

  const [phoneGateAllowed, setPhoneGateAllowed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(`yr:phone-gate:task-print:${tenantId}`) === "ok";
    } catch {
      return false;
    }
  });
  const [phoneGateValue, setPhoneGateValue] = useState("");
  const [phoneGateError, setPhoneGateError] = useState("");
  const [phoneGateLoading, setPhoneGateLoading] = useState(true);
  const [registeredGatePhone, setRegisteredGatePhone] = useState("");

  useEffect(() => {
    let mounted = true;
    setPhoneGateLoading(true);
    setPhoneGateError("");
    const phone = printReadLocalRegisteredPhone();
    if (mounted) {
      setRegisteredGatePhone(phone);
      setPhoneGateLoading(false);
    }
    const onStorage = () => {
      if (!mounted) return;
      setRegisteredGatePhone(printReadLocalRegisteredPhone());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      mounted = false;
      window.removeEventListener("storage", onStorage);
    };
  }, [tenantId]);

  const verifyPhoneGate = () => {
    const expected = printPhoneDigitsOnly(registeredGatePhone);
    const actual = printPhoneDigitsOnly(phoneGateValue);
    if (!expected) {
      setPhoneGateError("لا يوجد رقم هاتف مسجل في إعدادات المدرسة.");
      return;
    }
    if (!actual || actual !== expected) {
      setPhoneGateError("رقم الهاتف غير مطابق للرقم المسجل.");
      return;
    }
    try {
      sessionStorage.setItem(`yr:phone-gate:task-print:${tenantId}`, "ok");
    } catch {
      // ignore
    }
    setPhoneGateAllowed(true);
    setPhoneGateError("");
  };

  const printAreaRef = useRef<HTMLDivElement | null>(null);

  const [run, setRun] = useState(() => loadRun(tenantId));
  const [schoolData, setSchoolData] = useState<SchoolData>(() => {
    const saved = readJson<SchoolData>(SCHOOL_DATA_KEY);
    return (
      saved || {
        name: "",
        governorate: "",
        semester: "",
        phone: "",
        address: "",
      }
    );
  });
  const [logoUrl, setLogoUrl] = useState(() => {
    const savedLogo = (localStorage.getItem(LOGO_KEY) || "").trim();
    return savedLogo || DEFAULT_LOGO_URL;
  });
  const [examsList, setExamsList] = useState<Exam[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [unavailabilityRules, setUnavailabilityRules] = useState<any[]>(() => loadUnavailabilityForPrint(tenantId));

  // ✅ منع تجميد صفحة التقارير:
  // كانت الصفحة تستدعي Firestore + غياب الكادر كل 2.5 ثانية، وهذا يسبب بطء شديد عند الفتح.
  // هذه الحواجز تمنع تكرار نفس الطلبات الثقيلة أثناء فتح الصفحة أو الضغط على الأزرار.
  const rosterLoadingRef = useRef(false);
  const unavailabilityLoadingRef = useRef(false);
  const lastRosterLoadAtRef = useRef(0);
  const lastUnavailabilityCloudLoadAtRef = useRef(0);

  async function refreshUnavailabilityRulesFromTenant(
    targetTenantId = tenantId,
    options: { forceCloud?: boolean } = {}
  ) {
    const tid = String(targetTenantId || "").trim();

    // ✅ قراءة محلية فورية وخفيفة حتى يظهر كشف الغياب بدون انتظار السحابة.
    const localRows = loadUnavailabilityForPrint(tid);
    setUnavailabilityRules((prev) => dedupePrintUnavailabilityRules([...(Array.isArray(prev) ? prev : []), ...localRows]));

    const now = Date.now();
    const recentlyLoaded = now - lastUnavailabilityCloudLoadAtRef.current < 60_000;
    if (unavailabilityLoadingRef.current) return;
    if (!options.forceCloud && recentlyLoaded) return;

    unavailabilityLoadingRef.current = true;
    lastUnavailabilityCloudLoadAtRef.current = now;

    try {
      const cloudRows = await syncUnavailabilityFromTenant(tid)
        .then((rows: any) => extractPrintUnavailabilityRulesDeep(rows))
        .catch(() => []);

      setUnavailabilityRules(dedupePrintUnavailabilityRules([...cloudRows, ...localRows]));
    } finally {
      unavailabilityLoadingRef.current = false;
    }
  }

  async function refreshRosterFromFirestore(options: { force?: boolean } = {}) {
    const now = Date.now();
    const recentlyLoaded = now - lastRosterLoadAtRef.current < 60_000;
    if (rosterLoadingRef.current) return;
    if (!options.force && recentlyLoaded) return;

    rosterLoadingRef.current = true;
    lastRosterLoadAtRef.current = now;

    try {
      const [exRows, tRows] = await Promise.all([
        loadTenantArray<any>(tenantId, EXAMS_SUB).catch(() => []),
        loadTenantArray<any>(tenantId, TEACHERS_SUB).catch(() => []),
      ]);
      setExamsList(Array.isArray(exRows) ? (exRows as Exam[]) : []);
      setTeachers(
        (Array.isArray(tRows) ? tRows : [])
          .map((t: any) => ({
            id: String(t.id ?? "").trim(),
            employeeNo: String(t.employeeNo ?? t.employeeNumber ?? t.jobNo ?? t.jobNumber ?? "").trim(),
            fullName: String(t.fullName ?? t.name ?? t.teacherName ?? "").trim(),
            phone: String(t.phone ?? t.mobile ?? "").trim(),
          }))
          .filter((t: Teacher) => t.fullName || t.employeeNo || t.phone)
      );
    } finally {
      rosterLoadingRef.current = false;
    }
  }

  const [storageTick, setStorageTick] = useState(0);
  const lastRawRef = useRef<{ [k: string]: string }>({});

  function getRaw(key: string) {
    return localStorage.getItem(key) || "";
  }

  function refreshFromStorage() {
    let changed = false;

    const keysToWatch = [
      taskDistributionKey(tenantId),
      SCHOOL_DATA_KEY,
      LOGO_KEY,
      "exam-manager:task-distribution:master-table:v1",
      "exam-manager:task-distribution:all-table:v1",
      "exam-manager:task-distribution:results-table:v1",
    ];

    for (const k of keysToWatch) {
      const raw = getRaw(k);
      if (lastRawRef.current[k] !== raw) {
        lastRawRef.current[k] = raw;
        changed = true;
      }
    }

    if (changed) {
      setRun(loadRun(tenantId));

      const sd = readJson<SchoolData>(SCHOOL_DATA_KEY);
      setSchoolData(
        sd || {
          name: "",
          governorate: "",
          semester: "",
          phone: "",
          address: "",
        }
      );

      const nextLogo = (localStorage.getItem(LOGO_KEY) || "").trim() || DEFAULT_LOGO_URL;
      setLogoUrl(nextLogo);

      // teachers/exams أصبحت من Firestore
      refreshRosterFromFirestore();

      setStorageTick((x) => x + 1);
    }
  }

  useEffect(() => {
    refreshFromStorage();
    refreshRosterFromFirestore({ force: true });
    refreshUnavailabilityRulesFromTenant(tenantId, { forceCloud: true });

    const onRunUpdated = (e: any) => {
      const tid = String(e?.detail?.tenantId || "").trim();
      if (!tid || tid === String(tenantId)) refreshFromStorage();
    };

    const onStorage = (e: StorageEvent) => {
      if (!e?.key) return;
      if (
        e.key === taskDistributionKey(tenantId) ||
        e.key === SCHOOL_DATA_KEY ||
        e.key === LOGO_KEY ||
        e.key === "exam-manager:task-distribution:master-table:v1" ||
        e.key === "exam-manager:task-distribution:all-table:v1" ||
        e.key === "exam-manager:task-distribution:results-table:v1"
      ) {
        refreshFromStorage();
      }

      if (/(unavail|availability|غياب|عدم)/i.test(String(e.key || ""))) {
        refreshUnavailabilityRulesFromTenant(tenantId);
      }
    };

    const onUnavailabilityUpdated = (e: any) => {
      const tid = String(e?.detail?.tenantId || "").trim();
      if (!tid || tid === String(tenantId)) refreshUnavailabilityRulesFromTenant(tenantId, { forceCloud: true });
    };

    window.addEventListener(RUN_UPDATED_EVENT, onRunUpdated as any);
    window.addEventListener(UNAVAIL_UPDATED_EVENT, onUnavailabilityUpdated as any);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refreshFromStorage);

    const iv = window.setInterval(() => {
      // ✅ تحديث دوري خفيف فقط من localStorage.
      // لا نستدعي Firestore هنا حتى لا تتجمد صفحة التقارير كل ثوانٍ.
      refreshFromStorage();
    }, 30000);

    return () => {
      window.removeEventListener(RUN_UPDATED_EVENT, onRunUpdated as any);
      window.removeEventListener(UNAVAIL_UPDATED_EVENT, onUnavailabilityUpdated as any);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refreshFromStorage);
      window.clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const qs = useMemo(() => new URLSearchParams(loc.search), [loc.search]);

  const reportType = (qs.get("reportType") || (qs.get("teacher") ? "teacher" : "daily")) as "daily" | "teacher";
  const dateISO = normalizeISODate(qs.get("dateISO") || "");
  const teacherNameFilter = (qs.get("teacher") || "").trim();
  const subjectFilter = (qs.get("subject") || "").trim();

  const schoolHeader = useMemo(() => {
    const countryName = "سلطنة عمان";
    const ministryName = "وزارة التعليم";
    const directorateName = schoolData.governorate?.trim() || "المديرية العامة للتعليم";
    const schoolName = schoolData.name?.trim() || "المدرسة";
    const semesterLabel = schoolData.semester?.trim() || "الفصل الدراسي الأول";
    const yearLabel = "2026/2025";
    return { countryName, ministryName, directorateName, schoolName, semesterLabel, yearLabel };
  }, [schoolData]);

  /** -------------------------------------------
   * Exams index
   * ------------------------------------------ */
  const examsIndex = useMemo(() => {
    type ExamMeta = {
      id: string;
      subject: string;
      dateISO: string;
      period: string;
      periodKey: string;
      dayLabel: string;
      time: string;
    };

    const exact = new Map<string, ExamMeta>();
    const bySubjectDate = new Map<string, ExamMeta[]>();
    const byId = new Map<string, ExamMeta>();

    for (const ex of examsList || []) {
      const subject = String(ex?.subject || "").trim();
      const s = normalizeText(subject);
      const d = normalizeISODate(ex?.dateISO || "");
      const period = String(ex?.period || "").trim();
      const periodKey = normalizePeriodKey(period || "");
      if (!s || !d || !periodKey) continue;

      const meta: ExamMeta = {
        id: String((ex as any)?.id ?? (ex as any)?.examId ?? "").trim(),
        subject,
        dateISO: d,
        period,
        periodKey,
        dayLabel: String(ex?.dayLabel || "").trim(),
        time: String(ex?.time || "").trim(),
      };

      const exactKey = `${s}|${d}|${periodKey}`;
      if (!exact.has(exactKey)) exact.set(exactKey, meta);

      const subjectDateKey = `${s}|${d}`;
      const list = bySubjectDate.get(subjectDateKey) || [];
      list.push(meta);
      bySubjectDate.set(subjectDateKey, list);

      if (meta.id && !byId.has(meta.id)) byId.set(meta.id, meta);
    }

    for (const list of bySubjectDate.values()) {
      list.sort((a, b) => periodOrderValue(a.period) - periodOrderValue(b.period) || a.subject.localeCompare(b.subject, "ar"));
    }

    return { exact, bySubjectDate, byId };
  }, [examsList]);

  function lookupExamMeta(subject: string, dISO: string, period: string, time?: string) {
    const s = normalizeText(subject);
    const d = normalizeISODate(dISO);
    const p = normalizePeriodKey(period);
    if (!s || !d) return null;

    if (p) {
      const exactKey = `${s}|${d}|${p}`;
      const exactMatch = examsIndex.exact.get(exactKey);
      if (exactMatch) return exactMatch;
    }

    const subjectDateRows = examsIndex.bySubjectDate.get(`${s}|${d}`) || [];
    if (subjectDateRows.length === 1) return subjectDateRows[0];

    const wantedTime = String(time || "").trim();
    if (wantedTime) {
      const byTime = subjectDateRows.find((ex) => String(ex.time || "").trim() === wantedTime);
      if (byTime) return byTime;
    }

    if (p) {
      const byPeriod = subjectDateRows.find((ex) => ex.periodKey === p);
      if (byPeriod) return byPeriod;
    }

    return null;
  }

  function lookupExamMetaForRow(row: AnyAssignment) {
    const examId = getAssignmentExamId(row);
    if (examId) {
      const byId = examsIndex.byId.get(examId);
      if (byId) return byId;
    }

    return lookupExamMeta(getExamSubject(row), getExamDateISO(row), getExamPeriod(row), getExamTime(row));
  }

  function getResolvedExamPeriod(row: AnyAssignment) {
    return lookupExamMetaForRow(row)?.period || getExamPeriod(row) || "";
  }

  /** -------------------------------------------
   * Teachers index (name -> phone / employeeNo)
   * ------------------------------------------ */
  const teacherPhoneIndex = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teachers || []) {
      const nameKey = normalizeText(t.fullName || "");
      if (!nameKey) continue;
      const phone = sanitizePhoneToWhatsApp(t.phone || "");
      if (phone) map.set(nameKey, phone);
    }
    return map;
  }, [teachers]);

  const teacherEmployeeIndex = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teachers || []) {
      const nameKey = normalizeText(t.fullName || "");
      if (!nameKey) continue;
      const emp = String(t.employeeNo || "").trim();
      if (emp) map.set(nameKey, emp);
    }
    return map;
  }, [teachers]);

  /**
   * ✅ ربط الطباعة ببيانات الكادر التعليمي مثل صفحة النتائج:
   * نعتمد على teacherId أولًا، ثم الاسم المطابق، ثم مطابقة الاسم بعد حذف رقم النهاية فقط.
   */
  const teacherFullNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teachers || []) {
      const fullName = String(t.fullName || "").trim();
      if (!fullName) continue;
      const ids = [t.id, (t as any).teacherId, (t as any).uid, (t as any).docId]
        .map((v) => String(v ?? "").trim())
        .filter(Boolean);
      for (const id of ids) {
        if (!map.has(id)) map.set(id, fullName);
      }
    }
    return map;
  }, [teachers]);

  const teacherFullNameByNameKey = useMemo(() => {
    const exact = new Map<string, string>();
    const clean = new Map<string, string>();

    for (const t of teachers || []) {
      const fullName = String(t.fullName || "").trim();
      if (!fullName) continue;

      const exactKey = normalizeText(fullName);
      if (exactKey && !exact.has(exactKey)) exact.set(exactKey, fullName);

      const cleanKey = normalizeTeacherNameForMatch(fullName);
      if (cleanKey && !clean.has(cleanKey)) clean.set(cleanKey, fullName);
    }

    return { exact, clean };
  }, [teachers]);

  function resolveTeacherNameForPrint(row: AnyAssignment): string {
    const rawName = String(getTeacherName(row) || "").trim();
    const teacherId = getAssignmentTeacherId(row);

    if (teacherId) {
      const byId = teacherFullNameById.get(teacherId);
      if (byId) return byId;
    }

    const exactKey = normalizeText(rawName);
    if (exactKey) {
      const exact = teacherFullNameByNameKey.exact.get(exactKey);
      if (exact) return exact;
    }

    const cleanKey = normalizeTeacherNameForMatch(rawName);
    if (cleanKey) {
      const clean = teacherFullNameByNameKey.clean.get(cleanKey);
      if (clean) return clean;

      const candidates = (teachers || [])
        .map((t) => String(t.fullName || "").trim())
        .filter(Boolean)
        .filter((fullName) => {
          const fullKey = normalizeTeacherNameForMatch(fullName);
          return fullKey === cleanKey || fullKey.startsWith(`${cleanKey} `) || cleanKey.startsWith(`${fullKey} `);
        });

      const unique = Array.from(new Set<string>(candidates));
      if (unique.length === 1) return unique[0];
    }

    return rawName;
  }

  function getTeacherWhatsAppPhoneByName(name: string) {
    const key = normalizeText(name || "");
    if (!key) return "";
    return teacherPhoneIndex.get(key) || "";
  }

  function getTeacherEmployeeNoByName(name: string) {
    const key = normalizeText(name || "");
    if (!key) return "";
    return teacherEmployeeIndex.get(key) || "";
  }

  function maskEmployeeNoForPrint(value: string) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const chars = Array.from(raw.replace(/\s+/g, ""));
    if (chars.length <= 4) return chars.join("");
    return chars.map((ch, index) => (index < 2 || index >= chars.length - 2 ? ch : "x")).join("");
  }

  /** -------------------------------------------
   * Load master table
   * ------------------------------------------ */
  const masterTableRows = useMemo<AnyAssignment[]>(() => {
    const m1 = readJson<any>("exam-manager:task-distribution:master-table:v1");
    const m2 = readJson<any>("exam-manager:task-distribution:all-table:v1");
    const m3 = readJson<any>("exam-manager:task-distribution:results-table:v1");

    const payload = m1 || m2 || m3 || null;
    const rows = payload?.rows || payload?.data || null;

    // ✅ مهم: إذا كان "الجدول الشامل" من Run قديم، لا نسمح له أن يطغى على Run الحالي
    const meta = payload?.meta || {};
    const matchesCurrentRun = !run || meta?.runId === run.runId || meta?.runCreatedAtISO === run.createdAtISO;

    if (Array.isArray(rows) && rows.length && matchesCurrentRun) return rows;
    return Array.isArray(run?.assignments) ? (run!.assignments as any[]) : [];
  }, [run, storageTick]);

  const printTableRows = useMemo<AnyAssignment[]>(() => {
    const resolvedBase = (masterTableRows || []).map((row) => {
      const resolvedName = resolveTeacherNameForPrint(row);
      const originalName = String(getTeacherName(row) || "").trim();

      if (!resolvedName || resolvedName === originalName) {
        return row;
      }

      return {
        ...row,
        __printResolvedTeacherName: resolvedName,
        teacherName: resolvedName,
        name: resolvedName,
        teacherLabel: resolvedName,
      };
    });

    // ✅ حماية الطباعة: إذا كان المعلم مسجلًا في غياب الكادر التعليمي، لا يظهر له تكليف عادي في نفس الفترة.
    const cleanedBase = resolvedBase.filter((row) => {
      if (isLeaveAssignmentForPrint(row)) return true;

      const task = String(getTaskType(row) || "");
      const teacherId = getAssignmentTeacherId(row);
      const teacherName = getTeacherName(row);
      const date = normalizePrintUnavailabilityDateISO(getExamDateISO(row));
      if (!date || (!teacherId && !teacherName)) return true;

      return !assignmentPeriodsForPrintUnavailability(row, task).some((period) =>
        isPrintTeacherBlockedByUnavailability(unavailabilityRules, teacherId, teacherName, date, period)
      );
    });

    // ✅ لا نعتمد فقط على Run؛ نبني صفوف الغياب من Unavailability.tsx مباشرة.
    const absenceRows = buildPrintUnavailabilityAbsenceAssignments(unavailabilityRules, teachers);
    const existingAbsenceKeys = new Set(
      cleanedBase
        .filter((row) => isLeaveAssignmentForPrint(row))
        .map((row) => {
          const teacherKey = getAssignmentTeacherId(row) || normalizeTeacherNameForMatch(getTeacherName(row));
          const date = normalizePrintUnavailabilityDateISO(getExamDateISO(row));
          const period = periodToPrintAMPM(getExamPeriod(row) || "AM");
          return `${teacherKey}__${date}__${period}`;
        })
    );

    const extraAbsenceRows = absenceRows.filter((row) => {
      const teacherKey = getAssignmentTeacherId(row) || normalizeTeacherNameForMatch(getTeacherName(row));
      const key = `${teacherKey}__${normalizePrintUnavailabilityDateISO(getExamDateISO(row))}__${periodToPrintAMPM(getExamPeriod(row) || "AM")}`;
      if (existingAbsenceKeys.has(key)) return false;
      existingAbsenceKeys.add(key);
      return true;
    });

    // ✅ دمج صفوف الغياب المتكررة لنفس المعلم/التاريخ/الفترة.
    // مثال: إذا ظهر "غياب - إجازة" و "غياب - غياب" لنفس الفترة، نُبقي فقط "غياب - إجازة".
    return mergePrintLeaveDuplicates([...cleanedBase, ...extraAbsenceRows]);
  }, [masterTableRows, teacherFullNameById, teacherFullNameByNameKey, teachers, unavailabilityRules]);

  /** -------------------------------------------
   * Options
   * ------------------------------------------ */
  const teacherOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of printTableRows || []) {
      const n = (getTeacherName(r) || "").trim();
      if (!n) continue;
      const k = normalizeText(n);
      if (!set.has(k)) set.set(k, n);
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, "ar"));
  }, [printTableRows]);

  const subjectOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of printTableRows || []) {
      const s = (getExamSubject(r) || "").trim();
      if (!s) continue;
      const n = normalizeText(s);
      if (!set.has(n)) set.set(n, s);
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, "ar"));
  }, [printTableRows]);

  /** -------------------------------------------
   * Apply filters
   * ------------------------------------------ */
  const filteredRows = useMemo(() => {
    let rows = [...(printTableRows || [])];

    if (reportType === "daily" && dateISO) {
      rows = rows.filter((r) => normalizeISODate(getExamDateISO(r)) === dateISO);
    }

    if (reportType === "teacher" && teacherNameFilter) {
      rows = rows.filter((r) => getTeacherName(r).trim() === teacherNameFilter);
    }

    if (subjectFilter) {
      const nSub = normalizeText(subjectFilter);
      rows = rows.filter((r) => normalizeText(getExamSubject(r)) === nSub);
    }

    return rows;
  }, [printTableRows, reportType, dateISO, teacherNameFilter, subjectFilter]);

  /** -------------------------------------------
   * Header exam info
   * ------------------------------------------ */
  const headerExamInfo = useMemo(() => {
    const r = filteredRows[0] || printTableRows[0] || null;

    const subject = subjectFilter || (r ? getExamSubject(r) : "");
    const dISO = r ? normalizeISODate(getExamDateISO(r)) : dateISO;
    const period = r ? getExamPeriod(r) : "";

    let dayLabel = r ? getExamDayLabel(r) : "";
    let time = r ? getExamTime(r) : "";

    const meta = lookupExamMeta(subject, dISO, period);
    if (meta) {
      dayLabel = meta.dayLabel || dayLabel;
      time = meta.time || time;
    }

    return { subject, dISO, dayLabel, period, time };
  }, [filteredRows, printTableRows, dateISO, subjectFilter, examsIndex]);

  /** -------------------------------------------
   * Query helper
   * ------------------------------------------ */
  function setQueryParam(key: string, value: string) {
    const sp = new URLSearchParams(loc.search);
    if (!value) sp.delete(key);
    else sp.set(key, value);
    nav(`${loc.pathname}?${sp.toString()}`, { replace: true });
  }

  function setTeacherSelection(v: string) {
    setQueryParam("reportType", "teacher");
    setQueryParam("teacher", v || "");
  }
  function setReportDaily() {
    setQueryParam("reportType", "daily");
    setQueryParam("teacher", "");
  }
  function setReportTeacher() {
    setQueryParam("reportType", "teacher");
  }

  // ✅ طباعة "التقرير فقط" عبر نافذة مستقلة
  async function openPrintDialog() {
    const el = printAreaRef.current;
    if (!el) return;

    // ✅ Audit: طباعة تقرير التوزيع
    void writeTenantAudit(tenantId, {
      action: "distribution_print_report",
      entity: "task_distribution",
      by: user?.uid || undefined,
      meta: { reportType, teacherNameFilter: teacherNameFilter || null, atISO: new Date().toISOString() },
    }).catch(() => {});
    const safeTitle = (teacherNameFilter || (reportType === "daily" ? "daily" : "report")).trim() || "report";
    await printOnlyElement(el, safeTitle);
  }

  if (!run) {
    return (
      <div style={styles.pageWrapDark}>
        <div style={styles.darkCard}>
          <div style={styles.darkRow}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "white" }}>طباعة التقرير</div>
              <div style={{ color: "rgba(255,255,255,.75)", marginTop: 4 }}>لا يوجد تشغيل محفوظ بعد</div>
            </div>
            <button style={styles.btnSoft} onClick={() => nav("/task-distribution")}>
              رجوع
            </button>
          </div>
        </div>
      </div>
    );
  }

  const safeRun = run;

  const title =
    reportType === "teacher"
      ? teacherNameFilter
        ? "تقرير معلم (فردي)"
        : "تقرير الكادر التعليمي (الكل)"
      : "كشف يومي (امتحانات)";

  /** -------------------------------------------
   * DAILY groups
   * ------------------------------------------ */
  const dailyInvigilators = useMemo(() => {
    if (reportType !== "daily") return [];
    const rows = filteredRows.filter((r) => getTaskType(r) === "INVIGILATION");
    rows.sort((a, b) => {
      const ra = parseCommitteeNumber(getRoomNumber(a));
      const rb = parseCommitteeNumber(getRoomNumber(b));
      if (ra.num !== rb.num) return ra.num - rb.num;
      if (ra.raw !== rb.raw) return ra.raw.localeCompare(rb.raw, "ar");
      return (getTeacherName(a) || "").localeCompare(getTeacherName(b) || "", "ar");
    });
    return rows;
  }, [filteredRows, reportType]);

  const dailyReserves = useMemo(() => {
    if (reportType !== "daily") return [];
    return filteredRows.filter((r) => getTaskType(r) === "RESERVE");
  }, [filteredRows, reportType]);

  const dailyReviewFree = useMemo(() => {
    if (reportType !== "daily") return [];
    return filteredRows.filter((r) => getTaskType(r) === "REVIEW_FREE");
  }, [filteredRows, reportType]);


  /** -------------------------------------------
   * ✅ كل التقارير اليومية عند فتح الصفحة
   * الترتيب: التاريخ تصاعديًا، ثم الفترة الأولى، ثم الفترة الثانية، ثم المادة.
   * إذا كان هناك أكثر من مادة في نفس الفترة يتم فصل كل مادة في كشف مستقل.
   * ------------------------------------------ */
  const dailyReportGroups = useMemo(() => {
    if (reportType !== "daily") return [];

    /**
     * ✅ مهم:
     * الكشوف اليومية مفصولة حسب المادة، لكن الاحتياط يكون حسب اليوم + الفترة فقط.
     * لذلك يتم استخراج احتياط الفترة من الجدول الكامل، ثم إظهاره في كل كشوف نفس التاريخ والفترة.
     */
    const dailyBaseRows = (printTableRows || []).filter((row) => {
      if (!dateISO) return true;
      return normalizeISODate(getExamDateISO(row) || "") === dateISO;
    });

    const reserveByDatePeriod = new Map<string, AnyAssignment[]>();
    const reviewFreeByDateSubject = new Map<string, AnyAssignment[]>();

    for (const row of dailyBaseRows) {
      const task = getTaskType(row);
      const meta = lookupExamMetaForRow(row);
      const rowDate = meta?.dateISO || normalizeISODate(getExamDateISO(row) || "");

      // ✅ لا يتم إنشاء كشف تقرير الغياب داخل صفحة الطباعة.
      // ✅ يظل الغياب مستخدمًا كحماية لمنع توزيع المعلم، لكنه لا يظهر ككشف مستقل.
      if (task === "LEAVE") continue;

      if (task === "RESERVE") {
        const reservePeriod = meta?.period || getExamPeriod(row) || "";
        const key = datePeriodKey(rowDate, reservePeriod);
        const list = reserveByDatePeriod.get(key) || [];
        list.push(row);
        reserveByDatePeriod.set(key, list);
        continue;
      }

      // ✅ فاضي للمراجعة يظهر داخل كشف مادته فقط، ولا ينتشر في كل كشوف نفس اليوم.
      // ✅ لا نستخدم الفترة هنا؛ إذا كانت نفس المادة موجودة في فترتين بنفس اليوم يظهر في كشفي نفس المادة فقط.
      if (task === "REVIEW_FREE") {
        if (!rowDate) continue;
        const reviewSubject = getReviewFreeSubjectForPrint(row, meta);
        const reviewSubjectKey = normalizeSubjectKeyForPrint(reviewSubject);
        if (!reviewSubjectKey) continue;
        const key = dateSubjectKey(rowDate, reviewSubject);
        const list = reviewFreeByDateSubject.get(key) || [];
        list.push(row);
        reviewFreeByDateSubject.set(key, list);
      }
    }

    const map = new Map<
      string,
      {
        key: string;
        dateISO: string;
        period: string;
        subject: string;
        dayLabel: string;
        time: string;
        invigilators: AnyAssignment[];
        reserves: AnyAssignment[];
        reviewFree: AnyAssignment[];
        leaves: AnyAssignment[];
        isLeaveReport?: boolean;
      }
    >();

    for (const row of filteredRows || []) {
      const task = getTaskType(row);

      // ✅ لا ننشئ كشفًا مستقلًا للاحتياط أو المراجعة أو التصحيح.
      // ✅ التصحيح لا يمثل امتحان مراقبة، لذلك لا يظهر ككشف يومي فارغ في الطباعة.
      if (task === "RESERVE" || task === "REVIEW_FREE" || task === "CORRECTION_FREE" || task === "LEAVE") continue;

      const meta = lookupExamMetaForRow(row);
      const date = meta?.dateISO || normalizeISODate(getExamDateISO(row) || "");
      const period = meta?.period || getExamPeriod(row) || "";
      const subject = meta?.subject || getExamSubject(row) || "";
      const periodKey = normalizePeriodKey(period);
      const subjectKey = normalizeText(subject || "بدون مادة");
      const key = `${date || "no-date"}|${periodKey || "no-period"}|${subjectKey || "no-subject"}`;

      let group = map.get(key);
      if (!group) {
        group = {
          key,
          dateISO: date,
          period,
          subject,
          dayLabel: meta?.dayLabel || getExamDayLabel(row) || "",
          time: meta?.time || getExamTime(row) || "",
          invigilators: [],
          reserves: [],
          reviewFree: [],
          leaves: [],
        };
        map.set(key, group);
      } else if (meta) {
        if (!group.dayLabel && meta.dayLabel) group.dayLabel = meta.dayLabel;
        if (!group.time && meta.time) group.time = meta.time;
        if (!normalizePeriodKey(group.period) && meta.period) group.period = meta.period;
      }

      if (task === "INVIGILATION") group.invigilators.push(row);
      else if (task === "REVIEW_FREE") group.reviewFree.push(row);
    }

    const normalGroups = Array.from(map.values()).map((group) => {
      const sharedReserveRows = reserveByDatePeriod.get(datePeriodKey(group.dateISO, group.period)) || [];
      const sharedReviewRows = reviewFreeByDateSubject.get(dateSubjectKey(group.dateISO, group.subject)) || [];

      return {
        ...group,
        invigilators: sortInvigilatorsByCommittee(group.invigilators),
        reserves: uniqueAssignmentsByTeacherName(sharedReserveRows),
        reviewFree: uniqueAssignmentsByTeacherName(sharedReviewRows),
        leaves: [],
      };
    });

    return normalGroups.sort((a, b) => {
      const da = a.dateISO || "9999-99-99";
      const db = b.dateISO || "9999-99-99";
      if (da !== db) return da.localeCompare(db);

      const po = periodOrderValue(a.period) - periodOrderValue(b.period);
      if (po !== 0) return po;

      return (a.subject || "").localeCompare(b.subject || "", "ar");
    });
  }, [filteredRows, printTableRows, reportType, dateISO, examsIndex]);

  /** -------------------------------------------
   * WhatsApp text
   * ------------------------------------------ */
  const shareText = useMemo(() => {
    const base = `تقرير توزيع المهام - ${schoolHeader.schoolName}\n`;
    const typeLine = `نوع التقرير: ${title}\n`;
    const teacherLine = teacherNameFilter ? `المعلم: ${teacherNameFilter}\n` : "";
    const empLine = teacherNameFilter ? `الرقم الوظيفي: ${maskEmployeeNoForPrint(getTeacherEmployeeNoByName(teacherNameFilter)) || "—"}\n` : "";
    const subjectLine = subjectFilter ? `المادة: ${subjectFilter}\n` : "";
    const dateLine = dateISO ? `التاريخ: ${dateISO}\n` : "";
    return `${base}${typeLine}${teacherLine}${empLine}${subjectLine}${dateLine}تم الإنشاء من النظام.`;
  }, [schoolHeader.schoolName, title, teacherNameFilter, subjectFilter, dateISO, teacherEmployeeIndex]);

  /** -------------------------------------------
   * Teacher pages (all teachers)
   * ------------------------------------------ */
  const allTeachersPages = useMemo(() => {
    if (reportType !== "teacher" || teacherNameFilter) return [];
    const pages = teacherOptions.map((tName) => {
      let rows = printTableRows.filter((r) => getTeacherName(r).trim() === tName);

      if (subjectFilter) {
        const nSub = normalizeText(subjectFilter);
        rows = rows.filter((r) => normalizeText(getExamSubject(r)) === nSub);
      }

      rows.sort((a, b) => {
        const da = normalizeISODate(getExamDateISO(a));
        const db = normalizeISODate(getExamDateISO(b));
        if (da !== db) return da.localeCompare(db);

        const po = periodOrderValue(getResolvedExamPeriod(a)) - periodOrderValue(getResolvedExamPeriod(b));
        if (po !== 0) return po;

        return (getExamSubject(a) || "").toString().localeCompare((getExamSubject(b) || "").toString(), "ar");
      });

      return { teacherName: tName, rows };
    });

    return pages.filter((p) => p.rows.length > 0);
  }, [reportType, teacherNameFilter, teacherOptions, printTableRows, subjectFilter]);

  /** -------------------------------------------
   * Daily sheet
   * ------------------------------------------ */
  function DailySheet(props: {
    group: {
      dateISO: string;
      period: string;
      subject: string;
      dayLabel: string;
      time: string;
      invigilators: AnyAssignment[];
      reserves: AnyAssignment[];
      reviewFree: AnyAssignment[];
      leaves: AnyAssignment[];
      isLeaveReport?: boolean;
    };
    pageBreak?: boolean;
    createdAtISO: string;
  }) {
    const group = props.group;

    return (
      <div className="print-sheet print-daily" style={{ ...styles.sheet, ...(props.pageBreak ? styles.pageBreak : {}) }}>
        <div style={styles.headerGrid}>
          <div style={styles.headerRight}>
            <div style={styles.headerRightLine}>{schoolHeader.countryName}</div>
            <div style={styles.headerRightLine}>{schoolHeader.ministryName}</div>
            <div style={styles.headerRightLine}>{schoolHeader.directorateName}</div>
            <div style={styles.headerRightLine}>{schoolHeader.schoolName}</div>
          </div>

          <div style={styles.headerCenter}>
            <img src={logoUrl} alt="شعار" style={{ width: 80, height: 80, objectFit: "contain" }} />
          </div>

          <div style={styles.headerLeft}>
            <div style={styles.headerLeftTitle}>{group.isLeaveReport ? "كشف تقرير الغياب" : "كشف مراقبة امتحان"}</div>
            <div style={styles.headerLeftSub}>{schoolHeader.semesterLabel}</div>
            <div style={styles.headerLeftSub}>العام الدراسي {schoolHeader.yearLabel}</div>
          </div>
        </div>

        <div style={styles.hr} />

        <div style={styles.examBarWide}>
          <div style={styles.examBarWideInner}>
            <div style={styles.examBarWideItem}>
              <span style={styles.examLabel}>الفترة:</span> <span style={styles.examValue}>{formatPeriod(group.period)}</span>
            </div>
            <div style={styles.examBarWideSep}>|</div>

            <div style={styles.examBarWideItem}>
              <span style={styles.examLabel}>اليوم:</span> <span style={styles.examValue}>{group.dayLabel || "—"}</span>
            </div>
            <div style={styles.examBarWideSep}>|</div>

            <div style={styles.examBarWideItem}>
              <span style={styles.examLabel}>الوقت:</span> <span style={styles.examValue}>{group.time || "—"}</span>
            </div>

            <div style={styles.examBarWideItem}>
              <span style={styles.examLabel}>المادة:</span> <span style={styles.examValue}>{group.subject || "—"}</span>
            </div>

            <div style={styles.examBarWideItem}>
              <span style={styles.examLabel}>التاريخ:</span> <span style={styles.examValue}>{group.dateISO || "—"}</span>
            </div>
          </div>
        </div>

        <div style={styles.chipRow}>
          <div style={group.isLeaveReport ? styles.leaveChip : styles.chip}>
            {group.isLeaveReport ? "كشف تقرير الغياب" : "كشف بأسماء المراقبين"}
          </div>
        </div>

        {group.isLeaveReport ? (
          <>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: 56, textAlign: "center" }}>م</th>
                  <th style={{ ...styles.th }}>اسم المعلم</th>
                  <th style={{ ...styles.th, width: 150 }}>الفترة</th>
                  <th style={{ ...styles.th, width: 220 }}>سبب الغياب / العذر</th>
                  <th style={{ ...styles.th, width: 140 }}>التوقيع</th>
                </tr>
              </thead>
              <tbody>
                {group.leaves.length ? (
                  group.leaves.map((r, idx) => (
                    <tr key={idx}>
                      <td style={styles.tdNum}>{idx + 1}</td>
                      <td style={{ ...styles.td, ...styles.leaveTd }}><span data-print-teacher-name="true">{getTeacherName(r) || "—"}</span></td>
                      <td style={{ ...styles.td, ...styles.leaveTd }}>{formatPeriod(getExamPeriod(r) || group.period)}</td>
                      <td style={{ ...styles.td, ...styles.leaveTd }}>{String(r?.reason || "غياب").trim() || "غياب"}</td>
                      <td style={styles.td}></td>
                    </tr>
                  ))
                ) : (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td style={styles.tdNum}>{i + 1}</td>
                      <td style={styles.td}></td>
                      <td style={styles.td}></td>
                      <td style={styles.td}>غياب</td>
                      <td style={styles.td}></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div style={styles.leaveNotice}>
              هذه الأسماء مرتبطة بسجل غياب الكادر التعليمي، ولا يتم توزيعها في هذه الفترة أو تعديلها من كشوف التوزيع.
            </div>
          </>
        ) : (
          <>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: 56, textAlign: "center" }}>م</th>
                  <th style={{ ...styles.th }}>اسم المراقب</th>
                  <th style={{ ...styles.th, width: 140 }}>رقم اللجنة</th>
                  <th style={{ ...styles.th, width: 140 }}>التوقيع</th>
                </tr>
              </thead>
              <tbody>
                {group.invigilators.length ? (
                  group.invigilators.map((r, idx) => (
                    <tr key={idx}>
                      <td style={styles.tdNum}>{idx + 1}</td>
                      <td style={styles.td}><span data-print-teacher-name="true">{getTeacherName(r) || "—"}</span></td>
                      <td style={styles.td}>{getRoomNumber(r) || "—"}</td>
                      <td style={styles.td}></td>
                    </tr>
                  ))
                ) : (
                  Array.from({ length: 12 }).map((_, i) => (
                    <tr key={i}>
                      <td style={styles.tdNum}>{i + 1}</td>
                      <td style={styles.td}></td>
                      <td style={styles.td}></td>
                      <td style={styles.td}></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div style={styles.reserveBlock}>
              <div style={styles.reserveTitle}>المراقبون الاحتياط</div>
              <table style={styles.reserveTable}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: 56, textAlign: "center" }}>م</th>
                    <th style={{ ...styles.th }}>اسم المراقب الاحتياط</th>
                    <th style={{ ...styles.th, width: 200 }}>التوقيع</th>
                  </tr>
                </thead>
                <tbody>
                  {group.reserves.length ? (
                    group.reserves.map((r, idx) => (
                      <tr key={idx}>
                        <td style={styles.tdNum}>{idx + 1}</td>
                        <td style={{ ...styles.td, fontWeight: 900 }}><span data-print-teacher-name="true">{getTeacherName(r) || "—"}</span></td>
                        <td style={styles.td}></td>
                      </tr>
                    ))
                  ) : (
                    Array.from({ length: 2 }).map((_, i) => (
                      <tr key={i}>
                        <td style={styles.tdNum}>{i + 1}</td>
                        <td style={styles.td}></td>
                        <td style={styles.td}></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div style={{ marginTop: 14 }}>
                <div style={styles.reserveTitle}>المعلمون الفارغون للمراجعة</div>
                <table style={styles.reserveTable}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, width: 56, textAlign: "center" }}>م</th>
                      <th style={{ ...styles.th }}>اسم المعلم</th>
                      <th style={{ ...styles.th, width: 200 }}>التوقيع</th>
                      <th style={{ ...styles.th, width: 220 }}>ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.reviewFree.length ? (
                      group.reviewFree.map((r, idx) => (
                        <tr key={idx}>
                          <td style={styles.tdNum}>{idx + 1}</td>
                          <td style={{ ...styles.td, fontWeight: 900 }}><span data-print-teacher-name="true">{getTeacherName(r) || "—"}</span></td>
                          <td style={styles.td}></td>
                          <td style={styles.td}>فارغ للمراجعة</td>
                        </tr>
                      ))
                    ) : (
                      Array.from({ length: 1 }).map((_, i) => (
                        <tr key={i}>
                          <td style={styles.tdNum}>{i + 1}</td>
                          <td style={styles.td}></td>
                          <td style={styles.td}></td>
                          <td style={styles.td}>فارغ للمراجعة</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <div style={styles.bottomSigRow}>
          <div style={styles.bottomSigCell}>رئيس الكنترول</div>
          <div style={styles.bottomSigCell}>مدير المدرسة</div>
        </div>

        <div style={styles.footerNote}>تم إنشاء التقرير من نظام توزيع مهام المراقبة — {props.createdAtISO || ""}</div>
      </div>
    );
  }

  function TeacherSheet(props: { teacherName: string; rows: AnyAssignment[]; pageBreak?: boolean; createdAtISO: string }) {
    const employeeNo = maskEmployeeNoForPrint(getTeacherEmployeeNoByName(props.teacherName));
    const teacherRowsForPrint = dedupeTeacherRowsForPrint(props.rows || []);

    return (
      <div className="print-sheet" style={{ ...styles.sheet, ...(props.pageBreak ? styles.pageBreak : {}) }}>
        <div style={styles.headerGrid}>
          <div style={styles.headerRight}>
            <div style={styles.headerRightLine}>{schoolHeader.countryName}</div>
            <div style={styles.headerRightLine}>{schoolHeader.ministryName}</div>
            <div style={styles.headerRightLine}>{schoolHeader.directorateName}</div>
            <div style={styles.headerRightLine}>{schoolHeader.schoolName}</div>
          </div>

          <div style={styles.headerCenter}>
            <img src={logoUrl} alt="شعار" style={{ width: 80, height: 80, objectFit: "contain" }} />
          </div>

          <div style={styles.headerLeft}>
            <div style={styles.headerLeftTitle}>تقرير معلم (فردي)</div>
            <div style={styles.headerLeftSub}>{schoolHeader.semesterLabel}</div>
            <div style={styles.headerLeftSub}>العام الدراسي {schoolHeader.yearLabel}</div>
          </div>
        </div>

        <div style={styles.hr} />

        <div style={styles.teacherInfoBox}>
          <div style={styles.teacherInfoRow}>
            <span style={styles.teacherInfoLabel}>اسم المعلم:</span>
            <span style={styles.teacherInfoValue}><span data-print-teacher-name="true">{props.teacherName || "—"}</span></span>
          </div>

          <div style={styles.teacherInfoRow}>
            <span style={styles.teacherInfoLabel}>الرقم الوظيفي:</span>
            <span style={styles.teacherInfoValue}>{employeeNo || "—"}</span>
          </div>
        </div>

        <div style={styles.tableTitleWrap}>
          <div style={styles.tableTitle}>جدول مهام المراقبة والمراجعة والتصحيح</div>
        </div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: 56 }}>م</th>
              <th style={{ ...styles.th, width: 170 }}>اليوم والتاريخ</th>
              <th style={{ ...styles.th, width: 120 }}>الفترة</th>

              {/* ✅ تركنا طبيعة العمل ثابتة */}
              <th style={{ ...styles.th, width: 140 }}>طبيعة العمل</th>

              {/* ✅ FIX: عمود المادة بنفس عرض الفترة */}
              <th style={{ ...styles.th, width: 120 }}>المادة</th>

              <th style={{ ...styles.th, width: 140 }}>رقم اللجنة</th>
            </tr>
          </thead>
          <tbody>
            {teacherRowsForPrint.length ? (
              teacherRowsForPrint.map((r, idx) => {
                const meta = lookupExamMetaForRow(r);
                const isLeaveRow = getTaskType(r) === "LEAVE";
                // ✅ للغياب: لا نعرض "إجازة" دائمًا؛ نعرض السبب المسجل فعليًا في Unavailability.tsx.
                const sub = isLeaveRow ? getLeaveReasonForPrint(r) : meta?.subject || getExamSubject(r) || "";
                const dISO = meta?.dateISO || normalizeISODate(getExamDateISO(r)) || "";
                const per = meta?.period || getExamPeriod(r) || "";
                const day = meta?.dayLabel || getExamDayLabel(r) || "—";

                return (
                  <tr key={idx}>
                    <td style={styles.tdNum}>{idx + 1}</td>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 900 }}>{day}</div>
                      <div style={{ fontWeight: 800, color: "#334155" }}>{dISO || "—"}</div>
                    </td>
                    <td style={styles.td}>{formatPeriod(per)}</td>
                    <td style={styles.td}>{taskLabel(getTaskType(r))}</td>

                    {/* ✅ المادة بعرض ثابت + لفّ واضح */}
                    <td style={{ ...styles.td, wordBreak: "break-word", overflowWrap: "anywhere" }}>{sub || "—"}</td>

                    <td style={styles.td}>{getRoomNumber(r) || "—"}</td>
                  </tr>
                );
              })
            ) : (
              Array.from({ length: 10 }).map((_, idx) => (
                <tr key={idx}>
                  <td style={styles.tdNum}>{idx + 1}</td>
                  <td style={styles.td}></td>
                  <td style={styles.td}></td>
                  <td style={styles.td}></td>
                  <td style={styles.td}></td>
                  <td style={styles.td}></td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div style={styles.importantSection}>
          <div style={styles.importantTitle}>تنبيهات هامة:</div>
          <ul style={styles.importantList}>
            <li style={styles.importantLi}>يجب الحضور إلى مقر اللجنة قبل بدء الامتحان بـ 20 دقيقة على الأقل.</li>
            <li style={styles.importantLi}>يرجى الالتزام التام بالتعليمات الواردة في لائحة إدارة الامتحانات.</li>
            <li style={styles.importantLi}>         يمنع استخدام الهاتف النقال داخل قاعات الامتحان..</li>
             <li style={styles.importantLi}>في حال وجود عذر طارئ يمنعك من الحضور، يرجى إبلاغ إدارة المدرسة فوراً لتوفير البديل.</li>
            <li style={styles.importantLi}>       في حال استدعاء أي معلم للمراقبة من خارج أيام الجدول المرفق و لم يحضر يتم تسجيله غياب يوم كامل..</li>
           
          </ul>

          <div style={styles.importantSigRow}>
            <div style={styles.importantSigCol}>
              <div style={styles.importantSigLabel}>توقيع المعلم بالعلم</div>
              <div style={styles.importantSigLine} />
            </div>

            <div style={styles.importantSigCol}>
              <div style={styles.importantSigLabel}>مدير المدرسة</div>
              <div style={styles.importantSigLine} />
            </div>
          </div>
        </div>

        <div style={styles.footerNote}>تم إنشاء التقرير من نظام توزيع مهام المراقبة — {props.createdAtISO}</div>
      </div>
    );
  }

  async function handleWhatsAppClick() {
    const phone = teacherNameFilter ? getTeacherWhatsAppPhoneByName(teacherNameFilter) : "";
    openWhatsAppWindow({ text: shareText, phone: phone || undefined });

    // محاولة تنزيل PNG للتقرير
    window.setTimeout(async () => {
      try {
        const el = printAreaRef.current;
        if (!el) return;
        const safeName = (teacherNameFilter || title || "report").replace(/[\\/:*?"<>|]/g, "_");
        await exportElementToPng(el, `report_${safeName}_${dateISO || "all"}.png`);
      } catch {
        alert("تعذر إنشاء صورة للتقرير (قد يكون بسبب الشعار الخارجي). يمكنك استخدام حفظ PDF من زر الطباعة.");
      }
    }, 250);

    // فتح نافذة الطباعة (تقرير فقط + صفحة واحدة قدر الإمكان)
    window.setTimeout(() => {
      openPrintDialog();
    }, 650);
  }

  if (!phoneGateAllowed) {
    return (
      <PrintPhoneGateScreen
        tenantId={tenantId}
        registeredPhone={registeredGatePhone}
        loading={phoneGateLoading}
        error={phoneGateError}
        value={phoneGateValue}
        setValue={setPhoneGateValue}
        onVerify={verifyPhoneGate}
        onGoSettings={() => nav(`/t/${tenantId}/settings1`)}
      />
    );
  }

  return (
    <div style={styles.outer}>
      <style>{printCss}</style>

      {/* TOP ACTION BAR */}
      <div className="no-print" style={styles.topActionBar}>
        <div style={styles.topActionTitle}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>خيارات العرض والطباعة</div>
        </div>

        <div style={styles.topActionBtns}>
          <button
            style={{ ...styles.pillBtn, ...styles.pillAll }}
            onClick={() => {
              setReportTeacher();
              setTeacherSelection("");
            }}
            title="طباعة الكل (كل معلم صفحة)"
          >
            طباعة الكل
          </button>

          <button style={{ ...styles.pillBtn, ...styles.pillPrint }} onClick={openPrintDialog} title="طباعة (تقرير فقط)">
            طباعة
          </button>

          <button style={{ ...styles.pillBtn, ...styles.pillPdf }} onClick={openPrintDialog} title="PDF (Save as PDF) تقرير فقط">
            PDF
          </button>

          <button style={{ ...styles.pillBtn, ...styles.pillWa }} onClick={handleWhatsAppClick} title="واتساب + PNG + PDF">
            واتساب
          </button>
        </div>

        <div style={styles.topActionRight}>
          <select value={reportType} onChange={(e) => setQueryParam("reportType", e.target.value)} style={styles.topSelect}>
            <option value="teacher">تقرير معلم (فردي)</option>
            <option value="daily">كشف يومي (امتحانات)</option>
          </select>
        </div>
      </div>

      {/* Filters row */}
      <div className="no-print" style={styles.filtersRow1to1}>
        <div style={styles.filtersGrid}>
          <div style={styles.filterBox}>
            <div style={styles.filterBoxLabel}>المعلم</div>
            <select value={teacherNameFilter} onChange={(e) => setTeacherSelection(e.target.value)} style={styles.filterSelect}>
              <option value="">— اختر المعلم — (فارغ = طباعة الكل)</option>
              {teacherOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.filterBox}>
            <div style={styles.filterBoxLabel}>المادة</div>
            <select value={subjectFilter} onChange={(e) => setQueryParam("subject", e.target.value)} style={styles.filterSelect}>
              <option value="">— كل المواد —</option>
              {subjectOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.filterBox}>
            <div style={styles.filterBoxLabel}>سريع</div>
            <button style={styles.quickBtn} onClick={setReportDaily}>
              عرض الكشف اليومي
            </button>
          </div>

          <div style={styles.filterBox}>
            <div style={styles.filterBoxLabel}>تنقل</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button style={styles.quickBtnSoft} onClick={() => nav("/task-distribution/results")}>
                النتائج
              </button>
              <button style={styles.quickBtnSoft} onClick={() => nav("/task-distribution")}>
                الرئيسية
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ PRINT AREA: هذا هو التقرير */}
      <div id="print-area" ref={printAreaRef}>
        {/* DAILY REPORTS: تظهر كلها مرتبة حسب التاريخ ثم الفترة الأولى ثم الثانية */}
        {reportType === "daily" && (
          <>
            {dailyReportGroups.length ? (
              dailyReportGroups.map((group, index) => (
                <DailySheet
                  key={group.key}
                  group={group}
                  pageBreak={index < dailyReportGroups.length - 1}
                  createdAtISO={safeRun.createdAtISO || ""}
                />
              ))
            ) : (
              <div className="print-sheet print-daily" style={styles.sheet}>
                <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>لا توجد بيانات يومية لعرضها.</div>
              </div>
            )}
          </>
        )}

        {/* TEACHER REPORT */}
        {reportType === "teacher" && (
          <>
            {!teacherNameFilter &&
              (allTeachersPages.length ? (
                allTeachersPages.map((p, i) => (
                  <TeacherSheet
                    key={p.teacherName}
                    teacherName={p.teacherName}
                    rows={p.rows}
                    pageBreak={i < allTeachersPages.length - 1}
                    createdAtISO={safeRun.createdAtISO || ""}
                  />
                ))
              ) : (
                <div className="print-sheet" style={styles.sheet}>
                  <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>لا توجد بيانات لتقرير الكادر التعليمي.</div>
                </div>
              ))}

            {teacherNameFilter && (
              <TeacherSheet
                teacherName={teacherNameFilter}
                rows={[...filteredRows].sort((a, b) => {
                  const da = normalizeISODate(lookupExamMetaForRow(a)?.dateISO || getExamDateISO(a));
                  const db = normalizeISODate(lookupExamMetaForRow(b)?.dateISO || getExamDateISO(b));
                  if (da !== db) return da.localeCompare(db);
                  const po = periodOrderValue(getResolvedExamPeriod(a)) - periodOrderValue(getResolvedExamPeriod(b));
                  if (po !== 0) return po;
                  return (getExamSubject(a) || "").localeCompare(getExamSubject(b) || "", "ar");
                })}
                createdAtISO={safeRun.createdAtISO || ""}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** -------------------------------------------
 * Styles
 * ------------------------------------------ */
const styles: Record<string, React.CSSProperties> = {
  outer: {
    minHeight: "100vh",
    background: "#0b1220",
    padding: 18,
    direction: "rtl",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Tahoma, Arial, sans-serif',
  },

  topActionBar: {
    maxWidth: 1180,
    margin: "0 auto 12px auto",
    background: "#ffffff",
    borderRadius: 18,
    boxShadow: "0 12px 30px rgba(0,0,0,.22)",
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  topActionTitle: { display: "flex", alignItems: "center", gap: 10 },
  topActionBtns: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "center" },
  topActionRight: { display: "flex", alignItems: "center", gap: 10 },
  topSelect: {
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    padding: "10px 12px",
    fontWeight: 900,
    background: "#f8fafc",
    color: "#0f172a",
    outline: "none",
    minWidth: 190,
  },

  pillBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, .10)",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(0,0,0,.10)",
  },
  pillAll: { background: "#f3e8ff", color: "#6b21a8" },
  pillPrint: { background: "#2563eb", color: "#fff" },
  pillPdf: { background: "#ef4444", color: "#fff" },
  pillWa: { background: "#22c55e", color: "#fff" },

  filtersRow1to1: { maxWidth: 1180, margin: "0 auto 14px auto" },
  filtersGrid: {
    background: "#ffffff",
    borderRadius: 18,
    boxShadow: "0 12px 30px rgba(0,0,0,.22)",
    padding: 12,
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr .8fr 1fr",
    gap: 12,
    alignItems: "end",
  },
  filterBox: { border: "1px solid #e5e7eb", borderRadius: 16, padding: "10px 10px", background: "#f8fafc" },
  filterBoxLabel: { fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 6 },
  filterSelect: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 900,
    outline: "none",
  },
  quickBtn: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#0f172a",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  quickBtnSoft: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 900,
    cursor: "pointer",
  },

  // شاشة البرنامج (عادي)
  sheet: {
    width: "210mm",
    minHeight: "297mm",
    background: "white",
    margin: "0 auto",
    borderRadius: 16,
    boxShadow: "0 20px 50px rgba(0,0,0,.35)",
    padding: "14mm 12mm",
    color: "#111",
    position: "relative",
  },
  pageBreak: { pageBreakAfter: "always", breakAfter: "page" },

  headerGrid: { display: "grid", gridTemplateColumns: "1fr 120px 1fr", gap: 10, alignItems: "center" },
  headerLeft: { textAlign: "left", lineHeight: 1.25 },
  headerLeftTitle: {
    fontSize: 18,
    fontWeight: 900,
    borderBottom: "2px solid #111",
    display: "inline-block",
    paddingBottom: 4,
    marginBottom: 6,
  },
  headerLeftSub: { fontSize: 14, fontWeight: 800, marginTop: 2 },
  headerCenter: { display: "flex", justifyContent: "center", alignItems: "center" },
  headerRight: { textAlign: "right", lineHeight: 1.3 },
  headerRightLine: { fontSize: 14, fontWeight: 800 },

  hr: { height: 2, background: "#111", opacity: 0.85, margin: "10px 0 12px 0" },

  // شريط بيانات الامتحان (نموذج 1)
  examBarWide: { border: "3px solid #111", borderRadius: 12, padding: "10px 12px", marginBottom: 10 },
  examBarWideInner: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    fontSize: 14,
    fontWeight: 900,
  },
  examBarWideItem: { whiteSpace: "nowrap" },
  examBarWideSep: { color: "#111", opacity: 0.9, fontWeight: 900 },

  examLabel: { fontWeight: 900 },
  examValue: { fontWeight: 900 },

  chipRow: { display: "flex", justifyContent: "flex-end", marginBottom: 6 },
  chip: {
    border: "2px solid #111",
    borderBottom: "0",
    padding: "8px 14px",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    background: "#f3f4f6",
    fontWeight: 900,
    fontSize: 18,
  },
  leaveChip: {
    border: "2px solid #6d28d9",
    borderBottom: "0",
    padding: "8px 14px",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    background: "#ede9fe",
    color: "#3b0764",
    fontWeight: 900,
    fontSize: 18,
  },

  teacherInfoBox: { border: "2px solid #111", borderRadius: 10, padding: "10px 12px", marginBottom: 12 },
  teacherInfoRow: { display: "flex", gap: 10, justifyContent: "flex-start", alignItems: "center", padding: "4px 0" },
  teacherInfoLabel: { fontWeight: 900 },
  teacherInfoValue: { fontWeight: 800 },

  tableTitleWrap: { marginTop: 8, display: "flex", justifyContent: "flex-end" },
  tableTitle: {
    border: "2px solid #111",
    borderBottom: "0",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    padding: "8px 12px",
    fontWeight: 900,
    background: "#f3f4f6",
  },

  table: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed", border: "2px solid #111" },
  th: { background: "#f3f4f6", border: "1px solid #111", padding: "10px 8px", fontSize: 14, fontWeight: 900, textAlign: "right" },
  td: { border: "1px solid #111", padding: "10px 8px", fontSize: 14, verticalAlign: "middle", height: 38 },
  tdNum: {
    border: "1px solid #111",
    padding: "10px 8px",
    fontSize: 14,
    verticalAlign: "middle",
    textAlign: "center",
    height: 38,
    color: "#475569",
    fontWeight: 900,
  },
  leaveTd: {
    background: "#f5f3ff",
    color: "#3b0764",
    fontWeight: 900,
  },
  leaveNotice: {
    marginTop: 14,
    border: "2px solid #a78bfa",
    background: "#f5f3ff",
    color: "#3b0764",
    borderRadius: 12,
    padding: "10px 12px",
    fontWeight: 900,
    textAlign: "center",
  },

  reserveBlock: { marginTop: 18 },
  reserveTitle: { display: "inline-block", border: "1px solid #111", background: "#f3f4f6", padding: "8px 12px", fontWeight: 900, marginBottom: 0 },
  reserveTable: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed", border: "2px solid #111" },

  bottomSigRow: { marginTop: 26, display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 20 },
  bottomSigCell: { width: "45%", textAlign: "center" },

  importantSection: { marginTop: 18, paddingTop: 6 },
  importantTitle: { fontSize: 14, fontWeight: 900, marginBottom: 8, textAlign: "right" },
  importantList: { margin: 0, paddingRight: 18, paddingLeft: 0, fontSize: 12.5, lineHeight: 1.85 },
  importantLi: { marginBottom: 4 },
  importantSigRow: { marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18 },
  importantSigCol: { width: "45%", textAlign: "center" },
  importantSigLabel: { fontSize: 13, fontWeight: 900, marginBottom: 10 },
  importantSigLine: { height: 0, borderBottom: "2px dotted #111", width: "100%" },

  footerNote: { marginTop: 10, fontSize: 11, color: "#64748b", fontWeight: 700, textAlign: "center" },

  pageWrapDark: { minHeight: "100vh", background: "#0b1220", padding: 18, direction: "rtl", fontFamily: 'system-ui, -apple-system, "Segoe UI", Tahoma, Arial, sans-serif' },
  darkCard: { maxWidth: 900, margin: "0 auto", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)", borderRadius: 16, padding: 16 },
  darkRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  btnSoft: { background: "rgba(255,255,255,.10)", color: "white", border: "1px solid rgba(255,255,255,.18)", padding: "10px 14px", borderRadius: 12, cursor: "pointer", fontWeight: 800 },
};

/** ✅ إبقاء CSS داخل الصفحة فقط — الطباعة الفعلية تتم عبر نافذة جديدة */
const printCss = `
@media print {
  /* لا نعتمد على إخفاء القوائم هنا */
}
`;
