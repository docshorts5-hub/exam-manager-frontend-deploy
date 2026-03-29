// ✅ src/pages/TaskDistributionRun.tsx
// ✅ كود كامل بدون أخطاء JSX/TS
// ✅ إصلاح خطأ: Duplicate function implementation ts(2393) (تم حذف الدالة المكررة)
// ✅ تعديل مهم حسب طلبك: الحد الأقصى للنصاب لكل معلم = (مراقبة + احتياط + مراجعة) فقط
//    ❌ التصحيح CORRECTION_FREE لا يدخل ضمن maxTasksPerTeacher ولا ضمن إجمالي النصاب
//
// ✅ تحديث أسماء الكادر التعليمي دائمًا من صفحة الكادر التعليمي  (LocalStorage) عند كل تشغيل + عند فتح الصفحة
// ✅ حل مشكلة التوزيع = صفر بسبب عدم تطابق date/dateISO عبر تطبيع البيانات
// ✅ نقل أزرار (الجدول الشامل/طباعة PDF/حذف بيانات التوزيع) أعلى جدول العدالة
// ✅ زر حذف جميع بيانات التوزيع (يمسح العدالة + الجدول الشامل لأنه نفس run)
//
// ✅ منطق التوزيع:
// 1) maxTasksPerTeacher (Quota) = INVIGILATION + RESERVE + REVIEW_FREE فقط
// 2) Round-Robin للمهام غير المراقبة
// 3) المراقبة Min-Inv First لتحقيق مساواة قدر الإمكان
// 4) إسناد: مراقبة ثم احتياط ثم مراجعة
//
// ✅ شروط المراجعة/التصحيح كما هو (مع منع التداخل):
// - REVIEW_FREE (حسب subject1 فقط) يحجز اليوم كامل AM+PM ولا يسمح بغيره بهذا اليوم
// - CORRECTION_FREE: يحجز اليوم كامل AM+PM لمنع أي INV/RES بهذا اليوم
// - التصحيح يُحسب فقط “اليوم التالي” لامتحانات المواد الفعلية الموجودة في جدول الامتحانات
//
// ✅ الشروط السابقة (حسب طلبك):
// 1) الجمعة والسبت إجازة: لا يتم توزيع أي مهام عليهما، وكل المهام تُرحّل إلى يوم الأحد
// 2) شرط "بن" داخل نفس اللجنة (قاعة):
//    - إذا كان في اللجنة مراقب واحد: يجب أن يحتوي اسم المعلم على كلمة " بن "
//    - إذا كان عدد المراقبين 2:
//      - ممنوع (بدون "بن" + بدون "بن") في نفس القاعة
//      - مسموح (بن+بن) أو (بن+بدون بن)
//
// ✅ الشروط الجديدة (حسب طلبك):
// - المعلم الذي يحتوي اسمه على 12 يوزع أولاً عند توزيع امتحان مادة تحتوي على 12 (مثال "الرياضة المدرسية 12")
//   وإن لم يوجد اسم بهذه المواصفات يوزع على باقي الكادر التعليمي
// - المعلم الذي يحتوي اسمه على 13 لا يوزع في آخر يوم اختبار (مراقبة/احتياط)
// - المعلم الذي يحتوي اسمه على 14 لا يوزع في آخر يومين اختبار (مراقبة/احتياط)
// - المعلم الذي يتم توزيعه مراقبة ثلاث ساعات (180 دقيقة) لا يتم توزيعه مرة أخرى مراقبة ثلاث ساعات
//
// ✅ NEW (حسب طلبك النهائي):
// ✅ فاضي للتصحيح (CORRECTION_FREE) شرطه:
//   - اليوم التالي فقط (يوم واحد) = الأساسي
//   - للصفوف 1-4: المطابقة تكون نفس "اسم المادة" مع أي من subject1..subject4
//   - للصفوف 5-12: المطابقة تكون حسب مجموعات التصحيح المحددة
//   - لا يوجد أي ترحيل/shift لأيام أخرى للتصحيح

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useAppData } from "../context/AppDataContext";
import { loadTenantArray, writeTenantAudit } from "../services/tenantData";
import { loadDistributionConstraints, saveDistributionConstraints, clearDistributionConstraints } from "../infra/cache/distributionConstraintsStorage";
import { buildFairnessRows } from "../features/task-distribution/services/taskDistributionFairness";
import { rebalanceFairDistribution, rebalanceInvigilationsToEqualize, rebalanceReserveToCoverInvigilations } from "../features/task-distribution/services/taskDistributionRebalance";
import { useTaskDistributionRunner } from "../features/task-distribution/hooks/useTaskDistributionRunner";
import FairnessSummarySection from "../features/task-distribution/components/FairnessSummarySection";
import TaskDistributionQuickSummarySection from "../features/task-distribution/components/TaskDistributionQuickSummarySection";
import TaskDistributionConstraintsSection from "../features/task-distribution/components/TaskDistributionConstraintsSection";
import TaskDistributionDebugPanel from "../features/task-distribution/components/TaskDistributionDebugPanel";
import TaskDistributionRunFeedback from "../features/task-distribution/components/TaskDistributionRunFeedback";
import TaskDistributionReadinessSection from "../features/task-distribution/components/TaskDistributionReadinessSection";

import type { DistributionDebug, UnfilledSlotDebug } from "../contracts/taskDistributionContract";
import { saveRun, loadRun, clearRun, RUN_UPDATED_EVENT, MASTER_TABLE_UPDATED_EVENT, taskDistributionKey } from "../utils/taskDistributionStorage";
import {
  buildUnavailabilityIndex,
  isTeacherUnavailable,
  loadUnavailability,
  syncUnavailabilityFromTenant,
  UNAVAIL_UPDATED_EVENT,
} from "../utils/taskDistributionUnavailability";

const CONSTRAINTS_KEY = "exam-manager:task-distribution:constraints:v2";
const AUTORUN_KEY = "exam-manager:task-distribution:autorun:v1";

// ✅ Settings page reads this (fallback) when run is missing
const MASTER_TABLE_KEY = "exam-manager:task-distribution:master-table:v1";
// ✅ (Optional) old keys that may exist in some builds
const RESULTS_TABLE_KEY = "exam-manager:task-distribution:results-table:v1";
const ALL_TABLE_KEY = "exam-manager:task-distribution:all-table:v1";
const MANUAL_SUGGESTION_HISTORY_KEY_PREFIX = "exam-manager:task-distribution:manual-suggestion-history:";

const LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const APP_NAME = "برنامج ادارة الامتحانات الذكي";

function num(v: string, fallback: number) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function readJsonSafe<T = any>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function loadMasterTableAssignments(): any[] {
  const keys = [MASTER_TABLE_KEY, ALL_TABLE_KEY, RESULTS_TABLE_KEY];
  for (const key of keys) {
    const payload = readJsonSafe<any>(key);
    const rows = Array.isArray(payload?.rows) ? payload.rows : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    if (rows.length) return rows;
  }
  return [];
}

function assignmentIdentity(assignment: any, fallbackIndex = -1) {
  const raw = String((assignment as any)?.__uid || (assignment as any)?.id || "").trim();
  if (raw) return raw;
  return `fallback-assignment-${fallbackIndex}`;
}

function buildTeacherSuggestionIdentity(item: any, fallbackIndex = -1) {
  const teacherId = String(item?.teacherId || "").trim();
  const subject = String(item?.subject || "").trim();
  const source = String(item?.source || "").trim();
  const transferAssignmentId = String(item?.transferAssignmentId || "").trim();
  const transferFromDateISO = String(item?.transferFromDateISO || "").trim();
  const transferFromPeriod = String(item?.transferFromPeriod || "").trim();
  const transferFromTaskType = String(item?.transferFromTaskType || "").trim();
  const transferFromSubject = String(item?.transferFromSubject || "").trim();
  const note = String(item?.note || "").trim();

  const stable = [
    teacherId,
    subject,
    source,
    transferAssignmentId,
    transferFromDateISO,
    transferFromPeriod,
    transferFromTaskType,
    transferFromSubject,
    note,
  ].join("__");

  return stable.replace(/\s+/g, " ").trim() || `fallback-suggestion-${fallbackIndex}`;
}

function dedupeTeacherSuggestions(items: any[]) {
  const out: any[] = [];
  const seenStrict = new Set<string>();
  const seenTeacherSubject = new Set<string>();

  for (const [index, item] of (Array.isArray(items) ? items : []).entries()) {
    if (!item) continue;

    const strictKey = buildTeacherSuggestionIdentity(item, index);
    if (seenStrict.has(strictKey)) continue;

    const teacherId = String(item?.teacherId || "").trim();
    const subject = String(item?.subject || "").trim();
    const teacherSubjectKey = `${teacherId}__${subject}`.trim();

    if (teacherId && subject && seenTeacherSubject.has(teacherSubjectKey)) continue;

    seenStrict.add(strictKey);
    if (teacherId && subject) seenTeacherSubject.add(teacherSubjectKey);
    out.push(item);
  }

  return out;
}


const DEFAULT_CONSTRAINTS: any = {
  maxTasksPerTeacher: 10, // ✅ نصاب (مراقبة+احتياط+مراجعة) فقط
  reservePerPeriod: 1,

  invigilators_5_10: 2,
  invigilators_11: 2,
  invigilators_12: 2,

  avoidBackToBack: true,
  smartBySpecialty: true,
  freeAllSubjectTeachersForCorrection: true,

  // ✅ تفريغ معلمي المادة للتصحيح
  // - ALL: كل أيام التصحيح (اليوم التالي لكل امتحان)
  // - DATES: أيام محددة فقط
  correctionFreeMode: "ALL",
  correctionFreeDatesISO: [] as string[],
  // (Deprecated) دعم قديم ليوم واحد
  correctionFreeDateISO: "",

  // ✅ السماح بفترتين
  allowTwoPeriodsSameDay: false,
  allowTwoPeriodsSameDayAllDates: true, // true = كل الأيام، false = تواريخ محددة
  allowTwoPeriodsSameDayDates: [] as string[], // قائمة YYYY-MM-DD

  // ✅ عدد محاولات التحسين لاختيار أقل عجز (كل تشغيل سيختلف عن السابق)
  optimizationAttempts: 5,

  correctionDays: 1,
};

type FairRow = {
  teacherId: string;
  teacherName: string;
  inv: number;
  res: number;
  rev: number;
  cor: number;
  total: number; // ✅ مجموع (inv+res+rev) فقط
};

type ReadinessTone = "good" | "warn" | "danger" | "neutral";

type SuggestionSource = "RESERVE" | "FREE" | "MAX_TASK_RELAX" | "SAME_DAY_RELAX" | "SPECIALTY_RELAX" | "CORRECTION_RELAX" | "TRANSFER_SAFE";

type ManualSuggestionActionKind = "ADD" | "CONVERT_RESERVE" | "MOVE_FROM_SAFE";

type ReadinessCardEntry = {
  key: string;
  title: string;
  value: string;
  sub?: string;
  tone?: ReadinessTone;
};

type ManualSuggestionHistoryEntry = {
  id: string;
  teacherId: string;
  teacherName: string;
  dateISO: string;
  period: "AM" | "PM";
  subject: string;
  taskType: string;
  source: string;
  note: string;
  appliedAtISO: string;
  actionKind: ManualSuggestionActionKind;
  assignmentId?: string;
  previousAssignmentId?: string;
  previousAssignmentSnapshot?: any;
};

function manualSuggestionHistoryKey(tenantId: string) {
  return `${MANUAL_SUGGESTION_HISTORY_KEY_PREFIX}${String(tenantId || "default").trim() || "default"}:v1`;
}

function loadManualSuggestionHistory(tenantId: string): ManualSuggestionHistoryEntry[] {
  const payload = readJsonSafe<any[]>(manualSuggestionHistoryKey(tenantId));
  return Array.isArray(payload) ? payload : [];
}

function saveManualSuggestionHistory(tenantId: string, entries: ManualSuggestionHistoryEntry[]) {
  try {
    localStorage.setItem(manualSuggestionHistoryKey(tenantId), JSON.stringify(Array.isArray(entries) ? entries : []));
  } catch {}
}

function normalizeSuggestionSource(value: any): SuggestionSource {
  const source = String(value || "").trim().toUpperCase();
  switch (source) {
    case "RESERVE":
    case "FREE":
    case "MAX_TASK_RELAX":
    case "SAME_DAY_RELAX":
    case "SPECIALTY_RELAX":
    case "CORRECTION_RELAX":
    case "TRANSFER_SAFE":
      return source as SuggestionSource;
    default:
      return "FREE";
  }
}

function normalizeStoredTaskTypeGlobal(rawTaskType: any): string {
  const raw = String(rawTaskType || "").trim().toUpperCase();
  if (raw === "INVIGILATION" || raw === "RESERVE" || raw === "REVIEW_FREE" || raw === "CORRECTION_FREE") return raw;
  if (raw.includes("مراقبة")) return "INVIGILATION";
  if (raw.includes("احتياط")) return "RESERVE";
  if (raw.includes("مراجعة")) return "REVIEW_FREE";
  if (raw.includes("تصحيح")) return "CORRECTION_FREE";
  return raw;
}


// ✅ مهام تدخل في نصاب maxTasksPerTeacher
function isQuotaTaskType(t: any) {
  return t === "INVIGILATION" || t === "RESERVE" || t === "REVIEW_FREE";
}

function normalizeSearch(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function reasonLabel(code?: string) {
  switch (code) {
    case "NO_TEACHERS":
      return "لا يوجد معلمين";
    case "MAX_TASKS_REACHED":
      return "وصل الحد الأقصى للنصاب";
    case "PERIOD_CONFLICT":
      return "تعارض في نفس الفترة";
    case "BACK_TO_BACK_BLOCK":
      return "منع حسب القيود";
    case "REVIEW_FREE_BLOCK":
      return "مفرّغ للمراجعة";
    case "CORRECTION_FREE_BLOCK":
      return "مفرّغ للتصحيح";
    case "SPECIALTY_BLOCK":
      return "ممنوع لمعلم المادة";
    case "ARABIC_ONCE":
      return "اللغة العربية (مرة واحدة)";
    case "THREE_HOURS_ALREADY":
      return "مراقبة 3 ساعات سبق تنفيذها";
    case "UNAVAILABLE":
      return "غير متاح (غياب/عدم توفر)";
    default:
      return "سبب غير معروف";
  }
}

function getEffectiveTenantId(userTenantId: string | null | undefined) {
  return (userTenantId && String(userTenantId).trim()) || "default";
}

/* ============================================================
   ✅ تحديد نوع المهمة بوضوح
============================================================ */
const TASK_TYPE_LABEL_AR: Record<string, string> = {
  INVIGILATION: "مراقبة",
  RESERVE: "احتياط",
  REVIEW_FREE: "مراجعة",
  CORRECTION_FREE: "تصحيح",
};

function ensureExplicitTaskTypes(out: any) {
  const assigns: any[] = Array.isArray(out?.assignments) ? out.assignments : [];
  for (const a of assigns) {
    const t = String(a?.taskType || "").trim();
    const safeType = t || "RESERVE";
    a.taskType = safeType;
    a.taskTypeLabelAr = TASK_TYPE_LABEL_AR[safeType] || "غير محدد";
  }
  return out;
}

/* ============================================================
   ✅ Helpers: Subjects + Period normalize + Dates
============================================================ */
function buildTeacherSubjectsMapAll(teachers: any[]) {
  const map = new Map<string, Set<string>>();
  for (const t of teachers || []) {
    const id = String(t.id ?? "").trim();
    if (!id) continue;
    const subjects = new Set<string>();
    [t.subject1, t.subject2, t.subject3, t.subject4].forEach((s: any) => {
      const v = String(s ?? "").trim();
      if (v) subjects.add(v);
    });
    map.set(id, subjects);
  }
  return map;
}

// ✅ subject1 فقط (شرط التفريغ للمراجعة)
function buildTeacherSubject1Map(teachers: any[]) {
  const map = new Map<string, string>(); // teacherId -> subject1
  for (const t of teachers || []) {
    const id = String(t.id ?? "").trim();
    if (!id) continue;
    map.set(id, String(t.subject1 ?? "").trim());
  }
  return map;
}

function periodToAMPM(p: string): "AM" | "PM" {
  const x = String(p || "").trim();
  if (!x) return "AM";
  if (x === "AM" || x === "PM") return x;
  if (x.includes("الثانية")) return "PM";
  if (x.includes("الأولى")) return "AM";
  return "AM";
}

function guessInvigilatorsPerRoom(exam: any, constraints: any): number {
  const subj = String(exam?.subject || "");
  if (/\b11\b/.test(subj) || subj.includes("11")) return Number(constraints.invigilators_11 || 2) || 2;
  if (/\b10\b/.test(subj) || subj.includes("10")) return Number(constraints.invigilators_5_10 || 2) || 2;
  return Number(constraints.invigilators_12 || 2) || 2;
}

function slotKey(dateISO: string, period: "AM" | "PM") {
  return `${dateISO}__${period}`;
}

// ✅ إضافة يوم (YYYY-MM-DD) بشكل آمن (UTC)
function addDaysISO(dateISO: string, days: number) {
  const m = String(dateISO || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateISO;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/* ============================================================
   ✅ عطلة الجمعة/السبت -> ترحيل للأحد
============================================================ */
function isFriOrSat(dateISO: string) {
  const m = String(dateISO || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  const day = dt.getUTCDay(); // 0=Sun, 5=Fri, 6=Sat
  return day === 5 || day === 6;
}

function shiftWeekendToSunday(dateISO: string) {
  const m = String(dateISO || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateISO;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  const day = dt.getUTCDay(); // 0=Sun,5=Fri,6=Sat

  if (day === 5) dt.setUTCDate(dt.getUTCDate() + 2); // Fri -> Sun
  else if (day === 6) dt.setUTCDate(dt.getUTCDate() + 1); // Sat -> Sun

  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function workDateISO(dateISO: string) {
  const d = String(dateISO || "").trim();
  if (!d) return d;
  return isFriOrSat(d) ? shiftWeekendToSunday(d) : d;
}

/* ============================================================
   ✅ شرط "بن" في الاسم
============================================================ */
function normalizeArabicSpaces(s: string) {
  return String(s || "").replace(/\s+/g, " ").trim();
}
function hasBenInName(name: string) {
  const n = " " + normalizeArabicSpaces(name) + " ";
  return n.includes(" بن ");
}

/* ============================================================
   ✅ NEW: شروط 12 / 13 / 14 + 3 ساعات
============================================================ */
function hasNumInText(text: string, n: number) {
  const s = String(text || "");
  return s.includes(String(n));
}
function teacherHas12(name: string) {
  return hasNumInText(name, 12);
}
function teacherHas13(name: string) {
  return hasNumInText(name, 13);
}
function teacherHas14(name: string) {
  return hasNumInText(name, 14);
}
function subjectHas12(subject: string) {
  return hasNumInText(subject, 12);
}

/* ============================================================
   ✅ Randomization helpers (لجعل كل تشغيل مختلف مع أقل عجز)
============================================================ */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  const rnd = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

/* ============================================================
   ✅ مجموعات التصحيح + NEW: تمييز الصف 1-4 عن 5-12
============================================================ */
function normSubj(s: string) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// ✅ استخراج رقم الصف من نص المادة (1..12) إن وجد
function extractGradeFromSubject(subject: string): number | null {
  const s = String(subject || "");
  // نلتقط 1-12 حتى لو حولها حروف/مسافات
  const m = s.match(/(^|[^\d])((1[0-2])|([1-9]))([^\d]|$)/);
  if (!m) return null;
  const n = Number(m[2]);
  if (!Number.isFinite(n)) return null;
  if (n >= 1 && n <= 12) return n;
  return null;
}

// ✅ مجموعة التصحيح للصفوف 5-12 فقط (حسب شروطك)
function getCorrectionGroupKey_5_12(subject: string) {
  const s = normSubj(subject);

  // (الرياضيات من 5 إلى 10 + الرياضيات الأساسية + الرياضيات المتقدمة 11 إلى 12) مجموعة واحدة
  if (s.includes("رياضيات") || s.includes("الرياضيات") || s.includes("الرياضيات الأساسية") || s.includes("الرياضيات المتقدمة"))
    return "G5_12_MATH";

  // (التربية الإسلامية من 5 إلى 12)
  if (s.includes("التربية الإسلامية") || s.includes("تربية إسلامية") || s.includes("اسلامية") || s.includes("إسلامية"))
    return "G5_12_ISLAMIC";

  // (اللغة العربية من 5 إلى 12)
  if (s.includes("اللغة العربية") || s === "عربي" || s.includes("عربية")) return "G5_12_ARABIC";

  // (اللغة الإنجليزية من 5 إلى 12)
  if (s.includes("اللغة الإنجليزية") || s.includes("انجليزي") || s.includes("إنجليزي") || s.includes("english"))
    return "G5_12_ENGLISH";

  if (s.includes("فيزياء")) return "G5_12_PHYSICS";
  if (s.includes("كيمياء")) return "G5_12_CHEMISTRY";
  if (s.includes("احياء") || s.includes("أحياء")) return "G5_12_BIOLOGY";

  if (s.includes("العلوم و البيئة") || s.includes("علوم و البيئة") || s.includes("العلوم والبيئة") || s.includes("البيئة"))
    return "G5_12_SCI_ENV";

  if (s.includes("الرياضة المدرسية") || s.includes("رياضة مدرسية") || s === "رياضة") return "G5_12_SPORTS";

  if (s.includes("الفنون التشكيلية") || s.includes("فنون تشكيلية") || s.includes("الفنون")) return "G5_12_ART";

  if (s.includes("المهارات الموسيقية") || s.includes("مهارات موسيقية") || s.includes("موسيقى")) return "G5_12_MUSIC";

  // (الدراسات الاجتماعية – التاريخ – هذا وطني – الجغرافيا من5 إلى 12)
  if (s.includes("الدراسات الاجتماعية") || s.includes("التاريخ") || s.includes("هذا وطني") || s.includes("الجغرافيا"))
    return "G5_12_SOCIAL";

  // (تقنية المعلومات من 5 إلى 12)
  if (s.includes("تقنية المعلومات") || s.includes("حاسوب") || s.includes("كمبيوتر") || s.includes("it")) return "G5_12_IT";

  return `G5_12_SUBJECT:${s}`;
}

// ✅ تطبيع "مطابقة مادة" للصفوف 1-4: لازم نفس النص (بعد trim/مسافات)
function normalizeExactSubject_1_4(subject: string) {
  return String(subject || "").trim().replace(/\s+/g, " ");
}

/* ============================================================
   ✅ السماح بفترتين (حسب كل الأيام أو تواريخ محددة)
============================================================ */
function isTwoPeriodsAllowedOnDate(dateISO: string, constraints: any): boolean {
  if (!constraints.allowTwoPeriodsSameDay) return false;
  if (constraints.allowTwoPeriodsSameDayAllDates) return true;
  const dates: string[] = Array.isArray(constraints.allowTwoPeriodsSameDayDates) ? constraints.allowTwoPeriodsSameDayDates : [];
  return dates.includes(dateISO);
}

/* ============================================================
   ✅ شرط: المعلم فاضي للمراجعة (subject1 فقط) + اليوم كامل
   ✅ + تطبيق ترحيل الجمعة/السبت إلى الأحد
============================================================ */
function buildDaySubjectsMap(exams: any[]) {
  const map = new Map<string, Set<string>>(); // workDateISO -> subjects set
  for (const e of exams || []) {
    const raw = String(e.dateISO || e.date || "").trim();
    const dateISO = workDateISO(raw); // ✅ ترحيل عطلة
    const subject = String(e.subject || "").trim();
    if (!dateISO || !subject) continue;
    if (!map.has(dateISO)) map.set(dateISO, new Set<string>());
    map.get(dateISO)!.add(subject);
  }
  return map;
}

/* ============================================================
   ✅ منطق التوزيع المحلي
============================================================ */
function runTaskDistributionLocal(params: { teachers: any[]; exams: any[]; constraints: any; runSeed?: number }) {
  const { teachers, exams, constraints, runSeed } = params;

  // ✅ تحميل عدم التوفر وبناء Index سريع للبحث
  const unavailIndex = buildUnavailabilityIndex(loadUnavailability(String(constraints?.__tenantId || "").trim() || undefined));

  // ✅ حتى لا تكون خيارات الواجهة شكلية:
  const enableCorrectionFree = !!constraints?.freeAllSubjectTeachersForCorrection;

  // ✅ تفريغ التصحيح: ALL أو DATES (مع دعم القديم correctionFreeDateISO)
  const legacyOne = workDateISO(String(constraints?.correctionFreeDateISO || "").trim());
  const modeRaw = String(constraints?.correctionFreeMode || "").trim().toUpperCase();
  const correctionMode: "ALL" | "DATES" = modeRaw === "DATES" ? "DATES" : legacyOne ? "DATES" : "ALL";

  const selectedCorrectionDatesISO: string[] = (() => {
    const out: string[] = [];
    const arr = Array.isArray(constraints?.correctionFreeDatesISO) ? constraints.correctionFreeDatesISO : [];
    for (const d of arr) {
      const v = workDateISO(String(d || "").trim());
      if (v && !out.includes(v)) out.push(v);
    }
    if (legacyOne && !out.includes(legacyOne)) out.push(legacyOne);
    out.sort();
    return out;
  })();

  const teacherSubjectsAll = buildTeacherSubjectsMapAll(teachers);
  const teacherSubject1Map = buildTeacherSubject1Map(teachers);
  const daySubjectsMap = buildDaySubjectsMap(exams);

  const teacherNameMap = new Map<string, string>();
  let teacherIds: string[] = [];
  for (const t of teachers) {
    const id = String(t.id || "").trim();
    if (!id) continue;
    teacherIds.push(id);
    teacherNameMap.set(id, String(t.fullName || t.name || t.employeeNo || id).trim());
  }

  // ✅ shuffle
  const _seed = Number((runSeed ?? Date.now()) as any) || Date.now();
  teacherIds = seededShuffle(teacherIds, _seed);

  const maxTasks = Number(constraints.maxTasksPerTeacher ?? 10) || 10; // ✅ quota
  const reservePerPeriod = Number(constraints.reservePerPeriod ?? 0) || 0;
  const smartBySpecialty = !!constraints.smartBySpecialty;

  const quotaTotals = new Map<string, number>();
  const invCounts = new Map<string, number>();
  const occupiedSlots = new Map<string, Set<string>>(); // teacherId -> set(date__period)
  const dayHasAnyPeriod = new Map<string, Set<string>>(); // teacherId -> set(dateISO)
  const teacherDayFirstInvDuration = new Map<string, number>(); // key teacherId__dateISO -> durationMinutes of first invigilation

  // ✅ NEW: منع تكرار مراقبة 3 ساعات
  const teacherHad3HoursInv = new Map<string, boolean>(); // teacherId -> true إذا أخذ 180 دقيقة مرة

  teacherIds.forEach((id) => {
    quotaTotals.set(id, 0);
    invCounts.set(id, 0);
    occupiedSlots.set(id, new Set<string>());
    dayHasAnyPeriod.set(id, new Set<string>());
    teacherHad3HoursInv.set(id, false);
  });

  let rr = 0;
  const assignments: any[] = [];
  const unfilled: any[] = [];

  let invRequired = 0;
  let invAssigned = 0;
  let reserveRequired = 0;
  let reserveAssigned = 0;
  let reviewFreeTeachersDays = 0;
  let correctionFreeTeachersDays = 0;

  // ✅ REVIEW_FREE قبل توزيع المراقبة/الاحتياط (يُحسب ضمن النصاب)
  const reviewFreeApplied = new Set<string>(); // key teacherId__dateISO
  for (const [dateISO, subjectsSet] of daySubjectsMap.entries()) {
    for (const teacherId of teacherIds) {
      const s1 = String(teacherSubject1Map.get(teacherId) || "").trim();
      if (!s1) continue;
      if (!subjectsSet.has(s1)) continue;

      const key = `${teacherId}__${dateISO}`;
      if (reviewFreeApplied.has(key)) continue;

      if ((quotaTotals.get(teacherId) || 0) >= maxTasks) continue;

      occupiedSlots.get(teacherId)!.add(slotKey(dateISO, "AM"));
      occupiedSlots.get(teacherId)!.add(slotKey(dateISO, "PM"));
      dayHasAnyPeriod.get(teacherId)!.add(dateISO);

      quotaTotals.set(teacherId, (quotaTotals.get(teacherId) || 0) + 1);

      assignments.push({
        teacherId,
        teacherName: teacherNameMap.get(teacherId) || teacherId,
        taskType: "REVIEW_FREE",
        taskTypeLabelAr: TASK_TYPE_LABEL_AR["REVIEW_FREE"],
        dateISO,
        date: dateISO,
        period: "AM",
        subject: s1,
        fullDay: true,
        coversPeriods: ["AM", "PM"],
        reviewBySubject1Only: true,
      });

      reviewFreeApplied.add(key);
      reviewFreeTeachersDays += 1;
    }
  }

  // ============================================================
  // ✅ NEW: تحديد آخر يوم اختبار + آخر يومين (بعد ترحيل عطلة الجمعة/السبت)
  // ============================================================
  const _uniqueWorkExamDates0 = Array.from(
    new Set(
      (exams || [])
        .map((e: any) => workDateISO(String(e.dateISO || e.date || "").trim()))
        .filter(Boolean)
    )
  ).sort();

  const _lastExamDate0 = _uniqueWorkExamDates0.length ? _uniqueWorkExamDates0[_uniqueWorkExamDates0.length - 1] : "";

  const _lastTwoExamDates0 = new Set<string>();
  if (_uniqueWorkExamDates0.length >= 1) _lastTwoExamDates0.add(_uniqueWorkExamDates0[_uniqueWorkExamDates0.length - 1]);
  if (_uniqueWorkExamDates0.length >= 2) _lastTwoExamDates0.add(_uniqueWorkExamDates0[_uniqueWorkExamDates0.length - 2]);

  // ============================================================
  // ✅ PRE-COMPUTE CORRECTION DAYS (BEFORE distribution)
  // ✅ (اليوم التالي فقط) + (تمييز 1-4 عن 5-12)
  // ============================================================
  const sortedExams = [...exams].sort((a, b) => {
    const da = workDateISO(String(a.dateISO || a.date || ""));
    const db = workDateISO(String(b.dateISO || b.date || ""));
    if (da !== db) return da.localeCompare(db);
    const pa = periodToAMPM(String(a.period || ""));
    const pb = periodToAMPM(String(b.period || ""));
    return pa === pb ? 0 : pa === "AM" ? -1 : 1;
  });

  // ✅ teacherExactSubjects_1_4: مطابقة نصية للمادة (للصفوف 1-4)
  // ✅ teacherGroups_5_12: مفاتيح مجموعات التصحيح (للصفوف 5-12)
  const teacherExactSubjects_1_4 = new Map<string, Set<string>>(); // teacherId -> Set(exact normalized subject strings)
  const teacherGroups_5_12 = new Map<string, Set<string>>(); // teacherId -> Set(groupKey)

  for (const t of teachers) {
    const teacherId = String(t.id || "").trim();
    if (!teacherId) continue;

    const exactSet = new Set<string>();
    const groupsSet = new Set<string>();

    [t.subject1, t.subject2, t.subject3, t.subject4]
      .map((x: any) => String(x ?? "").trim())
      .filter(Boolean)
      .forEach((s) => {
        exactSet.add(normalizeExactSubject_1_4(s));
        groupsSet.add(getCorrectionGroupKey_5_12(s));
      });

    teacherExactSubjects_1_4.set(teacherId, exactSet);
    teacherGroups_5_12.set(teacherId, groupsSet);
  }

  const teacherCorrectionDays = new Map<string, Set<string>>(); // teacherId -> Set(correctionDateISO)

  // ✅ تفريغ التصحيح (اختياري حسب خيار الواجهة)
  if (enableCorrectionFree) {
    for (const exam of sortedExams) {
      const examDateISO_raw = String(exam.dateISO || exam.date || "").trim();
      const examDateISO = workDateISO(examDateISO_raw); // ✅ ترحيل عطلة
      const subject = String(exam.subject || "").trim();
      if (!examDateISO || !subject) continue;

      const grade = extractGradeFromSubject(subject);
      const correctionDateISO = workDateISO(addDaysISO(examDateISO, 1)); // ✅ اليوم التالي فقط + ترحيل عطلة

      // ✅ NEW: إذا كان الوضع DATES نطبّق التفريغ على الأيام المحددة فقط
      if (correctionMode === "DATES") {
        if (!selectedCorrectionDatesISO.length) continue; // لا توجد أيام مختارة → لا تفريغ
        if (!selectedCorrectionDatesISO.includes(correctionDateISO)) continue;
      }

      // ✅ لا نسمح بتصحيح يتعارض مع REVIEW_FREE
      // (نحتفظ بنفس سلوكك السابق)
      for (const teacherId of teacherIds) {
        if (reviewFreeApplied.has(`${teacherId}__${correctionDateISO}`)) continue;

        const ok =
          grade !== null && grade >= 1 && grade <= 4
            ? // ✅ 1-4: مطابقة نصية للمادة مع أي subject1..4
              (teacherExactSubjects_1_4.get(teacherId) || new Set<string>()).has(normalizeExactSubject_1_4(subject))
            : // ✅ 5-12 (أو غير معلوم): حسب المجموعات
              (teacherGroups_5_12.get(teacherId) || new Set<string>()).has(getCorrectionGroupKey_5_12(subject));

        if (!ok) continue;

        if (!teacherCorrectionDays.has(teacherId)) teacherCorrectionDays.set(teacherId, new Set<string>());
        teacherCorrectionDays.get(teacherId)!.add(correctionDateISO);
      }
    }
  }

  function canAssign(
    teacherId: string,
    dateISO: string,
    period: "AM" | "PM",
    taskType: string,
    subject: string,
    meta?: any
  ) {
    if (!teacherId) return { ok: false, reason: "NO_TEACHERS" as const };

    // ✅ عدم التوفر (يمنع حسب اليوم+الفترة+نوع المهمة)
    if (
      (taskType === "INVIGILATION" ||
        taskType === "RESERVE" ||
        taskType === "REVIEW_FREE" ||
        taskType === "CORRECTION_FREE") &&
      isTeacherUnavailable({
        teacherId,
        dateISO,
        period,
        taskType: taskType as any,
        index: unavailIndex,
      })
    ) {
      return { ok: false, reason: "UNAVAILABLE" as const };
    }

    const tQuota = quotaTotals.get(teacherId) || 0;
    if (tQuota >= maxTasks) return { ok: false, reason: "MAX_TASKS_REACHED" as const };

    const sk = slotKey(dateISO, period);
    const slots = occupiedSlots.get(teacherId) || new Set<string>();
    if (slots.has(sk)) return { ok: false, reason: "PERIOD_CONFLICT" as const };

    // ✅ منع أي مهام في يوم التصحيح (اليوم التالي فقط)
    if (enableCorrectionFree) {
      const corDays = teacherCorrectionDays.get(teacherId);
      if (corDays && corDays.has(dateISO)) {
        return { ok: false, reason: "CORRECTION_FREE_BLOCK" as const };
      }
    }

    // ✅ NEW: شرط 13 / 14 على آخر يوم/آخر يومين (نمنع التوزيع للمراقبة/الاحتياط فقط)
    const tName = teacherNameMap.get(teacherId) || "";
    if (taskType === "INVIGILATION" || taskType === "RESERVE") {
      if (_lastExamDate0 && teacherHas13(tName) && dateISO === _lastExamDate0) {
        return { ok: false, reason: "BACK_TO_BACK_BLOCK" as const };
      }
      if (_lastTwoExamDates0.size && teacherHas14(tName) && _lastTwoExamDates0.has(dateISO)) {
        return { ok: false, reason: "BACK_TO_BACK_BLOCK" as const };
      }
    }

    // ✅ NEW: منع تكرار مراقبة 3 ساعات لنفس المعلم
    if (taskType === "INVIGILATION") {
      const dur = Number(meta?.durationMinutes ?? 0) || 0;
      if (dur === 180 && (teacherHad3HoursInv.get(teacherId) || false)) {
        return { ok: false, reason: "BACK_TO_BACK_BLOCK" as const };
      }
    }

    // ✅ منع فترتين لنفس المعلم في نفس اليوم افتراضيًا
    {
      const datesSet = dayHasAnyPeriod.get(teacherId) || new Set<string>();
      const slotsAny = occupiedSlots.get(teacherId) || new Set<string>();
      const hasSameDay = datesSet.has(dateISO) || Array.from(slotsAny).some((x) => x.startsWith(`${dateISO}__`));
      if (hasSameDay) {
        const allowedGlobal = isTwoPeriodsAllowedOnDate(dateISO, constraints);
        if (!allowedGlobal) {
          return { ok: false, reason: "BACK_TO_BACK_BLOCK" as const };
        }
      }
    }

    if (smartBySpecialty && taskType === "INVIGILATION") {
      const subs = teacherSubjectsAll.get(teacherId);
      if (subs && subs.has(String(subject || "").trim())) return { ok: false, reason: "SPECIALTY_BLOCK" as const };
    }

    return { ok: true as const };
  }

  function commitAssign(
    teacherId: string,
    dateISO: string,
    period: "AM" | "PM",
    taskType: string,
    subject: string,
    meta?: any
  ) {
    const sk = slotKey(dateISO, period);
    occupiedSlots.get(teacherId)!.add(sk);
    dayHasAnyPeriod.get(teacherId)!.add(dateISO);

    if (isQuotaTaskType(taskType)) {
      quotaTotals.set(teacherId, (quotaTotals.get(teacherId) || 0) + 1);
    }

    if (taskType === "INVIGILATION") {
      invCounts.set(teacherId, (invCounts.get(teacherId) || 0) + 1);

      const dur = Number(meta?.durationMinutes ?? 0) || 0;

      const key = `${teacherId}__${dateISO}`;
      if (!teacherDayFirstInvDuration.has(key)) {
        if (dur > 0) teacherDayFirstInvDuration.set(key, dur);
      }

      // ✅ NEW: إذا أخذ 3 ساعات مرة، امنع تكرارها لاحقًا
      if (dur === 180) {
        teacherHad3HoursInv.set(teacherId, true);
      }
    }

    assignments.push({
      teacherId,
      teacherName: teacherNameMap.get(teacherId) || teacherId,
      taskType,
      taskTypeLabelAr: TASK_TYPE_LABEL_AR[taskType] || "غير محدد",
      dateISO,
      date: dateISO,
      period,
      subject,
      ...meta,
    });
  }

  // ✅ توزيع: INVIGILATION بالحد الأدنى من المراقبات، والباقي RR
  function assignOne(dateISO: string, period: "AM" | "PM", taskType: string, subject: string, meta?: any) {
    const n = teacherIds.length;
    if (n === 0) return { assigned: false as const, reason: "NO_TEACHERS" as const };

    if (taskType === "INVIGILATION") {
      const start = rr;

      const subj12 = subjectHas12(subject);

      const baseCandidates = teacherIds
        .map((id, idx) => {
          const slotsSet = occupiedSlots.get(id) || new Set<string>();
          const hasSameDay =
            (dayHasAnyPeriod.get(id) || new Set<string>()).has(dateISO) ||
            Array.from(slotsSet).some((x) => x.startsWith(`${dateISO}__`));
          const firstDur = teacherDayFirstInvDuration.get(`${id}__${dateISO}`) ?? 999999;

          const name = teacherNameMap.get(id) || "";
          const is12 = teacherHas12(name);

          return {
            id,
            idx,
            inv: invCounts.get(id) || 0,
            quota: quotaTotals.get(id) || 0,
            rrDist: (idx - start + n) % n,
            hasSameDay,
            firstDur,
            is12,
          };
        })
        .sort(
          (a, b) =>
            // ✅ NEW: لو مادة 12، فضّل معلم 12
            (subj12 ? Number(b.is12) - Number(a.is12) : 0) ||
            a.inv - b.inv ||
            a.quota - b.quota ||
            Number(a.hasSameDay) - Number(b.hasSameDay) ||
            a.firstDur - b.firstDur ||
            a.rrDist - b.rrDist
        );

      const hasAny12 = subj12 && baseCandidates.some((c) => c.is12);
      const ordered = hasAny12
        ? [...baseCandidates.filter((c) => c.is12), ...baseCandidates.filter((c) => !c.is12)]
        : baseCandidates;

      for (const c of ordered) {
        const chk = canAssign(c.id, dateISO, period, taskType, subject, meta);
        if (!chk.ok) continue;

        commitAssign(c.id, dateISO, period, taskType, subject, meta);
        rr = (c.idx + 1) % n;
        return { assigned: true as const };
      }

      return { assigned: false as const, reason: "NO_TEACHERS" as const };
    }

    for (let tries = 0; tries < n; tries++) {
      const idx = (rr + tries) % n;
      const teacherId = teacherIds[idx];
      const chk = canAssign(teacherId, dateISO, period, taskType, subject, meta);
      if (!chk.ok) continue;

      commitAssign(teacherId, dateISO, period, taskType, subject, meta);
      rr = (idx + 1) % n;
      return { assigned: true as const };
    }

    return { assigned: false as const, reason: "NO_TEACHERS" as const };
  }

  // ============================================================
  // ✅ PASS 1: توزيع المراقبة لكل الامتحانات أولاً
  // ✅ PASS 2: توزيع الاحتياط بعد الانتهاء من المراقبة
  // ✅ شرط: إذا حصل عجز مراقبة في يوم => لا يتم توزيع احتياط في هذا اليوم بالكامل
  // ============================================================

  const examSlots = new Map<string, { dateISO: string; period: "AM" | "PM"; subjects: string[]; examIds: string[] }>();
  for (const exam of sortedExams) {
    const dateISO = workDateISO(String(exam.dateISO || exam.date || "").trim()); // ✅ ترحيل عطلة
    const period = periodToAMPM(String(exam.period || ""));
    const subject = String(exam.subject || "").trim();
    if (!dateISO || !subject) continue;

    const sk = slotKey(dateISO, period);
    if (!examSlots.has(sk)) examSlots.set(sk, { dateISO, period, subjects: [], examIds: [] });
    examSlots.get(sk)!.subjects.push(subject);
    examSlots.get(sk)!.examIds.push(String(exam.id || ""));
  }

  const daysWithInvShortage = new Set<string>();

  // ----- PASS 1: INVIGILATION (مع شرط "بن" + شروط 12/13/14/3س) -----
  for (const exam of sortedExams) {
    const rawDate = String(exam.dateISO || exam.date || "").trim();
    const dateISO = workDateISO(rawDate); // ✅ ترحيل الجمعة/السبت إلى الأحد
    const period = periodToAMPM(String(exam.period || ""));
    const subject = String(exam.subject || "").trim();
    const roomsCount = Number(exam.roomsCount || 0) || 0;

    if (!dateISO || !subject) continue;

    const invPerRoom = Math.max(1, Number(guessInvigilatorsPerRoom(exam, constraints) || 1));
    const neededInv = roomsCount * invPerRoom;
    invRequired += neededInv;

    let assignedInvHere = 0;

    for (let committeeNo = 1; committeeNo <= roomsCount; committeeNo++) {
      // ============ حالة 1 مراقب في اللجنة ============
      if (invPerRoom === 1) {
        const n = teacherIds.length;
        const start = rr;
        const subj12 = subjectHas12(subject);

        const candidatesAll = teacherIds
          .map((id, idx) => {
            const slotsSet = occupiedSlots.get(id) || new Set<string>();
            const hasSameDay =
              (dayHasAnyPeriod.get(id) || new Set<string>()).has(dateISO) ||
              Array.from(slotsSet).some((x) => x.startsWith(`${dateISO}__`));
            const firstDur = teacherDayFirstInvDuration.get(`${id}__${dateISO}`) ?? 999999;
            const name = teacherNameMap.get(id) || "";
            return {
              id,
              idx,
              inv: invCounts.get(id) || 0,
              quota: quotaTotals.get(id) || 0,
              rrDist: (idx - start + n) % n,
              hasSameDay,
              firstDur,
              name,
              ben: hasBenInName(name),
              is12: teacherHas12(name),
            };
          })
          .filter((c) => c.ben) // ✅ شرط: لازم "بن"
          .sort(
            (a, b) =>
              (subj12 ? Number(b.is12) - Number(a.is12) : 0) ||
              a.inv - b.inv ||
              a.quota - b.quota ||
              Number(a.hasSameDay) - Number(b.hasSameDay) ||
              a.firstDur - b.firstDur ||
              a.rrDist - b.rrDist
          );

        const hasAny12 = subj12 && candidatesAll.some((c) => c.is12);
        const candidates = hasAny12
          ? [...candidatesAll.filter((c) => c.is12), ...candidatesAll.filter((c) => !c.is12)]
          : candidatesAll;

        let ok = false;
        for (const c of candidates) {
          const chk = canAssign(c.id, dateISO, period, "INVIGILATION", subject, {
            durationMinutes: Number(exam.durationMinutes ?? 0) || 0,
          });
          if (!chk.ok) continue;

          commitAssign(c.id, dateISO, period, "INVIGILATION", subject, {
            examId: exam.id,
            examSubject: subject,
            committeeNo,
            committeeNumber: committeeNo,
            roomNo: committeeNo,
            roomNumber: committeeNo,
            invigilatorIndex: 1,
            durationMinutes: Number(exam.durationMinutes ?? 0) || 0,
          });

          rr = (c.idx + 1) % n;
          ok = true;
          assignedInvHere += 1;
          invAssigned += 1;
          break;
        }

        if (!ok) {
          daysWithInvShortage.add(dateISO);
          unfilled.push({
            kind: "INVIGILATION",
            dateISO,
            period,
            subject,
            required: neededInv,
            assigned: assignedInvHere,
            reasons: [{ code: "NO_TEACHERS", count: 1 }],
          });
          break;
        }

        continue;
      }

      // ============ حالة 2 مراقبين في اللجنة ============
      if (invPerRoom === 2) {
        const n = teacherIds.length;
        const start = rr;
        const subj12 = subjectHas12(subject);

        const buildCandidates = () =>
          teacherIds
            .map((id, idx) => {
              const slotsSet = occupiedSlots.get(id) || new Set<string>();
              const hasSameDay =
                (dayHasAnyPeriod.get(id) || new Set<string>()).has(dateISO) ||
                Array.from(slotsSet).some((x) => x.startsWith(`${dateISO}__`));
              const firstDur = teacherDayFirstInvDuration.get(`${id}__${dateISO}`) ?? 999999;
              const name = teacherNameMap.get(id) || "";
              return {
                id,
                idx,
                inv: invCounts.get(id) || 0,
                quota: quotaTotals.get(id) || 0,
                rrDist: (idx - start + n) % n,
                hasSameDay,
                firstDur,
                name,
                ben: hasBenInName(name),
                is12: teacherHas12(name),
              };
            })
            .sort(
              (a, b) =>
                (subj12 ? Number(b.is12) - Number(a.is12) : 0) ||
                a.inv - b.inv ||
                a.quota - b.quota ||
                Number(a.hasSameDay) - Number(b.hasSameDay) ||
                a.firstDur - b.firstDur ||
                a.rrDist - b.rrDist
            );

        let firstPicked: any = null;
        let secondPicked: any = null;

        let cand1 = buildCandidates();
        if (subj12) {
          const any12 = cand1.some((c) => c.is12);
          if (any12) cand1 = [...cand1.filter((c) => c.is12), ...cand1.filter((c) => !c.is12)];
        }

        for (const c1 of cand1) {
          const chk1 = canAssign(c1.id, dateISO, period, "INVIGILATION", subject, {
            durationMinutes: Number(exam.durationMinutes ?? 0) || 0,
          });
          if (!chk1.ok) continue;

          const cand2raw = buildCandidates().filter((c2) => c2.id !== c1.id);
          const cand2 = subj12
            ? [...cand2raw.filter((c) => c.is12), ...cand2raw.filter((c) => !c.is12)]
            : cand2raw;

          for (const c2 of cand2) {
            // ✅ ممنوع: بدون بن + بدون بن
            if (!c1.ben && !c2.ben) continue;

            const chk2 = canAssign(c2.id, dateISO, period, "INVIGILATION", subject, {
              durationMinutes: Number(exam.durationMinutes ?? 0) || 0,
            });
            if (!chk2.ok) continue;

            firstPicked = c1;
            secondPicked = c2;
            break;
          }
          if (firstPicked && secondPicked) break;
        }

        if (!firstPicked || !secondPicked) {
          daysWithInvShortage.add(dateISO);
          unfilled.push({
            kind: "INVIGILATION",
            dateISO,
            period,
            subject,
            required: neededInv,
            assigned: assignedInvHere,
            reasons: [{ code: "NO_TEACHERS", count: 1 }],
          });
          break;
        }

        commitAssign(firstPicked.id, dateISO, period, "INVIGILATION", subject, {
          examId: exam.id,
          examSubject: subject,
          committeeNo,
          committeeNumber: committeeNo,
          roomNo: committeeNo,
          roomNumber: committeeNo,
          invigilatorIndex: 1,
          durationMinutes: Number(exam.durationMinutes ?? 0) || 0,
        });
        assignedInvHere += 1;
        invAssigned += 1;

        commitAssign(secondPicked.id, dateISO, period, "INVIGILATION", subject, {
          examId: exam.id,
          examSubject: subject,
          committeeNo,
          committeeNumber: committeeNo,
          roomNo: committeeNo,
          roomNumber: committeeNo,
          invigilatorIndex: 2,
          durationMinutes: Number(exam.durationMinutes ?? 0) || 0,
        });
        assignedInvHere += 1;
        invAssigned += 1;

        rr = (secondPicked.idx + 1) % n;
        continue;
      }

      // ============ أكثر من 2 مراقب في اللجنة: توزيع عادي ============
      for (let j = 1; j <= invPerRoom; j++) {
        const res = assignOne(dateISO, period, "INVIGILATION", subject, {
          examId: exam.id,
          examSubject: subject,
          committeeNo,
          committeeNumber: committeeNo,
          roomNo: committeeNo,
          roomNumber: committeeNo,
          invigilatorIndex: j,
          durationMinutes: Number(exam.durationMinutes ?? 0) || 0,
        });
        if (res.assigned) {
          assignedInvHere += 1;
          invAssigned += 1;
        } else {
          daysWithInvShortage.add(dateISO);
          unfilled.push({
            kind: "INVIGILATION",
            dateISO,
            period,
            subject,
            required: neededInv,
            assigned: assignedInvHere,
            reasons: [{ code: res.reason || "NO_TEACHERS", count: 1 }],
          });
          break;
        }
      }
    }
  }

  // ----- PASS 2: RESERVE -----
  for (const slot of Array.from(examSlots.values()).sort((a, b) => {
    if (a.dateISO !== b.dateISO) return a.dateISO.localeCompare(b.dateISO);
    return a.period === b.period ? 0 : a.period === "AM" ? -1 : 1;
  })) {
    const { dateISO, period, subjects, examIds } = slot;

    if (daysWithInvShortage.has(dateISO)) continue;

    reserveRequired += reservePerPeriod;

    let assignedResHere = 0;
    for (let i = 0; i < reservePerPeriod; i++) {
      const labelSubject = subjects?.[0] ? String(subjects[0]) : "احتياط";
      const res = assignOne(dateISO, period, "RESERVE", labelSubject, {
        examId: examIds?.[0] || "",
        examIds,
        slotSubjects: subjects,
      });
      if (res.assigned) {
        assignedResHere += 1;
        reserveAssigned += 1;
      } else {
        unfilled.push({
          kind: "RESERVE",
          dateISO,
          period,
          subject: subjects?.[0] || "",
          required: reservePerPeriod,
          assigned: assignedResHere,
          reasons: [{ code: res.reason || "NO_TEACHERS", count: 1 }],
        });
        break;
      }
    }
  }

  // ============================================================
  // ✅ APPLY CORRECTION_FREE (AFTER distribution)
  // ✅ (اليوم التالي فقط) ✅ بدون أي ترحيل/shift
  // ✅ التصحيح لا يدخل في النصاب
  // ============================================================
  const correctionApplied = new Set<string>(); // key teacherId__dateISO
  const appliedCorrectionDaysByTeacher = new Map<string, Set<string>>();

  function isTeacherFreeFullDay(teacherId: string, dateISO: string) {
    const key = `${teacherId}__${dateISO}`;
    if (reviewFreeApplied.has(key)) return false;
    const set = occupiedSlots.get(teacherId) || new Set<string>();
    return !set.has(slotKey(dateISO, "AM")) && !set.has(slotKey(dateISO, "PM"));
  }

  if (enableCorrectionFree) {
    for (const teacherId of teacherIds) {
      const daysSet = teacherCorrectionDays.get(teacherId);
      if (!daysSet || daysSet.size === 0) continue;

      for (const correctionDateISO_raw of Array.from(daysSet).sort()) {
        const correctionDateISO = workDateISO(correctionDateISO_raw);
        const key = `${teacherId}__${correctionDateISO}`;
        if (correctionApplied.has(key)) continue;

        // ✅ بدون shift: إذا لم يكن فاضي (نادرًا بسبب قيود أخرى)، نتجاهل ونترك تحذير ضمن warnings لاحقًا
        if (!isTeacherFreeFullDay(teacherId, correctionDateISO)) {
          // لا نرحّل أبداً
          continue;
        }

        occupiedSlots.get(teacherId)!.add(slotKey(correctionDateISO, "AM"));
        occupiedSlots.get(teacherId)!.add(slotKey(correctionDateISO, "PM"));
        dayHasAnyPeriod.get(teacherId)!.add(correctionDateISO);

        assignments.push({
          teacherId,
          teacherName: teacherNameMap.get(teacherId) || teacherId,
          taskType: "CORRECTION_FREE",
          taskTypeLabelAr: TASK_TYPE_LABEL_AR["CORRECTION_FREE"],
          dateISO: correctionDateISO,
          date: correctionDateISO,
          period: "AM",
          subject: "تصحيح",
          fullDay: true,
          coversPeriods: ["AM", "PM"],
          correctionDays: 1,
          basedOnExamTableOnly: true,
          correctionFixedNextDayOnly: true,
        });

        correctionApplied.add(key);
        correctionFreeTeachersDays += 1;

        if (!appliedCorrectionDaysByTeacher.has(teacherId)) appliedCorrectionDaysByTeacher.set(teacherId, new Set<string>());
        appliedCorrectionDaysByTeacher.get(teacherId)!.add(correctionDateISO);
      }
    }
  }

  const correctionByTeacher = enableCorrectionFree
    ? teacherIds
        .map((teacherId) => {
          const dates = Array.from(appliedCorrectionDaysByTeacher.get(teacherId) || []).sort();
          return {
            teacherId,
            teacherName: teacherNameMap.get(teacherId) || teacherId,
            correctionDates: dates,
            correctionDaysCount: dates.length,
          };
        })
        .filter((x) => x.correctionDaysCount > 0)
        .sort((a, b) => b.correctionDaysCount - a.correctionDaysCount || a.teacherName.localeCompare(b.teacherName, "ar"))
    : [];

  // ============================================================
  // ✅ NEW: اقتراح يوم بديل للتصحيح إذا كان هناك عجز في المراقبة
  // عند اختيار يوم تصحيح محدد (correctionFreeDateISO)
  // ============================================================
  function suggestBetterCorrectionDate(fromDateISO: string) {
    const workExamDates = new Set<string>();
    for (const e of exams || []) {
      const d = workDateISO(String(e.dateISO || e.date || "").trim());
      if (d) workExamDates.add(d);
    }

    // نبحث عن أول يوم عمل بعد التاريخ المختار لا يوجد فيه امتحانات (أفضل لتجنب العجز)
    for (let i = 1; i <= 14; i++) {
      const cand = workDateISO(addDaysISO(fromDateISO, i));
      if (!cand) continue;
      if (!workExamDates.has(cand)) return cand;
    }

    // fallback
    return workDateISO(addDaysISO(fromDateISO, 1));
  }

  const correctionSelectedDates = correctionMode === "DATES" ? selectedCorrectionDatesISO : [];

  const invShortageOnSelectedCorrectionDates: Record<string, number> = {};
  if (correctionSelectedDates.length) {
    for (const d of correctionSelectedDates) {
      const shortage = unfilled
        .filter((u) => u?.kind === "INVIGILATION" && String(u?.dateISO || "").trim() === d)
        .reduce((acc, u) => acc + Math.max(0, Number(u?.required || 0) - Number(u?.assigned || 0)), 0);
      if (shortage > 0) invShortageOnSelectedCorrectionDates[d] = shortage;
    }
  }

  const suggestedCorrectionDates: Record<string, string> = {};
  for (const d of Object.keys(invShortageOnSelectedCorrectionDates)) {
    suggestedCorrectionDates[d] = suggestBetterCorrectionDate(d);
  }

  const out: any = {
    assignments,
    warnings: [],
    debug: {
      summary: {
        invRequired,
        invAssigned,
        reserveRequired,
        reserveAssigned,
        reviewFreeTeachersDays,
        correctionFreeTeachersDays,
        teachersTotal: teachers.length,
        examsTotal: exams.length,
        runSeed: _seed,
        daysNoReserveBecauseInvShortage: Array.from(daysWithInvShortage).sort(),

        // ✅ NEW: معلومات تفريغ التصحيح (اليوم المحدد + اقتراح بديل عند العجز)
        correctionFreeMode: correctionMode,
        correctionFreeSelectedDatesISO: correctionSelectedDates,
        correctionFreeInvShortageByDate: invShortageOnSelectedCorrectionDates,
        correctionFreeSuggestedDatesByDate: suggestedCorrectionDates,
      },
      unfilled,
      correctionByTeacher,
    },
  };

  // ✅ تحذيرات واضحة للمستخدم في حال وجود عجز في أي تاريخ من تواريخ التفريغ
  for (const d of Object.keys(suggestedCorrectionDates)) {
    const alt = suggestedCorrectionDates[d];
    if (!alt) continue;
    out.warnings.push(
      `⚠️ يوجد عجز في المراقبة بتاريخ ${d} بسبب تفريغ معلمي المادة للتصحيح. اقترح نقل يوم التصحيح إلى ${alt}.`
    );
  }

  return out;
}

export default function TaskDistributionRun() {
  const nav = useNavigate();
  const { user, profile, effectiveTenantId } = useAuth() as any;
  const { teachers: appTeachers, exams: appExams } = useAppData();

  const tenantId = String(effectiveTenantId || profile?.tenantId || user?.tenantId || "").trim() || "default";

  const [fsTeachers, setFsTeachers] = useState<any[]>([]);
  const [fsExams, setFsExams] = useState<any[]>([]);
  const [fsLoading, setFsLoading] = useState(false);
  const [fsLoaded, setFsLoaded] = useState(false);

  // ✅ تحميل بيانات الكادر التعليمي /الامتحانات من Firestore داخل tenant (حتى تكون نتائج Results/Print مرتبطة بـ Run)
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!tenantId) return;
      setFsLoading(true);
      setFsLoaded(false);
      try {
        const [t, e] = await Promise.all([
          loadTenantArray<any>(tenantId, "teachers"),
          loadTenantArray<any>(tenantId, "exams"),
        ]);
        if (!mounted) return;
        setFsTeachers(Array.isArray(t) ? t : []);
        setFsExams(Array.isArray(e) ? e : []);
      } catch {
        if (!mounted) return;
        setFsTeachers([]);
        setFsExams([]);
      } finally {
        if (mounted) setFsLoading(false);
        if (mounted) setFsLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [tenantId]);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      await syncUnavailabilityFromTenant(tenantId).catch(() => loadUnavailability(tenantId));
      if (mounted) setUnavailabilityVersion((v) => v + 1);
    };
    void refresh();
    const onUpdated = (event?: any) => {
      const eventTenantId = String(event?.detail?.tenantId ?? "").trim();
      if (eventTenantId && eventTenantId !== tenantId) return;
      if (mounted) setUnavailabilityVersion((v) => v + 1);
    };
    window.addEventListener(UNAVAIL_UPDATED_EVENT, onUpdated as any);
    return () => {
      mounted = false;
      window.removeEventListener(UNAVAIL_UPDATED_EVENT, onUpdated as any);
    };
  }, [tenantId]);

  // ✅ مصدر البيانات الفعلي للتشغيل: Firestore داخل tenant إن وُجد، وإلا AppData
  // ثم نفلتر بقوة حتى لا يتم التشغيل بصفوف/عناصر “فارغة” بعد الحذف.
  // إذا تم تحميل Firestore (حتى لو كانت النتيجة فارغة) نعتمد عليه كحقيقة.
  const teachersRaw = (fsLoaded ? fsTeachers : appTeachers) as any[];
  const examsRaw = (fsLoaded ? fsExams : appExams) as any[];

  const teachers = useMemo(() => {
    const list = Array.isArray(teachersRaw) ? teachersRaw : [];
    return list
      .map((t: any) => ({
        id: String(t?.id ?? "").trim(),
        employeeNo: String(t?.employeeNo ?? "").trim(),
        fullName: String(t?.fullName ?? "").trim(),
        name: String(t?.name ?? "").trim(),
        subject1: String(t?.subject1 ?? "").trim(),
        subject2: String(t?.subject2 ?? "").trim(),
        subject3: String(t?.subject3 ?? "").trim(),
        subject4: String(t?.subject4 ?? "").trim(),
        grades: String(t?.grades ?? "").trim(),
        phone: String(t?.phone ?? "").trim(),
        notes: String(t?.notes ?? "").trim(),
      }))
      .filter((t: any) => t.id && (t.fullName || t.name || t.employeeNo));
  }, [teachersRaw]);

  const exams = useMemo(() => {
    const list = Array.isArray(examsRaw) ? examsRaw : [];
    return list
      .map((e: any) => {
        const dateISO = String(e?.dateISO ?? e?.date ?? "").trim();
        return {
          id: String(e?.id ?? "").trim(),
          subject: String(e?.subject ?? "").trim(),
          dateISO,
          date: dateISO,
          dayLabel: String(e?.dayLabel ?? "").trim(),
          time: String(e?.time ?? "").trim(),
          durationMinutes: Number(e?.durationMinutes ?? 0) || 0,
          period: String(e?.period ?? "").trim(),
          roomsCount: Number(e?.roomsCount ?? 0) || 0,
        };
      })
      .filter((e: any) => e.id && e.subject && e.dateISO);
  }, [examsRaw]);

  const teachersCount = teachers.length;
  const examsCount = exams.length;
  const hasBasics = !fsLoading && teachersCount > 0 && examsCount > 0;

  const [constraints, setConstraints] = useState<any>(() => {
    const merged = loadDistributionConstraints({ ...DEFAULT_CONSTRAINTS });

    // ✅ ترحيل الإعداد القديم (يوم واحد) إلى النظام الجديد (MODE + DATES)
    const legacyOne = workDateISO(String(merged?.correctionFreeDateISO || "").trim());
    const modeRaw = String(merged?.correctionFreeMode || "").trim().toUpperCase();
    if (!modeRaw) {
      merged.correctionFreeMode = legacyOne ? "DATES" : "ALL";
    }
    if (!Array.isArray(merged?.correctionFreeDatesISO)) merged.correctionFreeDatesISO = [];
    if (legacyOne && !merged.correctionFreeDatesISO.includes(legacyOne)) merged.correctionFreeDatesISO.push(legacyOne);

    return merged;
  });

  const [errors, setErrors] = useState<string[]>([]);
  const { isRunning, runtimeError, setRuntimeError, executeDistribution } = useTaskDistributionRunner();

  const [runOut, setRunOut] = useState<any | null>(null);

  const [sortMode, setSortMode] = useState<"TOTAL_DESC" | "TOTAL_ASC" | "NAME_ASC">("TOTAL_DESC");

  const [debugOpen, setDebugOpen] = useState(true);
  const [fairnessQuery, setFairnessQuery] = useState("");
  const [isReadinessCleared, setIsReadinessCleared] = useState(false);
  const [unavailabilityVersion, setUnavailabilityVersion] = useState(0);
  const [masterTableVersion, setMasterTableVersion] = useState(0);
  const [manualSuggestionHistory, setManualSuggestionHistory] = useState<ManualSuggestionHistoryEntry[]>(() => loadManualSuggestionHistory(tenantId));


  const allExamDatesSorted: string[] = useMemo(() => {
    const latestExams = exams as any[];
    const s = new Set<string>();
    for (const e of latestExams) {
      const d = String(e.dateISO || e.date || "").trim();
      if (d) s.add(d);
    }
    return Array.from(s).sort();
  }, [exams]);

  // ✅ NEW: أيام التصحيح المحتملة = اليوم التالي لكل امتحان (بعد ترحيل الجمعة/السبت)
  const correctionDatesSorted: string[] = useMemo(() => {
    const latestExams = exams as any[];
    const s = new Set<string>();
    for (const e of latestExams) {
      const d = workDateISO(String(e.dateISO || e.date || "").trim());
      if (!d) continue;
      const cor = workDateISO(addDaysISO(d, 1));
      if (cor) s.add(cor);
    }
    return Array.from(s).sort();
  }, [exams]);


  const latestRunSummary = useMemo(() => {
    if (!runOut) return null;
    const assignments = Array.isArray(runOut?.assignments) ? runOut.assignments : [];
    const countBy = (type: string) => assignments.filter((a: any) => String(a?.taskType || "") === type).length;
    return {
      createdAtISO: String(runOut?.createdAtISO || ""),
      totalAssignments: assignments.length,
      inv: countBy("INVIGILATION"),
      res: countBy("RESERVE"),
      rev: countBy("REVIEW_FREE"),
      cor: countBy("CORRECTION_FREE"),
      warnings: Array.isArray(runOut?.warnings) ? runOut.warnings.length : 0,
    };
  }, [runOut]);

  const readinessSnapshot = useMemo(() => {
    const latestTeachers = Array.isArray(teachers) ? teachers : [];
    const latestExams = Array.isArray(exams) ? exams : [];
    const unavailabilityRules = loadUnavailability(tenantId);
    const unavailabilityIndex = buildUnavailabilityIndex(unavailabilityRules);
    const masterAssignments = loadMasterTableAssignments();

    const teachersWithoutSubjects = latestTeachers.filter((t: any) => ![t.subject1, t.subject2, t.subject3, t.subject4].some((s: any) => String(s || "").trim()));
    const examsWithoutRooms = latestExams.filter((e: any) => (Number(e?.roomsCount) || 0) <= 0);
    const shiftedWeekendExams = latestExams.filter((e: any) => {
      const raw = String(e?.dateISO || e?.date || "").trim();
      return !!raw && workDateISO(raw) !== raw;
    });

    const teacherSubject1Map = buildTeacherSubject1Map(latestTeachers);
    const teacherSubjectSetMap = buildTeacherSubjectsMapAll(latestTeachers);
    const daySubjectsMap = buildDaySubjectsMap(latestExams);

    const teachersWithReviewFree = new Set<string>();
    for (const [dateISO, subjectsSet] of daySubjectsMap.entries()) {
      for (const teacher of latestTeachers) {
        const teacherId = String(teacher?.id || "").trim();
        if (!teacherId) continue;
        const s1 = String(teacherSubject1Map.get(teacherId) || "").trim();
        if (s1 && subjectsSet.has(s1)) teachersWithReviewFree.add(`${teacherId}__${dateISO}`);
      }
    }

    const teacherExactSubjects_1_4 = new Map<string, Set<string>>();
    const teacherGroups_5_12 = new Map<string, Set<string>>();
    for (const t of latestTeachers) {
      const teacherId = String(t?.id || "").trim();
      if (!teacherId) continue;
      const exactSet = new Set<string>();
      const groupsSet = new Set<string>();
      [t.subject1, t.subject2, t.subject3, t.subject4]
        .map((x: any) => String(x ?? "").trim())
        .filter(Boolean)
        .forEach((s) => {
          exactSet.add(normalizeExactSubject_1_4(s));
          groupsSet.add(getCorrectionGroupKey_5_12(s));
        });
      teacherExactSubjects_1_4.set(teacherId, exactSet);
      teacherGroups_5_12.set(teacherId, groupsSet);
    }

    const teacherCorrectionDays = new Map<string, Set<string>>();
    if (constraints.freeAllSubjectTeachersForCorrection) {
      const selectedMode = String(constraints?.correctionFreeMode || "ALL").toUpperCase() === "DATES" ? "DATES" : "ALL";
      const selectedDates = Array.isArray(constraints?.correctionFreeDatesISO) ? constraints.correctionFreeDatesISO.map((d: string) => workDateISO(String(d || "").trim())).filter(Boolean) : [];
      const sortedExamsLocal = [...latestExams].sort((a: any, b: any) => {
        const da = workDateISO(String(a?.dateISO || a?.date || ""));
        const db = workDateISO(String(b?.dateISO || b?.date || ""));
        if (da !== db) return da.localeCompare(db);
        const pa = periodToAMPM(String(a?.period || ""));
        const pb = periodToAMPM(String(b?.period || ""));
        return pa === pb ? 0 : pa === "AM" ? -1 : 1;
      });

      for (const exam of sortedExamsLocal) {
        const examDateISO = workDateISO(String(exam?.dateISO || exam?.date || "").trim());
        const subject = String(exam?.subject || "").trim();
        if (!examDateISO || !subject) continue;
        const correctionDateISO = workDateISO(addDaysISO(examDateISO, 1));
        if (!correctionDateISO) continue;
        if (selectedMode === "DATES" && (!selectedDates.length || !selectedDates.includes(correctionDateISO))) continue;

        const grade = extractGradeFromSubject(subject);
        for (const teacher of latestTeachers) {
          const teacherId = String(teacher?.id || "").trim();
          if (!teacherId) continue;
          if (teachersWithReviewFree.has(`${teacherId}__${correctionDateISO}`)) continue;

          const ok =
            grade !== null && grade >= 1 && grade <= 4
              ? (teacherExactSubjects_1_4.get(teacherId) || new Set<string>()).has(normalizeExactSubject_1_4(subject))
              : (teacherGroups_5_12.get(teacherId) || new Set<string>()).has(getCorrectionGroupKey_5_12(subject));

          if (!ok) continue;
          if (!teacherCorrectionDays.has(teacherId)) teacherCorrectionDays.set(teacherId, new Set<string>());
          teacherCorrectionDays.get(teacherId)!.add(correctionDateISO);
        }
      }
    }

    const subjectCoverageIssues = Array.from(new Set(
      latestExams
        .map((e: any) => String(e?.subject || "").trim())
        .filter(Boolean)
        .filter((subject: string) => {
          for (const subjects of teacherSubjectSetMap.values()) {
            if (subjects.has(subject)) return false;
          }
          return true;
        })
    ));

    const duplicateTeacherIds = Array.from(
      latestTeachers.reduce((acc: Map<string, number>, t: any) => {
        const id = String(t?.id || "").trim();
        if (id) acc.set(id, (acc.get(id) || 0) + 1);
        return acc;
      }, new Map<string, number>()).entries()
    ).filter(([, count]) => count > 1).map(([id]) => id);

    const duplicateTeacherNames = Array.from(
      latestTeachers.reduce((acc: Map<string, number>, t: any) => {
        const name = String(t?.fullName || t?.name || "").trim();
        if (name) acc.set(name, (acc.get(name) || 0) + 1);
        return acc;
      }, new Map<string, number>()).entries()
    ).filter(([, count]) => count > 1).map(([name]) => name);

    const slotMap = new Map<string, any>();
    for (const exam of latestExams) {
      const dateISO = workDateISO(String(exam?.dateISO || exam?.date || "").trim());
      const period = periodToAMPM(String(exam?.period || ""));
      if (!dateISO) continue;
      const key = `${dateISO}__${period}`;
      const current = slotMap.get(key) || {
        key,
        dateISO,
        period,
        rooms: 0,
        subjects: [],
        invigilatorsRequired: 0,
      };
      current.rooms += Number(exam?.roomsCount) || 0;
      current.invigilatorsRequired += (Number(exam?.roomsCount) || 0) * guessInvigilatorsPerRoom(exam, constraints);
      current.subjects.push(String(exam?.subject || "").trim());
      slotMap.set(key, current);
    }

    const teacherNameMapLocal = new Map<string, string>();
    const teacherIds = Array.from(
      new Set(
        latestTeachers
          .map((t: any) => String(t?.id || "").trim())
          .filter(Boolean)
      )
    );
    for (const teacher of latestTeachers) {
      const teacherId = String(teacher?.id || "").trim();
      if (!teacherId) continue;
      teacherNameMapLocal.set(teacherId, String(teacher?.fullName || teacher?.name || teacher?.employeeNo || teacherId).trim());
    }

    const smartBySpecialty = !!constraints?.smartBySpecialty;
    const maxTasks = Number(constraints?.maxTasksPerTeacher ?? 10) || 10;
    const enableCorrectionFree = !!constraints?.freeAllSubjectTeachersForCorrection;

    const uniqueWorkExamDates = Array.from(
      new Set(latestExams.map((e: any) => workDateISO(String(e?.dateISO || e?.date || "").trim())).filter(Boolean))
    ).sort();
    const lastExamDate = uniqueWorkExamDates.length ? uniqueWorkExamDates[uniqueWorkExamDates.length - 1] : "";
    const lastTwoExamDates = new Set<string>();
    if (uniqueWorkExamDates.length >= 1) lastTwoExamDates.add(uniqueWorkExamDates[uniqueWorkExamDates.length - 1]);
    if (uniqueWorkExamDates.length >= 2) lastTwoExamDates.add(uniqueWorkExamDates[uniqueWorkExamDates.length - 2]);

    function normalizeStoredTaskType(rawTaskType: any) {
      const raw = String(rawTaskType || "").trim().toUpperCase();
      if (raw === "INVIGILATION" || raw === "RESERVE" || raw === "REVIEW_FREE" || raw === "CORRECTION_FREE") return raw;
      if (raw.includes("مراقبة")) return "INVIGILATION";
      if (raw.includes("احتياط")) return "RESERVE";
      if (raw.includes("مراجعة")) return "REVIEW_FREE";
      if (raw.includes("تصحيح")) return "CORRECTION_FREE";
      return raw;
    }

    function getAssignmentPeriods(assignment: any, taskType: string): ("AM" | "PM")[] {
      const covers = Array.isArray((assignment as any)?.coversPeriods)
        ? (assignment as any).coversPeriods.map((p: any) => periodToAMPM(String(p || "")))
        : [];
      if (covers.length) return Array.from(new Set(covers));
      if ((assignment as any)?.fullDay || taskType === "REVIEW_FREE" || taskType === "CORRECTION_FREE") return ["AM", "PM"];
      return [periodToAMPM(String((assignment as any)?.period || ""))];
    }

    const slotExamMap = new Map<string, any[]>();
    for (const exam of latestExams) {
      const dateISO = workDateISO(String(exam?.dateISO || exam?.date || "").trim());
      const period = periodToAMPM(String(exam?.period || ""));
      const subject = String(exam?.subject || "").trim();
      const roomsCount = Number(exam?.roomsCount || 0) || 0;
      if (!dateISO || !subject || roomsCount <= 0) continue;
      const key = `${dateISO}__${period}`;
      if (!slotExamMap.has(key)) slotExamMap.set(key, []);
      slotExamMap.get(key)!.push({
        examId: String((exam as any)?.id || "").trim(),
        subject,
        roomsCount,
        invPerRoom: Math.max(1, Number(guessInvigilatorsPerRoom(exam, constraints) || 1)),
        durationMinutes: Number((exam as any)?.durationMinutes ?? 0) || 0,
      });
    }

    function createSimulationState() {
      const quotaTotals = new Map<string, number>();
      const invCounts = new Map<string, number>();
      const occupiedSlots = new Map<string, Set<string>>();
      const dayHasAnyPeriod = new Map<string, Set<string>>();
      const teacherDayFirstInvDuration = new Map<string, number>();
      const teacherHad3HoursInv = new Map<string, boolean>();
      for (const teacherId of teacherIds) {
        quotaTotals.set(teacherId, 0);
        invCounts.set(teacherId, 0);
        occupiedSlots.set(teacherId, new Set<string>());
        dayHasAnyPeriod.set(teacherId, new Set<string>());
        teacherHad3HoursInv.set(teacherId, false);
      }
      return { quotaTotals, invCounts, occupiedSlots, dayHasAnyPeriod, teacherDayFirstInvDuration, teacherHad3HoursInv };
    }

    function buildSimulationArtifactsFromAssignments(sourceAssignments: any[]) {
      const state = createSimulationState();
      const committeeMap = new Map<string, Map<number, any[]>>();
      const slotCounts = new Map<string, { inv: number; res: number; rev: number; cor: number }>();

      for (const ass of sourceAssignments) {
        const teacherId = String((ass as any)?.teacherId || "").trim();
        const dateISO = workDateISO(String((ass as any)?.dateISO || (ass as any)?.date || "").trim());
        const period = periodToAMPM(String((ass as any)?.period || ""));
        if (!dateISO) continue;
        const key = `${dateISO}__${period}`;
        const taskType = normalizeStoredTaskType((ass as any)?.taskType || (ass as any)?.role || "");
        const current = slotCounts.get(key) || { inv: 0, res: 0, rev: 0, cor: 0 };
        if (taskType === "INVIGILATION") current.inv += 1;
        else if (taskType === "RESERVE") current.res += 1;
        else if (taskType === "REVIEW_FREE") current.rev += 1;
        else if (taskType === "CORRECTION_FREE") current.cor += 1;
        slotCounts.set(key, current);

        if (!teacherId || !state.occupiedSlots.has(teacherId)) continue;

        for (const coveredPeriod of getAssignmentPeriods(ass, taskType)) {
          state.occupiedSlots.get(teacherId)!.add(slotKey(dateISO, coveredPeriod));
        }
        state.dayHasAnyPeriod.get(teacherId)!.add(dateISO);

        if (isQuotaTaskType(taskType)) {
          state.quotaTotals.set(teacherId, (state.quotaTotals.get(teacherId) || 0) + 1);
        }

        if (taskType === "INVIGILATION") {
          state.invCounts.set(teacherId, (state.invCounts.get(teacherId) || 0) + 1);
          const durationMinutes = Number((ass as any)?.durationMinutes ?? 0) || 0;
          const firstDurationKey = `${teacherId}__${dateISO}`;
          if (!state.teacherDayFirstInvDuration.has(firstDurationKey) && durationMinutes > 0) {
            state.teacherDayFirstInvDuration.set(firstDurationKey, durationMinutes);
          }
          if (durationMinutes === 180) {
            state.teacherHad3HoursInv.set(teacherId, true);
          }

          const examKey = String((ass as any)?.examId || `${key}__${String((ass as any)?.subject || "").trim()}`).trim();
          const committeeNo = Math.max(1, Number((ass as any)?.committeeNo || (ass as any)?.committeeNumber || (ass as any)?.roomNo || (ass as any)?.roomNumber || 1) || 1);
          if (!committeeMap.has(examKey)) committeeMap.set(examKey, new Map<number, any[]>());
          const nextCommitteeMap = committeeMap.get(examKey)!;
          if (!nextCommitteeMap.has(committeeNo)) nextCommitteeMap.set(committeeNo, []);
          nextCommitteeMap.get(committeeNo)!.push({
            teacherId,
            teacherName: String((ass as any)?.teacherName || teacherNameMapLocal.get(teacherId) || teacherId).trim(),
            ben: hasBenInName(String((ass as any)?.teacherName || teacherNameMapLocal.get(teacherId) || teacherId).trim()),
          });
        }
      }

      return {
        state,
        invAssignmentsByExamCommittee: committeeMap,
        slotAssignmentMap: slotCounts,
      };
    }

    const baseArtifacts = buildSimulationArtifactsFromAssignments(masterAssignments);
    const baseSimulationState = baseArtifacts.state;
    const invAssignmentsByExamCommittee = baseArtifacts.invAssignmentsByExamCommittee;
    const slotAssignmentMap = baseArtifacts.slotAssignmentMap;

    function cloneSimulationState(state: any) {
      return {
        quotaTotals: new Map(state.quotaTotals),
        invCounts: new Map(state.invCounts),
        occupiedSlots: new Map(Array.from(state.occupiedSlots.entries()).map(([teacherId, periods]: any) => [teacherId, new Set(Array.from(periods))])),
        dayHasAnyPeriod: new Map(Array.from(state.dayHasAnyPeriod.entries()).map(([teacherId, dates]: any) => [teacherId, new Set(Array.from(dates))])),
        teacherDayFirstInvDuration: new Map(state.teacherDayFirstInvDuration),
        teacherHad3HoursInv: new Map(state.teacherHad3HoursInv),
      };
    }

    function canAssignUsingState(state: any, teacherId: string, dateISO: string, period: "AM" | "PM", taskType: string, subject: string, meta?: any) {
      if (!teacherId || !state.occupiedSlots.has(teacherId)) return false;

      if (
        (taskType === "INVIGILATION" || taskType === "RESERVE" || taskType === "REVIEW_FREE" || taskType === "CORRECTION_FREE") &&
        isTeacherUnavailable({
          teacherId,
          dateISO,
          period,
          taskType: taskType as any,
          index: unavailabilityIndex,
        })
      ) {
        return false;
      }

      if ((state.quotaTotals.get(teacherId) || 0) >= maxTasks && isQuotaTaskType(taskType)) return false;

      const sk = slotKey(dateISO, period);
      const slots = state.occupiedSlots.get(teacherId) || new Set<string>();
      if (slots.has(sk)) return false;

      if (enableCorrectionFree) {
        const correctionDays = teacherCorrectionDays.get(teacherId);
        if (correctionDays && correctionDays.has(dateISO)) {
          return false;
        }
      }

      const teacherName = teacherNameMapLocal.get(teacherId) || "";
      if (taskType === "INVIGILATION" || taskType === "RESERVE") {
        if (lastExamDate && teacherHas13(teacherName) && dateISO === lastExamDate) return false;
        if (lastTwoExamDates.size && teacherHas14(teacherName) && lastTwoExamDates.has(dateISO)) return false;
      }

      if (taskType === "INVIGILATION") {
        const durationMinutes = Number(meta?.durationMinutes ?? 0) || 0;
        if (durationMinutes === 180 && (state.teacherHad3HoursInv.get(teacherId) || false)) return false;
      }

      if ((state.dayHasAnyPeriod.get(teacherId) || new Set<string>()).has(dateISO) && !isTwoPeriodsAllowedOnDate(dateISO, constraints)) {
        return false;
      }

      if (smartBySpecialty && taskType === "INVIGILATION") {
        const subjects = teacherSubjectSetMap.get(teacherId);
        if (subjects && subjects.has(String(subject || "").trim())) return false;
      }

      return true;
    }

    function commitAssignUsingState(state: any, teacherId: string, dateISO: string, period: "AM" | "PM", taskType: string, subject: string, meta?: any) {
      const sk = slotKey(dateISO, period);
      state.occupiedSlots.get(teacherId)!.add(sk);
      state.dayHasAnyPeriod.get(teacherId)!.add(dateISO);

      if (isQuotaTaskType(taskType)) {
        state.quotaTotals.set(teacherId, (state.quotaTotals.get(teacherId) || 0) + 1);
      }

      if (taskType === "INVIGILATION") {
        state.invCounts.set(teacherId, (state.invCounts.get(teacherId) || 0) + 1);
        const durationMinutes = Number(meta?.durationMinutes ?? 0) || 0;
        const dayKey = `${teacherId}__${dateISO}`;
        if (!state.teacherDayFirstInvDuration.has(dayKey) && durationMinutes > 0) {
          state.teacherDayFirstInvDuration.set(dayKey, durationMinutes);
        }
        if (durationMinutes === 180) {
          state.teacherHad3HoursInv.set(teacherId, true);
        }
      }
    }

    function buildOrderedCandidates(state: any, dateISO: string, subject: string, durationMinutes: number, excludeIds: Set<string>) {
      const subject12 = subjectHas12(subject);
      const candidates = teacherIds
        .filter((teacherId) => !excludeIds.has(teacherId))
        .map((teacherId, idx) => {
          const teacherName = teacherNameMapLocal.get(teacherId) || "";
          const hasSameDay = (state.dayHasAnyPeriod.get(teacherId) || new Set<string>()).has(dateISO);
          const firstDuration = state.teacherDayFirstInvDuration.get(`${teacherId}__${dateISO}`) ?? 999999;
          return {
            id: teacherId,
            idx,
            inv: state.invCounts.get(teacherId) || 0,
            quota: state.quotaTotals.get(teacherId) || 0,
            hasSameDay,
            firstDuration,
            ben: hasBenInName(teacherName),
            is12: teacherHas12(teacherName),
            durationMinutes,
          };
        })
        .sort(
          (a, b) =>
            (subject12 ? Number(b.is12) - Number(a.is12) : 0) ||
            a.inv - b.inv ||
            a.quota - b.quota ||
            Number(a.hasSameDay) - Number(b.hasSameDay) ||
            a.firstDuration - b.firstDuration ||
            a.idx - b.idx
        );

      if (subject12 && candidates.some((candidate) => candidate.is12)) {
        return [...candidates.filter((candidate) => candidate.is12), ...candidates.filter((candidate) => !candidate.is12)];
      }
      return candidates;
    }

    function assignReserveUsingState(state: any, dateISO: string, period: "AM" | "PM", subject: string) {
      const candidates = teacherIds
        .map((teacherId, idx) => ({
          id: teacherId,
          idx,
          quota: state.quotaTotals.get(teacherId) || 0,
          inv: state.invCounts.get(teacherId) || 0,
          hasSameDay: (state.dayHasAnyPeriod.get(teacherId) || new Set<string>()).has(dateISO),
        }))
        .sort((a, b) => a.quota - b.quota || a.inv - b.inv || Number(a.hasSameDay) - Number(b.hasSameDay) || a.idx - b.idx);

      for (const candidate of candidates) {
        if (!canAssignUsingState(state, candidate.id, dateISO, period, "RESERVE", subject, {})) continue;
        commitAssignUsingState(state, candidate.id, dateISO, period, "RESERVE", subject, {});
        return true;
      }
      return false;
    }

    function reserveCanConvertToInvigilation(state: any, teacherId: string, dateISO: string, period: "AM" | "PM", subject: string, durationMinutes: number, existingAssignments: any[], invPerRoom: number) {
      if (!teacherId || !state.occupiedSlots.has(teacherId)) return false;
      if (
        isTeacherUnavailable({
          teacherId,
          dateISO,
          period,
          taskType: "INVIGILATION",
          index: unavailabilityIndex,
        })
      ) {
        return false;
      }

      const teacherName = teacherNameMapLocal.get(teacherId) || "";
      if (enableCorrectionFree) {
        const correctionDays = teacherCorrectionDays.get(teacherId);
        if (correctionDays && correctionDays.has(dateISO)) return false;
      }

      if (lastExamDate && teacherHas13(teacherName) && dateISO === lastExamDate) return false;
      if (lastTwoExamDates.size && teacherHas14(teacherName) && lastTwoExamDates.has(dateISO)) return false;
      if (durationMinutes === 180 && (state.teacherHad3HoursInv.get(teacherId) || false)) return false;

      if (smartBySpecialty) {
        const subjects = teacherSubjectSetMap.get(teacherId);
        if (subjects && subjects.has(String(subject || "").trim())) return false;
      }

      const ben = hasBenInName(teacherName);
      if (invPerRoom === 1) return ben;
      if (invPerRoom === 2) {
        const existingBen = existingAssignments.some((assignment: any) => !!assignment?.ben);
        if (existingAssignments.length >= 1 && !existingBen && !ben) return false;
      }
      return true;
    }

    function pickFreeCandidateForCommittee(state: any, dateISO: string, period: "AM" | "PM", subject: string, durationMinutes: number, existingAssignments: any[], existingTeacherIds: Set<string>, invPerRoom: number) {
      let candidates = buildOrderedCandidates(state, dateISO, subject, durationMinutes, existingTeacherIds);
      if (invPerRoom === 1) {
        candidates = candidates.filter((candidate) => candidate.ben);
      } else if (invPerRoom === 2) {
        const existingBen = existingAssignments.some((assignment: any) => !!assignment?.ben);
        if (!existingBen) {
          const benFirst = candidates.filter((candidate) => candidate.ben);
          const rest = candidates.filter((candidate) => !candidate.ben);
          candidates = [...benFirst, ...rest];
        }
      }

      for (const candidate of candidates) {
        if (invPerRoom === 2 && existingAssignments.length >= 1) {
          const existingBen = existingAssignments.some((assignment: any) => !!assignment?.ben);
          if (!existingBen && !candidate.ben) continue;
        }
        if (!canAssignUsingState(state, candidate.id, dateISO, period, "INVIGILATION", subject, { durationMinutes })) continue;
        return candidate;
      }
      return null;
    }

    function getSuggestionRelaxBlocker(state: any, teacherId: string, dateISO: string, period: "AM" | "PM", subject: string, durationMinutes: number) {
      if (!teacherId || !state.occupiedSlots.has(teacherId)) return null;

      if (
        isTeacherUnavailable({
          teacherId,
          dateISO,
          period,
          taskType: "INVIGILATION",
          index: unavailabilityIndex,
        })
      ) {
        return null;
      }

      const teacherName = teacherNameMapLocal.get(teacherId) || "";
      const sk = slotKey(dateISO, period);
      const slots = state.occupiedSlots.get(teacherId) || new Set<string>();
      if (slots.has(sk)) return null;

      if (lastExamDate && teacherHas13(teacherName) && dateISO === lastExamDate) return null;
      if (lastTwoExamDates.size && teacherHas14(teacherName) && lastTwoExamDates.has(dateISO)) return null;

      const blockers: string[] = [];
      if ((state.quotaTotals.get(teacherId) || 0) >= maxTasks) blockers.push("MAX_TASKS");

      if (enableCorrectionFree) {
        const correctionDays = teacherCorrectionDays.get(teacherId);
        if (correctionDays && correctionDays.has(dateISO)) blockers.push("CORRECTION_FREE");
      }

      if ((state.dayHasAnyPeriod.get(teacherId) || new Set<string>()).has(dateISO) && !isTwoPeriodsAllowedOnDate(dateISO, constraints)) {
        blockers.push("SAME_DAY");
      }

      if (smartBySpecialty) {
        const subjects = teacherSubjectSetMap.get(teacherId);
        if (subjects && subjects.has(String(subject || "").trim())) blockers.push("SAME_SUBJECT");
      }

      if (durationMinutes === 180 && (state.teacherHad3HoursInv.get(teacherId) || false)) blockers.push("THREE_HOURS_REPEAT");

      if (blockers.length !== 1) return null;
      return blockers[0];
    }

    function relaxBlockerSuggestionMeta(blocker: string | null | undefined) {
      switch (blocker) {
        case "MAX_TASKS":
          return { source: "MAX_TASK_RELAX" as const, note: "قابل للإسناد إذا زاد النصاب +1" };
        case "SAME_DAY":
          return { source: "SAME_DAY_RELAX" as const, note: "قابل للإسناد إذا سُمح بفترتين في هذا اليوم" };
        case "SAME_SUBJECT":
          return { source: "SPECIALTY_RELAX" as const, note: "قابل للإسناد إذا تم استثناء منع مراقبة نفس المادة" };
        case "CORRECTION_FREE":
          return { source: "CORRECTION_RELAX" as const, note: "قابل للإسناد إذا رُفع تفريغ التصحيح لهذا اليوم" };
        default:
          return null;
      }
    }

    function buildTeacherSuggestionsForRow(row: any) {
      const state = cloneSimulationState(baseSimulationState);
      const suggestions: Array<{
        teacherId: string;
        teacherName: string;
        subject: string;
        source: SuggestionSource;
        note: string;
        transferAssignmentId?: string;
        transferFromDateISO?: string;
        transferFromPeriod?: "AM" | "PM";
        transferFromTaskType?: string;
        transferFromSubject?: string;
      }> = [];
      const seenTeacherIds = new Set<string>();
      const usedReserveTeacherIds = new Set<string>();
      const slotReserveAssignments = masterAssignments
        .filter((ass: any) => {
          const taskType = normalizeStoredTaskType((ass as any)?.taskType || (ass as any)?.role || "");
          if (taskType !== "RESERVE") return false;
          const assDate = workDateISO(String((ass as any)?.dateISO || (ass as any)?.date || "").trim());
          const assPeriod = periodToAMPM(String((ass as any)?.period || ""));
          return assDate === row.dateISO && assPeriod === row.period;
        })
        .map((ass: any) => ({
          teacherId: String((ass as any)?.teacherId || "").trim(),
          teacherName: String((ass as any)?.teacherName || teacherNameMapLocal.get(String((ass as any)?.teacherId || "").trim()) || String((ass as any)?.teacherId || "")).trim(),
        }))
        .filter((ass: any) => ass.teacherId);

      const examsInSlot = (slotExamMap.get(row.key) || []).slice().sort((a: any, b: any) => String(a.subject || "").localeCompare(String(b.subject || "")));
      for (const examDetail of examsInSlot) {
        const examSubject = String(examDetail?.subject || "").trim();
        const examDurationMinutes = Number(examDetail?.durationMinutes ?? 0) || 0;
        const examKey = String(examDetail.examId || `${row.key}__${examSubject}`);
        const committeeMap = invAssignmentsByExamCommittee.get(examKey) || new Map<number, any[]>();
        for (let committeeNo = 1; committeeNo <= Number(examDetail.roomsCount || 0); committeeNo++) {
          const existingAssignments = (committeeMap.get(committeeNo) || []).slice(0, Math.max(0, Number(examDetail.invPerRoom || 0)));
          const existingTeacherIds = new Set(existingAssignments.map((assignment: any) => String(assignment?.teacherId || "").trim()).filter(Boolean));
          const invPerRoom = Math.max(1, Number(examDetail.invPerRoom || 0) || 1);
          const missingSpots = Math.max(0, invPerRoom - existingAssignments.length);
          for (let spotIndex = 0; spotIndex < missingSpots; spotIndex++) {
            const reserveCandidates = slotReserveAssignments
              .filter((candidate: any) => !usedReserveTeacherIds.has(candidate.teacherId) && !existingTeacherIds.has(candidate.teacherId))
              .filter((candidate: any) => reserveCanConvertToInvigilation(state, candidate.teacherId, row.dateISO, row.period, examSubject, examDurationMinutes, existingAssignments, invPerRoom))
              .sort((a: any, b: any) => {
                const invA = Number(state.invCounts.get(String(a.teacherId || "").trim()) ?? 0);
                const invB = Number(state.invCounts.get(String(b.teacherId || "").trim()) ?? 0);
                const quotaA = Number(state.quotaTotals.get(String(a.teacherId || "").trim()) ?? 0);
                const quotaB = Number(state.quotaTotals.get(String(b.teacherId || "").trim()) ?? 0);
                return invA - invB || quotaA - quotaB || String(a.teacherName || "").localeCompare(String(b.teacherName || ""));
              });

            if (reserveCandidates.length) {
              const pickedReserve = reserveCandidates[0];
              usedReserveTeacherIds.add(pickedReserve.teacherId);
              existingTeacherIds.add(pickedReserve.teacherId);
              existingAssignments.push({
                teacherId: pickedReserve.teacherId,
                teacherName: pickedReserve.teacherName,
                ben: hasBenInName(pickedReserve.teacherName),
              });
              if (!seenTeacherIds.has(pickedReserve.teacherId)) {
                seenTeacherIds.add(pickedReserve.teacherId);
                suggestions.push({
                  teacherId: pickedReserve.teacherId,
                  teacherName: pickedReserve.teacherName,
                  subject: examSubject,
                  source: "RESERVE",
                  note: `تحويل من الاحتياط لنفس الفترة • ${examSubject}`,
                });
              }
              continue;
            }

            const picked = pickFreeCandidateForCommittee(state, row.dateISO, row.period, examSubject, examDurationMinutes, existingAssignments, existingTeacherIds, invPerRoom);
            if (picked) {
              commitAssignUsingState(state, picked.id, row.dateISO, row.period, "INVIGILATION", examSubject, { durationMinutes: examDurationMinutes });
              existingTeacherIds.add(picked.id);
              existingAssignments.push({
                teacherId: picked.id,
                teacherName: teacherNameMapLocal.get(picked.id) || picked.id,
                ben: !!picked.ben,
              });
              if (!seenTeacherIds.has(picked.id)) {
                seenTeacherIds.add(picked.id);
                suggestions.push({
                  teacherId: picked.id,
                  teacherName: teacherNameMapLocal.get(picked.id) || picked.id,
                  subject: examSubject,
                  source: "FREE",
                  note: `معلم متاح لنفس الفترة • ${examSubject}`,
                });
              }
              continue;
            }

            const relaxedCandidates = buildOrderedCandidates(state, row.dateISO, examSubject, examDurationMinutes, existingTeacherIds)
              .map((candidate: any) => {
                const blocker = getSuggestionRelaxBlocker(state, candidate.id, row.dateISO, row.period, examSubject, examDurationMinutes);
                return { candidate, blocker };
              })
              .filter((item: any) => !!item.blocker)
              .filter((item: any) => {
                if (invPerRoom === 1 && !item.candidate.ben) return false;
                if (invPerRoom === 2 && existingAssignments.length >= 1) {
                  const existingBen = existingAssignments.some((assignment: any) => !!assignment?.ben);
                  if (!existingBen && !item.candidate.ben) return false;
                }
                return true;
              })
              .sort((a: any, b: any) =>
                Number(a.candidate.inv) - Number(b.candidate.inv) ||
                Number(a.candidate.quota) - Number(b.candidate.quota) ||
                Number(a.candidate.hasSameDay) - Number(b.candidate.hasSameDay) ||
                Number(a.candidate.firstDuration) - Number(b.candidate.firstDuration) ||
                Number(a.candidate.idx) - Number(b.candidate.idx)
              );

            for (const item of relaxedCandidates) {
              const suggestionMeta = relaxBlockerSuggestionMeta(item.blocker);
              if (!suggestionMeta) continue;
              const teacherId = String(item.candidate.id || "").trim();
              if (!teacherId || seenTeacherIds.has(teacherId)) continue;
              seenTeacherIds.add(teacherId);
              suggestions.push({
                teacherId,
                teacherName: teacherNameMapLocal.get(teacherId) || teacherId,
                subject: examSubject,
                source: suggestionMeta.source,
                note: `${suggestionMeta.note} • ${examSubject}`,
              });
              break;
            }
          }
        }
      }

      return dedupeTeacherSuggestions(suggestions).slice(0, 8);
    }

    function findDirectTargetMetaForTeacher(artifacts: any, row: any, teacherId: string) {
      const targetTaskType = Number(row?.remainingInvigilations || 0) > 0 ? "INVIGILATION" : (Number(row?.remainingReserve || 0) > 0 ? "RESERVE" : "INVIGILATION");
      if (targetTaskType === "RESERVE") {
        const reserveSubject = row.subjects?.[0] ? String(row.subjects[0]) : "احتياط";
        if (canAssignUsingState(artifacts.state, teacherId, row.dateISO, row.period, "RESERVE", reserveSubject, {})) {
          return {
            taskType: "RESERVE",
            subject: reserveSubject,
            examId: undefined,
            committeeNo: undefined,
            invigilatorIndex: undefined,
            durationMinutes: 0,
          };
        }
        return null;
      }

      const teacherName = teacherNameMapLocal.get(teacherId) || teacherId;
      const teacherBen = hasBenInName(teacherName);
      const examsInSlot = (slotExamMap.get(row.key) || []).slice().sort((a: any, b: any) => String(a.subject || "").localeCompare(String(b.subject || "")));
      for (const examDetail of examsInSlot) {
        const examKey = String(examDetail.examId || `${row.key}__${String(examDetail.subject || "").trim()}`);
        const committeeMap = artifacts.invAssignmentsByExamCommittee.get(examKey) || new Map<number, any[]>();
        for (let committeeNo = 1; committeeNo <= Number(examDetail.roomsCount || 0); committeeNo++) {
          const existingAssignments = (committeeMap.get(committeeNo) || []).slice(0, Math.max(0, Number(examDetail.invPerRoom || 0)));
          const existingTeacherIds = new Set(existingAssignments.map((assignment: any) => String(assignment?.teacherId || "").trim()).filter(Boolean));
          const invPerRoom = Math.max(1, Number(examDetail.invPerRoom || 0) || 1);
          if (existingAssignments.length >= invPerRoom) continue;
          if (existingTeacherIds.has(teacherId)) continue;
          if (invPerRoom === 1 && !teacherBen) continue;
          if (invPerRoom === 2 && existingAssignments.length >= 1) {
            const existingBen = existingAssignments.some((assignment: any) => !!assignment?.ben);
            if (!existingBen && !teacherBen) continue;
          }
          if (!canAssignUsingState(artifacts.state, teacherId, row.dateISO, row.period, "INVIGILATION", examDetail.subject, { durationMinutes: examDetail.durationMinutes })) continue;
          return {
            taskType: "INVIGILATION",
            subject: String(examDetail.subject || "").trim(),
            examId: String(examDetail.examId || "").trim() || undefined,
            committeeNo,
            invigilatorIndex: existingAssignments.length + 1,
            durationMinutes: Number(examDetail.durationMinutes ?? 0) || 0,
          };
        }
      }
      return null;
    }

    function buildTransferSuggestionsForRow(row: any, safeRows: any[]) {
      if (!safeRows.length) return [];
      const suggestions: Array<{
        teacherId: string;
        teacherName: string;
        subject: string;
        source: "TRANSFER_SAFE";
        note: string;
        transferAssignmentId: string;
        transferFromDateISO: string;
        transferFromPeriod: "AM" | "PM";
        transferFromTaskType: string;
        transferFromSubject?: string;
      }> = [];
      const seenTeacherIds = new Set<string>();
      const safeRowKeys = new Set(safeRows.map((safeRow: any) => String(safeRow?.key || "")));
      const donorAssignments = masterAssignments
        .map((ass: any, idx: number) => ({ ass, idx }))
        .filter(({ ass }) => {
          const taskType = normalizeStoredTaskType((ass as any)?.taskType || (ass as any)?.role || "");
          if (taskType !== "INVIGILATION" && taskType !== "RESERVE") return false;
          const donorDate = workDateISO(String((ass as any)?.dateISO || (ass as any)?.date || "").trim());
          const donorPeriod = periodToAMPM(String((ass as any)?.period || ""));
          const donorKey = `${donorDate}__${donorPeriod}`;
          return donorKey !== row.key && safeRowKeys.has(donorKey);
        })
        .sort((a, b) => {
          const aTask = normalizeStoredTaskType((a.ass as any)?.taskType || (a.ass as any)?.role || "");
          const bTask = normalizeStoredTaskType((b.ass as any)?.taskType || (b.ass as any)?.role || "");
          if (aTask !== bTask) return aTask === "RESERVE" ? -1 : 1;
          const aTeacher = String((a.ass as any)?.teacherName || (a.ass as any)?.teacherId || "");
          const bTeacher = String((b.ass as any)?.teacherName || (b.ass as any)?.teacherId || "");
          return aTeacher.localeCompare(bTeacher, "ar");
        });

      for (const donor of donorAssignments) {
        const donorTaskType = normalizeStoredTaskType((donor.ass as any)?.taskType || (donor.ass as any)?.role || "");
        const teacherId = String((donor.ass as any)?.teacherId || "").trim();
        if (!teacherId || seenTeacherIds.has(teacherId)) continue;
        const teacherName = String((donor.ass as any)?.teacherName || teacherNameMapLocal.get(teacherId) || teacherId).trim();
        const donorAssignmentId = assignmentIdentity(donor.ass, donor.idx);
        const donorDateISO = workDateISO(String((donor.ass as any)?.dateISO || (donor.ass as any)?.date || "").trim());
        const donorPeriod = periodToAMPM(String((donor.ass as any)?.period || ""));
        const donorSubject = String((donor.ass as any)?.subject || "").trim();
        const tempAssignments = masterAssignments.filter((item: any, itemIdx: number) => assignmentIdentity(item, itemIdx) !== donorAssignmentId);
        const tempArtifacts = buildSimulationArtifactsFromAssignments(tempAssignments);
        const targetMeta = findDirectTargetMetaForTeacher(tempArtifacts, row, teacherId);
        if (!targetMeta) continue;
        suggestions.push({
          teacherId,
          teacherName,
          subject: String(targetMeta.subject || donorSubject || row.subjects?.[0] || "").trim(),
          source: "TRANSFER_SAFE",
          note: `نقل من ${donorDateISO} ${donorPeriod === "PM" ? "الفترة الثانية" : "الفترة الأولى"} (${TASK_TYPE_LABEL_AR[donorTaskType] || donorTaskType})${donorSubject ? ` • ${donorSubject}` : ""}`,
          transferAssignmentId: donorAssignmentId,
          transferFromDateISO: donorDateISO,
          transferFromPeriod: donorPeriod,
          transferFromTaskType: donorTaskType,
          transferFromSubject: donorSubject,
        });
        seenTeacherIds.add(teacherId);
        if (suggestions.length >= 4) break;
      }

      return suggestions;
    }

    function simulateSlotFillability(row: any, slotAssignments: { inv: number; res: number; rev: number; cor: number }, dayHasMasterInvShortage: boolean) {
      const state = cloneSimulationState(baseSimulationState);
      const examsInSlot = (slotExamMap.get(row.key) || []).slice().sort((a: any, b: any) => String(a.subject || "").localeCompare(String(b.subject || "")));
      let additionalInvigilations = 0;

      for (const examDetail of examsInSlot) {
        const examSubject = String(examDetail?.subject || "").trim();
        const examDurationMinutes = Number(examDetail?.durationMinutes ?? 0) || 0;
        const examKey = String(examDetail.examId || `${row.key}__${examSubject}`);
        const committeeMap = invAssignmentsByExamCommittee.get(examKey) || new Map<number, any[]>();

        for (let committeeNo = 1; committeeNo <= Number(examDetail.roomsCount || 0); committeeNo++) {
          const existingAssignments = (committeeMap.get(committeeNo) || []).slice(0, Math.max(0, Number(examDetail.invPerRoom || 0)));
          const existingTeacherIds = new Set(existingAssignments.map((assignment: any) => String(assignment?.teacherId || "").trim()).filter(Boolean));
          const existingCount = existingAssignments.length;
          const invPerRoom = Math.max(1, Number(examDetail.invPerRoom || 0) || 1);

          if (invPerRoom === 1) {
            if (existingCount >= 1) continue;
            const candidates = buildOrderedCandidates(state, row.dateISO, examDetail.subject, examDetail.durationMinutes, existingTeacherIds).filter((candidate) => candidate.ben);
            const picked = candidates.find((candidate) => canAssignUsingState(state, candidate.id, row.dateISO, row.period, "INVIGILATION", examDetail.subject, { durationMinutes: examDetail.durationMinutes }));
            if (!picked) continue;
            commitAssignUsingState(state, picked.id, row.dateISO, row.period, "INVIGILATION", examDetail.subject, { durationMinutes: examDetail.durationMinutes });
            additionalInvigilations += 1;
            continue;
          }

          if (invPerRoom === 2) {
            if (existingCount >= 2) continue;
            const candidates = buildOrderedCandidates(state, row.dateISO, examDetail.subject, examDetail.durationMinutes, existingTeacherIds);

            if (existingCount === 1) {
              const existingBen = existingAssignments.some((assignment: any) => !!assignment?.ben);
              const picked = candidates.find((candidate) => (existingBen || candidate.ben) && canAssignUsingState(state, candidate.id, row.dateISO, row.period, "INVIGILATION", examDetail.subject, { durationMinutes: examDetail.durationMinutes }));
              if (!picked) continue;
              commitAssignUsingState(state, picked.id, row.dateISO, row.period, "INVIGILATION", examSubject, { durationMinutes: examDurationMinutes });
              additionalInvigilations += 1;
              continue;
            }

            let firstPicked: any = null;
            let secondPicked: any = null;
            for (const firstCandidate of candidates) {
              if (!canAssignUsingState(state, firstCandidate.id, row.dateISO, row.period, "INVIGILATION", examDetail.subject, { durationMinutes: examDetail.durationMinutes })) continue;
              for (const secondCandidate of candidates) {
                if (secondCandidate.id === firstCandidate.id) continue;
                if (!firstCandidate.ben && !secondCandidate.ben) continue;
                if (!canAssignUsingState(state, secondCandidate.id, row.dateISO, row.period, "INVIGILATION", examDetail.subject, { durationMinutes: examDetail.durationMinutes })) continue;
                firstPicked = firstCandidate;
                secondPicked = secondCandidate;
                break;
              }
              if (firstPicked && secondPicked) break;
            }

            if (!firstPicked || !secondPicked) continue;
            commitAssignUsingState(state, firstPicked.id, row.dateISO, row.period, "INVIGILATION", examDetail.subject, { durationMinutes: examDetail.durationMinutes });
            commitAssignUsingState(state, secondPicked.id, row.dateISO, row.period, "INVIGILATION", examDetail.subject, { durationMinutes: examDetail.durationMinutes });
            additionalInvigilations += 2;
            continue;
          }

          const missingSpots = Math.max(0, invPerRoom - existingCount);
          for (let i = 0; i < missingSpots; i++) {
            const candidates = buildOrderedCandidates(state, row.dateISO, examDetail.subject, examDetail.durationMinutes, existingTeacherIds);
            const picked = candidates.find((candidate) => canAssignUsingState(state, candidate.id, row.dateISO, row.period, "INVIGILATION", examDetail.subject, { durationMinutes: examDetail.durationMinutes }));
            if (!picked) break;
            commitAssignUsingState(state, picked.id, row.dateISO, row.period, "INVIGILATION", examDetail.subject, { durationMinutes: examDetail.durationMinutes });
            existingTeacherIds.add(picked.id);
            additionalInvigilations += 1;
          }
        }
      }

      let additionalReserve = 0;
      if (!dayHasMasterInvShortage) {
        const reserveSubject = row.subjects?.[0] ? String(row.subjects[0]) : "احتياط";
        const remainingReserveNeed = Math.max(0, row.reserveRequired - slotAssignments.res);
        for (let i = 0; i < remainingReserveNeed; i++) {
          if (!assignReserveUsingState(state, row.dateISO, row.period, reserveSubject)) break;
          additionalReserve += 1;
        }
      }

      return {
        additionalInvigilations,
        additionalReserve,
      };
    }

    const slotBaseRows = Array.from(slotMap.values()).map((row: any) => {
      const reserveRequired = Number(constraints?.reservePerPeriod ?? 0) || 0;
      const slotAssignments = slotAssignmentMap.get(row.key) || { inv: 0, res: 0, rev: 0, cor: 0 };
      return {
        ...row,
        subjects: Array.from(new Set(row.subjects.filter(Boolean))),
        reserveRequired,
        slotAssignments,
        remainingInvigilations: Math.max(0, row.invigilatorsRequired - slotAssignments.inv),
        remainingReserve: Math.max(0, reserveRequired - slotAssignments.res),
      };
    });

    const daysWithMasterInvShortage = new Set(
      slotBaseRows.filter((row: any) => Number(row.remainingInvigilations || 0) > 0).map((row: any) => String(row.dateISO || ""))
    );

    const forecastRowsBase = slotBaseRows
      .map((row: any) => {
        const unavailableCount = latestTeachers.filter((t: any) => isTeacherUnavailable({
          teacherId: String(t?.id || "").trim(),
          dateISO: row.dateISO,
          period: row.period,
          taskType: "INVIGILATION",
          index: unavailabilityIndex,
        })).length;

        const reviewFreeEstimate = latestTeachers.filter((t: any) => teachersWithReviewFree.has(`${String(t?.id || "").trim()}__${row.dateISO}`)).length;
        const correctionFreeEstimate = latestTeachers.filter((t: any) => (teacherCorrectionDays.get(String(t?.id || "").trim()) || new Set<string>()).has(row.dateISO)).length;
        const effectiveReviewImpact = Math.max(reviewFreeEstimate, row.slotAssignments.rev);
        const effectiveCorrectionImpact = Math.max(correctionFreeEstimate, row.slotAssignments.cor);
        const simulation = simulateSlotFillability(row, row.slotAssignments, daysWithMasterInvShortage.has(String(row.dateISO || "")));
        const availableEstimate = Math.max(0, simulation.additionalInvigilations + simulation.additionalReserve);
        const bufferEstimate = availableEstimate - row.remainingInvigilations - row.remainingReserve;
        const hasRealGap = row.remainingInvigilations > 0 || row.remainingReserve > 0;
        const status = hasRealGap && availableEstimate < row.remainingInvigilations + row.remainingReserve
          ? "CRITICAL"
          : hasRealGap && bufferEstimate <= 2
            ? "TIGHT"
            : !hasRealGap
              ? "SAFE"
              : bufferEstimate <= 2
                ? "TIGHT"
                : "SAFE";
        const teacherSuggestions = status !== "SAFE"
          ? buildTeacherSuggestionsForRow(row)
          : [];
        return {
          ...row,
          reviewFreeEstimate: effectiveReviewImpact,
          correctionFreeEstimate: effectiveCorrectionImpact,
          availableEstimate,
          bufferEstimate,
          status,
          teacherSuggestions,
          assignedInvigilations: row.slotAssignments.inv,
          assignedReserve: row.slotAssignments.res,
          assignedReviewFree: row.slotAssignments.rev,
          assignedCorrectionFree: row.slotAssignments.cor,
        };
      })
      .sort((a: any, b: any) => (a.dateISO === b.dateISO ? (a.period === b.period ? 0 : a.period === "AM" ? -1 : 1) : a.dateISO.localeCompare(b.dateISO)));

    const safeForecastRows = forecastRowsBase.filter((row: any) => row.status === "SAFE" && ((row.assignedInvigilations || 0) > 0 || (row.assignedReserve || 0) > 0));
    const forecastRows = forecastRowsBase
      .map((row: any) => {
        if (row.status === "SAFE") return row;
        const transferSuggestions = buildTransferSuggestionsForRow(row, safeForecastRows);
        if (!transferSuggestions.length) return row;
        const mergedSuggestions = dedupeTeacherSuggestions([
          ...(Array.isArray(row.teacherSuggestions) ? row.teacherSuggestions : []),
          ...transferSuggestions,
        ]).slice(0, 10);
        return { ...row, teacherSuggestions: mergedSuggestions };
      })
      .sort((a: any, b: any) => (a.dateISO === b.dateISO ? (a.period === b.period ? 0 : a.period === "AM" ? -1 : 1) : a.dateISO.localeCompare(b.dateISO)));

    const workDates = Array.from(new Set(latestExams.map((e: any) => workDateISO(String(e?.dateISO || e?.date || "").trim())).filter(Boolean))).sort();
    const teachersWith12 = latestTeachers.filter((t: any) => teacherHas12(String(t?.fullName || t?.name || ""))).length;
    const teachersWith13 = latestTeachers.filter((t: any) => teacherHas13(String(t?.fullName || t?.name || ""))).length;
    const teachersWith14 = latestTeachers.filter((t: any) => teacherHas14(String(t?.fullName || t?.name || ""))).length;
    const criticalSlots = forecastRows.filter((row: any) => row.status === "CRITICAL");
    const tightSlots = forecastRows.filter((row: any) => row.status === "TIGHT");

    const readinessCards: ReadinessCardEntry[] = [
      {
        key: 'source',
        title: 'مصدر البيانات',
        value: fsLoaded ? 'Tenant مباشر' : 'AppData',
        sub: fsLoaded ? 'تشغيل على بيانات المدرسة الحالية مباشرةً' : 'يتم استخدام AppData مؤقتًا حتى يكتمل تحميل tenant',
        tone: fsLoaded ? 'good' : 'warn',
      },
      {
        key: 'quality',
        title: 'جودة بيانات الإدخال',
        value: `${teachersWithoutSubjects.length + examsWithoutRooms.length + subjectCoverageIssues.length}`,
        sub: `معلمون بلا مواد: ${teachersWithoutSubjects.length} • امتحانات بلا قاعات: ${examsWithoutRooms.length} • مواد بلا تخصص: ${subjectCoverageIssues.length}`,
        tone: teachersWithoutSubjects.length || examsWithoutRooms.length || subjectCoverageIssues.length ? 'warn' : 'good',
      },
      {
        key: 'calendar',
        title: 'أيام التشغيل الفعلية',
        value: `${workDates.length}`,
        sub: `أيام التصحيح المحتملة: ${correctionDatesSorted.length} • الترحيل من الجمعة/السبت: ${shiftedWeekendExams.length}`,
        tone: 'neutral',
      },
      {
        key: 'pressure',
        title: 'الضغط المتوقع',
        value: `${criticalSlots.length}/${tightSlots.length}`,
        sub: `حرج/ضيق على مستوى الفترات بعد محاكاة الأهلية الفعلية فوق آخر تعديلات الجدول الشامل`,
        tone: criticalSlots.length ? 'danger' : tightSlots.length ? 'warn' : 'good',
      },
      {
        key: 'restrictions',
        title: 'القيود المؤثرة',
        value: `${unavailabilityRules.length}`,
        sub: `عدم توفر: ${unavailabilityRules.length} • معلمو 12: ${teachersWith12} • 13: ${teachersWith13} • 14: ${teachersWith14}`,
        tone: unavailabilityRules.length ? 'warn' : 'neutral',
      },
    ];

    const alerts: string[] = [];
    if (!latestTeachers.length || !latestExams.length) {
      alerts.push('⚠️ لا يمكن التوزيع بدقة قبل اكتمال بيانات الكادر التعليمي وجدول الامتحانات.');
    }
    if (criticalSlots.length) {
      const firstCritical = criticalSlots[0];
      const firstNames = Array.isArray((firstCritical as any)?.teacherSuggestions)
        ? (firstCritical as any).teacherSuggestions.slice(0, 3).map((item: any) => String(item?.teacherName || '').trim()).filter(Boolean)
        : [];
      alerts.push(`⚠️ هناك ${criticalSlots.length} فترة حرجة متوقعة بعد احتساب الأهلية الفعلية. أولها ${firstCritical.dateISO} (${firstCritical.period === 'AM' ? 'الفترة الأولى' : 'الفترة الثانية'}) بهامش ${firstCritical.bufferEstimate}.${firstNames.length ? ` أسماء مقترحة مبدئية: ${firstNames.join(' • ')}` : ''}`);
    }
    const rowsWithMasterCoverage = forecastRows.filter((row: any) => (row.assignedInvigilations || 0) || (row.assignedReserve || 0) || (row.assignedReviewFree || 0) || (row.assignedCorrectionFree || 0));
    if (rowsWithMasterCoverage.length) {
      alerts.push(`ℹ️ تم ربط التقرير تلقائيًا بتعديلات الجدول الشامل الحالية ومحاكاة ما يمكن إسناده فعليًا. الفترات المتأثرة الآن: ${rowsWithMasterCoverage.length}.`);
    }
    if (teachersWithoutSubjects.length) {
      alerts.push(`ℹ️ يوجد ${teachersWithoutSubjects.length} معلم/معلمة بلا مواد مسجلة، مثل: ${teachersWithoutSubjects.slice(0, 3).map((t: any) => String(t?.fullName || t?.name || t?.id || '—')).join(' • ')}${teachersWithoutSubjects.length > 3 ? ' ...' : ''}`);
    }
    if (examsWithoutRooms.length) {
      alerts.push(`ℹ️ يوجد ${examsWithoutRooms.length} امتحان بقاعات = 0، وهذه السجلات لن تنتج مراقبات فعلية حتى يتم تصحيحها.`);
    }
    if (subjectCoverageIssues.length) {
      alerts.push(`ℹ️ مواد بلا تخصص ظاهر في الكادر: ${subjectCoverageIssues.slice(0, 4).join(' • ')}${subjectCoverageIssues.length > 4 ? ' ...' : ''}`);
    }
    if (shiftedWeekendExams.length) {
      alerts.push(`ℹ️ يوجد ${shiftedWeekendExams.length} امتحان/فترة سيتم ترحيلها تلقائيًا إلى يوم الأحد بسبب وقوعها في الجمعة أو السبت.`);
    }
    if (duplicateTeacherIds.length || duplicateTeacherNames.length) {
      alerts.push(`ℹ️ توجد تكرارات محتملة في الكادر: IDs مكررة ${duplicateTeacherIds.length} • أسماء مكررة ${duplicateTeacherNames.length}. يفضل مراجعتها قبل التشغيل النهائي.`);
    }
    if (!alerts.length) {
      alerts.push('✅ البيانات الأساسية تبدو جاهزة، ويمكن تشغيل الخوارزمية مع المحافظة على الشروط الحالية نفسها.');
    }

    return {
      readinessCards,
      alerts,
      forecastRows,
    };
  }, [teachers, exams, constraints, fsLoaded, correctionDatesSorted, tenantId, unavailabilityVersion, masterTableVersion]);

  useEffect(() => {
    saveDistributionConstraints(constraints)
  }, [constraints]);

  useEffect(() => {
    const last = loadRun(tenantId);
    if (last) setRunOut(last);
  }, [tenantId]);

  useEffect(() => {
    setManualSuggestionHistory(loadManualSuggestionHistory(tenantId));
  }, [tenantId]);

  useEffect(() => {
    saveManualSuggestionHistory(tenantId, manualSuggestionHistory);
  }, [tenantId, manualSuggestionHistory]);

  useEffect(() => {
    const refreshFromStoredData = () => {
      setRunOut(loadRun(tenantId));
      setMasterTableVersion((prev) => prev + 1);
      setIsReadinessCleared(false);
    };

    const onRunUpdated = (e: any) => {
      const tid = String(e?.detail?.tenantId || "").trim();
      if (tid && tid !== tenantId) return;
      refreshFromStoredData();
    };

    const onMasterTableUpdated = () => {
      refreshFromStoredData();
    };

    const onStorage = (e: StorageEvent) => {
      if (!e.key || [MASTER_TABLE_KEY, ALL_TABLE_KEY, RESULTS_TABLE_KEY].includes(e.key) || e.key === taskDistributionKey(tenantId)) {
        refreshFromStoredData();
      }
    };

    window.addEventListener(RUN_UPDATED_EVENT, onRunUpdated as any);
    window.addEventListener(MASTER_TABLE_UPDATED_EVENT, onMasterTableUpdated as any);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(RUN_UPDATED_EVENT, onRunUpdated as any);
      window.removeEventListener(MASTER_TABLE_UPDATED_EVENT, onMasterTableUpdated as any);
      window.removeEventListener("storage", onStorage);
    };
  }, [tenantId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTORUN_KEY);
      if (!raw) return;
      const payload = JSON.parse(raw);
      localStorage.removeItem(AUTORUN_KEY);

      const patch = payload?.patch || {};
      const nextConstraints = { ...constraints, ...patch };
      setConstraints(nextConstraints);

      setTimeout(() => {
        run(nextConstraints);
      }, 50);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  function setField(key: string, value: any) {
    setIsReadinessCleared(false);
    setConstraints((prev: any) => ({ ...prev, [key]: value }));
  }

  const derived = useMemo(() => {
    const list = exams || [];
    const uniqueDates = new Set(list.map((e: any) => String(e.dateISO || e.date || "").trim()).filter(Boolean));
    return {
      uniqueDates: uniqueDates.size,
      totalRooms: list.reduce((acc: number, e: any) => acc + (Number(e.roomsCount) || 0), 0),
    };
  }, [exams]);

  const debug: DistributionDebug | any = runOut?.debug;
  const unfilledSlots: UnfilledSlotDebug[] = (debug?.unfilled || []) as any;

  function validate(): string[] {
    const errs: string[] = [];
    // ✅ مهم: زر التشغيل يجب أن يعمل (يعرض رسالة) حتى لو لا توجد بيانات
    if (teachersCount <= 0) errs.push("❌ لا يوجد بيانات في صفحة الكادر التعليمي. الرجاء إدخال الكادر التعليمي أولاً ثم العودة للتوزيع.");
    if (examsCount <= 0) errs.push("❌ لا يوجد بيانات في صفحة جدول الامتحانات. الرجاء إدخال جدول الامتحانات أولاً ثم العودة للتوزيع.");
    if (!hasBasics) errs.push("لا يمكن التشغيل قبل إدخال بيانات الكادر التعليمي  + جدول الامتحانات.");
    if ((constraints.maxTasksPerTeacher ?? 0) <= 0) errs.push("الحد الأقصى للنصاب يجب أن يكون أكبر من 0.");
    if ((constraints.reservePerPeriod ?? 0) < 0) errs.push("الاحتياط لكل فترة لا يمكن أن يكون سالب.");

    if ((constraints.invigilators_5_10 ?? 0) <= 0) errs.push("مراقبين لكل قاعة (صفوف 10) يجب أن يكون أكبر من 0.");
    if ((constraints.invigilators_11 ?? 0) <= 0) errs.push("مراقبين لكل قاعة (صفوف 11) يجب أن يكون أكبر من 0.");
    if ((constraints.invigilators_12 ?? 0) <= 0) errs.push("مراقبين لكل قاعة (أخرى/12) يجب أن يكون أكبر من 0.");

    if ((constraints.correctionDays ?? 1) <= 0) errs.push("عدد أيام التصحيح يجب أن يكون أكبر من 0.");

    if (constraints.allowTwoPeriodsSameDay) {
      const allDates = !!constraints.allowTwoPeriodsSameDayAllDates;
      const dates = Array.isArray(constraints.allowTwoPeriodsSameDayDates) ? constraints.allowTwoPeriodsSameDayDates : [];
      if (!allDates && dates.length === 0) {
        errs.push("السماح بفترتين (تواريخ محددة): اختر تاريخًا واحدًا على الأقل أو فعّل خيار (كل الأيام).");
      }
    }

    return errs;
  }

  async function run(customConstraints?: any) {
    setIsReadinessCleared(false);
    const out = await executeDistribution({
      teachers: teachers as any[],
      exams: exams as any[],
      constraints: {
        ...(customConstraints ? { ...constraints, ...customConstraints } : constraints),
        __tenantId: tenantId,
      },
      validate,
      onValidationErrors: setErrors,
      engine: runTaskDistributionLocal,
      normalize: ensureExplicitTaskTypes,
      rebalanceReserve: (candidate, teachersArg, constraintsArg) =>
        rebalanceReserveToCoverInvigilations(candidate, teachersArg, constraintsArg),
      rebalanceInvigilations: (candidate, teachersArg, constraintsArg) =>
        rebalanceInvigilationsToEqualize(candidate, teachersArg, constraintsArg),
      rebalanceFairness: (candidate, teachersArg, constraintsArg) =>
        rebalanceFairDistribution(candidate, teachersArg, constraintsArg),
    });

    if (!out) return;

    saveRun(tenantId, out);
    try {
    } catch {}

    setRunOut(out);
  }

  function deleteAllDistributionData() {
    clearRun(tenantId);

    // ✅ امسح أي جداول/ملخصات محفوظة (حتى صفحة Settings لا تعرض بيانات قديمة)
    try {
      localStorage.removeItem(MASTER_TABLE_KEY);
      localStorage.removeItem(RESULTS_TABLE_KEY);
      localStorage.removeItem(ALL_TABLE_KEY);
      localStorage.removeItem(manualSuggestionHistoryKey(tenantId));
    } catch {}

    // ✅ أبلغ الصفحات الأخرى (Settings) بالتحديث في نفس التبويب
    try {
      window.dispatchEvent(new Event(RUN_UPDATED_EVENT));
    } catch {}
    // ✅ Audit: حذف بيانات التوزيع
    void writeTenantAudit(tenantId, {
      action: "distribution_clear",
      entity: "task_distribution",
      by: user?.uid || undefined,
      meta: { atISO: new Date().toISOString() },
    }).catch(() => {});

    setRunOut(null);
    setRuntimeError(null);
    setManualSuggestionHistory([]);
    setIsReadinessCleared(true);
  }

  async function handleAddSuggestedTeacherToMasterTable(row: any, suggestion: any) {
    const currentRun = loadRun(tenantId) || runOut;
    if (!currentRun) {
      return { ok: false, message: "لا يوجد تشغيل محفوظ حاليًا لإضافة الاسم إليه." };
    }

    const teacherId = String(suggestion?.teacherId || "").trim();
    const teacherName = String(suggestion?.teacherName || teacherId || "").trim();
    const dateISO = workDateISO(String(row?.dateISO || "").trim());
    const period = periodToAMPM(String(row?.period || "AM"));
    const preferredSubject = String(suggestion?.subject || row?.subjects?.[0] || "").trim();
    const appliedAtISO = new Date().toISOString();
    if (!teacherId || !teacherName || !dateISO) {
      return { ok: false, message: "بيانات الاقتراح غير مكتملة ولا يمكن إضافته الآن." };
    }

    const currentAssignments = Array.isArray(currentRun?.assignments) ? [...currentRun.assignments] : [];
    const remainingInv = Math.max(0, Number(row?.remainingInvigilations || 0));
    const remainingReserve = Math.max(0, Number(row?.remainingReserve || 0));
    const preferredTaskType: "INVIGILATION" | "RESERVE" = remainingInv > 0 ? "INVIGILATION" : (remainingReserve > 0 ? "RESERVE" : "INVIGILATION");
    const normalizedSuggestionSource = normalizeSuggestionSource(suggestion?.source);

    const sameTeacherSameSlot = currentAssignments.find((ass: any) => {
      const assTeacherId = String((ass as any)?.teacherId || "").trim();
      const assDate = workDateISO(String((ass as any)?.dateISO || (ass as any)?.date || "").trim());
      const assPeriod = periodToAMPM(String((ass as any)?.period || "AM"));
      return assTeacherId === teacherId && assDate === dateISO && assPeriod === period;
    });

    if (sameTeacherSameSlot && String((sameTeacherSameSlot as any)?.taskType || "").trim() !== "RESERVE" && preferredTaskType === "INVIGILATION") {
      return { ok: false, message: `المعلم ${teacherName} موجود بالفعل في الجدول الشامل لنفس الفترة، لذلك لا يمكن إضافته مرة أخرى.` };
    }
    if (sameTeacherSameSlot && preferredTaskType === "RESERVE") {
      return { ok: false, message: `المعلم ${teacherName} موجود بالفعل في الجدول الشامل لنفس الفترة.` };
    }

    const matchingExams = (exams || []).filter((exam: any) => {
      const exDate = workDateISO(String(exam?.dateISO || exam?.date || "").trim());
      const exPeriod = periodToAMPM(String(exam?.period || "AM"));
      const exSubject = String(exam?.subject || "").trim();
      return exDate === dateISO && exPeriod === period && (!preferredSubject || exSubject === preferredSubject);
    });
    const selectedExam = matchingExams[0] || (exams || []).find((exam: any) => {
      const exDate = workDateISO(String(exam?.dateISO || exam?.date || "").trim());
      const exPeriod = periodToAMPM(String(exam?.period || "AM"));
      return exDate === dateISO && exPeriod === period;
    });

    let committeeNo: any = undefined;
    let invigilatorIndex: any = undefined;
    let examId: any = selectedExam ? String((selectedExam as any)?.id || "").trim() || undefined : undefined;
    let subject = preferredSubject || String((selectedExam as any)?.subject || row?.subjects?.[0] || "").trim();
    let durationMinutes = Number((selectedExam as any)?.durationMinutes ?? 0) || 0;

    if (preferredTaskType === "INVIGILATION") {
      const roomsCount = Math.max(1, Number((selectedExam as any)?.roomsCount || 1) || 1);
      const invPerRoom = Math.max(1, Number(guessInvigilatorsPerRoom(selectedExam || { subject, roomsCount }, constraints) || 1));
      const invRows = currentAssignments.filter((ass: any) => {
        const assDate = workDateISO(String((ass as any)?.dateISO || (ass as any)?.date || "").trim());
        const assPeriod = periodToAMPM(String((ass as any)?.period || "AM"));
        const assTaskType = String((ass as any)?.taskType || "").trim();
        const assSubject = String((ass as any)?.subject || "").trim();
        const assExamId = String((ass as any)?.examId || "").trim();
        return assDate === dateISO && assPeriod === period && assTaskType === "INVIGILATION" && ((examId && assExamId === examId) || (!examId && assSubject === subject));
      });
      const counts = new Map<number, number>();
      for (let i = 1; i <= roomsCount; i++) counts.set(i, 0);
      for (const ass of invRows) {
        const cNo = Math.max(1, Number((ass as any)?.committeeNo || (ass as any)?.committeeNumber || (ass as any)?.roomNo || (ass as any)?.roomNumber || 1) || 1);
        counts.set(cNo, (counts.get(cNo) || 0) + 1);
      }
      let pickedCommittee = 1;
      let pickedIndex = 1;
      for (let i = 1; i <= roomsCount; i++) {
        const used = counts.get(i) || 0;
        if (used < invPerRoom) {
          pickedCommittee = i;
          pickedIndex = used + 1;
          break;
        }
      }
      committeeNo = pickedCommittee;
      invigilatorIndex = pickedIndex;
    }

    let note = "";

    if (String(suggestion?.source || "") === "TRANSFER_SAFE") {
      const donorAssignmentId = String(suggestion?.transferAssignmentId || "").trim();
      const donorIdx = currentAssignments.findIndex((ass: any, idx: number) => assignmentIdentity(ass, idx) === donorAssignmentId);
      if (donorIdx < 0) {
        return { ok: false, message: "تعذر العثور على التكليف الأصلي المقترح للنقل، ربما تم تغييره بالفعل من صفحة أخرى." };
      }
      if (sameTeacherSameSlot) {
        return { ok: false, message: `المعلم ${teacherName} موجود بالفعل في الجدول الشامل لنفس الفترة، لذلك لا يمكن نقله إليها مرة أخرى.` };
      }
      const previousAssignmentSnapshot = JSON.parse(JSON.stringify(currentAssignments[donorIdx]));
      const donorTaskLabel = TASK_TYPE_LABEL_AR[String(suggestion?.transferFromTaskType || normalizeStoredTaskTypeGlobal((previousAssignmentSnapshot as any)?.taskType || (previousAssignmentSnapshot as any)?.role || ""))] || String(suggestion?.transferFromTaskType || "");
      const donorSlotLabel = `${String(suggestion?.transferFromDateISO || workDateISO(String((previousAssignmentSnapshot as any)?.dateISO || (previousAssignmentSnapshot as any)?.date || "").trim()) || "")} ${String(suggestion?.transferFromPeriod || periodToAMPM(String((previousAssignmentSnapshot as any)?.period || "AM"))) === "PM" ? "الفترة الثانية" : "الفترة الأولى"}`;
      const movedAssignment = {
        ...currentAssignments[donorIdx],
        teacherId,
        teacherName,
        dateISO,
        date: dateISO,
        period,
        taskType: preferredTaskType,
        taskTypeLabelAr: TASK_TYPE_LABEL_AR[preferredTaskType] || preferredTaskType,
        subject,
        examId,
        committeeNo,
        invigilatorIndex,
        durationMinutes,
        manualSuggested: true,
        manualSuggestedAtISO: appliedAtISO,
        manualSuggestedSource: "TRANSFER_SAFE",
        manualSuggestedNote: String(suggestion?.note || "").trim(),
      };
      const nextAssignments = currentAssignments.map((ass: any, idx: number) => idx === donorIdx ? movedAssignment : ass);
      note = `🔁 تم نقل ${teacherName} من ${donorSlotLabel} (${donorTaskLabel}) إلى ${dateISO} ${period === "AM" ? "الفترة الأولى" : "الفترة الثانية"}`;
      const nextRun = ensureExplicitTaskTypes({
        ...currentRun,
        assignments: nextAssignments,
        warnings: [...(Array.isArray(currentRun?.warnings) ? currentRun.warnings : []), note],
      });
      saveRun(tenantId, nextRun as any);
      setRunOut(nextRun);
      setMasterTableVersion((prev) => prev + 1);
      setIsReadinessCleared(false);
      setManualSuggestionHistory((prev) => {
        const entry: ManualSuggestionHistoryEntry = {
          id: `history-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          teacherId,
          teacherName,
          dateISO,
          period,
          subject,
          taskType: preferredTaskType,
          source: "TRANSFER_SAFE",
          note: String(suggestion?.note || "").trim(),
          appliedAtISO,
          actionKind: "MOVE_FROM_SAFE",
          previousAssignmentId: donorAssignmentId,
          previousAssignmentSnapshot,
        };
        return [entry, ...prev].slice(0, 25);
      });
      void writeTenantAudit(tenantId, {
        action: "distribution_manual_suggestion_transfer",
        entity: "task_distribution",
        by: user?.uid || undefined,
        meta: { teacherId, teacherName, fromDateISO: suggestion?.transferFromDateISO || null, fromPeriod: suggestion?.transferFromPeriod || null, dateISO, period, taskType: preferredTaskType, subject },
      }).catch(() => {});
      return { ok: true, message: `${note}. ويمكنك طلب اسم بديل أو التراجع من سجل الإضافات الأخيرة إذا احتجت.` };
    }

    if (sameTeacherSameSlot && String((sameTeacherSameSlot as any)?.taskType || "").trim() === "RESERVE" && preferredTaskType === "INVIGILATION") {
      const previousAssignmentId = String((sameTeacherSameSlot as any)?.__uid || (sameTeacherSameSlot as any)?.id || "").trim();
      const previousAssignmentSnapshot = JSON.parse(JSON.stringify(sameTeacherSameSlot));
      const nextAssignments = currentAssignments.map((ass: any) => {
        if (String((ass as any)?.__uid || (ass as any)?.id || "") !== previousAssignmentId) return ass;
        return {
          ...ass,
          teacherId,
          teacherName,
          dateISO,
          date: dateISO,
          period,
          taskType: "INVIGILATION",
          taskTypeLabelAr: TASK_TYPE_LABEL_AR["INVIGILATION"],
          subject,
          examId,
          committeeNo,
          invigilatorIndex,
          durationMinutes,
          manualSuggested: true,
          manualSuggestedAtISO: appliedAtISO,
          manualSuggestedSource: normalizedSuggestionSource,
          manualSuggestedNote: String(suggestion?.note || "").trim(),
        };
      });
      note = `➕ تم تحويل ${teacherName} من احتياط إلى مراقبة في ${dateISO} ${period === "AM" ? "الفترة الأولى" : "الفترة الثانية"}`;
      const nextRun = ensureExplicitTaskTypes({
        ...currentRun,
        assignments: nextAssignments,
        warnings: [...(Array.isArray(currentRun?.warnings) ? currentRun.warnings : []), note],
      });
      saveRun(tenantId, nextRun as any);
      setRunOut(nextRun);
      setMasterTableVersion((prev) => prev + 1);
      setIsReadinessCleared(false);
      setManualSuggestionHistory((prev) => {
        const entry: ManualSuggestionHistoryEntry = {
          id: `history-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          teacherId,
          teacherName,
          dateISO,
          period,
          subject,
          taskType: "INVIGILATION",
          source: normalizedSuggestionSource === "FREE" ? "RESERVE" : normalizedSuggestionSource,
          note: String(suggestion?.note || "").trim(),
          appliedAtISO,
          actionKind: "CONVERT_RESERVE",
          previousAssignmentId,
          previousAssignmentSnapshot,
        };
        return [entry, ...prev].slice(0, 25);
      });
      void writeTenantAudit(tenantId, {
        action: "distribution_manual_suggestion_apply",
        entity: "task_distribution",
        by: user?.uid || undefined,
        meta: { teacherId, teacherName, dateISO, period, taskType: "INVIGILATION", subject, source: normalizedSuggestionSource === "FREE" ? "RESERVE" : normalizedSuggestionSource },
      }).catch(() => {});
      return { ok: true, message: `${note}. إذا بقي عجز في نفس الفترة ستظهر لك اقتراحات جديدة مباشرة، ويمكنك التراجع من سجل الإضافات الأخيرة.` };
    }

    const now = Date.now();
    const newId = `manual-suggested-${preferredTaskType}-${now}-${Math.random().toString(16).slice(2)}`;
    const newAssignment: any = ensureExplicitTaskTypes({
      assignments: [{
        id: newId,
        __uid: newId,
        teacherId,
        teacherName,
        dateISO,
        date: dateISO,
        period,
        taskType: preferredTaskType,
        taskTypeLabelAr: TASK_TYPE_LABEL_AR[preferredTaskType] || "غير محدد",
        subject,
        examId,
        committeeNo,
        invigilatorIndex,
        durationMinutes,
        manualSuggested: true,
        manualSuggestedAtISO: appliedAtISO,
        manualSuggestedSource: normalizedSuggestionSource,
        manualSuggestedNote: String(suggestion?.note || "").trim(),
      }],
    }).assignments?.[0] || null;
    if (!newAssignment) {
      return { ok: false, message: "تعذر تجهيز السجل الجديد للإضافة." };
    }

    note = `➕ تمت إضافة ${teacherName} إلى الجدول الشامل (${TASK_TYPE_LABEL_AR[preferredTaskType] || preferredTaskType}) في ${dateISO} ${period === "AM" ? "الفترة الأولى" : "الفترة الثانية"}`;
    const nextRun = ensureExplicitTaskTypes({
      ...currentRun,
      assignments: [...currentAssignments, newAssignment],
      warnings: [...(Array.isArray(currentRun?.warnings) ? currentRun.warnings : []), note],
    });
    saveRun(tenantId, nextRun as any);
    setRunOut(nextRun);
    setMasterTableVersion((prev) => prev + 1);
    setIsReadinessCleared(false);
    setManualSuggestionHistory((prev) => {
      const entry: ManualSuggestionHistoryEntry = {
        id: `history-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        teacherId,
        teacherName,
        dateISO,
        period,
        subject,
        taskType: preferredTaskType,
        source: normalizedSuggestionSource,
        note: String(suggestion?.note || "").trim(),
        appliedAtISO,
        actionKind: "ADD",
        assignmentId: newId,
      };
      return [entry, ...prev].slice(0, 25);
    });
    void writeTenantAudit(tenantId, {
      action: "distribution_manual_suggestion_apply",
      entity: "task_distribution",
      by: user?.uid || undefined,
      meta: { teacherId, teacherName, dateISO, period, taskType: preferredTaskType, subject, source: normalizedSuggestionSource },
    }).catch(() => {});
    return { ok: true, message: `${note}. إذا بقي عجز في نفس الفترة يمكنك الضغط على "اقتراح اسم آخر" أو التراجع من سجل الإضافات الأخيرة.` };
  }

  async function handleUndoManualSuggestion(historyId: string) {
    const entry = (manualSuggestionHistory || []).find((item) => String(item?.id || "") === String(historyId || ""));
    if (!entry) {
      return { ok: false, message: "لم يعد سجل هذه الإضافة متوفرًا للتراجع." };
    }

    const currentRun = loadRun(tenantId) || runOut;
    if (!currentRun) {
      return { ok: false, message: "لا يوجد تشغيل محفوظ حاليًا للتراجع عنه." };
    }

    const currentAssignments = Array.isArray(currentRun?.assignments) ? [...currentRun.assignments] : [];
    let nextAssignments = [...currentAssignments];
    let changed = false;

    if (entry.actionKind === "ADD") {
      const before = nextAssignments.length;
      nextAssignments = nextAssignments.filter((ass: any) => {
        const assId = String((ass as any)?.__uid || (ass as any)?.id || "").trim();
        return assId !== String(entry.assignmentId || "").trim();
      });
      changed = nextAssignments.length !== before;
    } else if (entry.actionKind === "CONVERT_RESERVE" || entry.actionKind === "MOVE_FROM_SAFE") {
      const targetId = String(entry.previousAssignmentId || "").trim();
      const idx = nextAssignments.findIndex((ass: any, assIdx: number) => assignmentIdentity(ass, assIdx) === targetId);
      if (idx >= 0 && entry.previousAssignmentSnapshot) {
        nextAssignments[idx] = entry.previousAssignmentSnapshot;
        changed = true;
      }
    }

    if (!changed) {
      return { ok: false, message: `تعذر التراجع عن ${entry.teacherName} لأن السجل الأصلي لم يعد متاحًا كما كان.` };
    }

    const note = `↩️ تم التراجع عن الإضافة اليدوية لـ ${entry.teacherName} في ${entry.dateISO} ${entry.period === "AM" ? "الفترة الأولى" : "الفترة الثانية"}`;
    const nextRun = ensureExplicitTaskTypes({
      ...currentRun,
      assignments: nextAssignments,
      warnings: [...(Array.isArray(currentRun?.warnings) ? currentRun.warnings : []), note],
    });
    saveRun(tenantId, nextRun as any);
    setRunOut(nextRun);
    setMasterTableVersion((prev) => prev + 1);
    setIsReadinessCleared(false);
    setManualSuggestionHistory((prev) => prev.filter((item) => String(item?.id || "") !== String(historyId || "")));
    void writeTenantAudit(tenantId, {
      action: "distribution_manual_suggestion_undo",
      entity: "task_distribution",
      by: user?.uid || undefined,
      meta: { teacherId: entry.teacherId, teacherName: entry.teacherName, dateISO: entry.dateISO, period: entry.period, taskType: entry.taskType, source: entry.source },
    }).catch(() => {});
    return { ok: true, message: `${note}. تم تحديث الجدول الشامل وتقرير الضغط مباشرة.` };
  }

  // ✅ ملخص العدالة: الإجمالي = (مراقبة + احتياط + مراجعة) فقط
  const fairnessRowsBase: FairRow[] = useMemo(() => {
    return buildFairnessRows({
      teachers,
      assignments: (runOut?.assignments || []) as any[],
    }) as FairRow[];
  }, [teachers, runOut]);

  const fairnessRows: FairRow[] = useMemo(() => {
    const q = normalizeSearch(fairnessQuery);
    let arr = [...fairnessRowsBase];

    if (q) {
      arr = arr.filter((r) => {
        const name = normalizeSearch(r.teacherName);
        const id = normalizeSearch(r.teacherId);
        return name.includes(q) || id.includes(q);
      });
    }

    if (sortMode === "TOTAL_DESC")
      arr.sort((a, b) => b.total - a.total || (a.teacherName || "").localeCompare(b.teacherName || "", "ar"));
    if (sortMode === "TOTAL_ASC")
      arr.sort((a, b) => a.total - b.total || (a.teacherName || "").localeCompare(b.teacherName || "", "ar"));
    if (sortMode === "NAME_ASC") arr.sort((a, b) => (a.teacherName || "").localeCompare(b.teacherName || "", "ar"));

    return arr;
  }, [fairnessRowsBase, fairnessQuery, sortMode]);

  // ====== UI constants (كما هي) ======
  const DARK_BLUE = "#0b1b3a";
  const DARK_BLUE_2 = "#0a1630";
  const GOLD_2 = "#c9a227"; // Dark gold
const GOLD_SUB = "rgba(201,162,39,0.75)";
  const LINE = "rgba(201,162,39,.18)";

  const page: React.CSSProperties = {
  color: GOLD_2,

    direction: "rtl",
    minHeight: "100vh",
    background: "#0a1020",
    padding: 18,
    boxSizing: "border-box",
  };

  const header: React.CSSProperties = {
    background: `linear-gradient(135deg, ${DARK_BLUE}, ${DARK_BLUE_2})`,
    borderRadius: 22,
    padding: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    boxShadow: "0 18px 50px rgba(0,0,0,.45)",
    border: `1px solid ${LINE}`,
  };

  const headerLeft: React.CSSProperties = {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  };

  const hBtn: React.CSSProperties = {
    border: `1px solid ${LINE}`,
    background: "rgba(255,255,255,.06)",
    color: GOLD_2,
    borderRadius: 14,
    padding: "10px 14px",
    fontWeight: 950,
    cursor: "pointer",
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
  };

  const btnMini: React.CSSProperties = {
    border: `1px solid ${LINE}`,
    background: "rgba(255,255,255,.10)",
    color: GOLD_2,
    borderRadius: 14,
    padding: "10px 14px",
    fontWeight: 950,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  };

  const titleBox: React.CSSProperties = {
    textAlign: "right",
    display: "flex",
    alignItems: "center",
    gap: 12,
  };

  const brandText: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  };

  const title: React.CSSProperties = {
    fontSize: 22,
    fontWeight: 950,
    margin: 0,
    lineHeight: 1.2,
    color: GOLD_2,
  };

  const subtitle: React.CSSProperties = {
    opacity: 0.9,
    fontWeight: 800,
    marginTop: 2,
    color: "rgba(201,162,39,.85)",
    fontSize: 12,
  };

  const grid3: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(260px, 1fr))",
    gap: 16,
    marginTop: 16,
  };

  const card: React.CSSProperties = {
    background: `linear-gradient(180deg, ${DARK_BLUE}, ${DARK_BLUE_2})`,
    borderRadius: 20,
    padding: 16,
    boxShadow: "0 12px 35px rgba(0,0,0,.45)",
    border: `1px solid ${LINE}`,
    color: GOLD_2,
  };

  const cardHead: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  };

  const cardTitle: React.CSSProperties = { fontWeight: 950, color: GOLD_2, fontSize: 16 };
  const cardSub: React.CSSProperties = {
    marginTop: 4,
    color: "rgba(201,162,39,.80)",
    fontWeight: 800,
    fontSize: 12,
  };

  const row: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 0",
    borderBottom: `1px solid ${LINE}`,
  };

  const label: React.CSSProperties = { color: GOLD_2, fontWeight: 950, fontSize: 13 };
  const note: React.CSSProperties = { color: "rgba(201,162,39,.82)", fontWeight: 800, fontSize: 12, marginTop: 2 };

  const toggle: React.CSSProperties = {
    width: 56,
    height: 30,
    borderRadius: 999,
    background: "rgba(255,255,255,.10)",
    position: "relative",
    border: `1px solid ${LINE}`,
    cursor: "pointer",
    flexShrink: 0,
  };

  const knob: React.CSSProperties = {
    width: 24,
    height: 24,
    borderRadius: 999,
    background: "#fff",
    position: "absolute",
    top: 2.5,
    left: 3,
    boxShadow: "0 6px 14px rgba(0,0,0,.35)",
    transition: "all .15s ease",
  };

  const statusChip: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 950,
    fontSize: 12,
    border: `1px solid ${LINE}`,
    background: "rgba(255,255,255,.06)",
    color: GOLD_2,
    whiteSpace: "nowrap",
  };

  const miniBtn: React.CSSProperties = {
    border: `1px solid ${LINE}`,
    background: "rgba(255,255,255,.06)",
    color: GOLD_2,
    borderRadius: 12,
    padding: "8px 12px",
    fontWeight: 950,
    cursor: "pointer",
  };

  const input: React.CSSProperties = {
    width: 130,
    padding: "10px 12px",
    borderRadius: 14,
    border: `1px solid ${LINE}`,
    outline: "none",
    fontWeight: 950,
    color: GOLD_2,
    background: "rgba(255,255,255,.06)",
    textAlign: "center",
  };

  const bigRun: React.CSSProperties = {
    marginTop: 18,
    width: "100%",
    padding: "18px 18px",
    borderRadius: 18,
    border: `1px solid ${LINE}`,
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 18,
    color: GOLD_2,
    background: `linear-gradient(135deg, ${DARK_BLUE}, ${DARK_BLUE_2})`,
    boxShadow: "0 18px 45px rgba(0,0,0,.45)",
  };

  const errorsBox: React.CSSProperties = { marginTop: 12, display: "grid", gap: 8 };

  const errChip: React.CSSProperties = {
    background: "rgba(239,68,68,.12)",
    border: "1px solid rgba(239,68,68,.28)",
    color: "#fecaca",
    borderRadius: 14,
    padding: "10px 12px",
    fontWeight: 900,
  };

  const warnChip: React.CSSProperties = {
    background: "rgba(245,158,11,.12)",
    border: "1px solid rgba(245,158,11,.28)",
    color: "#fde68a",
    borderRadius: 14,
    padding: "10px 12px",
    fontWeight: 900,
  };

  const fairnessWrap: React.CSSProperties = {
    marginTop: 18,
    background: `linear-gradient(180deg, ${DARK_BLUE}, ${DARK_BLUE_2})`,
    borderRadius: 20,
    overflow: "hidden",
    boxShadow: "0 12px 35px rgba(0,0,0,.45)",
    border: `1px solid ${LINE}`,
    color: GOLD_2,
  };

  const fairnessHeader: React.CSSProperties = {
    padding: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  };

  const fairnessTitle: React.CSSProperties = { fontWeight: 950, fontSize: 18, color: GOLD_2 };
  const fairnessSub: React.CSSProperties = {
    fontWeight: 800,
    fontSize: 12,
    color: "rgba(201,162,39,.82)",
    marginTop: 4,
  };

  const table2: React.CSSProperties = { width: "100%", borderCollapse: "separate", borderSpacing: 0 };

  const th2: React.CSSProperties = {
    position: "sticky",
    top: 0,
    textAlign: "center",
    padding: "14px 10px",
    fontWeight: 950,
    fontSize: 13,
    background: "rgba(255,255,255,.04)",
    color: GOLD_2,
    borderBottom: `1px solid ${LINE}`,
    zIndex: 2,
  };

  const td2: React.CSSProperties = {
    textAlign: "center",
    padding: "16px 10px",
    borderTop: `1px solid ${LINE}`,
    fontWeight: 900,
    color: GOLD_2,
  };

  const totalBadge: React.CSSProperties = {
    display: "inline-flex",
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(201,162,39,.18)",
    border: `1px solid ${LINE}`,
    color: GOLD_2,
    boxShadow: "0 10px 20px rgba(0,0,0,.25)",
  };

  const pill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,.06)",
    border: `1px solid ${LINE}`,
    fontWeight: 900,
    color: GOLD_2,
  };

  const fairnessTableScroll: React.CSSProperties = {
    maxHeight: "55vh",
    overflow: "auto",
    borderTop: `1px solid ${LINE}`,
  };

  const fairnessSearchInput: React.CSSProperties = {
    width: 260,
    padding: "10px 12px",
    borderRadius: 14,
    border: `1px solid ${LINE}`,
    outline: "none",
    fontWeight: 900,
    color: GOLD_2,
    background: "rgba(255,255,255,.06)",
  };

  const grid3Responsive = grid3;

  const boolText = (v: boolean) => (v ? "مفعل" : "غير مفعل");

  const allowTwo = !!constraints.allowTwoPeriodsSameDay;
  const twoAllDates = !!constraints.allowTwoPeriodsSameDayAllDates;
  const twoDates: string[] = Array.isArray(constraints.allowTwoPeriodsSameDayDates)
    ? constraints.allowTwoPeriodsSameDayDates
    : [];

  function toggleDate(dateISO: string) {
    const d = String(dateISO || "").trim();
    if (!d) return;
    const set = new Set(twoDates);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    setField("allowTwoPeriodsSameDayDates", Array.from(set).sort());
  }

  const correctionByTeacher: any[] = Array.isArray(debug?.correctionByTeacher) ? debug.correctionByTeacher : [];

  return (
    <div style={page}>
      <TaskDistributionConstraintsSection
        constraints={constraints}
        allowTwo={allowTwo}
        twoAllDates={twoAllDates}
        twoDates={twoDates}
        correctionDatesSorted={correctionDatesSorted}
        allExamDatesSorted={allExamDatesSorted}
        runOut={runOut}
        hasBasics={hasBasics}
        isRunning={isRunning}
        onRun={run}
        onGoHome={() => nav("/")}
        onGoResults={() => nav("/task-distribution/results")}
        onGoSuggestions={() => nav("/task-distribution/suggestions")}
        onDeleteAllDistributionData={deleteAllDistributionData}
        onReloadConstraints={() => {
          setIsReadinessCleared(false);
          setConstraints(loadDistributionConstraints({ ...DEFAULT_CONSTRAINTS }));
        }}
        onSaveConstraints={() => {
          setIsReadinessCleared(false);
          saveDistributionConstraints(constraints);
        }}
        onClearConstraints={() => {
          clearDistributionConstraints();
          setIsReadinessCleared(false);
          setConstraints({ ...DEFAULT_CONSTRAINTS });
        }}
        setField={setField}
        setConstraints={setConstraints}
        toggleDate={toggleDate}
        boolText={boolText}
        num={num}
        styles={{
          hBtn,
          pageGrid: grid3Responsive,
          card,
          cardHead,
          cardTitle,
          cardSub,
          row,
          label,
          note,
          input,
          statusChip,
          toggle,
          knob,
          btnMini,
          miniBtn,
          pill,
          bigRun,
          line: LINE,
          gold2: GOLD_2,
        }}
      />

      <TaskDistributionRunFeedback
        errors={errors}
        runtimeError={runtimeError}
        warnings={Array.isArray(runOut?.warnings) ? runOut.warnings : []}
        styles={{ errorsBox, errChip, warnChip }}
      />

      <TaskDistributionReadinessSection
        readinessCards={readinessSnapshot.readinessCards}
        alerts={readinessSnapshot.alerts}
        forecastRows={readinessSnapshot.forecastRows}
        latestRunSummary={latestRunSummary}
        isCleared={isReadinessCleared}
        onSuggestionPick={handleAddSuggestedTeacherToMasterTable}
        appliedSuggestionHistory={manualSuggestionHistory}
        onUndoSuggestion={handleUndoManualSuggestion}
        styles={{
          card,
          cardSub,
          gold2: GOLD_2,
          note,
          th2,
          td2,
          line: LINE,
          pill,
        }}
      />

      <TaskDistributionDebugPanel
        debug={debug}
        correctionByTeacher={correctionByTeacher}
        unfilledSlots={unfilledSlots}
        debugOpen={debugOpen}
        setDebugOpen={setDebugOpen}
        reasonLabel={reasonLabel}
        styles={{
          card,
          cardSub,
          gold2: GOLD_2,
          hBtn,
          pill,
          note,
          th2,
          td2,
          line: LINE,
        }}
      />

      {/* جدول العدالة */}
      <FairnessSummarySection
        fairnessRows={fairnessRows}
        teachersCount={teachers.length}
        fairnessQuery={fairnessQuery}
        setFairnessQuery={setFairnessQuery}
        sortMode={sortMode}
        setSortMode={setSortMode}
        navToResults={() => nav("/task-distribution/results")}
        onDeleteAllDistributionData={deleteAllDistributionData}
        styles={{
          fairnessWrap,
          fairnessHeader,
          fairnessTitle,
          fairnessSub,
          hBtn,
          fairnessSearchInput,
          pill,
          fairnessTableScroll,
          table2,
          th2,
          td2,
          totalBadge,
          line: LINE,
          gold2: GOLD_2,
        }}
      />

      <TaskDistributionQuickSummarySection
        teachersCount={teachersCount}
        examsCount={examsCount}
        derived={derived}
        pillStyle={pill}
        cardStyle={card}
      />
    </div>
  );
}
