import { getAccessWorkerUrl } from "../lib/accessWorkerUrl";
// ✅ src/pages/TaskDistributionRun.tsx
// ✅ كود كامل بدون أخطاء JSX/TS
// ✅ تنظيف شامل بعد التعديل:
// - مهام التوزيع الفعلية الآن: مراقبة + احتياط + مراقب دور فقط
// - الإجمالي = المراقبة + الاحتياط + مراقب الدور
// - حذف مسارات المراجعة والتصحيح من قلب التوزيع والجداول النشطة
// - إبقاء توافق قراءة البيانات القديمة عند الحاجة بدون إدخالها في الإجمالي
// - الحفاظ على الشروط النشطة: شرط "بن"، منع معلم المادة من المراقبة أو الاحتياط لنفس مادته، عدم التوفر، والعدالة

import React, {useEffect, useMemo, useRef, useState} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { useAppData } from "../context/AppDataContext";
import { loadTenantArray, loadTenantSettings, saveTenantSettings, replaceTenantArray, subscribeTenantArray, writeTenantAudit } from "../services/tenantData";
import { loadDistributionConstraints, saveDistributionConstraints, clearDistributionConstraints } from "../infra/cache/distributionConstraintsStorage";
import { rebalanceFairDistribution, rebalanceInvigilationsToEqualize, rebalanceReserveToCoverInvigilations } from "../features/task-distribution/services/taskDistributionRebalance";
import { useTaskDistributionRunner } from "../features/task-distribution/hooks/useTaskDistributionRunner";
// Removed conflicting import: local FairnessSummarySection is defined in this file.
import TaskDistributionQuickSummarySection from "../features/task-distribution/components/TaskDistributionQuickSummarySection";
import TaskDistributionConstraintsSection from "../features/task-distribution/components/TaskDistributionConstraintsSection";
import TaskDistributionRunFeedback from "../features/task-distribution/components/TaskDistributionRunFeedback";

import type { DistributionDebug, UnfilledSlotDebug } from "../contracts/taskDistributionContract";
import { saveRun, loadRun, clearRun, RUN_UPDATED_EVENT, MASTER_TABLE_UPDATED_EVENT, taskDistributionKey } from "../utils/taskDistributionStorage";
import {
  buildUnavailabilityIndex,
  isTeacherUnavailable,
  loadUnavailability,
  syncUnavailabilityFromTenant,
  UNAVAIL_UPDATED_EVENT,
} from "../utils/taskDistributionUnavailability";
// 🛡️ SECURITY LAYER: التنظيف الجذري للمدخلات 🛡️
const sanitizeInput = (input: string | null | undefined): string => {
  if (!input) return "";
  let sanitized = String(input)
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  if (/^[=\-+\@]/.test(sanitized)) {
    sanitized = "'" + sanitized;
  }
  return sanitized;
};

// 🛡️ SECURITY LAYER: التحقق الصارم من معرف المدرسة
const validateTenantId = (id: string | null | undefined): string => {
  if (!id) return "default";
  return String(id).replace(/[^a-zA-Z0-9_-]/g, "");
};

const normalizeTaskRun12AccessCode = (value: string) => String(value || "").replace(/\D/g, "").slice(0, 6);
const normalizeTaskRun12AccessEmail = (value: string) => String(value || "").trim().toLowerCase();
const TASKRUN12_ACCESS_LOCK_MINUTES = 5;
const TASKRUN12_ACCESS_WORKER_URL = getAccessWorkerUrl();
const TASKRUN12_ACCESS_SESSION_DURATION_MS = 10 * 60 * 1000;

const getTaskRun12WorkerErrorMessage = (data: any, fallback: string) => {
  const error = String(data?.error || "");
  if (error === "PAGE_NOT_ALLOWED") return "TaskDistributionRun12 is not allowed by the access Worker.";
  if (error === "TOO_MANY_ATTEMPTS") return "Too many failed attempts. Please request a new code later.";
  if (error === "CODE_EXPIRED") return "The access code has expired. Please request a new code.";
  if (error === "INVALID_CODE") return "Invalid access code.";
  if (typeof data?.message === "string" && data.message.trim()) return data.message;
  return fallback;
};

const callTaskRun12AccessWorker = async (
  endpoint: "/api/teachers12/request-code" | "/api/teachers12/verify-code",
  firebaseUser: any,
  payload: Record<string, unknown>,
) => {
  const token = await firebaseUser?.getIdToken?.();

  if (!token) {
    throw new Error("Unable to get the sign-in session. Please sign in again.");
  }

  const response = await fetch(`${TASKRUN12_ACCESS_WORKER_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.ok) {
    const error: any = new Error(
      getTaskRun12WorkerErrorMessage(
        data,
        endpoint.includes("verify-code")
          ? "Invalid or expired access code."
          : "Failed to send the access code email.",
      )
    );
    error.data = data;
    error.status = response.status;
    throw error;
  }

  return data;
};

const getTaskRun12AccessLockFromError = (error: any) => {
  const status = Number(error?.status || 0);
  const message = String(error?.message || "");
  const code = String(error?.data?.error || "");

  if (
    status === 429 ||
    code === "TOO_MANY_ATTEMPTS" ||
    message.includes("Too many") ||
    message.includes("too many")
  ) {
    return Date.now() + TASKRUN12_ACCESS_LOCK_MINUTES * 60 * 1000;
  }

  return 0;
};

function TaskDistributionReadinessSection(props: any) {
  const {
    readinessCards = [],
    alerts = [],
    forecastRows = [],
    latestRunSummary,
    isCleared,
    onSuggestionPick,
    appliedSuggestionHistory = [],
    onUndoSuggestion,
    styles = {},
  } = props || {};

  const card = styles.card || {};
  const cardSub = styles.cardSub || {};
  const th2 = styles.th2 || {};
  const td2 = styles.td2 || {};
  const note = styles.note || {};
  const pill = styles.pill || {};

  const periodLabel = (period: any) => String(period || "AM") === "PM" ? "الثانية" : "الأولى";
  const statusLabel = (status: any) => {
    const s = String(status || "").toUpperCase();
    if (s === "SAFE") return "مريح";
    if (s === "TIGHT") return "ضيق";
    if (s === "CRITICAL") return "حرج";
    return "غير محدد";
  };

  const visibleRows = Array.isArray(forecastRows) ? forecastRows : [];
  const totalRows = visibleRows.length;
  const safeRows = visibleRows.filter((row: any) => String(row?.status || "").toUpperCase() === "SAFE").length;
  const tightRows = visibleRows.filter((row: any) => String(row?.status || "").toUpperCase() === "TIGHT").length;
  const criticalRows = visibleRows.filter((row: any) => String(row?.status || "").toUpperCase() === "CRITICAL").length;

  if (isCleared) {
    return null;
  }

  return (
    <section style={{ ...card, marginTop: 16, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
<div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900 }}>تقدير الضغط المتوقع لكل يوم/فترة</h2>
          <div style={{ ...cardSub, marginTop: 8 }}>
            هذا تقدير تشغيلي قبل التنفيذ يعتمد على القاعات والاحتياط وعدم التوفر وآخر تعديلات الجدول الشامل لنفس الفترات.
          </div>
        </div>
        {latestRunSummary ? (
          <div style={{ ...pill, borderColor: "#2563eb", color: "#111827", fontWeight: 900 }}>
            آخر تشغيل: {latestRunSummary.totalAssignments ?? 0} مهمة
          </div>
        ) : null}
      </div>

      {Array.isArray(readinessCards) && readinessCards.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 14 }}>
          {readinessCards.map((item: any) => (
            <div key={String(item?.key || item?.title || Math.random())} style={{ border: "2px solid #e5e7eb", borderRadius: 16, padding: 12, background: "rgba(255,255,255,.72)" }}>
              <div style={{ fontWeight: 900, fontSize: 14 }}>{item?.title}</div>
              <div style={{ fontWeight: 900, fontSize: 24, marginTop: 6 }}>{item?.value}</div>
              {item?.sub ? <div style={{ ...note, marginTop: 6 }}>{item.sub}</div> : null}
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        <span style={{ ...pill, borderColor: "#2563eb" }}>الكل {totalRows}</span>
        <span style={{ ...pill, borderColor: "#16a34a" }}>المريحة {safeRows}</span>
        <span style={{ ...pill, borderColor: "#f59e0b" }}>الضيقة {tightRows}</span>
        <span style={{ ...pill, borderColor: "#dc2626" }}>الحرجة {criticalRows}</span>
      </div>

      {Array.isArray(alerts) && alerts.length ? (
        <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
          {alerts.slice(0, 5).map((alert: any, index: number) => (
            <div key={index} style={{ ...note, border: "1px solid #f59e0b", borderRadius: 12, padding: 10, background: "rgba(255,251,235,.8)" }}>{alert}</div>
          ))}
        </div>
      ) : null}

      <div style={{ overflowX: "auto", marginTop: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
          <thead>
            <tr>
              <th style={th2}>الحالة</th>
              <th style={th2}>التاريخ</th>
              <th style={th2}>الفترة</th>
              <th style={th2}>القاعات</th>
              <th style={th2}>المواد</th>
              <th style={th2}>المراقبة</th>
              <th style={th2}>الاحتياط</th>
              <th style={th2}>مراقب الدور</th>
              <th style={th2}>المتاح</th>
              <th style={th2}>العجز</th>
              <th style={th2}>الهامش</th>
              <th style={th2}>اقتراحات سد العجز</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length ? visibleRows.map((row: any, index: number) => {
              const suggestions = Array.isArray(row?.teacherSuggestions) ? row.teacherSuggestions : [];
              const assignedDuty = Number(row?.assignedDutyInvigilator ?? row?.assignedDuty ?? row?.slotAssignments?.duty ?? 0) || 0;
              return (
                <tr key={`${String(row?.dateISO || '')}-${String(row?.period || '')}-${index}`}>
                  <td style={td2}>{statusLabel(row?.status)}</td>
                  <td style={td2}>{row?.dateISO || "—"}</td>
                  <td style={td2}>{periodLabel(row?.period)}</td>
                  <td style={td2}>{row?.roomsCount ?? row?.rooms ?? "—"}</td>
                  <td style={td2}>{Array.isArray(row?.subjects) ? row.subjects.join(" • ") : String(row?.subject || "—")}</td>
                  <td style={td2}>{Number(row?.assignedInvigilations || 0)}/{Number(row?.invigilatorsRequired || 0)}</td>
                  <td style={td2}>{Number(row?.assignedReserve || 0)}/{Number(row?.reserveRequired || 0)}</td>
                  <td style={td2}>{assignedDuty}</td>
                  <td style={td2}>{Number(row?.availableEstimate || 0)}</td>
                  <td style={td2}>{Number(row?.remainingInvigilations || 0) + Number(row?.remainingReserve || 0)}</td>
                  <td style={td2}>{Number(row?.bufferEstimate || 0)}</td>
                  <td style={td2}>
                    {suggestions.length ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        {suggestions.slice(0, 3).map((item: any, sIndex: number) => (
                          <button
                            key={`${String(item?.teacherId || '')}-${sIndex}`}
                            type="button"
                            onClick={() => onSuggestionPick?.(row, item)}
                            style={{ border: "1px solid #9333ea", borderRadius: 10, padding: "6px 8px", cursor: "pointer", fontWeight: 800, background: "#fff" }}
                          >
                            {item?.teacherName || "اقتراح"}
                          </button>
                        ))}
                      </div>
                    ) : "لا يحتاج اقتراحات حاليًا"}
                  </td>
                </tr>
              );
            }) : (
              <tr><td style={td2} colSpan={12}>لا توجد بيانات ضغط متاحة حاليًا.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {Array.isArray(appliedSuggestionHistory) && appliedSuggestionHistory.length ? (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>آخر الإضافات اليدوية</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {appliedSuggestionHistory.slice(0, 8).map((item: any) => (
              <button key={String(item?.id || item?.teacherId || Math.random())} type="button" onClick={() => onUndoSuggestion?.(item)} style={{ ...pill, cursor: "pointer" }}>
                تراجع: {item?.teacherName || "—"}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

const AUTORUN_KEY = "exam-manager:task-distribution:autorun:v1";

// ✅ Settings page reads this (fallback) when run is missing
const MASTER_TABLE_KEY = "exam-manager:task-distribution:master-table:v1";
// ✅ (Optional) old keys that may exist in some builds
const RESULTS_TABLE_KEY = "exam-manager:task-distribution:results-table:v1";
const ALL_TABLE_KEY = "exam-manager:task-distribution:all-table:v1";
const MANUAL_SUGGESTION_HISTORY_KEY_PREFIX = "exam-manager:task-distribution:manual-suggestion-history:";

const TASKRUN12_EXAM_CENTER_DATA_KEY = "exam-manager:exam-center-data:v1";
const TASKRUN12_EXAM_CENTER_LOGO_KEY = "exam-manager:exam-center-logo:v1";
const TASKRUN12_CONTROL_HEAD_NAME_KEY = "exam-manager:control-head-name:v1";
const DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID = "diplomaExamCenter";
const TASKRUN12_ROOMS_SUBCOLLECTION = "rooms";
const TASKRUN12_ROOM_BLOCKS_SUBCOLLECTION = "roomBlocks";
const TASKRUN12_LATEST_RUN_SETTINGS_DOC_ID = "latestTaskDistributionRun12";
const TASKRUN12_ASSIGNMENTS_SUBCOLLECTION = "taskDistributionAssignments12";

type TaskRun12ExamCenterData = {
  name?: string;
  examCenterCode?: string;
  centerCode?: string;
  governorate?: string;
  semester?: string;
  phone?: string;
  address?: string;
  controlHeadName?: string;
  academicYear?: string;
  logo?: string;
};

function taskRun12Clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function taskRun12StableSignature(value: any) {
  try {
    const assignments = Array.isArray(value?.assignments) ? value.assignments : [];
    return JSON.stringify({
      runId: String(value?.runId || ""),
      createdAtISO: String(value?.createdAtISO || ""),
      count: assignments.length,
      assignments: assignments.map((assignment: any, index: number) => ({
        id: String(assignment?.__uid || assignment?.id || index),
        teacherId: String(assignment?.teacherId || ""),
        teacherName: String(assignment?.teacherName || ""),
        dateISO: String(assignment?.dateISO || assignment?.date || ""),
        period: String(assignment?.period || ""),
        taskType: String(assignment?.taskType || ""),
        subject: String(assignment?.subject || ""),
        roomNo: String(assignment?.roomNo || assignment?.committeeNo || ""),
      })),
    });
  } catch {
    return "";
  }
}

function taskRun12SafeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function taskRun12AcademicYearFromSystemDate(now = new Date()) {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear} / ${startYear + 1}`;
}

function taskRun12ReadExamCenterData(): TaskRun12ExamCenterData {
  const saved = taskRun12SafeJson<TaskRun12ExamCenterData>(
    localStorage.getItem(TASKRUN12_EXAM_CENTER_DATA_KEY),
    {}
  );

  return {
    ...saved,
    examCenterCode: taskRun12Clean(saved.examCenterCode || saved.centerCode || ""),
    controlHeadName: taskRun12Clean(
      saved.controlHeadName || localStorage.getItem(TASKRUN12_CONTROL_HEAD_NAME_KEY) || ""
    ),
  };
}

function taskRun12ReadOfficialLogo() {
  return taskRun12Clean(localStorage.getItem(TASKRUN12_EXAM_CENTER_LOGO_KEY)) || LOGO_URL;
}

const LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const APP_NAME_AR = "برنامج ادارة الامتحانات الذكي";
const APP_NAME_EN = "Smart Exam Management Program";

function trGlobal(ar: string, en: string) {
  try {
    const lang = String(document?.documentElement?.lang || "").toLowerCase();
    if (lang.startsWith("en")) return en;
  } catch {}
  return ar;
}


function TaskDistributionDebugPanel(props: any) {
  const {
    debug,
    unfilledSlots = [],
    debugOpen,
    setDebugOpen,
    reasonLabel,
    styles = {},
  } = props || {};

  const card = styles.card || {};
  const cardSub = styles.cardSub || {};
  const hBtn = styles.hBtn || {};
  const pill = styles.pill || {};
  const note = styles.note || {};
  const th2 = styles.th2 || {};
  const td2 = styles.td2 || {};

  const summary = debug?.summary || {};
  const safeNumber = (value: any) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const ratio = (assigned: any, required: any) => `${safeNumber(assigned)}/${safeNumber(required)}`;

  const dutyShortage = (Array.isArray(unfilledSlots) ? unfilledSlots : []).filter((slot: any) => {
    const kind = String(slot?.kind || slot?.taskType || "").trim().toUpperCase();
    return kind === "DUTY_INVIGILATOR" || kind.includes("DUTY") || kind.includes("مراقب دور") || kind.includes("مراقب الدور");
  });

  const activeUnfilled = (Array.isArray(unfilledSlots) ? unfilledSlots : []).filter((slot: any) => {
    const kind = String(slot?.kind || slot?.taskType || "").trim().toUpperCase();
    return kind !== "REVIEW_FREE" && kind !== "CORRECTION_FREE" && !kind.includes("REVIEW") && !kind.includes("CORRECTION");
  });

  if (!debugOpen) {
    return (
      <section style={{ ...card, marginTop: 16 }}>
        <button type="button" style={hBtn} onClick={() => setDebugOpen?.(true)}>
          {trGlobal("إظهار لوحة التشخيص", "Show Debug Panel")}
        </button>
      </section>
    );
  }

  return (
    <section style={{ ...card, marginTop: 16, borderColor: "#f97316" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 950, color: "#111827" }}>
            {trGlobal("لوحة التشخيص (Debug)", "Debug Panel")}
          </h2>
          <div style={{ ...cardSub, marginTop: 8, color: "#111827", fontWeight: 900 }}>
            {trGlobal(
              "تُظهر المطلوب/الموزع لمهام المراقبة والاحتياط ومراقب الدور فقط.",
              "Shows required/assigned for invigilation, reserve, and duty invigilator only."
            )}
          </div>
        </div>
        <button type="button" style={{ ...hBtn, borderColor: "#2563eb" }} onClick={() => setDebugOpen?.(false)}>
          {trGlobal("إخفاء", "Hide")}
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
        <span style={{ ...pill, borderColor: "#16a34a", color: "#111827" }}>
          {trGlobal("مراقبة", "Invigilation")}: {ratio(summary.invAssigned, summary.invRequired)}
        </span>
        <span style={{ ...pill, borderColor: "#2563eb", color: "#111827" }}>
          {trGlobal("احتياط", "Reserve")}: {ratio(summary.reserveAssigned, summary.reserveRequired)}
        </span>
        <span style={{ ...pill, borderColor: "#dc2626", color: "#111827" }}>
          {trGlobal("مراقب الدور", "Duty Invigilator")}: {ratio(summary.dutyAssigned, summary.dutyRequired)}
        </span>
        <span style={{ ...pill, borderColor: "#9333ea", color: "#111827" }}>
          {trGlobal("معلمين", "Teachers")}: {safeNumber(summary.teachersTotal)}
        </span>
        <span style={{ ...pill, borderColor: "#ca8a04", color: "#111827" }}>
          {trGlobal("امتحانات", "Exams")}: {safeNumber(summary.examsTotal)}
        </span>
      </div>

      <div style={{ marginTop: 18, border: "3px solid #dc2626", borderRadius: 0, padding: 14, background: "rgba(255,255,255,.65)" }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 950, color: "#111827" }}>
          {trGlobal("📌 مراقب الدور", "📌 Duty Invigilator")}
        </h3>
        <div style={{ ...note, marginTop: 8, color: "#111827", fontWeight: 900 }}>
          {dutyShortage.length
            ? trGlobal("يوجد عجز في توزيع مراقب الدور لبعض الأيام.", "There is a duty-invigilator shortage on some days.")
            : trGlobal("لا يوجد عجز في مراقب الدور حسب القيود الحالية.", "No duty-invigilator shortage under the current constraints.")}
        </div>
      </div>

      {activeUnfilled.length ? (
        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr>
                <th style={th2}>{trGlobal("نوع العجز", "Shortage Type")}</th>
                <th style={th2}>{trGlobal("التاريخ", "Date")}</th>
                <th style={th2}>{trGlobal("الفترة", "Period")}</th>
                <th style={th2}>{trGlobal("المادة", "Subject")}</th>
                <th style={th2}>{trGlobal("المطلوب", "Required")}</th>
                <th style={th2}>{trGlobal("الموزع", "Assigned")}</th>
                <th style={th2}>{trGlobal("السبب", "Reason")}</th>
              </tr>
            </thead>
            <tbody>
              {activeUnfilled.map((slot: any, index: number) => {
                const reasonCode = slot?.reasons?.[0]?.code || slot?.reason || "NO_TEACHERS";
                const kind = String(slot?.kind || slot?.taskType || "").trim().toUpperCase();
                const label = kind === "DUTY_INVIGILATOR"
                  ? trGlobal("مراقب الدور", "Duty Invigilator")
                  : kind === "RESERVE"
                    ? trGlobal("احتياط", "Reserve")
                    : kind === "INVIGILATION"
                      ? trGlobal("مراقبة", "Invigilation")
                      : String(slot?.kind || "—");

                return (
                  <tr key={`${String(slot?.dateISO || "")}-${String(slot?.period || "")}-${index}`}>
                    <td style={td2}>{label}</td>
                    <td style={td2}>{slot?.dateISO || "—"}</td>
                    <td style={td2}>{String(slot?.period || "—")}</td>
                    <td style={td2}>{slot?.subject || "—"}</td>
                    <td style={td2}>{safeNumber(slot?.required)}</td>
                    <td style={td2}>{safeNumber(slot?.assigned)}</td>
                    <td style={td2}>{typeof reasonLabel === "function" ? reasonLabel(reasonCode) : reasonCode}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ ...note, marginTop: 14, color: "#111827", fontWeight: 900 }}>
          ✅ {trGlobal("لا توجد سلوتات ناقصة — التوزيع مكتمل حسب القيود الحالية.", "No missing slots — distribution is complete under current constraints.")}
        </div>
      )}
    </section>
  );
}


const SUBJECT_TRANSLATIONS: Record<string, string> = {
  "التربية الإسلامية ": "Islamic Education ",
  "اللغة العربية ": "Arabic Language ",
  "اللغة الإنجليزية ": "English Language ",
  "الرياضيات الأساسية ": "Basic Mathematics ",
  "الرياضيات المتقدمة ": "Advanced Mathematics ",
  "الدراسات الاجتماعية ": "Social Studies ",
  "التاريخ والحضارة الإسلامية ": "Islamic History and Civilization ",
  "الجغرافيا الاقتصادية ": "Human Geography ",
  "هذا وطني ": "This Is My Nation ",
  "الفيزياء ": "Physics ",
  "الكيمياء ": "Chemistry ",
  "الأحياء ": "Biology ",
  "الرياضة المدرسية ": "School Sports ",
  "الفنون التشكيلية ": "Visual Arts ",
  "المهارات الموسيقية ": "Music Skills ",
  "مواد التخصصات الهندسية والصناعية ": "Engineering and Industrial Specializations ",
  "مهارات اللغة الإنجليزية ": "English Skills ",
   "تقنية المعلومات ": "Information Technology ",
  "السفر و السياحة و إدارة الأعمال و تقنية المعلومات ": "Travel, Tourism, Business Administration and IT 12",
   "اللغة الألمانية ": "German Language ",
  "اللغة الصينية ": "Chinese Language ",
   "العلوم البيئية ": "Environmental Science ",
};

function translateSubjectValue(value: string, lang: "ar" | "en") {
  const raw = String(value || "").trim();
  if (!raw || lang === "ar") return raw;
  return SUBJECT_TRANSLATIONS[raw] || raw;
}

function translateSubjectsList(values: string[], lang: "ar" | "en") {
  return (Array.isArray(values) ? values : []).map((value) => translateSubjectValue(String(value || ""), lang));
}


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

function persistDistributionState(tenantId: string, out: any) {
  const safeTenantId = validateTenantId(tenantId);
  const safeRun = ensureExplicitTaskTypes(out || {});
  const assignments = Array.isArray(safeRun?.assignments) ? safeRun.assignments : [];
  
  // توليد معرّفات فريدة (UIDs) للبيانات لتكون جاهزة للقراءة في صفحة النتائج
  const runId = String(safeRun?.runId || `run_${Date.now()}`);
  const assignmentsWithIds = assignments.map((a: any, i: number) => ({
    ...a,
    __uid: a.__uid || a.id || `${runId}_${i}`
  }));

  const payload = {
    rows: assignmentsWithIds,
    data: assignmentsWithIds,
    assignments: assignmentsWithIds,
    meta: {
      runId: runId,
      updatedAtISO: new Date().toISOString(),
      source: "run",
    },
  };

  saveRun(safeTenantId, { ...safeRun, assignments: assignmentsWithIds, runId });
  
  try {
    localStorage.setItem(MASTER_TABLE_KEY, JSON.stringify(payload));
    localStorage.setItem(RESULTS_TABLE_KEY, JSON.stringify(payload));
    localStorage.setItem(ALL_TABLE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error("Storage error:", e);
  }

  // ✅ الخطوة الجوهرية: إرسال إشارة (Event) لصفحة النتائج
  try {
    window.dispatchEvent(new CustomEvent(RUN_UPDATED_EVENT, { 
      detail: { tenantId: safeTenantId, source: "task-distribution-run12", timestamp: Date.now() } 
    }));
    window.dispatchEvent(new CustomEvent(MASTER_TABLE_UPDATED_EVENT, { 
      detail: { tenantId: safeTenantId, source: "task-distribution-run12", timestamp: Date.now() } 
    }));
  } catch (e) {
    console.error("Event dispatch error:", e);
  }
}

function taskRun12RemoveUndefinedForFirestore<T = any>(value: T): T {
  if (value === undefined) return null as T;
  if (value === null) return value;
  if (value instanceof Date) return value as T;
  if (Array.isArray(value)) {
    return value.map((item) => taskRun12RemoveUndefinedForFirestore(item)) as T;
  }
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [key, item] of Object.entries(value as Record<string, any>)) {
      if (item === undefined) continue;
      out[key] = taskRun12RemoveUndefinedForFirestore(item);
    }
    return out as T;
  }
  return value;
}

function taskRun12FirestoreWriteOptions(by?: string, audit?: any) {
  const safeBy = String(by || "").trim();
  return taskRun12RemoveUndefinedForFirestore({
    ...(safeBy ? { by: safeBy } : {}),
    ...(audit ? { audit } : {}),
  });
}

async function persistDistributionStateToCloud(tenantId: string, out: any, by?: string) {
  const safeRun = taskRun12RemoveUndefinedForFirestore(ensureExplicitTaskTypes(out || {}));
  const assignments = Array.isArray((safeRun as any)?.assignments) ? (safeRun as any).assignments : [];
  const runId = String((safeRun as any)?.runId || `run_${Date.now()}`).trim();
  const createdAtISO = String((safeRun as any)?.createdAtISO || new Date().toISOString()).trim();
  const nowISO = new Date().toISOString();

  const normalizedAssignments = assignments.map((assignment: any, index: number) => {
    const id = String(assignment?.__uid || assignment?.id || `${runId}_${index + 1}`).trim();
    return taskRun12RemoveUndefinedForFirestore({
      ...assignment,
      id,
      __uid: String(assignment?.__uid || id),
      runId,
      runCreatedAtISO: createdAtISO,
      updatedAtISO: nowISO,
    });
  });

  const auditPayload = {
    entity: TASKRUN12_ASSIGNMENTS_SUBCOLLECTION,
    meta: {
      summary: "saved task distribution assignments",
      runId,
      count: normalizedAssignments.length,
    },
  };

  await replaceTenantArray(
    tenantId,
    TASKRUN12_ASSIGNMENTS_SUBCOLLECTION,
    taskRun12RemoveUndefinedForFirestore(normalizedAssignments) as any[],
    taskRun12FirestoreWriteOptions(by, auditPayload) as any
  );

  await saveTenantSettings(
    tenantId,
    TASKRUN12_LATEST_RUN_SETTINGS_DOC_ID,
    taskRun12RemoveUndefinedForFirestore({
      runId,
      createdAtISO,
      updatedAtISO: nowISO,
      assignmentsCount: normalizedAssignments.length,
      assignments: normalizedAssignments,
      warnings: Array.isArray((safeRun as any)?.warnings) ? (safeRun as any).warnings : [],
      debug: (safeRun as any)?.debug || null,
      summary: (safeRun as any)?.debug?.summary || null,
      run: {
        ...(safeRun as any),
        assignments: normalizedAssignments,
      },
    }),
    taskRun12FirestoreWriteOptions(by) as any
  );
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
  maxTasksPerTeacher: 10, // ✅ نصاب (مراقبة + احتياط + مراقب دور) فقط
  reservePerPeriod: 2,
  dutyInvigilatorsPerDay: 2, // ✅ ثابت: يبدأ مراقب الدور من 2 ولا يُعدّل يدويًا
  invigilators_5_10: 2,
  invigilators_11: 2,
  invigilators_12: 2,

  smartBySpecialty: true,

  // ✅ عدد محاولات التحسين لاختيار أقل عجز (كل تشغيل سيختلف عن السابق)
  optimizationAttempts: 5,
};

type FairRow = {
  teacherId: string;
  teacherName: string;
  inv: number;
  res: number;
  duty: number;
  rev?: number;
  cor?: number;
  total: number; // ✅ مجموع (مراقبة + احتياط + مراقب دور) فقط
};

type ReadinessTone = "good" | "warn" | "danger" | "neutral";

type SuggestionSource = "RESERVE" | "FREE" | "MAX_TASK_RELAX" | "SPECIALTY_RELAX" | "TRANSFER_SAFE";

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
    case "SPECIALTY_RELAX":
    case "TRANSFER_SAFE":
      return source as SuggestionSource;
    default:
      return "FREE";
  }
}

function normalizeStoredTaskTypeGlobal(rawTaskType: any): string {
  const raw = String(rawTaskType || "").trim().toUpperCase();
  if (raw === "INVIGILATION" || raw === "RESERVE" || raw === "DUTY_INVIGILATOR") return raw;
  if (raw === "REVIEW_FREE" || raw === "CORRECTION_FREE") return "LEGACY_REMOVED_TASK";
  if (raw.includes("مراقبة")) return "INVIGILATION";
  if (raw.includes("احتياط")) return "RESERVE";
  if (raw.includes("مراقب دور") || raw.includes("مراقب الدور")) return "DUTY_INVIGILATOR";
  if (raw.includes("مراجعة") || raw.includes("تصحيح")) return "LEGACY_REMOVED_TASK";
  return raw;
}


// ✅ مهام تدخل في نصاب maxTasksPerTeacher
function isQuotaTaskType(t: any) {
  return t === "INVIGILATION" || t === "RESERVE" || t === "DUTY_INVIGILATOR";
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
    case "SPECIALTY_BLOCK":
      return "ممنوع لمعلم المادة";
    case "DUTY_ALREADY_ASSIGNED":
      return "تم توزيعه مراقب دور سابقًا";
    case "ARABIC_ONCE":
      return "اللغة العربية (مرة واحدة)";
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
  DUTY_INVIGILATOR: "مراقب دور",
  LEGACY_REMOVED_TASK: "مهمة قديمة محذوفة",
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

function periodToAMPM(_p: string): "AM" | "PM" {
  // ✅ بعد التعديل: الصفحة تعمل على فترة واحدة فقط، وهي الفترة الأولى.
  return "AM";
}

function guessInvigilatorsPerRoom(_exam: any, _constraints: any): number {
  // ✅ ثابت حسب الطلب: عدد المراقبين لكل قاعة = 2 ولا يمكن تغييره من الواجهة أو التخزين.
  return 2;
}

function taskRun12CountByCommitteeRanges(committeesCount: any): number {
  const count = Math.max(0, Number(committeesCount ?? 0) || 0);
  if (count <= 0) return 0;
  // ✅ قاعدة النطاقات الموحدة لمراقب الدور والاحتياط:
  // من 1 إلى 12 لجنة = 2.
  // من 13 إلى 18 لجنة = 3.
  // من 19 إلى 24 لجنة = 4.
  // بعد ذلك: كل نطاق 6 لجان إضافية يزيد العدد 1.
  if (count <= 12) return 2;
  return 2 + Math.ceil((count - 12) / 6);
}

function taskRun12DutyInvigilatorsByCommittees(committeesCount: any): number {
  return taskRun12CountByCommitteeRanges(committeesCount);
}

function taskRun12ReserveByCommittees(committeesCount: any): number {
  return taskRun12CountByCommitteeRanges(committeesCount);
}

function taskRun12DutyRuleLabel(committeesCount: any) {
  const count = Math.max(0, Number(committeesCount ?? 0) || 0);
  const duty = taskRun12DutyInvigilatorsByCommittees(count);
  return `${count} لجنة = ${duty} مراقب دور`;
}

function taskRun12ReserveRuleLabel(committeesCount: any) {
  const count = Math.max(0, Number(committeesCount ?? 0) || 0);
  const reserve = taskRun12ReserveByCommittees(count);
  return `${count} لجنة = ${reserve} احتياط`;
}

function slotKey(dateISO: string, period: "AM" | "PM") {
  return `${dateISO}__${period}`;
}

/* ============================================================
   ✅ التاريخ التشغيلي بدون ترحيل الجمعة/السبت
============================================================ */
function workDateISO(dateISO: string) {
  // ✅ تم إلغاء قيد ترحيل الجمعة/السبت إلى الأحد حسب الطلب.
  // تبقى الدالة لتوحيد قراءة التاريخ فقط بدون تغيير اليوم.
  const d = String(dateISO || "").trim();
  return d;
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

/* ============================================================
   ✅ خريطة مواد اليوم لاستخدام مراقب الدور ومنع معلم المادة
============================================================ */
function buildDaySubjectsMap(exams: any[]) {
  const map = new Map<string, Set<string>>(); // dateISO -> subjects set
  for (const e of exams || []) {
    const raw = String(e.dateISO || e.date || "").trim();
    const dateISO = workDateISO(raw); // ✅ بدون ترحيل عطلة
    const subject = String(e.subject || "").trim();
    if (!dateISO || !subject) continue;
    if (!map.has(dateISO)) map.set(dateISO, new Set<string>());
    map.get(dateISO)!.add(subject);
  }
  return map;
}

function taskRun12SubjectsForSpecialtyCheck(subject: string, meta?: any): string[] {
  const metaSubjects = Array.isArray(meta?.slotSubjects)
    ? meta.slotSubjects
    : Array.isArray(meta?.daySubjects)
      ? meta.daySubjects
      : [];
  const values = metaSubjects.length ? metaSubjects : [subject];
  return Array.from(
    new Set(
      values
        .map((value: any) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function taskRun12TeacherMatchesBlockedSubject(subjectsMap: Map<string, Set<string>>, teacherId: string, subjects: string[]) {
  const teacherSubjects = subjectsMap.get(String(teacherId || "").trim());
  if (!teacherSubjects || !Array.isArray(subjects) || !subjects.length) return false;
  const normalizedTeacherSubjects = new Set(Array.from(teacherSubjects).map((item) => normSubj(String(item || ""))).filter(Boolean));
  return subjects.some((subject) => {
    const normalizedSubject = normSubj(String(subject || ""));
    return !!normalizedSubject && normalizedTeacherSubjects.has(normalizedSubject);
  });
}

/* ============================================================
   ✅ منطق التوزيع المحلي
============================================================ */
function runTaskDistributionLocal(params: { teachers: any[]; exams: any[]; constraints: any; runSeed?: number }) {
  const { teachers, exams, constraints, runSeed } = params;

  // ✅ تحميل عدم التوفر وبناء Index سريع للبحث
  const unavailIndex = buildUnavailabilityIndex(loadUnavailability(String(constraints?.__tenantId || "").trim() || undefined));

  const teacherSubjectsAll = buildTeacherSubjectsMapAll(teachers);
  const teacherSubjectsNormalized = new Map<string, Set<string>>();
  for (const [teacherId, subjects] of teacherSubjectsAll.entries()) {
    teacherSubjectsNormalized.set(teacherId, new Set(Array.from(subjects).map((x) => normSubj(String(x || ""))).filter(Boolean)));
  }
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
  const dutyCounts = new Map<string, number>();
  const dutyAssignedTeachers = new Set<string>();
  const occupiedSlots = new Map<string, Set<string>>(); // teacherId -> set(date__period)
  const dayHasAnyPeriod = new Map<string, Set<string>>(); // teacherId -> set(dateISO)
  const teacherDayFirstInvDuration = new Map<string, number>(); // key teacherId__dateISO -> durationMinutes of first invigilation

  teacherIds.forEach((id) => {
    quotaTotals.set(id, 0);
    invCounts.set(id, 0);
    dutyCounts.set(id, 0);
    occupiedSlots.set(id, new Set<string>());
    dayHasAnyPeriod.set(id, new Set<string>());
  });

  let rr = 0;
  const assignments: any[] = [];
  const unfilled: any[] = [];

  let invRequired = 0;
  let invAssigned = 0;
  let reserveRequired = 0;
  let reserveAssigned = 0;
  let dutyRequired = 0;
  let dutyAssigned = 0;
  const _uniqueWorkExamDates0 = Array.from(
    new Set(
      (exams || [])
        .map((e: any) => workDateISO(String(e.dateISO || e.date || "").trim()))
        .filter(Boolean)
    )
  ).sort();

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
        taskType === "DUTY_INVIGILATOR") &&
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

    // ✅ مراقب دور: مرة واحدة فقط طوال فترة الامتحانات، ولا يكون من معلمي مواد امتحانات هذا اليوم
    if (taskType === "DUTY_INVIGILATOR") {
      if (dutyAssignedTeachers.has(teacherId)) {
        return { ok: false, reason: "DUTY_ALREADY_ASSIGNED" as const };
      }

      const daySubjects = Array.isArray(meta?.daySubjects)
        ? meta.daySubjects.map((x: any) => String(x || "").trim()).filter(Boolean)
        : Array.from(daySubjectsMap.get(dateISO) || []);

      const normalizedTeacherSubjects = teacherSubjectsNormalized.get(teacherId) || new Set<string>();
      const matchesDaySubject = daySubjects.some((subject: any) => normalizedTeacherSubjects.has(normSubj(String(subject || ""))));
      if (matchesDaySubject) {
        return { ok: false, reason: "SPECIALTY_BLOCK" as const };
      }

      const hasAnyTaskSameDay = (dayHasAnyPeriod.get(teacherId) || new Set<string>()).has(dateISO);
      if (hasAnyTaskSameDay) {
        return { ok: false, reason: "PERIOD_CONFLICT" as const };
      }
    }

    // ✅ منع معلم المادة من المراقبة أو الاحتياط لنفس المادة/مواد نفس الفترة
    if (smartBySpecialty && (taskType === "INVIGILATION" || taskType === "RESERVE")) {
      const blockedSubjects = taskRun12SubjectsForSpecialtyCheck(subject, meta);
      if (taskRun12TeacherMatchesBlockedSubject(teacherSubjectsAll, teacherId, blockedSubjects)) {
        return { ok: false, reason: "SPECIALTY_BLOCK" as const };
      }
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
    if (meta?.fullDay) {
      // ✅ فترة واحدة فقط: مراقب الدور يغطي الفترة الأولى فقط.
      occupiedSlots.get(teacherId)!.add(slotKey(dateISO, "AM"));
    } else {
      occupiedSlots.get(teacherId)!.add(sk);
    }
    dayHasAnyPeriod.get(teacherId)!.add(dateISO);

    if (isQuotaTaskType(taskType)) {
      quotaTotals.set(teacherId, (quotaTotals.get(teacherId) || 0) + 1);
    }

    if (taskType === "DUTY_INVIGILATOR") {
      dutyAssignedTeachers.add(teacherId);
      dutyCounts.set(teacherId, (dutyCounts.get(teacherId) || 0) + 1);
    }

    if (taskType === "INVIGILATION") {
      invCounts.set(teacherId, (invCounts.get(teacherId) || 0) + 1);

      const dur = Number(meta?.durationMinutes ?? 0) || 0;

      const key = `${teacherId}__${dateISO}`;
      if (!teacherDayFirstInvDuration.has(key)) {
        if (dur > 0) teacherDayFirstInvDuration.set(key, dur);
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

      const baseCandidates = teacherIds
        .map((id, idx) => {
          const slotsSet = occupiedSlots.get(id) || new Set<string>();
          const hasSameDay =
            (dayHasAnyPeriod.get(id) || new Set<string>()).has(dateISO) ||
            Array.from(slotsSet).some((x) => x.startsWith(`${dateISO}__`));
          const firstDur = teacherDayFirstInvDuration.get(`${id}__${dateISO}`) ?? 999999;

          return {
            id,
            idx,
            inv: invCounts.get(id) || 0,
            quota: quotaTotals.get(id) || 0,
            rrDist: (idx - start + n) % n,
            hasSameDay,
            firstDur,
          };
        })
        .sort(
          (a, b) =>
            a.inv - b.inv ||
            a.quota - b.quota ||
            a.firstDur - b.firstDur ||
            a.rrDist - b.rrDist
        );

      for (const c of baseCandidates) {
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
  // ✅ الاحتياط يوزع تلقائيًا حسب عدد لجان اليوم، مستقلًا عن عجز المراقبة
  // ============================================================

  const examSlots = new Map<string, { dateISO: string; period: "AM" | "PM"; subjects: string[]; examIds: string[] }>();
  for (const exam of sortedExams) {
    const dateISO = workDateISO(String(exam.dateISO || exam.date || "").trim()); // ✅ بدون ترحيل عطلة
    const period = periodToAMPM(String(exam.period || ""));
    const subject = String(exam.subject || "").trim();
    if (!dateISO || !subject) continue;

    const sk = slotKey(dateISO, period);
    if (!examSlots.has(sk)) examSlots.set(sk, { dateISO, period, subjects: [], examIds: [] });
    examSlots.get(sk)!.subjects.push(subject);
    examSlots.get(sk)!.examIds.push(String(exam.id || ""));
  }

  const daysWithInvShortage = new Set<string>();

  // ----- PASS 1: INVIGILATION (مع شرط "بن" + منع معلم المادة + عدم التوفر + العدالة) -----
  for (const exam of sortedExams) {
    const rawDate = String(exam.dateISO || exam.date || "").trim();
    const dateISO = workDateISO(rawDate); // ✅ بدون ترحيل الجمعة/السبت إلى الأحد
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
            };
          })
          .filter((c) => c.ben) // ✅ شرط: لازم "بن"
          .sort(
            (a, b) =>
              a.inv - b.inv ||
              a.quota - b.quota ||
                a.firstDur - b.firstDur ||
              a.rrDist - b.rrDist
          );

        let ok = false;
        for (const c of candidatesAll) {
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
              };
            })
            .sort(
              (a, b) =>
                a.inv - b.inv ||
                a.quota - b.quota ||
                    a.firstDur - b.firstDur ||
                a.rrDist - b.rrDist
            );

        let firstPicked: any = null;
        let secondPicked: any = null;

        const cand1 = buildCandidates();

        for (const c1 of cand1) {
          const chk1 = canAssign(c1.id, dateISO, period, "INVIGILATION", subject, {
            durationMinutes: Number(exam.durationMinutes ?? 0) || 0,
          });
          if (!chk1.ok) continue;

          const cand2 = buildCandidates().filter((c2) => c2.id !== c1.id);

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

  const committeesCountByDay = new Map<string, number>();
  for (const exam of sortedExams) {
    const dateISO = workDateISO(String(exam.dateISO || exam.date || "").trim());
    if (!dateISO) continue;
    committeesCountByDay.set(dateISO, (committeesCountByDay.get(dateISO) || 0) + (Number(exam.roomsCount || 0) || 0));
  }

  // ----- PASS 2: RESERVE / الاحتياط حسب عدد لجان كل يوم امتحان -----
  for (const slot of Array.from(examSlots.values()).sort((a, b) => {
    if (a.dateISO !== b.dateISO) return a.dateISO.localeCompare(b.dateISO);
    return a.period === b.period ? 0 : a.period === "AM" ? -1 : 1;
  })) {
    const { dateISO, period, subjects, examIds } = slot;

    const dayCommitteesCount = committeesCountByDay.get(dateISO) || 0;
    const reserveForDay = taskRun12ReserveByCommittees(dayCommitteesCount);
    if (reserveForDay <= 0) continue;

    reserveRequired += reserveForDay;

    let assignedResHere = 0;
    for (let i = 0; i < reserveForDay; i++) {
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
          required: reserveForDay,
          assigned: assignedResHere,
          reasons: [{ code: res.reason || "NO_TEACHERS", count: 1 }],
        });
        break;
      }
    }
  }

  // ----- PASS 3: DUTY_INVIGILATOR / مراقب دور حسب عدد لجان كل يوم امتحان -----
  for (const dateISO of _uniqueWorkExamDates0) {
    const daySubjects = Array.from(daySubjectsMap.get(dateISO) || []).sort();
    if (!daySubjects.length) continue;

    const dayCommitteesCount = committeesCountByDay.get(dateISO) || 0;
    const dutyInvigilatorsForDay = taskRun12DutyInvigilatorsByCommittees(dayCommitteesCount);
    if (dutyInvigilatorsForDay <= 0) continue;

    dutyRequired += dutyInvigilatorsForDay;

    for (let i = 0; i < dutyInvigilatorsForDay; i += 1) {
      const candidates = teacherIds
        .map((id, idx) => ({
          id, idx,
          duty: dutyCounts.get(id) || 0,
          quota: quotaTotals.get(id) || 0,
          inv: invCounts.get(id) || 0,
          rrDist: (idx - rr + teacherIds.length) % teacherIds.length,
        }))
        .sort((a, b) => a.duty - b.duty || a.quota - b.quota || a.inv - b.inv || a.rrDist - b.rrDist);

      let picked: any = null;
      for (const c of candidates) {
        const chk = canAssign(c.id, dateISO, "AM", "DUTY_INVIGILATOR", daySubjects.join("، "), {
          fullDay: true, coversPeriods: ["AM"], daySubjects, dayCommitteesCount,
        });
        if (!chk.ok) continue;
        picked = c;
        break;
      }

      if (!picked) {
        unfilled.push({
          kind: "DUTY_INVIGILATOR", dateISO, period: "AM", subject: daySubjects.join("، "),
          required: dutyInvigilatorsForDay, assigned: i, reasons: [{ code: "NO_TEACHERS", count: 1 }],
        });
        break;
      }

      commitAssign(picked.id, dateISO, "AM", "DUTY_INVIGILATOR", daySubjects.join("، "), {
        fullDay: true, coversPeriods: ["AM"], daySubjects, dayCommitteesCount, dutyInvigilatorIndex: i + 1,
      });
      dutyAssigned += 1;
      rr = (picked.idx + 1) % teacherIds.length;
    }
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
        dutyRequired,
        dutyAssigned,
        teachersTotal: teachers.length,
        examsTotal: exams.length,
        runSeed: _seed,
      },
      unfilled,
    },
  };

  return out;
}


function FairnessSummarySection({ fairnessRows, teachersCount, fairnessQuery, setFairnessQuery, sortMode, setSortMode, navToResults, onDeleteAllDistributionData, styles }: any) {
  const rows: FairRow[] = Array.isArray(fairnessRows) ? fairnessRows : [];
  const st = styles || {};
  const totalInv = rows.reduce((acc, row) => acc + Number(row?.inv || 0), 0);
  const totalRes = rows.reduce((acc, row) => acc + Number(row?.res || 0), 0);
  const totalDuty = rows.reduce((acc, row) => acc + Number(row?.duty || 0), 0);
  const totalAll = rows.reduce((acc, row) => acc + Number(row?.total || 0), 0);
  return (
    <section style={st.fairnessWrap}>
      <div style={st.fairnessHeader}>
        <div>
          <div style={st.fairnessTitle}>{trGlobal("جدول العدالة", "Fairness table")}</div>
          <div style={st.fairnessSub}>{trGlobal("الإجمالي = المراقبة + الاحتياط + مراقب الدور فقط. تم حذف المراجعة والتصحيح من الجداول.", "Total = invigilation + reserve + duty invigilator only. Review and correction were removed from the tables.")}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" style={st.hBtn} onClick={navToResults}>{trGlobal("الجدول الشامل", "Master table")}</button>
          <button type="button" style={st.hBtn} onClick={onDeleteAllDistributionData}>{trGlobal("حذف بيانات التوزيع", "Delete distribution data")}</button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, marginBottom: 12 }}>
        <span style={st.pill}>{trGlobal("عدد المعلمين", "Teachers")}: {teachersCount ?? rows.length}</span>
        <span style={st.pill}>{trGlobal("المراقبة", "Invigilation")}: {totalInv}</span>
        <span style={st.pill}>{trGlobal("الاحتياط", "Reserve")}: {totalRes}</span>
        <span style={st.pill}>{trGlobal("مراقب الدور", "Duty invigilator")}: {totalDuty}</span>
        <span style={st.totalBadge}>{trGlobal("الإجمالي", "Total")}: {totalAll}</span>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <input value={String(fairnessQuery || "")} onChange={(event) => setFairnessQuery(event.target.value)} placeholder={trGlobal("بحث باسم المعلم أو رقمه", "Search by teacher name or ID")} style={st.fairnessSearchInput} />
        <select value={String(sortMode || "TOTAL_DESC")} onChange={(event) => setSortMode(event.target.value)} style={{ ...st.fairnessSearchInput, maxWidth: 220 }}>
          <option value="TOTAL_DESC">{trGlobal("الأعلى إجماليًا", "Highest total")}</option>
          <option value="TOTAL_ASC">{trGlobal("الأقل إجماليًا", "Lowest total")}</option>
          <option value="NAME_ASC">{trGlobal("الاسم تصاعديًا", "Name A-Z")}</option>
        </select>
      </div>
      <div style={st.fairnessTableScroll}>
        <table style={st.table2}>
          <thead><tr>
            <th style={st.th2}>{trGlobal("المعلم", "Teacher")}</th>
            <th style={st.th2}>{trGlobal("مراقبة", "Invigilation")}</th>
            <th style={st.th2}>{trGlobal("احتياط", "Reserve")}</th>
            <th style={st.th2}>{trGlobal("مراقب الدور", "Duty")}</th>
            <th style={st.th2}>{trGlobal("الإجمالي", "Total")}</th>
          </tr></thead>
          <tbody>
            {rows.length ? rows.map((row) => (
              <tr key={String(row.teacherId || row.teacherName)}>
                <td style={st.td2}>{row.teacherName || row.teacherId}</td>
                <td style={st.td2}>{Number(row.inv || 0)}</td>
                <td style={st.td2}>{Number(row.res || 0)}</td>
                <td style={st.td2}>{Number(row.duty || 0)}</td>
                <td style={st.td2}><strong>{Number(row.total || 0)}</strong></td>
              </tr>
            )) : <tr><td style={st.td2} colSpan={5}>{trGlobal("لا توجد بيانات عدالة للعرض.", "No fairness data to display.")}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function TaskDistributionRun() {
const nav = useNavigate();
  const { user, profile, effectiveTenantId } = useAuth() as any;
  const { teachers: appTeachers, exams: appExams } = useAppData();

  const tenantId = String(effectiveTenantId || profile?.tenantId || user?.tenantId || "").trim() || "default";
  const currentUserId = String(user?.email || user?.uid || "").trim();
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const taskRun12AccessExpectedEmail = normalizeTaskRun12AccessEmail(user?.email || profile?.email || "");
  const taskRun12AccessSessionKey = `yr:taskrun12:email-code-session:${tenantId}:${taskRun12AccessExpectedEmail || "unknown"}`;
  const taskRun12AccessLockStorageKey = `yr:taskrun12:email-code-lock:${tenantId}:${taskRun12AccessExpectedEmail || "unknown"}`;

  const [taskRun12AccessVerified, setTaskRun12AccessVerified] = useState(false);
  const [taskRun12AccessEmail, setTaskRun12AccessEmail] = useState("");
  const [taskRun12AccessEmailConfirmed, setTaskRun12AccessEmailConfirmed] = useState(false);
  const [taskRun12AccessCodeSent, setTaskRun12AccessCodeSent] = useState(false);
  const [taskRun12AccessCode, setTaskRun12AccessCode] = useState("");
  const [taskRun12AccessBusy, setTaskRun12AccessBusy] = useState(false);
  const [taskRun12AccessMessage, setTaskRun12AccessMessage] = useState("");
  const [taskRun12AccessError, setTaskRun12AccessError] = useState("");
  const [taskRun12AccessLockedUntilMs, setTaskRun12AccessLockedUntilMs] = useState(0);
  const [taskRun12AccessLockRemainingSeconds, setTaskRun12AccessLockRemainingSeconds] = useState(0);

  useEffect(() => {
    let hasValidAccessSession = false;

    if (typeof window !== "undefined") {
      try {
        const rawAccessSession = window.localStorage.getItem(taskRun12AccessSessionKey) || "";
        const nowMs = Date.now();

        if (rawAccessSession) {
          const parsed = JSON.parse(rawAccessSession);
          const expiresAt = Number(parsed?.expiresAt || 0);
          if (Number.isFinite(expiresAt) && expiresAt > nowMs) {
            hasValidAccessSession = true;
          } else {
            window.localStorage.removeItem(taskRun12AccessSessionKey);
          }
        }
      } catch {
        window.localStorage.removeItem(taskRun12AccessSessionKey);
      }
    }

    setTaskRun12AccessVerified(hasValidAccessSession);
    setTaskRun12AccessEmail("");
    setTaskRun12AccessEmailConfirmed(false);
    setTaskRun12AccessCodeSent(false);
    setTaskRun12AccessCode("");
    setTaskRun12AccessBusy(false);
    setTaskRun12AccessMessage("");
    setTaskRun12AccessError("");

    if (typeof window === "undefined") return;

    const storedLockMs = Number(window.localStorage.getItem(taskRun12AccessLockStorageKey) || "0");
    if (Number.isFinite(storedLockMs) && storedLockMs > Date.now()) {
      setTaskRun12AccessLockedUntilMs(storedLockMs);
      setTaskRun12AccessLockRemainingSeconds(Math.ceil((storedLockMs - Date.now()) / 1000));
    } else {
      window.localStorage.removeItem(taskRun12AccessLockStorageKey);
      setTaskRun12AccessLockedUntilMs(0);
      setTaskRun12AccessLockRemainingSeconds(0);
    }
  }, [taskRun12AccessLockStorageKey, taskRun12AccessSessionKey]);

  useEffect(() => {
    if (!taskRun12AccessLockedUntilMs) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((taskRun12AccessLockedUntilMs - Date.now()) / 1000));
      setTaskRun12AccessLockRemainingSeconds(remaining);

      if (remaining <= 0) {
        setTaskRun12AccessLockedUntilMs(0);
        setTaskRun12AccessError("");
        setTaskRun12AccessMessage("");
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(taskRun12AccessLockStorageKey);
        }
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [taskRun12AccessLockedUntilMs, taskRun12AccessLockStorageKey]);

  const applyTaskRun12AccessLock = (lockedUntilMs: number) => {
    setTaskRun12AccessLockedUntilMs(lockedUntilMs);
    setTaskRun12AccessLockRemainingSeconds(Math.ceil((lockedUntilMs - Date.now()) / 1000));
    setTaskRun12AccessEmailConfirmed(false);
    setTaskRun12AccessCodeSent(false);
    setTaskRun12AccessCode("");
    setTaskRun12AccessBusy(false);
    setTaskRun12AccessMessage("");
    setTaskRun12AccessError(
      tr(
        "تم تجاوز عدد المحاولات. انتظر انتهاء العد التنازلي قبل المحاولة مرة أخرى.",
        "Too many attempts. Wait for the countdown before trying again."
      )
    );

    if (typeof window !== "undefined") {
      window.localStorage.setItem(taskRun12AccessLockStorageKey, String(lockedUntilMs));
    }
  };

  const sendTaskRun12AccessCode = async () => {
    if (taskRun12AccessLockedUntilMs && taskRun12AccessLockedUntilMs > Date.now()) {
      setTaskRun12AccessError(
        tr(
          `انتظر ${taskRun12AccessLockRemainingSeconds} ثانية قبل المحاولة مرة أخرى.`,
          `Wait ${taskRun12AccessLockRemainingSeconds} seconds before trying again.`
        )
      );
      return;
    }

    const enteredEmail = normalizeTaskRun12AccessEmail(taskRun12AccessEmail);
    const expectedEmail = taskRun12AccessExpectedEmail;

    if (!expectedEmail) {
      setTaskRun12AccessError(tr("تعذر تحديد بريد الحساب الحالي. الرجاء تسجيل الدخول مرة أخرى.", "The current account email is unavailable. Please sign in again."));
      return;
    }

    if (!enteredEmail || enteredEmail !== expectedEmail) {
      setTaskRun12AccessEmailConfirmed(false);
      setTaskRun12AccessCodeSent(false);
      setTaskRun12AccessCode("");
      setTaskRun12AccessError(tr("البريد الإلكتروني غير مطابق للحساب الحالي. لن يتم إرسال رمز الدخول.", "The email does not match the current account. The access code will not be sent."));
      return;
    }

    setTaskRun12AccessBusy(true);
    setTaskRun12AccessEmailConfirmed(true);
    setTaskRun12AccessError("");
    setTaskRun12AccessMessage("");

    try {
      const data = await callTaskRun12AccessWorker("/api/teachers12/request-code", user, {
        tenantId,
        page: "TaskDistributionRun12",
        to: expectedEmail,
      });

      if (typeof window !== "undefined") window.localStorage.removeItem(taskRun12AccessLockStorageKey);
      setTaskRun12AccessLockedUntilMs(0);
      setTaskRun12AccessLockRemainingSeconds(0);
      setTaskRun12AccessCodeSent(true);
      setTaskRun12AccessMessage(data?.message || tr("تم إرسال رمز الدخول إلى البريد الإلكتروني المسجل للحساب.", "The access code was sent to the account email."));
    } catch (error: any) {
      console.error("sendTaskRun12AccessCode failed:", error);
      const lockedUntilMs = getTaskRun12AccessLockFromError(error);
      if (lockedUntilMs) applyTaskRun12AccessLock(lockedUntilMs);
      else setTaskRun12AccessError(error?.message || tr("تعذر إرسال رمز الدخول إلى البريد الإلكتروني.", "Failed to send the access code."));
    } finally {
      setTaskRun12AccessBusy(false);
    }
  };

  const verifyTaskRun12AccessCode = async () => {
    if (taskRun12AccessLockedUntilMs && taskRun12AccessLockedUntilMs > Date.now()) {
      setTaskRun12AccessError(tr("تم تجاوز عدد محاولات التحقق. انتظر انتهاء العد التنازلي.", "Too many failed verification attempts. Wait until the countdown ends."));
      return;
    }

    const code = normalizeTaskRun12AccessCode(taskRun12AccessCode);
    if (code.length !== 6) {
      setTaskRun12AccessError(tr("أدخل رمزًا مكونًا من 6 أرقام.", "Enter a 6-digit code."));
      return;
    }

    setTaskRun12AccessBusy(true);
    setTaskRun12AccessError("");
    setTaskRun12AccessMessage("");

    try {
      const expectedEmail = taskRun12AccessExpectedEmail;
      if (!expectedEmail) {
        throw new Error("The account email is unavailable.");
      }

      await callTaskRun12AccessWorker("/api/teachers12/verify-code", user, {
        tenantId,
        page: "TaskDistributionRun12",
        to: expectedEmail,
        code,
      });

      if (typeof window !== "undefined") window.localStorage.removeItem(taskRun12AccessLockStorageKey);
      setTaskRun12AccessLockedUntilMs(0);
      setTaskRun12AccessLockRemainingSeconds(0);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          taskRun12AccessSessionKey,
          JSON.stringify({ expiresAt: Date.now() + TASKRUN12_ACCESS_SESSION_DURATION_MS })
        );
      }

      setTaskRun12AccessVerified(true);
      setTaskRun12AccessCode("");
      setTaskRun12AccessMessage(tr("تم التحقق بنجاح.", "Verified successfully."));
    } catch (error: any) {
      console.error("verifyTaskRun12AccessCode failed:", error);
      const lockedUntilMs = getTaskRun12AccessLockFromError(error);
      if (lockedUntilMs) applyTaskRun12AccessLock(lockedUntilMs);
      else setTaskRun12AccessError(error?.message || tr("رمز الدخول غير صحيح أو انتهت صلاحيته.", "The code is invalid or expired."));
    } finally {
      setTaskRun12AccessBusy(false);
    }
  };

  const translateSubject = (value: string) => translateSubjectValue(value, lang);
  const APP_NAME = lang === "ar" ? APP_NAME_AR : APP_NAME_EN;

  const [officialCenterData, setOfficialCenterData] = useState<TaskRun12ExamCenterData>(() =>
    taskRun12ReadExamCenterData()
  );
  const [officialLogo, setOfficialLogo] = useState<string>(() => taskRun12ReadOfficialLogo());

  useEffect(() => {
    const refreshOfficialHeader = () => {
      setOfficialCenterData(taskRun12ReadExamCenterData());
      setOfficialLogo(taskRun12ReadOfficialLogo());
    };

    async function refreshOfficialHeaderFromCloud() {
      try {
        const cloud = await loadTenantSettings<TaskRun12ExamCenterData>(
          tenantId,
          DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID,
          {}
        );

        const hasCloudData = Boolean(
          cloud?.name ||
            cloud?.examCenterCode ||
            cloud?.centerCode ||
            cloud?.governorate ||
            cloud?.semester ||
            cloud?.phone ||
            cloud?.address ||
            cloud?.controlHeadName ||
            cloud?.academicYear ||
            cloud?.logo
        );

        if (!hasCloudData) return;

        const nextData: TaskRun12ExamCenterData = {
          ...cloud,
          examCenterCode: taskRun12Clean(cloud.examCenterCode || cloud.centerCode || ""),
          centerCode: taskRun12Clean(cloud.examCenterCode || cloud.centerCode || ""),
          controlHeadName: taskRun12Clean(cloud.controlHeadName || ""),
        };

        const nextLogo = taskRun12Clean(cloud.logo || taskRun12ReadOfficialLogo()) || LOGO_URL;

        setOfficialCenterData(nextData);
        setOfficialLogo(nextLogo);

        localStorage.setItem(TASKRUN12_EXAM_CENTER_DATA_KEY, JSON.stringify(nextData));
        localStorage.setItem(TASKRUN12_EXAM_CENTER_LOGO_KEY, nextLogo);
        localStorage.setItem(TASKRUN12_CONTROL_HEAD_NAME_KEY, nextData.controlHeadName || "");
      } catch {
        refreshOfficialHeader();
      }
    }

    refreshOfficialHeader();
    void refreshOfficialHeaderFromCloud();

    window.addEventListener("storage", refreshOfficialHeader);
    window.addEventListener("exam-manager:changed", refreshOfficialHeader);
    window.addEventListener("exam-manager:control-head-changed", refreshOfficialHeader);

    return () => {
      window.removeEventListener("storage", refreshOfficialHeader);
      window.removeEventListener("exam-manager:changed", refreshOfficialHeader);
      window.removeEventListener("exam-manager:control-head-changed", refreshOfficialHeader);
    };
  }, [tenantId]);


  const [fsTeachers, setFsTeachers] = useState<any[]>([]);
  const [fsExams, setFsExams] = useState<any[]>([]);
  const [fsRooms, setFsRooms] = useState<any[]>([]);
  const [fsRoomBlocks, setFsRoomBlocks] = useState<any[]>([]);
  const [fsLoading, setFsLoading] = useState(false);
  const [fsLoaded, setFsLoaded] = useState(false);
  const [cloudSyncMessage, setCloudSyncMessage] = useState("");
  const [cloudSyncError, setCloudSyncError] = useState("");
  const taskRun12CloudLoadedRef = useRef(false);
  const taskRun12OperationalSubscribeRef = useRef(false);
  const taskRun12LastRunLoadedRef = useRef(false);
  const taskRun12LastRunSignatureRef = useRef("");

  // ✅ تحميل البيانات التشغيلية من Firestore داخل tenant حتى تعمل من أي جهاز.
  useEffect(() => {
    let mounted = true;
    let unsubscribeTeachers: (() => void) | undefined;
    let unsubscribeExams: (() => void) | undefined;
    let unsubscribeRooms: (() => void) | undefined;
    let unsubscribeRoomBlocks: (() => void) | undefined;

    async function loadCloudOperationalData() {
      if (!tenantId) return;
      if (taskRun12OperationalSubscribeRef.current) return;
      taskRun12OperationalSubscribeRef.current = true;
      setFsLoading(true);
      setFsLoaded(false);
      setCloudSyncError("");
      setCloudSyncMessage(lang === "ar" ? "جاري تحميل بيانات التشغيل من السحابة..." : "Loading operational data from cloud...");

      try {
        const [t, e, r, rb] = await Promise.all([
          loadTenantArray<any>(tenantId, "teachers"),
          loadTenantArray<any>(tenantId, "exams"),
          loadTenantArray<any>(tenantId, TASKRUN12_ROOMS_SUBCOLLECTION),
          loadTenantArray<any>(tenantId, TASKRUN12_ROOM_BLOCKS_SUBCOLLECTION),
        ]);

        if (!mounted) return;

        setFsTeachers(Array.isArray(t) ? t : []);
        setFsExams(Array.isArray(e) ? e : []);
        setFsRooms(Array.isArray(r) ? r : []);
        setFsRoomBlocks(Array.isArray(rb) ? rb : []);
        setCloudSyncMessage(lang === "ar" ? "تم تحميل بيانات التشغيل من السحابة." : "Operational data loaded from cloud.");

        unsubscribeTeachers = subscribeTenantArray<any>(
          tenantId,
          "teachers",
          (items) => setFsTeachers(Array.isArray(items) ? items : [])
        );

        unsubscribeExams = subscribeTenantArray<any>(
          tenantId,
          "exams",
          (items) => setFsExams(Array.isArray(items) ? items : [])
        );

        unsubscribeRooms = subscribeTenantArray<any>(
          tenantId,
          TASKRUN12_ROOMS_SUBCOLLECTION,
          (items) => setFsRooms(Array.isArray(items) ? items : [])
        );

        unsubscribeRoomBlocks = subscribeTenantArray<any>(
          tenantId,
          TASKRUN12_ROOM_BLOCKS_SUBCOLLECTION,
          (items) => setFsRoomBlocks(Array.isArray(items) ? items : [])
        );
      } catch {
        if (!mounted) return;
        setFsTeachers([]);
        setFsExams([]);
        setFsRooms([]);
        setFsRoomBlocks([]);
        setCloudSyncError(lang === "ar" ? "تعذر تحميل بيانات التشغيل من السحابة." : "Could not load operational data from cloud.");
      } finally {
        if (mounted) setFsLoading(false);
        if (mounted) setFsLoaded(true);
      }
    }

    void loadCloudOperationalData();

    return () => {
      mounted = false;
      taskRun12OperationalSubscribeRef.current = false;
      unsubscribeTeachers?.();
      unsubscribeExams?.();
      unsubscribeRooms?.();
      unsubscribeRoomBlocks?.();
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

    return { ...merged, invigilators_12: 2, dutyInvigilatorsPerDay: 2, reservePerPeriod: 2 };
  });


  // ✅ تثبيت حقول عدد المراقبين ومراقب الدور والاحتياط على 2 في الواجهة؛ الحساب الفعلي للاحتياط/مراقب الدور تلقائي حسب عدد اللجان.
  useEffect(() => {
    if (
      Number(constraints?.invigilators_12) === 2 &&
      Number(constraints?.dutyInvigilatorsPerDay) === 2 &&
      Number(constraints?.reservePerPeriod) === 2
    ) return;
    setConstraints((prev: any) => ({ ...(prev || {}), invigilators_12: 2, dutyInvigilatorsPerDay: 2, reservePerPeriod: 2 }));
  }, [constraints?.invigilators_12, constraints?.dutyInvigilatorsPerDay, constraints?.reservePerPeriod]);

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
  const [showDeleteDistributionConfirm, setShowDeleteDistributionConfirm] = useState(false);
  const [deletePhoneAuthStep, setDeletePhoneAuthStep] = useState(false);
  const [deletePhoneInput, setDeletePhoneInput] = useState("");
  const [deletePhoneError, setDeletePhoneError] = useState("");
  const [showRunPhoneAuthConfirm, setShowRunPhoneAuthConfirm] = useState(false);
  const [runPhoneInput, setRunPhoneInput] = useState("");
  const [runPhoneError, setRunPhoneError] = useState("");
  const [pendingRunConstraints, setPendingRunConstraints] = useState<any | null>(null);


  // ✅ حذف نهائي لصف "عدد أيام التصحيح" فقط من كرت القيود والأنصبة.
  // الصف مرسوم داخل TaskDistributionConstraintsSection، لذلك نعزله بعد الرسم بدون حذف الكرت.
  useEffect(() => {
    const normalizeText = (value: string) =>
      String(value || "")
        .replace(/\s+/g, " ")
        .trim();

    const isCorrectionDaysText = (value: string) => {
      const text = normalizeText(value);
      const lower = text.toLowerCase();
      return (
        text.includes("عدد أيام التصحيح") ||
        text.includes("عدد ايام التصحيح") ||
        lower.includes("correction days count") ||
        lower.includes("number of correction days")
      );
    };

    const controlSelector = "input, select, textarea";
    const stopTexts = [
      "الحد الأقصى للنصاب",
      "احتياط لليوم",
      "عدد محاولات التحسين",
      "Maximum quota",
      "Reserve per day",
      "Optimization attempts",
      "القيود والأنصبة",
      "Constraints",
    ];

    const pickCorrectionDaysRow = (seed: HTMLElement): HTMLElement | null => {
      let current: HTMLElement | null = seed;
      let best: HTMLElement | null = null;

      for (let depth = 0; current && depth < 10; depth += 1) {
        const text = normalizeText(current.textContent || "");
        const controls = current.querySelectorAll(controlSelector).length;

        if (isCorrectionDaysText(text) && controls >= 1 && controls <= 2 && text.length <= 260) {
          best = current;
        }

        const parent = current.parentElement as HTMLElement | null;
        if (!parent) break;

        const parentText = normalizeText(parent.textContent || "");
        const parentControls = parent.querySelectorAll(controlSelector).length;

        if (parentControls > 2 || parentText.length > 420) break;
        if (stopTexts.some((item) => parentText.includes(item)) && !isCorrectionDaysText(parentText)) break;

        current = parent;
      }

      return best;
    };

    const removeCorrectionDaysRow = () => {
      const root = document.querySelector(".taskRunCardsLightBlackScope") || document.body;
      if (!root) return;

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      let node = walker.nextNode();

      while (node) {
        if (isCorrectionDaysText(node.textContent || "")) textNodes.push(node as Text);
        node = walker.nextNode();
      }

      textNodes.forEach((textNode) => {
        const parent = textNode.parentElement as HTMLElement | null;
        if (!parent) return;
        if (parent.closest("[data-task-run-removed-correction-days-row='true']")) return;

        const target = pickCorrectionDaysRow(parent);
        if (!target) return;

        target.dataset.taskRunRemovedCorrectionDaysRow = "true";
        target.style.display = "none";
      });
    };

    removeCorrectionDaysRow();

    // ✅ منع تجميد الصفحة: لا نستخدم MutationObserver لأنه يراقب كل تغييرات DOM وقد يدخل في حلقة ثقيلة.
    // نعيد المحاولة مرات قليلة فقط بعد اكتمال رسم الكروت.
    const timers = [50, 200, 600].map((delay) => window.setTimeout(removeCorrectionDaysRow, delay));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);


  // ✅ تعديل كرت إعدادات القاعات فقط:
  // حذف صفوف 10 وصفوف 11 من الواجهة، وتغيير عنوان الصف المتبقي من "أخرى/12" إلى "الصف الثاني عشر".
  // هذا الكود لا يقترب من حاوية الكرت نفسها؛ يتعامل فقط مع صف الحقل الصغير الذي يحتوي على label + input.
  useEffect(() => {
    const normalizeText = (value: string) => String(value || "").replace(/\s+/g, " ").trim();

    const isRemovedRoomRowText = (value: string) => {
      const text = normalizeText(value);
      const lower = text.toLowerCase();
      return (
        text === "صفوف 10" ||
        text === "صفوف ١٠" ||
        text === "صفوف 11" ||
        text === "صفوف ١١" ||
        text === "Grade 10" ||
        text === "Grade 11" ||
        lower === "grade 10" ||
        lower === "grade 11"
      );
    };

    const isGrade12AliasText = (value: string) => {
      const text = normalizeText(value);
      const lower = text.toLowerCase();
      return (
        text === "أخرى/12" ||
        text === "اخرى/12" ||
        text === "أخرى / 12" ||
        text === "اخرى / 12" ||
        text === "أخرى (12)" ||
        text === "اخرى (12)" ||
        text === "أخرى" ||
        text === "اخرى" ||
        text === "(12)" ||
        text === "12" ||
        lower === "other/12" ||
        lower === "other / 12" ||
        lower === "other (12)" ||
        lower === "other"
      );
    };

    const isGrade12AliasNode = (node: Text) => {
      const value = normalizeText(node.textContent || "");
      if (!isGrade12AliasText(value)) return false;

      const parent = node.parentElement as HTMLElement | null;
      if (!parent) return false;

      // في بعض الواجهات تظهر "أخرى" و "(12)" في Text nodes منفصلة.
      // لذلك نتحقق من الصف الصغير كاملًا: يجب أن يحتوي على أخرى + 12 + input واحد فقط.
      const row = findSmallFieldRow(parent) || parent;
      const rowText = normalizeText(row.textContent || "");
      const controls = row.querySelectorAll("input,select,textarea").length;
      const looksLikeGrade12Row =
        controls === 1 &&
        (rowText.includes("أخرى") || rowText.includes("اخرى") || rowText.toLowerCase().includes("other")) &&
        rowText.includes("12");

      return looksLikeGrade12Row || value.includes("/12") || value.includes("(12)") || value.toLowerCase().includes("other");
    };

    const isCardTitleText = (value: string) => {
      const text = normalizeText(value);
      const lower = text.toLowerCase();
      return text.includes("إعدادات القاعات") || text.includes("اعدادات القاعات") || lower.includes("room settings");
    };

    const findSmallFieldRow = (seed: HTMLElement): HTMLElement | null => {
      let current: HTMLElement | null = seed;

      for (let depth = 0; current && depth < 6; depth += 1) {
        const text = normalizeText(current.textContent || "");
        const controls = current.querySelectorAll("input,select,textarea").length;

        // حماية مهمة: لا نحذف الكرت أو عنوانه أبدًا.
        if (isCardTitleText(text)) return null;

        // الصف المطلوب غالبًا يحتوي على input واحد ونص قصير جدًا.
        if (controls === 1 && text.length <= 120) return current;

        const parent = current.parentElement as HTMLElement | null;
        if (!parent) break;

        const parentText = normalizeText(parent.textContent || "");
        const parentControls = parent.querySelectorAll("input,select,textarea").length;

        // لا نصعد لحاوية كبيرة حتى لا يختفي الكرت.
        if (isCardTitleText(parentText) || parentControls > 1 || parentText.length > 180) break;

        current = parent;
      }

      return null;
    };

    const updateRoomSettingsRows = () => {
      const root = document.querySelector(".taskRunCardsLightBlackScope") || document.body;
      if (!root) return;

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      let node = walker.nextNode();

      while (node) {
        const value = node.textContent || "";
        if (isRemovedRoomRowText(value) || isGrade12AliasText(value)) textNodes.push(node as Text);
        node = walker.nextNode();
      }

      textNodes.forEach((textNode) => {
        const parent = textNode.parentElement as HTMLElement | null;
        if (!parent) return;

        const value = textNode.textContent || "";

        if (isRemovedRoomRowText(value)) {
          const row = findSmallFieldRow(parent);
          if (!row || row.dataset.taskRunRemovedRoomRow === "true") return;
          row.dataset.taskRunRemovedRoomRow = "true";
          row.style.display = "none";
          return;
        }

        if (isGrade12AliasNode(textNode)) {
          const normalizedValue = normalizeText(value);

          // حوّل كلمة "أخرى" نفسها إلى النص المطلوب.
          if (normalizedValue === "أخرى" || normalizedValue === "اخرى") {
            textNode.textContent = "الصف الثاني عشر";
            return;
          }

          // احذف الرقم المنفصل حتى لا تظهر: الصف الثاني عشر (12).
          if (normalizedValue === "(12)" || normalizedValue === "12") {
            textNode.textContent = "";
            return;
          }

          textNode.textContent = value
            .replace(/أخرى\s*\/\s*12/g, "الصف الثاني عشر")
            .replace(/اخرى\s*\/\s*12/g, "الصف الثاني عشر")
            .replace(/أخرى\s*\(\s*12\s*\)/g, "الصف الثاني عشر")
            .replace(/اخرى\s*\(\s*12\s*\)/g, "الصف الثاني عشر")
            .replace(/Other\s*\/\s*12/gi, "Grade 12")
            .replace(/Other\s*\(\s*12\s*\)/gi, "Grade 12");
        }
      });

      // ✅ تثبيت مربع إدخال عدد المراقبين للصف الثاني عشر على 2 ومنع تعديله.
      const inputs = Array.from(root.querySelectorAll<HTMLInputElement>("input[type='number'], input"));
      inputs.forEach((inputEl) => {
        const row = findSmallFieldRow(inputEl) || inputEl.parentElement;
        const rowText = normalizeText(row?.textContent || "");
        const looksLikeGrade12Input =
          rowText.includes("الصف الثاني عشر") ||
          rowText.includes("أخرى/12") ||
          rowText.includes("اخرى/12") ||
          rowText.toLowerCase().includes("grade 12") ||
          rowText.toLowerCase().includes("other/12");
        if (!looksLikeGrade12Input) return;
        inputEl.value = "2";
        inputEl.defaultValue = "2";
        inputEl.min = "2";
        inputEl.max = "2";
        inputEl.step = "1";
        inputEl.disabled = true;
        inputEl.readOnly = true;
        inputEl.title = "ثابت = 2 ولا يمكن تغييره";
        inputEl.style.opacity = "1";
        inputEl.style.cursor = "not-allowed";
        inputEl.style.background = "#f3f4f6";
      });
    };

    updateRoomSettingsRows();

    // ✅ منع تجميد الصفحة: تنفيذ محدود بدل مراقبة DOM باستمرار.
    const timers = [50, 200, 600].map((delay) => window.setTimeout(updateRoomSettingsRows, delay));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);





  // ✅ إضافة توضيح قاعدة مراقب الدور والاحتياط داخل كرت إعدادات القاعات نفسه.
  // القاعدة أصبحت تلقائية حسب عدد اللجان في كل يوم امتحان، ولا تعتمد على إدخال يدوي.
  useEffect(() => {
    const normalizeText = (value: string) => String(value || "").replace(/\s+/g, " ").trim();

    const isRoomSettingsTitle = (value: string) => {
      const text = normalizeText(value);
      const lower = text.toLowerCase();
      return text.includes("إعدادات القاعات") || text.includes("اعدادات القاعات") || lower.includes("room settings");
    };

    const findRoomSettingsCard = (): HTMLElement | null => {
      const root = (document.querySelector(".taskRunCardsLightBlackScope") || document.body) as HTMLElement | null;
      if (!root) return null;

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();

      while (node) {
        const textNode = node as Text;
        if (isRoomSettingsTitle(textNode.textContent || "")) {
          let current = textNode.parentElement as HTMLElement | null;
          for (let depth = 0; current && depth < 10; depth += 1) {
            const text = normalizeText(current.textContent || "");
            const controls = current.querySelectorAll("input,select,textarea").length;
            const hasRoomTitle = isRoomSettingsTitle(text);
            const hasGrade12 = text.includes("الصف الثاني عشر") || text.includes("أخرى") || text.includes("اخرى") || text.includes("Grade 12") || text.includes("12");

            if (hasRoomTitle && controls >= 1 && hasGrade12 && text.length < 1900) {
              return current;
            }

            const parent = current.parentElement as HTMLElement | null;
            if (!parent) break;
            const parentText = normalizeText(parent.textContent || "");
            const parentControls = parent.querySelectorAll("input,select,textarea").length;

            // لا نصعد إلى حاوية الصفحة الكبيرة.
            if (parentText.length > 3000 || parentControls > 8) break;
            current = parent;
          }
        }
        node = walker.nextNode();
      }

      return null;
    };

    const ensureDutyRuleInsideRoomCard = () => {
      const cardEl = findRoomSettingsCard();
      if (!cardEl) return;

      let rowEl = cardEl.querySelector<HTMLElement>("[data-task-run-duty-room-row='true']");

      if (!rowEl) {
        rowEl = document.createElement("div");
        rowEl.dataset.taskRunDutyRoomRow = "true";
        rowEl.style.display = "grid";
        rowEl.style.gridTemplateColumns = "1fr";
        rowEl.style.alignItems = "start";
        rowEl.style.justifyItems = "stretch";
        rowEl.style.gap = "10px";
        rowEl.style.border = "3px solid #dc2626";
        rowEl.style.borderRadius = "16px";
        rowEl.style.padding = "16px";
        rowEl.style.marginTop = "12px";
        rowEl.style.background = "rgba(255,255,255,.34)";
        rowEl.style.color = "#000";
        rowEl.style.direction = "rtl";

        const fixedInputWrap = document.createElement("div");
        fixedInputWrap.style.display = "flex";
        fixedInputWrap.style.alignItems = "center";
        fixedInputWrap.style.gap = "10px";
        fixedInputWrap.style.flexWrap = "wrap";

        const fixedInputLabel = document.createElement("span");
        fixedInputLabel.dataset.taskRunDutyRoomInputLabel = "true";
        fixedInputLabel.style.fontSize = "15px";
        fixedInputLabel.style.fontWeight = "950";
        fixedInputLabel.style.color = "#000";

        const fixedInput = document.createElement("input");
        fixedInput.type = "number";
        fixedInput.value = "2";
        fixedInput.defaultValue = "2";
        fixedInput.min = "2";
        fixedInput.max = "2";
        fixedInput.step = "1";
        fixedInput.disabled = true;
        fixedInput.readOnly = true;
        fixedInput.dataset.taskRunDutyRoomFixedInput = "true";
        fixedInput.style.width = "110px";
        fixedInput.style.minHeight = "48px";
        fixedInput.style.border = "2px solid #111827";
        fixedInput.style.borderRadius = "14px";
        fixedInput.style.padding = "8px 12px";
        fixedInput.style.fontSize = "22px";
        fixedInput.style.fontWeight = "1000";
        fixedInput.style.textAlign = "center";
        fixedInput.style.color = "#000";
        fixedInput.style.background = "#f3f4f6";
        fixedInput.style.opacity = "1";
        fixedInput.style.cursor = "not-allowed";

        fixedInputWrap.appendChild(fixedInputLabel);
        fixedInputWrap.appendChild(fixedInput);

        const title = document.createElement("div");
        title.dataset.taskRunDutyRoomTitle = "true";
        title.style.fontSize = "16px";
        title.style.fontWeight = "950";
        title.style.color = "#7c3aed";
        title.style.lineHeight = "1.8";

        const rule = document.createElement("div");
        rule.dataset.taskRunDutyRoomRule = "true";
        rule.style.fontSize = "14px";
        rule.style.fontWeight = "950";
        rule.style.color = "#000";
        rule.style.lineHeight = "2";
        rule.style.border = "2px solid #16a34a";
        rule.style.borderRadius = "14px";
        rule.style.padding = "10px 12px";
        rule.style.background = "rgba(255,255,255,.64)";

        const noteEl = document.createElement("div");
        noteEl.dataset.taskRunDutyRoomNote = "true";
        noteEl.style.fontSize = "13px";
        noteEl.style.fontWeight = "850";
        noteEl.style.color = "#14532d";
        noteEl.style.lineHeight = "1.9";

        rowEl.appendChild(fixedInputWrap);
        rowEl.appendChild(title);
        rowEl.appendChild(rule);
        rowEl.appendChild(noteEl);
        cardEl.appendChild(rowEl);
      }

      const fixedInputLabel = rowEl.querySelector<HTMLElement>("[data-task-run-duty-room-input-label='true']");
      if (fixedInputLabel) fixedInputLabel.textContent = tr("مربع مراقب الدور ثابت:", "Fixed duty invigilator input:");

      const fixedInput = rowEl.querySelector<HTMLInputElement>("[data-task-run-duty-room-fixed-input='true']");
      if (fixedInput) {
        fixedInput.value = "2";
        fixedInput.defaultValue = "2";
        fixedInput.disabled = true;
        fixedInput.readOnly = true;
        fixedInput.min = "2";
        fixedInput.max = "2";
        fixedInput.title = tr("ثابت = 2 ولا يمكن تغييره", "Fixed = 2 and cannot be changed");
      }

      const title = rowEl.querySelector<HTMLElement>("[data-task-run-duty-room-title='true']");
      if (title) title.textContent = tr("قاعدة مراقب الدور حسب عدد اللجان", "Duty invigilator rule by committees count");

      const rule = rowEl.querySelector<HTMLElement>("[data-task-run-duty-room-rule='true']");
      if (rule) {
        rule.textContent = tr(
          "مربع الإدخال ثابت على 2 ولا يمكن تغييره. قاعدة مراقب الدور: 1 إلى 12 لجنة = 2 • 13 إلى 18 لجنة = 3 • 19 إلى 24 لجنة = 4 • بعد 24 لجنة: يزيد مراقب دور واحد لكل نطاق 6 لجان إضافية.",
          "The input box is fixed at 2 and cannot be changed. Duty invigilator rule: 1 to 12 committees = 2 • 13 to 18 committees = 3 • 19 to 24 committees = 4 • after 24 committees: add 1 duty invigilator for each additional 6-committee range."
        );
      }

      const staleReserveRule = rowEl.querySelector<HTMLElement>("[data-task-run-reserve-room-rule='true']");
      if (staleReserveRule) staleReserveRule.remove();

      const noteEl = rowEl.querySelector<HTMLElement>("[data-task-run-duty-room-note='true']");
      if (noteEl) {
        noteEl.textContent = tr(
          "يتم حساب مراقب الدور تلقائيًا لكل يوم امتحان حسب إجمالي عدد اللجان في ذلك اليوم، ويعمل التوزيع على الفترة الأولى فقط، مع استمرار منع معلم مواد نفس اليوم وعدم تكرار مراقب الدور لنفس المعلم طوال فترة الامتحانات. تفاصيل الاحتياط أصبحت أسفل بند احتياط لليوم في الكرت الأول.",
          "Duty invigilators are calculated automatically for each exam day based on that day's total committees. Distribution runs in the first period only, while still blocking teachers of the same day's exam subjects and preventing repeated duty invigilator assignment for the same teacher during the exam period. Reserve details are now below Reserve per day in the first card."
        );
      }
    };

    ensureDutyRuleInsideRoomCard();

    // ✅ منع تجميد الصفحة: نضيف/نحدّث التوضيح بمحاولات محدودة فقط بدل MutationObserver.
    const timers = [50, 200, 600].map((delay) => window.setTimeout(ensureDutyRuleInsideRoomCard, delay));

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [lang, exams.length]);



  // ✅ وضع بيانات الاحتياط أسفل "احتياط لليوم" في الكرت الأول، ونقل "عدد محاولات التحسين" إلى الكرت الثالث.
  useEffect(() => {
    const normalizeText = (value: string) => String(value || "").replace(/\s+/g, " ").trim();

    const root = document.querySelector(".taskRunCardsLightBlackScope") || document.body;
    if (!root) return;

    const isReservePerPeriodText = (value: string) => {
      const text = normalizeText(value);
      const lower = text.toLowerCase();
      return (text.includes("الاحتياط لكل فترة") || text.includes("احتياط لليوم") || lower.includes("reserve per period") || lower.includes("reserve per day"));
    };

    const isOptimizationAttemptsText = (value: string) => {
      const text = normalizeText(value);
      const lower = text.toLowerCase();
      return text.includes("عدد محاولات التحسين") || lower.includes("optimization attempts");
    };

    const isAdvancedCardTitle = (value: string) => {
      const text = normalizeText(value);
      const lower = text.toLowerCase();
      return text.includes("خيارات متقدمة") || lower.includes("advanced options");
    };

    const findTextNode = (predicate: (value: string) => boolean): Text | null => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const textNode = node as Text;
        if (predicate(textNode.textContent || "")) return textNode;
        node = walker.nextNode();
      }
      return null;
    };

    const findSmallFieldRow = (seed: HTMLElement): HTMLElement | null => {
      let current: HTMLElement | null = seed;
      for (let depth = 0; current && depth < 8; depth += 1) {
        const text = normalizeText(current.textContent || "");
        const controls = current.querySelectorAll("input,select,textarea").length;
        if (controls >= 1 && controls <= 2 && text.length <= 220) return current;
        const parent = current.parentElement as HTMLElement | null;
        if (!parent) break;
        const parentText = normalizeText(parent.textContent || "");
        const parentControls = parent.querySelectorAll("input,select,textarea").length;
        if (parentControls > 3 || parentText.length > 520) break;
        current = parent;
      }
      return null;
    };

    const findAdvancedCard = (): HTMLElement | null => {
      const textNode = findTextNode(isAdvancedCardTitle);
      if (!textNode?.parentElement) return null;
      let current: HTMLElement | null = textNode.parentElement;
      for (let depth = 0; current && depth < 12; depth += 1) {
        const text = normalizeText(current.textContent || "");
        const controls = current.querySelectorAll("input,select,textarea,button").length;
        if (isAdvancedCardTitle(text) && controls >= 1 && text.length < 2600) return current;
        const parent = current.parentElement as HTMLElement | null;
        if (!parent) break;
        const parentText = normalizeText(parent.textContent || "");
        const parentControls = parent.querySelectorAll("input,select,textarea,button").length;
        if (parentText.length > 3600 || parentControls > 16) break;
        current = parent;
      }
      return null;
    };

    const ensureReserveDetailsUnderReserveField = () => {
      const reserveTextNode = findTextNode(isReservePerPeriodText);
      if (!reserveTextNode?.parentElement) return;
      const reserveRow = findSmallFieldRow(reserveTextNode.parentElement);
      if (!reserveRow?.parentElement) return;

      // ✅ تحويل عنوان الصف إلى "احتياط لليوم" وتثبيت مربع الإدخال على 2 لأنه عرض فقط؛ العدد الفعلي يحسب تلقائيًا حسب عدد اللجان.
      const labelWalker = document.createTreeWalker(reserveRow, NodeFilter.SHOW_TEXT);
      let labelNode = labelWalker.nextNode();
      while (labelNode) {
        const textNode = labelNode as Text;
        const normalized = normalizeText(textNode.textContent || "");
        const lower = normalized.toLowerCase();
        if (normalized.includes("الاحتياط لكل فترة") || lower.includes("reserve per period")) {
          textNode.textContent = tr("احتياط لليوم", "Reserve per day");
        }
        labelNode = labelWalker.nextNode();
      }

      const reserveInput = reserveRow.querySelector<HTMLInputElement>("input");
      if (reserveInput) {
        reserveInput.value = "2";
        reserveInput.disabled = true;
        reserveInput.readOnly = true;
        reserveInput.title = tr(
          "الاحتياط يحسب تلقائيًا حسب عدد لجان اليوم، وهذا الحقل ثابت للعرض فقط.",
          "Reserve is calculated automatically by the day's committee count; this field is fixed for display only."
        );
        reserveInput.style.cursor = "not-allowed";
        reserveInput.style.opacity = "0.85";
      }

      let details = reserveRow.parentElement.querySelector<HTMLElement>("[data-task-run-reserve-rule-first-card='true']");
      if (!details) {
        details = document.createElement("div");
        details.dataset.taskRunReserveRuleFirstCard = "true";
        details.style.border = "2px solid #2563eb";
        details.style.borderRadius = "14px";
        details.style.padding = "10px 12px";
        details.style.margin = "8px 0 12px 0";
        details.style.background = "rgba(239,246,255,.82)";
        details.style.fontSize = "13px";
        details.style.fontWeight = "950";
        details.style.lineHeight = "2";
        details.style.color = "#000";
        details.style.direction = "rtl";
        reserveRow.insertAdjacentElement("afterend", details);
      }

      details.textContent = tr(
        "بيانات الاحتياط التلقائي: 1 إلى 12 لجنة = 2 احتياط • 13 إلى 18 لجنة = 3 احتياط • 19 إلى 24 لجنة = 4 احتياط • بعد 24 لجنة يزيد احتياط واحد لكل نطاق 6 لجان إضافية.",
        "Reserve details: 1 to 12 committees = 2 reserve • 13 to 18 committees = 3 reserve • 19 to 24 committees = 4 reserve • after 24 committees, add 1 reserve for each additional 6-committee range."
      );
    };

    const ensureOptimizationAttemptsInAdvancedCard = () => {
      const optimizationTextNode = findTextNode(isOptimizationAttemptsText);
      const optimizationRow = optimizationTextNode?.parentElement ? findSmallFieldRow(optimizationTextNode.parentElement) : null;
      if (optimizationRow) {
        optimizationRow.dataset.taskRunOriginalOptimizationAttemptsRow = "true";
        optimizationRow.style.display = "none";
      }

      const advancedCard = findAdvancedCard();
      if (!advancedCard) return;

      let rowEl = advancedCard.querySelector<HTMLElement>("[data-task-run-optimization-row-advanced='true']");
      if (!rowEl) {
        rowEl = document.createElement("div");
        rowEl.dataset.taskRunOptimizationRowAdvanced = "true";
        rowEl.style.display = "grid";
        rowEl.style.gridTemplateColumns = "minmax(180px, 1fr) 140px";
        rowEl.style.alignItems = "center";
        rowEl.style.gap = "12px";
        rowEl.style.border = "2px solid #9333ea";
        rowEl.style.borderRadius = "14px";
        rowEl.style.padding = "10px 12px";
        rowEl.style.marginTop = "12px";
        rowEl.style.background = "rgba(243,232,255,.82)";
        rowEl.style.color = "#000";
        rowEl.style.direction = "rtl";

        const textWrap = document.createElement("div");
        textWrap.style.display = "grid";
        textWrap.style.gap = "4px";

        const labelEl = document.createElement("div");
        labelEl.dataset.taskRunOptimizationLabel = "true";
        labelEl.style.fontWeight = "950";
        labelEl.style.fontSize = "14px";

        const noteEl = document.createElement("div");
        noteEl.dataset.taskRunOptimizationNote = "true";
        noteEl.style.fontWeight = "850";
        noteEl.style.fontSize = "12px";
        noteEl.style.lineHeight = "1.8";

        const inputEl = document.createElement("input");
        inputEl.type = "number";
        inputEl.min = "1";
        inputEl.step = "1";
        inputEl.dataset.taskRunOptimizationInput = "true";
        inputEl.style.width = "120px";
        inputEl.style.minHeight = "44px";
        inputEl.style.border = "2px solid #111827";
        inputEl.style.borderRadius = "12px";
        inputEl.style.padding = "8px 10px";
        inputEl.style.fontSize = "18px";
        inputEl.style.fontWeight = "1000";
        inputEl.style.textAlign = "center";
        inputEl.style.background = "#fffdf7";
        inputEl.style.color = "#000";
        inputEl.addEventListener("input", (event) => {
          const target = event.currentTarget as HTMLInputElement;
          setField("optimizationAttempts", Math.max(1, num(target.value, 5)));
        });

        textWrap.appendChild(labelEl);
        textWrap.appendChild(noteEl);
        rowEl.appendChild(textWrap);
        rowEl.appendChild(inputEl);
        advancedCard.appendChild(rowEl);
      }

      const labelEl = rowEl.querySelector<HTMLElement>("[data-task-run-optimization-label='true']");
      if (labelEl) labelEl.textContent = tr("عدد محاولات التحسين", "Optimization attempts");

      const noteEl = rowEl.querySelector<HTMLElement>("[data-task-run-optimization-note='true']");
      if (noteEl) noteEl.textContent = tr("تم نقل هذا الشرط إلى كرت خيارات متقدمة.", "This setting has been moved to the Advanced Options card.");

      const inputEl = rowEl.querySelector<HTMLInputElement>("[data-task-run-optimization-input='true']");
      if (inputEl && inputEl.value !== String(constraints?.optimizationAttempts ?? 5)) {
        inputEl.value = String(constraints?.optimizationAttempts ?? 5);
      }
    };

    ensureReserveDetailsUnderReserveField();
    ensureOptimizationAttemptsInAdvancedCard();

    const timers = [80, 240, 700].map((delay) => window.setTimeout(() => {
      ensureReserveDetailsUnderReserveField();
      ensureOptimizationAttemptsInAdvancedCard();
    }, delay));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [constraints?.optimizationAttempts, lang]);

  // ✅ حذف شرط "تجنب المهام المتتالية / منع تكليف نفس المعلم بفترتين في نفس اليوم" من كرت خيارات متقدمة.
  // يبقى الحذف محصورًا في صف الشرط فقط حتى لا يختفي كرت خيارات متقدمة أو باقي الشروط.
  useEffect(() => {
    setConstraints((prev: any) => {
      const next = { ...(prev || {}) };
      delete next.avoidBackToBack;
      return next;
    });
  }, []);

  useEffect(() => {
    const normalizeText = (value: string) =>
      String(value || "")
        .replace(/\s+/g, " ")
        .trim();

    const isAdvancedCardTitle = (value: string) => {
      const text = normalizeText(value);
      const lower = text.toLowerCase();
      return text.includes("خيارات متقدمة") || lower.includes("advanced options");
    };

    const isBackToBackOptionText = (value: string) => {
      const text = normalizeText(value);
      const lower = text.toLowerCase();
      return (
        text.includes("تجنب المهام المتتالية") ||
        text.includes("منع تكليف نفس المعلم بفترتين في نفس اليوم") ||
        text.includes("منع تكليف المعلم بفترتين في نفس اليوم") ||
        lower.includes("back-to-back") ||
        lower.includes("back to back") ||
        lower.includes("two periods in the same day") ||
        lower.includes("same teacher two periods")
      );
    };

    const isNeighborAdvancedOptionText = (value: string) => {
      const text = normalizeText(value);
      const lower = text.toLowerCase();
      return (
        text.includes("منع مراقبة نفس المادة") ||
        text.includes("تفعيل شرط") ||
        text.includes("بن") ||
        text.includes("تفريغ") ||
        text.includes("التصحيح") ||
        lower.includes("same subject") ||
        lower.includes("ben") ||
        lower.includes("correction")
      );
    };

    const pickBackToBackOptionRow = (seed: HTMLElement): HTMLElement | null => {
      let current: HTMLElement | null = seed;
      let best: HTMLElement | null = null;

      for (let depth = 0; current && depth < 9; depth += 1) {
        const text = normalizeText(current.textContent || "");
        const controls = current.querySelectorAll("input,select,textarea,button").length;

        if (isAdvancedCardTitle(text)) break;

        const containsWanted = isBackToBackOptionText(text);
        const containsNeighbor = isNeighborAdvancedOptionText(text);

        if (containsWanted && !containsNeighbor && text.length <= 700 && controls <= 4) {
          best = current;
        }

        const parent = current.parentElement as HTMLElement | null;
        if (!parent) break;

        const parentText = normalizeText(parent.textContent || "");
        const parentControls = parent.querySelectorAll("input,select,textarea,button").length;

        if (isAdvancedCardTitle(parentText)) break;
        if (isNeighborAdvancedOptionText(parentText)) break;
        if (parentText.length > 900 || parentControls > 6) break;

        current = parent;
      }

      return best;
    };

    const removeBackToBackAdvancedOption = () => {
      const root = document.querySelector(".taskRunCardsLightBlackScope") || document.body;
      if (!root) return;

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const matches: Text[] = [];
      let node = walker.nextNode();

      while (node) {
        if (isBackToBackOptionText(node.textContent || "")) matches.push(node as Text);
        node = walker.nextNode();
      }

      matches.forEach((textNode) => {
        const parent = textNode.parentElement as HTMLElement | null;
        if (!parent) return;
        if (parent.closest("[data-task-run-removed-back-to-back-option='true']")) return;

        const target = pickBackToBackOptionRow(parent);
        if (!target) return;

        target.dataset.taskRunRemovedBackToBackOption = "true";
        target.style.display = "none";
      });
    };

    removeBackToBackAdvancedOption();

    const timers = [50, 200, 600].map((delay) => window.setTimeout(removeBackToBackAdvancedOption, delay));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  // ✅ حذف شرطين فقط من كرت "خيارات متقدمة" بدون إخفاء الكرت نفسه:
  // 1) تفريغ جميع معلمي المادة للتصحيح
  // 2) تفريغ التصحيح حسب التواريخ
  // ملاحظة: يتم تثبيت منطق التصحيح داخليًا كإعداد افتراضي حتى لا تعتمد الواجهة على هذه الخيارات المحذوفة.
  useEffect(() => {
    setConstraints((prev: any) => ({
      ...(prev || {}),
      allowTwoPeriodsSameDay: false,
      allowTwoPeriodsSameDayAllDates: true,
      allowTwoPeriodsSameDayDates: [],
    }));
  }, []);

  useEffect(() => {
    const normalizeText = (value: string) =>
      String(value || "")
        .replace(/\s+/g, " ")
        .trim();

    const isAdvancedCardTitle = (value: string) => {
      const text = normalizeText(value);
      const lower = text.toLowerCase();
      return text.includes("خيارات متقدمة") || lower.includes("advanced options");
    };

    const isOtherAdvancedOption = (value: string) => {
      const text = normalizeText(value);
      const lower = text.toLowerCase();
      return (
        text.includes("تجنب المهام المتتالية") ||
        text.includes("منع مراقبة نفس المادة") ||
        text.includes("تفعيل شرط") ||
        lower.includes("back-to-back") ||
        lower.includes("same subject")
      );
    };

    const isCorrectionOptionText = (value: string) => {
      const text = normalizeText(value);
      const lower = text.toLowerCase();
      return (
        text.includes("تفريغ جميع معلمي المادة للتصحيح") ||
        text.includes("تفريغ المعلمين للتصحيح") ||
        text.includes("تفريغ التصحيح حسب تواريخ") ||
        text.includes("تفريغ التصحيح حسب التواريخ") ||
        text.includes("وضع التواريخ المحددة") ||
        text.includes("السماح بفترتين") ||
        text.includes("فترتين في اليوم") ||
        lower.includes("allow two periods") ||
        lower.includes("two periods") ||
        lower.includes("free all subject teachers for correction") ||
        lower.includes("free teachers for correction") ||
        lower.includes("correction release by dates") ||
        lower.includes("correction free by dates")
      );
    };

    const pickAdvancedOptionRow = (seed: HTMLElement): HTMLElement | null => {
      let current: HTMLElement | null = seed;
      let best: HTMLElement | null = null;

      for (let depth = 0; current && depth < 9; depth += 1) {
        const text = normalizeText(current.textContent || "");
        const controls = current.querySelectorAll("input,select,textarea,button").length;

        // حماية أساسية: لا نحذف حاوية الكرت الثالث أبدًا.
        if (isAdvancedCardTitle(text)) break;

        const containsWanted = isCorrectionOptionText(text);
        const containsOtherRows = isOtherAdvancedOption(text);

        // الصف/القسم المطلوب يكون داخل خيار واحد فقط، وقد يحتوي أزرار تواريخ كثيرة.
        if (containsWanted && !containsOtherRows && text.length <= 900 && controls <= 12) {
          best = current;
        }

        const parent = current.parentElement as HTMLElement | null;
        if (!parent) break;

        const parentText = normalizeText(parent.textContent || "");
        const parentControls = parent.querySelectorAll("input,select,textarea,button").length;

        // لا نصعد إلى مستوى يجمع أكثر من خيار أو إلى حاوية الكرت.
        if (isAdvancedCardTitle(parentText)) break;
        if (isOtherAdvancedOption(parentText)) break;
        if (parentText.length > 1100 || parentControls > 14) break;

        current = parent;
      }

      return best;
    };

    const removeCorrectionAdvancedOptions = () => {
      const root = document.querySelector(".taskRunCardsLightBlackScope") || document.body;
      if (!root) return;

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const matches: Text[] = [];
      let node = walker.nextNode();

      while (node) {
        if (isCorrectionOptionText(node.textContent || "")) matches.push(node as Text);
        node = walker.nextNode();
      }

      matches.forEach((textNode) => {
        const parent = textNode.parentElement as HTMLElement | null;
        if (!parent) return;
        if (parent.closest("[data-task-run-removed-advanced-correction-option='true']")) return;

        const target = pickAdvancedOptionRow(parent);
        if (!target) return;

        target.dataset.taskRunRemovedAdvancedCorrectionOption = "true";
        target.style.display = "none";
      });
    };

    removeCorrectionAdvancedOptions();

    // ✅ منع تجميد الصفحة: تنفيذ محدود بدل مراقبة DOM باستمرار.
    const timers = [50, 200, 600].map((delay) => window.setTimeout(removeCorrectionAdvancedOptions, delay));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const allExamDatesSorted: string[] = useMemo(() => {
    const latestExams = exams as any[];
    const s = new Set<string>();
    for (const e of latestExams) {
      const d = String(e.dateISO || e.date || "").trim();
      if (d) s.add(d);
    }
    return Array.from(s).sort();
  }, [exams]);

  // ✅ لم تعد هناك مهمة تصحيح نشطة؛ يبقى هذا المصفوف للتوافق مع مكوّن القيود فقط.
  const correctionDatesSorted: string[] = useMemo(() => [], []);


  const latestRunSummary = useMemo(() => {
    if (!runOut) return null;
    const assignments = Array.isArray(runOut?.assignments) ? runOut.assignments : [];
    const countBy = (type: string) => assignments.filter((a: any) => String(a?.taskType || "") === type).length;
    const inv = countBy("INVIGILATION");
    const res = countBy("RESERVE");
    const duty = countBy("DUTY_INVIGILATOR");
    return {
      createdAtISO: String(runOut?.createdAtISO || ""),
      totalAssignments: inv + res + duty,
      inv,
      res,
      // Keep legacy fields for TaskDistributionReadinessSection type compatibility,
      // while the displayed total remains: inv + res + duty only.
      rev: 0,
      cor: 0,
      duty,
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

    const teacherSubjectSetMap = buildTeacherSubjectsMapAll(latestTeachers);

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

    function normalizeStoredTaskType(rawTaskType: any) {
      const raw = String(rawTaskType || "").trim().toUpperCase();
      if (raw === "INVIGILATION" || raw === "RESERVE" || raw === "DUTY_INVIGILATOR") return raw;
      if (raw === "REVIEW_FREE" || raw === "CORRECTION_FREE") return "LEGACY_REMOVED_TASK";
      if (raw.includes("مراقبة")) return "INVIGILATION";
      if (raw.includes("احتياط")) return "RESERVE";
      if (raw.includes("مراقب دور") || raw.includes("مراقب الدور")) return "DUTY_INVIGILATOR";
      if (raw.includes("مراجعة") || raw.includes("تصحيح")) return "LEGACY_REMOVED_TASK";
      return raw;
    }

    function getAssignmentPeriods(assignment: any, taskType: string): ("AM" | "PM")[] {
      const covers = Array.isArray((assignment as any)?.coversPeriods)
        ? (assignment as any).coversPeriods.map((p: any) => periodToAMPM(String(p || "")))
        : [];
      if (covers.length) return Array.from(new Set(covers));
      if ((assignment as any)?.fullDay || taskType === "DUTY_INVIGILATOR") return ["AM"];
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
      for (const teacherId of teacherIds) {
        quotaTotals.set(teacherId, 0);
        invCounts.set(teacherId, 0);
        occupiedSlots.set(teacherId, new Set<string>());
        dayHasAnyPeriod.set(teacherId, new Set<string>());
      }
      return { quotaTotals, invCounts, occupiedSlots, dayHasAnyPeriod, teacherDayFirstInvDuration };
    }

    function buildSimulationArtifactsFromAssignments(sourceAssignments: any[]) {
      const state = createSimulationState();
      const committeeMap = new Map<string, Map<number, any[]>>();
      const slotCounts = new Map<string, { inv: number; res: number; duty: number }>();

      for (const ass of sourceAssignments) {
        const teacherId = String((ass as any)?.teacherId || "").trim();
        const dateISO = workDateISO(String((ass as any)?.dateISO || (ass as any)?.date || "").trim());
        const period = periodToAMPM(String((ass as any)?.period || ""));
        if (!dateISO) continue;
        const key = `${dateISO}__${period}`;
        const taskType = normalizeStoredTaskType((ass as any)?.taskType || (ass as any)?.role || "");
        const current = slotCounts.get(key) || { inv: 0, res: 0, duty: 0 };
        if (taskType === "INVIGILATION") current.inv += 1;
        else if (taskType === "RESERVE") current.res += 1;
        else if (taskType === "DUTY_INVIGILATOR") current.duty += 1;
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
      };
    }

    function canAssignUsingState(state: any, teacherId: string, dateISO: string, period: "AM" | "PM", taskType: string, subject: string, meta?: any) {
      if (!teacherId || !state.occupiedSlots.has(teacherId)) return false;

      if (
        (taskType === "INVIGILATION" || taskType === "RESERVE" || taskType === "DUTY_INVIGILATOR") &&
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


      if (smartBySpecialty && (taskType === "INVIGILATION" || taskType === "RESERVE")) {
        const blockedSubjects = taskRun12SubjectsForSpecialtyCheck(subject, meta);
        if (taskRun12TeacherMatchesBlockedSubject(teacherSubjectSetMap, teacherId, blockedSubjects)) return false;
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
      }
    }

    function buildOrderedCandidates(state: any, dateISO: string, subject: string, durationMinutes: number, excludeIds: Set<string>) {
      const candidates = teacherIds
        .filter((teacherId) => !excludeIds.has(teacherId))
        .map((teacherId, idx) => {
          const teacherName = teacherNameMapLocal.get(teacherId) || "";
          const firstDuration = state.teacherDayFirstInvDuration.get(`${teacherId}__${dateISO}`) ?? 999999;
          return {
            id: teacherId,
            idx,
            inv: state.invCounts.get(teacherId) || 0,
            quota: state.quotaTotals.get(teacherId) || 0,
            firstDuration,
            ben: hasBenInName(teacherName),
            durationMinutes,
          };
        })
        .sort(
          (a, b) =>
            a.inv - b.inv ||
            a.quota - b.quota ||
            a.firstDuration - b.firstDuration ||
            a.idx - b.idx
        );

      return candidates;
    }

    function assignReserveUsingState(state: any, dateISO: string, period: "AM" | "PM", subject: string, slotSubjects: string[] = []) {
      const reserveMeta = { slotSubjects: Array.isArray(slotSubjects) && slotSubjects.length ? slotSubjects : [subject].filter(Boolean) };
      const candidates = teacherIds
        .map((teacherId, idx) => ({
          id: teacherId,
          idx,
          quota: state.quotaTotals.get(teacherId) || 0,
          inv: state.invCounts.get(teacherId) || 0,
        }))
        .sort((a, b) => a.quota - b.quota || a.inv - b.inv || a.idx - b.idx);

      for (const candidate of candidates) {
        if (!canAssignUsingState(state, candidate.id, dateISO, period, "RESERVE", subject, reserveMeta)) continue;
        commitAssignUsingState(state, candidate.id, dateISO, period, "RESERVE", subject, reserveMeta);
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

      const sk = slotKey(dateISO, period);
      const slots = state.occupiedSlots.get(teacherId) || new Set<string>();
      if (slots.has(sk)) return null;


      const blockers: string[] = [];
      if ((state.quotaTotals.get(teacherId) || 0) >= maxTasks) blockers.push("MAX_TASKS");



      if (smartBySpecialty) {
        const subjects = teacherSubjectSetMap.get(teacherId);
        if (subjects && subjects.has(String(subject || "").trim())) blockers.push("SAME_SUBJECT");
      }

      if (blockers.length !== 1) return null;
      return blockers[0];
    }

    function relaxBlockerSuggestionMeta(blocker: string | null | undefined) {
      switch (blocker) {
        case "MAX_TASKS":
          return { source: "MAX_TASK_RELAX" as const, note: "قابل للإسناد إذا زاد النصاب +1" };
        case "SAME_SUBJECT":
          return { source: "SPECIALTY_RELAX" as const, note: "قابل للإسناد إذا تم استثناء منع مراقبة نفس المادة" };
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
                  note: tr(`تحويل من الاحتياط لنفس الفترة • ${examSubject}`, `Convert from reserve in the same slot • ${translateSubject(examSubject)}`),
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
                  note: tr(`معلم متاح لنفس الفترة • ${examSubject}`, `Teacher available in the same slot • ${translateSubject(examSubject)}`),
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
        const reserveSubject = row.subjects?.[0] ? String(row.subjects[0]) : tr("احتياط", "Reserve");
        const reserveMeta = { slotSubjects: Array.isArray(row?.subjects) ? row.subjects : [reserveSubject].filter(Boolean) };
        if (canAssignUsingState(artifacts.state, teacherId, row.dateISO, row.period, "RESERVE", reserveSubject, reserveMeta)) {
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
          note: tr(`نقل من ${donorDateISO} ${donorPeriod === "PM" ? "الفترة الثانية" : "الفترة الأولى"} (${TASK_TYPE_LABEL_AR[donorTaskType] || donorTaskType})${donorSubject ? ` • ${donorSubject}` : ""}`, `Move from ${donorDateISO} ${donorPeriod === "PM" ? "Second Period" : "First Period"} (${donorTaskType})${donorSubject ? ` • ${translateSubject(donorSubject)}` : ""}`),
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

    function simulateSlotFillability(row: any, slotAssignments: { inv: number; res: number; duty: number }) {
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
      const reserveSubject = row.subjects?.[0] ? String(row.subjects[0]) : tr("احتياط", "Reserve");
      const remainingReserveNeed = Math.max(0, row.reserveRequired - slotAssignments.res);
      for (let i = 0; i < remainingReserveNeed; i++) {
        if (!assignReserveUsingState(state, row.dateISO, row.period, reserveSubject, Array.isArray(row.subjects) ? row.subjects : [])) break;
        additionalReserve += 1;
      }

      return {
        additionalInvigilations,
        additionalReserve,
      };
    }

    const slotBaseRows = Array.from(slotMap.values()).map((row: any) => {
      const reserveRequired = taskRun12ReserveByCommittees(Number(row.rooms || 0));
      const slotAssignments = slotAssignmentMap.get(row.key) || { inv: 0, res: 0, duty: 0 };
      return {
        ...row,
        subjects: Array.from(new Set(row.subjects.filter(Boolean))),
        reserveRequired,
        slotAssignments,
        remainingInvigilations: Math.max(0, row.invigilatorsRequired - slotAssignments.inv),
        remainingReserve: Math.max(0, reserveRequired - slotAssignments.res),
      };
    });

    const forecastRowsBase = slotBaseRows
      .map((row: any) => {
        const unavailableCount = latestTeachers.filter((t: any) => isTeacherUnavailable({
          teacherId: String(t?.id || "").trim(),
          dateISO: row.dateISO,
          period: row.period,
          taskType: "INVIGILATION",
          index: unavailabilityIndex,
        })).length;

        const simulation = simulateSlotFillability(row, row.slotAssignments);
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
          availableEstimate,
          bufferEstimate,
          status,
          teacherSuggestions,
          assignedInvigilations: row.slotAssignments.inv,
          assignedReserve: row.slotAssignments.res,
          assignedDutyInvigilator: row.slotAssignments.duty,
          assignedReviewFree: 0,
          assignedCorrectionFree: 0,
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
    const criticalSlots = forecastRows.filter((row: any) => row.status === "CRITICAL");
    const tightSlots = forecastRows.filter((row: any) => row.status === "TIGHT");

    const readinessCards: ReadinessCardEntry[] = [
      {
        key: 'source',
        title: tr('مصدر البيانات','Data Source'),
        value: fsLoaded ? tr('Tenant مباشر','Live Tenant') : 'AppData',
        sub: fsLoaded ? tr('تشغيل على بيانات المدرسة الحالية مباشرةً','Running directly on the current school data') : tr('يتم استخدام AppData مؤقتًا حتى يكتمل تحميل tenant','AppData is used temporarily until tenant loading completes'),
        tone: fsLoaded ? 'good' : 'warn',
      },
      {
        key: 'quality',
        title: tr('جودة بيانات الإدخال','Input Data Quality'),
        value: `${teachersWithoutSubjects.length + examsWithoutRooms.length + subjectCoverageIssues.length}`,
        sub: tr(`معلمون بلا مواد: ${teachersWithoutSubjects.length} • امتحانات بلا قاعات: ${examsWithoutRooms.length} • مواد بلا تخصص: ${subjectCoverageIssues.length}`, `Teachers without subjects: ${teachersWithoutSubjects.length} • Exams without rooms: ${examsWithoutRooms.length} • Subjects without matching specialty: ${subjectCoverageIssues.length}`),
        tone: teachersWithoutSubjects.length || examsWithoutRooms.length || subjectCoverageIssues.length ? 'warn' : 'good',
      },
      {
        key: 'calendar',
        title: tr('أيام التشغيل الفعلية','Actual Run Days'),
        value: `${workDates.length}`,
        tone: 'neutral',
      },
      {
        key: 'pressure',
        title: tr('الضغط المتوقع','Expected Pressure'),
        value: `${criticalSlots.length}/${tightSlots.length}`,
        sub: tr(`حرج/ضيق على مستوى الفترات بعد محاكاة الأهلية الفعلية فوق آخر تعديلات الجدول الشامل`, `Critical/tight period pressure after simulating actual eligibility on top of the latest master table changes`),
        tone: criticalSlots.length ? 'danger' : tightSlots.length ? 'warn' : 'good',
      },
      {
        key: 'restrictions',
        title: tr('القيود المؤثرة','Effective Constraints'),
        value: `${unavailabilityRules.length}`,
        sub: tr(`عدم توفر: ${unavailabilityRules.length} • منع معلم المادة في المراقبة والاحتياط • شرط بن • مراقب الدور حسب عدد اللجان`, `Unavailability: ${unavailabilityRules.length} • Subject-teacher block for invigilation/reserve • Ben rule • Duty by committees count`),
        tone: unavailabilityRules.length ? 'warn' : 'neutral',
      },
    ];

    const alerts: string[] = [];
    if (!latestTeachers.length || !latestExams.length) {
      alerts.push(tr('⚠️ لا يمكن التوزيع بدقة قبل اكتمال بيانات الكادر التعليمي وجدول الامتحانات.','⚠️ Accurate distribution cannot run before the teaching staff data and exams schedule are complete.'));
    }
    if (criticalSlots.length) {
      const firstCritical = criticalSlots[0];
      const firstNames = Array.isArray((firstCritical as any)?.teacherSuggestions)
        ? (firstCritical as any).teacherSuggestions.slice(0, 3).map((item: any) => String(item?.teacherName || '').trim()).filter(Boolean)
        : [];
      alerts.push(tr(`⚠️ هناك ${criticalSlots.length} فترة حرجة متوقعة بعد احتساب الأهلية الفعلية. أولها ${firstCritical.dateISO} (${firstCritical.period === 'AM' ? 'الفترة الأولى' : 'الفترة الثانية'}) بهامش ${firstCritical.bufferEstimate}.${firstNames.length ? ` أسماء مقترحة مبدئية: ${firstNames.join(' • ')}` : ''}`, `⚠️ There are ${criticalSlots.length} expected critical periods after calculating actual eligibility. The first is ${firstCritical.dateISO} (${firstCritical.period === 'AM' ? 'First Period' : 'Second Period'}) with a margin of ${firstCritical.bufferEstimate}.${firstNames.length ? ` Initial suggested names: ${firstNames.join(' • ')}` : ''}`));
    }
    const rowsWithMasterCoverage = forecastRows.filter((row: any) => (row.assignedInvigilations || 0) || (row.assignedReserve || 0) || (row.assignedDutyInvigilator || 0));
    if (rowsWithMasterCoverage.length) {
      alerts.push(tr(`ℹ️ تم ربط التقرير تلقائيًا بتعديلات الجدول الشامل الحالية ومحاكاة ما يمكن إسناده فعليًا. الفترات المتأثرة الآن: ${rowsWithMasterCoverage.length}.`, `ℹ️ The report is now linked automatically to the current master table updates and a simulation of what can actually be assigned. Affected periods now: ${rowsWithMasterCoverage.length}.`));
    }
    if (teachersWithoutSubjects.length) {
      alerts.push(tr(`ℹ️ يوجد ${teachersWithoutSubjects.length} معلم/معلمة بلا مواد مسجلة، مثل: ${teachersWithoutSubjects.slice(0, 3).map((t: any) => String(t?.fullName || t?.name || t?.id || '—')).join(' • ')}${teachersWithoutSubjects.length > 3 ? ' ...' : ''}`, `ℹ️ There are ${teachersWithoutSubjects.length} teacher(s) without registered subjects, such as: ${teachersWithoutSubjects.slice(0, 3).map((t: any) => String(t?.fullName || t?.name || t?.id || '—')).join(' • ')}${teachersWithoutSubjects.length > 3 ? ' ...' : ''}`));
    }
    if (examsWithoutRooms.length) {
      alerts.push(tr(`ℹ️ يوجد ${examsWithoutRooms.length} امتحان بقاعات = 0، وهذه السجلات لن تنتج مراقبات فعلية حتى يتم تصحيحها.`, `ℹ️ There are ${examsWithoutRooms.length} exam(s) with rooms = 0, and these records will not produce actual invigilation assignments until corrected.`));
    }
    if (subjectCoverageIssues.length) {
      alerts.push(tr(`ℹ️ مواد بلا تخصص ظاهر في الكادر: ${subjectCoverageIssues.slice(0, 4).join(' • ')}${subjectCoverageIssues.length > 4 ? ' ...' : ''}`, `ℹ️ Subjects without a visible matching specialty in staff data: ${subjectCoverageIssues.slice(0, 4).join(' • ')}${subjectCoverageIssues.length > 4 ? ' ...' : ''}`));
    }
    if (shiftedWeekendExams.length) {
      alerts.push(tr(`ℹ️ يوجد ${shiftedWeekendExams.length} امتحان/فترة سيتم ترحيلها تلقائيًا إلى يوم الأحد بسبب وقوعها في الجمعة أو السبت.`, `ℹ️ There are ${shiftedWeekendExams.length} exam/period entries that will be shifted automatically to Sunday because they fall on Friday or Saturday.`));
    }
    if (duplicateTeacherIds.length || duplicateTeacherNames.length) {
      alerts.push(tr(`ℹ️ توجد تكرارات محتملة في الكادر: IDs مكررة ${duplicateTeacherIds.length} • أسماء مكررة ${duplicateTeacherNames.length}. يفضل مراجعتها قبل التشغيل النهائي.`, `ℹ️ There may be duplicate staff records: duplicate IDs ${duplicateTeacherIds.length} • duplicate names ${duplicateTeacherNames.length}. Review them before the final run.`));
    }
    if (!alerts.length) {
      alerts.push(tr('✅ البيانات الأساسية تبدو جاهزة، ويمكن تشغيل الخوارزمية مع المحافظة على الشروط الحالية نفسها.','✅ The core data appears ready, and the algorithm can run while keeping the same current rules.'));
    }

    return {
      readinessCards,
      alerts,
      forecastRows,
    };
  }, [teachers, exams, constraints, fsLoaded, tenantId, unavailabilityVersion, masterTableVersion]);

  useEffect(() => {
    saveDistributionConstraints(constraints)
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadLatestRunOnce() {
      if (!tenantId) return;
      if (taskRun12LastRunLoadedRef.current) return;

      taskRun12LastRunLoadedRef.current = true;

      const localLast = loadRun(tenantId);
      if (localLast) {
        const localSignature = taskRun12StableSignature(localLast);
        if (localSignature && localSignature !== taskRun12LastRunSignatureRef.current) {
          taskRun12LastRunSignatureRef.current = localSignature;
          setRunOut(localLast);
        }
      }

      try {
        const cloud = await loadTenantSettings<any>(
          tenantId,
          TASKRUN12_LATEST_RUN_SETTINGS_DOC_ID,
          {}
        );

        if (!mounted) return;

        const cloudRun = cloud?.run || null;
        const cloudAssignments = Array.isArray(cloud?.assignments) ? cloud.assignments : [];

        if (cloudRun || cloudAssignments.length) {
          const nextRun = ensureExplicitTaskTypes(
            cloudRun || {
              runId: cloud?.runId || `cloud_run_${Date.now()}`,
              createdAtISO: cloud?.createdAtISO || cloud?.updatedAtISO || new Date().toISOString(),
              assignments: cloudAssignments,
              warnings: Array.isArray(cloud?.warnings) ? cloud.warnings : [],
              debug: cloud?.debug || null,
            }
          );

          const nextSignature = taskRun12StableSignature(nextRun);
          if (nextSignature && nextSignature !== taskRun12LastRunSignatureRef.current) {
            taskRun12LastRunSignatureRef.current = nextSignature;
            saveRun(tenantId, nextRun);
            setRunOut(nextRun);
            setMasterTableVersion((prev) => prev + 1);
            setCloudSyncMessage(lang === "ar" ? "تم تحميل آخر تشغيل محفوظ من السحابة." : "Latest saved run loaded from cloud.");
          }
        }
      } catch {
        // keep local version if cloud is unavailable
      }
    }

    void loadLatestRunOnce();

    return () => {
      mounted = false;
    };
  }, [tenantId, lang]);

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
    if (key === "invigilators_12" || key === "dutyInvigilatorsPerDay" || key === "reservePerPeriod") {
      setConstraints((prev: any) => ({ ...prev, [key]: 2, invigilators_12: 2, dutyInvigilatorsPerDay: 2, reservePerPeriod: 2 }));
      return;
    }
    setConstraints((prev: any) => ({ ...prev, [key]: value, invigilators_12: 2, dutyInvigilatorsPerDay: 2, reservePerPeriod: 2 }));
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
    if (teachersCount <= 0) errs.push(tr("❌ لا يوجد بيانات في صفحة الكادر التعليمي. الرجاء إدخال الكادر التعليمي أولاً ثم العودة للتوزيع.","❌ No data found in the teaching staff page. Please enter the teaching staff data first, then return to distribution."));
    if (examsCount <= 0) errs.push(tr("❌ لا يوجد بيانات في صفحة جدول الامتحانات. الرجاء إدخال جدول الامتحانات أولاً ثم العودة للتوزيع.","❌ No data found in the exams schedule page. Please enter the exams schedule first, then return to distribution."));
    if (!hasBasics) errs.push(tr("لا يمكن التشغيل قبل إدخال بيانات الكادر التعليمي  + جدول الامتحانات.","Cannot run before entering teaching staff data and exams schedule."));
    if ((constraints.maxTasksPerTeacher ?? 0) <= 0) errs.push(tr("الحد الأقصى للنصاب يجب أن يكون أكبر من 0.","Maximum quota must be greater than 0."));
    if ((constraints.reservePerPeriod ?? 0) < 0) errs.push(tr("احتياط لليوم لا يمكن أن يكون سالبًا.","Reserve per day cannot be negative."));

    if ((constraints.invigilators_12 ?? 0) <= 0) errs.push(tr("مراقبين لكل قاعة (الصف الثاني عشر) يجب أن يكون أكبر من 0.","Invigilators per room (Grade 12) must be greater than 0."));


    return errs;
  }

 async function run(customConstraints?: any) {
    setIsReadinessCleared(false);
    const rawOut = await executeDistribution({
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

    if (!rawOut) return;

    // ✅ الحل الجذري لمشكلة اختفاء البيانات: توليد UIDs قبل الحفظ
    const runId = `run_${Date.now()}`;
    const createdAtISO = new Date().toISOString();
    
    const finalizedAssignments = (rawOut.assignments || []).map((assignment: any, index: number) => {
      const id = String(assignment?.__uid || assignment?.id || `${runId}_${index + 1}`).trim();
      return {
        ...assignment,
        id,
        __uid: id,
        runId,
        runCreatedAtISO: createdAtISO,
        updatedAtISO: createdAtISO,
      };
    });

    const out = {
      ...rawOut,
      runId,
      createdAtISO,
      assignments: finalizedAssignments,
    };

    persistDistributionState(tenantId, out);
    setRunOut(out);
    setMasterTableVersion((prev) => prev + 1);
    setCloudSyncMessage(tr("جاري حفظ نتائج التشغيل في السحابة...", "Saving run results to cloud..."));
    try {
      await persistDistributionStateToCloud(tenantId, out, currentUserId || undefined);
      setCloudSyncMessage(tr("تم حفظ نتائج التشغيل في السحابة.", "Run results saved to cloud."));
    } catch {
      setCloudSyncError(tr("تم إنشاء التوزيع محليًا، لكن تعذر حفظ النتائج في السحابة.", "Distribution was generated locally, but cloud save failed."));
    }
  }

  function taskRun12NormalizePhoneForAuth(value: any) {
    return String(value ?? "").replace(/[^0-9]/g, "");
  }

  function taskRun12PhoneAuthCandidates(value: any) {
    const raw = taskRun12NormalizePhoneForAuth(value);
    const out = new Set<string>();
    if (!raw) return out;
    out.add(raw);
    if (raw.startsWith("00") && raw.length > 2) out.add(raw.slice(2));
    if (raw.startsWith("968") && raw.length > 3) out.add(raw.slice(3));
    if (raw.startsWith("0") && raw.length > 1) out.add(raw.slice(1));
    return out;
  }

  function taskRun12MaskPhone(value: any) {
    const digits = taskRun12NormalizePhoneForAuth(value);
    if (!digits) return "—";
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 1)}${"x".repeat(Math.max(1, digits.length - 2))}${digits.slice(-1)}`;
  }

  function taskRun12GetStoredPhoneForRunAuth() {
    return taskRun12Clean(officialCenterData?.phone || taskRun12ReadExamCenterData()?.phone || "");
  }

  function taskRun12IsRunPhoneValid(inputValue: any) {
    const storedCandidates = taskRun12PhoneAuthCandidates(taskRun12GetStoredPhoneForRunAuth());
    const inputCandidates = taskRun12PhoneAuthCandidates(inputValue);
    if (!storedCandidates.size || !inputCandidates.size) return false;
    for (const item of inputCandidates) {
      if (storedCandidates.has(item)) return true;
    }
    return false;
  }

  function requestRunWithPhoneAuth(customConstraints?: any) {
    setPendingRunConstraints(customConstraints || null);
    setRunPhoneInput("");
    setRunPhoneError("");
    setShowRunPhoneAuthConfirm(true);
  }

  function confirmRunWithPhoneAuth() {
    const storedPhone = taskRun12GetStoredPhoneForRunAuth();
    if (!taskRun12NormalizePhoneForAuth(storedPhone)) {
      setRunPhoneError(tr("لا يوجد رقم هاتف محفوظ في إعدادات مركز الدبلوم. الرجاء حفظ رقم الهاتف أولًا.", "No phone number is saved in the diploma exam center settings. Please save the phone number first."));
      return;
    }

    if (!taskRun12IsRunPhoneValid(runPhoneInput)) {
      setRunPhoneError(tr("رقم الهاتف غير مطابق للرقم المسجل.", "The phone number does not match the registered number."));
      return;
    }

    const nextConstraints = pendingRunConstraints;
    setShowRunPhoneAuthConfirm(false);
    setRunPhoneInput("");
    setRunPhoneError("");
    setPendingRunConstraints(null);
    void run(nextConstraints || undefined);
  }

  function requestDeleteDistributionData() {
    setDeletePhoneAuthStep(false);
    setDeletePhoneInput("");
    setDeletePhoneError("");
    setShowDeleteDistributionConfirm(true);
  }

  function cancelDeleteDistributionData() {
    setShowDeleteDistributionConfirm(false);
    setDeletePhoneAuthStep(false);
    setDeletePhoneInput("");
    setDeletePhoneError("");
  }

  function requestDeletePhoneAuth() {
    setDeletePhoneInput("");
    setDeletePhoneError("");
    setDeletePhoneAuthStep(true);
  }

  function confirmDeleteWithPhoneAuth() {
    const storedPhone = taskRun12GetStoredPhoneForRunAuth();
    if (!taskRun12NormalizePhoneForAuth(storedPhone)) {
      setDeletePhoneError(tr("لا يوجد رقم هاتف محفوظ في إعدادات مركز الدبلوم. الرجاء حفظ رقم الهاتف أولًا.", "No phone number is saved in the diploma exam center settings. Please save the phone number first."));
      return;
    }

    if (!taskRun12IsRunPhoneValid(deletePhoneInput)) {
      setDeletePhoneError(tr("رقم الهاتف غير مطابق للرقم المسجل.", "The phone number does not match the registered number."));
      return;
    }

    setDeletePhoneInput("");
    setDeletePhoneError("");
    setDeletePhoneAuthStep(false);
    deleteAllDistributionData();
  }

  function deleteAllDistributionData() {
    setShowDeleteDistributionConfirm(false);
    clearRun(tenantId);

    // ✅ امسح أي جداول/ملخصات محفوظة (حتى صفحة Settings لا تعرض بيانات قديمة)
    try {
      localStorage.removeItem(MASTER_TABLE_KEY);
      localStorage.removeItem(RESULTS_TABLE_KEY);
      localStorage.removeItem(ALL_TABLE_KEY);
      localStorage.removeItem(manualSuggestionHistoryKey(tenantId));
    } catch {}

    // ✅ أبلغ كل الصفحات المرتبطة بالتحديث في نفس التبويب
    try {
      window.dispatchEvent(new Event(RUN_UPDATED_EVENT));
    } catch {}
    try {
      window.dispatchEvent(new Event(MASTER_TABLE_UPDATED_EVENT));
    } catch {}
    // ✅ Audit: حذف بيانات التوزيع
    void writeTenantAudit(tenantId, {
      action: "distribution_clear",
      entity: "task_distribution",
      by: currentUserId || undefined,
      meta: { atISO: new Date().toISOString() },
    }).catch(() => {});

    void replaceTenantArray(tenantId, TASKRUN12_ASSIGNMENTS_SUBCOLLECTION, [], {
      by: currentUserId || undefined,
      audit: {
        entity: TASKRUN12_ASSIGNMENTS_SUBCOLLECTION,
        meta: { summary: "cleared task distribution assignments" },
      },
    })
      .then(() =>
        saveTenantSettings(
          tenantId,
          TASKRUN12_LATEST_RUN_SETTINGS_DOC_ID,
          {
            cleared: true,
            assignments: [],
            assignmentsCount: 0,
            updatedAtISO: new Date().toISOString(),
          },
          { by: currentUserId || undefined }
        )
      )
      .then(() => setCloudSyncMessage(tr("تم حذف بيانات التوزيع من السحابة.", "Distribution data cleared from cloud.")))
      .catch(() => setCloudSyncError(tr("تم الحذف محليًا، لكن تعذر حذف بيانات السحابة.", "Cleared locally, but cloud clear failed.")));

    setRunOut(null);
    setRuntimeError(null);
    setManualSuggestionHistory([]);
    setIsReadinessCleared(true);
  }

  async function handleAddSuggestedTeacherToMasterTable(row: any, suggestion: any) {
    const currentRun = loadRun(tenantId) || runOut;
    if (!currentRun) {
      return { ok: false, message: tr('لا يوجد تشغيل محفوظ حاليًا لإضافة الاسم إليه.','There is currently no saved run to add this name to.') };
    }

    const teacherId = String(suggestion?.teacherId || "").trim();
    const teacherName = String(suggestion?.teacherName || teacherId || "").trim();
    const dateISO = workDateISO(String(row?.dateISO || "").trim());
    const period = periodToAMPM(String(row?.period || "AM"));
    const preferredSubject = String(suggestion?.subject || row?.subjects?.[0] || "").trim();
    const appliedAtISO = new Date().toISOString();
    if (!teacherId || !teacherName || !dateISO) {
      return { ok: false, message: tr('بيانات الاقتراح غير مكتملة ولا يمكن إضافته الآن.','The suggestion data is incomplete and cannot be added right now.') };
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
      return { ok: false, message: tr(`المعلم ${teacherName} موجود بالفعل في الجدول الشامل لنفس الفترة، لذلك لا يمكن إضافته مرة أخرى.`, `Teacher ${teacherName} already exists in the master table for the same period, so it cannot be added again.`) };
    }
    if (sameTeacherSameSlot && preferredTaskType === "RESERVE") {
      return { ok: false, message: tr(`المعلم ${teacherName} موجود بالفعل في الجدول الشامل لنفس الفترة.`, `Teacher ${teacherName} already exists in the master table for the same period.`) };
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
        return { ok: false, message: tr('تعذر العثور على التكليف الأصلي المقترح للنقل، ربما تم تغييره بالفعل من صفحة أخرى.','The original suggested assignment for transfer could not be found. It may have already been changed from another page.') };
      }
      if (sameTeacherSameSlot) {
        return { ok: false, message: tr(`المعلم ${teacherName} موجود بالفعل في الجدول الشامل لنفس الفترة، لذلك لا يمكن نقله إليها مرة أخرى.`, `Teacher ${teacherName} already exists in the master table for the same period, so it cannot be moved there again.`) };
      }
      const previousAssignmentSnapshot = JSON.parse(JSON.stringify(currentAssignments[donorIdx]));
      const donorTaskLabel = TASK_TYPE_LABEL_AR[String(suggestion?.transferFromTaskType || normalizeStoredTaskTypeGlobal((previousAssignmentSnapshot as any)?.taskType || (previousAssignmentSnapshot as any)?.role || ""))] || String(suggestion?.transferFromTaskType || "");
      const donorSlotLabel = `${String(suggestion?.transferFromDateISO || workDateISO(String((previousAssignmentSnapshot as any)?.dateISO || (previousAssignmentSnapshot as any)?.date || "").trim()) || "")} ${String(suggestion?.transferFromPeriod || periodToAMPM(String((previousAssignmentSnapshot as any)?.period || "AM"))) === "PM" ? tr("الفترة الثانية","Second Period") : tr("الفترة الأولى","First Period")}`;
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
      note = tr(`🔁 تم نقل ${teacherName} من ${donorSlotLabel} (${donorTaskLabel}) إلى ${dateISO} ${period === "AM" ? "الفترة الأولى" : "الفترة الثانية"}`, `🔁 ${teacherName} was moved from ${donorSlotLabel} (${donorTaskLabel}) to ${dateISO} ${period === "AM" ? "First Period" : "Second Period"}`);
      const nextRun = ensureExplicitTaskTypes({
        ...currentRun,
        assignments: nextAssignments,
        warnings: [...(Array.isArray(currentRun?.warnings) ? currentRun.warnings : []), note],
      });
      persistDistributionState(tenantId, nextRun as any);
      void persistDistributionStateToCloud(tenantId, nextRun as any, currentUserId || undefined)
        .then(() => setCloudSyncMessage(tr("تم تحديث نتائج التوزيع في السحابة.", "Distribution results updated in cloud.")))
        .catch(() => setCloudSyncError(tr("تم التحديث محليًا، لكن تعذر تحديث السحابة.", "Updated locally, but cloud update failed.")));
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
        by: currentUserId || undefined,
        meta: { teacherId, teacherName, fromDateISO: suggestion?.transferFromDateISO || null, fromPeriod: suggestion?.transferFromPeriod || null, dateISO, period, taskType: preferredTaskType, subject },
      }).catch(() => {});
      return { ok: true, message: tr(`${note}. ويمكنك طلب اسم بديل أو التراجع من سجل الإضافات الأخيرة إذا احتجت.`, `${note}. You can also request another name or undo it from the recent additions history if needed.`) };
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
      note = tr(`➕ تم تحويل ${teacherName} من احتياط إلى مراقبة في ${dateISO} ${period === "AM" ? "الفترة الأولى" : "الفترة الثانية"}`, `➕ ${teacherName} was converted from reserve to invigilation on ${dateISO} ${period === "AM" ? "First Period" : "Second Period"}`);
      const nextRun = ensureExplicitTaskTypes({
        ...currentRun,
        assignments: nextAssignments,
        warnings: [...(Array.isArray(currentRun?.warnings) ? currentRun.warnings : []), note],
      });
      persistDistributionState(tenantId, nextRun as any);
      void persistDistributionStateToCloud(tenantId, nextRun as any, currentUserId || undefined)
        .then(() => setCloudSyncMessage(tr("تم تحديث نتائج التوزيع في السحابة.", "Distribution results updated in cloud.")))
        .catch(() => setCloudSyncError(tr("تم التحديث محليًا، لكن تعذر تحديث السحابة.", "Updated locally, but cloud update failed.")));
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
        by: currentUserId || undefined,
        meta: { teacherId, teacherName, dateISO, period, taskType: "INVIGILATION", subject, source: normalizedSuggestionSource === "FREE" ? "RESERVE" : normalizedSuggestionSource },
      }).catch(() => {});
      return { ok: true, message: tr(`${note}. إذا بقي عجز في نفس الفترة ستظهر لك اقتراحات جديدة مباشرة، ويمكنك التراجع من سجل الإضافات الأخيرة.`, `${note}. If a shortage remains in the same period, new suggestions will appear immediately, and you can undo it from the recent additions history.`) };
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
      return { ok: false, message: tr('تعذر تجهيز السجل الجديد للإضافة.','The new record could not be prepared for insertion.') };
    }

    note = `➕ تمت إضافة ${teacherName} إلى الجدول الشامل (${TASK_TYPE_LABEL_AR[preferredTaskType] || preferredTaskType}) في ${dateISO} ${period === "AM" ? "الفترة الأولى" : "الفترة الثانية"}`;
    const nextRun = ensureExplicitTaskTypes({
      ...currentRun,
      assignments: [...currentAssignments, newAssignment],
      warnings: [...(Array.isArray(currentRun?.warnings) ? currentRun.warnings : []), note],
    });
    persistDistributionState(tenantId, nextRun as any);
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
      by: currentUserId || undefined,
      meta: { teacherId, teacherName, dateISO, period, taskType: preferredTaskType, subject, source: normalizedSuggestionSource },
    }).catch(() => {});
    return { ok: true, message: tr(`${note}. إذا بقي عجز في نفس الفترة يمكنك الضغط على "اقتراح اسم آخر" أو التراجع من سجل الإضافات الأخيرة.`, `${note}. If a shortage remains in the same period, you can click "Suggest another name" or undo it from the recent additions history.`) };
  }

  async function handleUndoManualSuggestion(historyId: string) {
    const entry = (manualSuggestionHistory || []).find((item) => String(item?.id || "") === String(historyId || ""));
    if (!entry) {
      return { ok: false, message: tr('لم يعد سجل هذه الإضافة متوفرًا للتراجع.','The record for this addition is no longer available for undo.') };
    }

    const currentRun = loadRun(tenantId) || runOut;
    if (!currentRun) {
      return { ok: false, message: tr('لا يوجد تشغيل محفوظ حاليًا للتراجع عنه.','There is currently no saved run to undo.') };
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
      return { ok: false, message: tr(`تعذر التراجع عن ${entry.teacherName} لأن السجل الأصلي لم يعد متاحًا كما كان.`, `Could not undo ${entry.teacherName} because the original record is no longer available as it was.`) };
    }

    const note = tr(`↩️ تم التراجع عن الإضافة اليدوية لـ ${entry.teacherName} في ${entry.dateISO} ${entry.period === "AM" ? "الفترة الأولى" : "الفترة الثانية"}`, `↩️ Manual addition for ${entry.teacherName} was undone on ${entry.dateISO} ${entry.period === "AM" ? "First Period" : "Second Period"}`);
    const nextRun = ensureExplicitTaskTypes({
      ...currentRun,
      assignments: nextAssignments,
      warnings: [...(Array.isArray(currentRun?.warnings) ? currentRun.warnings : []), note],
    });
    persistDistributionState(tenantId, nextRun as any);
    setRunOut(nextRun);
    setMasterTableVersion((prev) => prev + 1);
    setIsReadinessCleared(false);
    setManualSuggestionHistory((prev) => prev.filter((item) => String(item?.id || "") !== String(historyId || "")));
    void writeTenantAudit(tenantId, {
      action: "distribution_manual_suggestion_undo",
      entity: "task_distribution",
      by: currentUserId || undefined,
      meta: { teacherId: entry.teacherId, teacherName: entry.teacherName, dateISO: entry.dateISO, period: entry.period, taskType: entry.taskType, source: entry.source },
    }).catch(() => {});
    return { ok: true, message: tr(`${note}. تم تحديث الجدول الشامل وتقرير الضغط مباشرة.`, `${note}. The master table and pressure report were updated immediately.`) };
  }

  // ✅ ملخص العدالة: الإجمالي = (مراقبة + احتياط + مراقب دور) فقط
  const fairnessRowsBase: FairRow[] = useMemo(() => {
    const rows = new Map<string, FairRow>();
    for (const teacher of Array.isArray(teachers) ? teachers : []) {
      const teacherId = String((teacher as any)?.id || "").trim();
      if (!teacherId) continue;
      rows.set(teacherId, {
        teacherId,
        teacherName: String((teacher as any)?.fullName || (teacher as any)?.name || (teacher as any)?.employeeNo || teacherId).trim(),
        inv: 0, res: 0, duty: 0, total: 0,
      });
    }
    for (const assignment of Array.isArray(runOut?.assignments) ? runOut.assignments : []) {
      const teacherId = String((assignment as any)?.teacherId || "").trim();
      if (!teacherId) continue;
      if (!rows.has(teacherId)) {
        rows.set(teacherId, {
          teacherId,
          teacherName: String((assignment as any)?.teacherName || teacherId).trim(),
          inv: 0, res: 0, duty: 0, total: 0,
        });
      }
      const row = rows.get(teacherId)!;
      const taskType = normalizeStoredTaskTypeGlobal((assignment as any)?.taskType || (assignment as any)?.role || "");
      if (taskType === "INVIGILATION") row.inv += 1;
      else if (taskType === "RESERVE") row.res += 1;
      else if (taskType === "DUTY_INVIGILATOR") row.duty += 1;
      row.total = row.inv + row.res + row.duty;
    }
    return Array.from(rows.values());
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
  const officialAcademicYear =
    officialCenterData.academicYear || taskRun12AcademicYearFromSystemDate(new Date());
  const officialGovernorate =
    officialCenterData.governorate || tr("المديرية العامة للتعليم", "Directorate General of Education");
  const officialCenterName =
    officialCenterData.name || tr("مركز الامتحانات", "Exam Center");
  const officialCenterCode =
    officialCenterData.examCenterCode || officialCenterData.centerCode || "—";
  const officialSemester =
    officialCenterData.semester || tr("الفصل الدراسي", "Semester");
  const officialCenterHead =
    officialCenterData.controlHeadName || tr("رئيس المركز", "Center Head");

  const GOLD_2 = "#c9a227"; // Dark gold
const GOLD_SUB = "rgba(201,162,39,0.75)";
  const LINE = "rgba(201,162,39,.18)";

  const page: React.CSSProperties = {
    minHeight: "100vh",
    padding: 18,
    direction: isRTL ? "rtl" : "ltr",
    color: "#000000",
    background: "radial-gradient(circle at 50% 0%, rgba(150,110,25,0.22), transparent 28%), linear-gradient(180deg, #efe0bf 0%, #e1cca2 48%, #d8bd8e 100%)",
    fontFamily: "Tahoma, Arial, sans-serif",
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
    border: "2px solid #111827",
  };

  const headerLeft: React.CSSProperties = {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  };

  const hBtn: React.CSSProperties = {
    border: "3px solid #111827",
    borderRadius: 16,
    background: "linear-gradient(180deg, #efe3c6 0%, #e2cca1 100%)",
    color: "#000000",
    WebkitTextFillColor: "#000000",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 1000,
    boxShadow: "0 10px 22px rgba(126,98,18,0.13)",
  };

  const btnMini: React.CSSProperties = {
    border: "2px solid #111827",
    background: "#f2e8d3",
    color: "#000000",
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
    fontSize: 15,
    fontWeight: 950,
    margin: 0,
    lineHeight: 1.2,
    color: "#000000",
  };

  const subtitle: React.CSSProperties = {
    opacity: 0.9,
    fontWeight: 800,
    marginTop: 2,
    color: "rgba(201,162,39,.85)",
    fontSize: 11,
  };

  const grid3: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(260px, 1fr))",
    gap: 16,
    marginTop: 16,
  };

  const card: React.CSSProperties = {
    background: "linear-gradient(180deg, #efe3c6 0%, #e2cca1 100%)",
    border: "4px solid #111827",
    borderRadius: 28,
    padding: 20,
    boxShadow: "0 0 0 5px rgba(212,175,55,0.13) inset, 0 16px 34px rgba(126,98,18,0.12)",
    marginTop: 16,
    color: "#000000",
  };

  const cardHead: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 12,
    color: "#000000",
  };

  const cardTitle: React.CSSProperties = {
    margin: 0,
    fontSize: 15,
    fontWeight: 1000,
    color: "#000000",
  };

  const cardSub: React.CSSProperties = {
    color: "#000000",
    WebkitTextFillColor: "#000000",
    fontWeight: 900,
    lineHeight: 1.75,
    fontSize: 12,
    opacity: 1,
  };

  const row: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 0",
    borderBottom: `1px solid ${LINE}`,
  };

  const label: React.CSSProperties = { color: "#000000", fontWeight: 950, fontSize: 12 };
  const note: React.CSSProperties = {
    color: "#000000",
    fontWeight: 900,
    background: "#f2e8d3",
    border: "2px solid #111827",
    borderRadius: 14,
    padding: 10,
  };

  const toggle: React.CSSProperties = {
    width: 56,
    height: 32,
    borderRadius: 999,
    border: "3px solid #111827",
    background: "#f2e8d3",
    position: "relative",
    cursor: "pointer",
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    transition: "all .15s ease",
    boxShadow: "0 8px 18px rgba(126,98,18,0.12)",
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
    fontSize: 11,
    border: "2px solid #111827",
    background: "#f2e8d3",
    color: "#000000",
    whiteSpace: "nowrap",
  };

  const miniBtn: React.CSSProperties = {
    border: "2px solid #111827",
    background: "#f2e8d3",
    color: "#000000",
    borderRadius: 12,
    padding: "8px 12px",
    fontWeight: 950,
    cursor: "pointer",
  };

  const input: React.CSSProperties = {
    width: "100%",
    minHeight: 44,
    border: "3px solid #111827",
    borderRadius: 16,
    padding: "10px 12px",
    outline: "none",
    background: "#f2e8d3",
    color: "#000000",
    WebkitTextFillColor: "#000000",
    fontWeight: 1000,
  };

  const bigRun: React.CSSProperties = {
    border: "4px solid #111827",
    borderRadius: 22,
    background: "linear-gradient(180deg, #e8d4ab 0%, #dcc391 100%)",
    color: "#000000",
    WebkitTextFillColor: "#000000",
    padding: "16px 20px",
    cursor: "pointer",
    fontWeight: 1000,
    fontSize: 15,
    boxShadow: "0 16px 28px rgba(126,98,18,0.20)",
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
    color: "#000000",
    borderRadius: 14,
    padding: "10px 12px",
    fontWeight: 900,
  };

  const fairnessWrap: React.CSSProperties = {
    background: "linear-gradient(180deg, #efe3c6 0%, #e2cca1 100%)",
    border: "4px solid #111827",
    borderRadius: 28,
    padding: 20,
    boxShadow: "0 0 0 5px rgba(212,175,55,0.13) inset, 0 16px 34px rgba(126,98,18,0.12)",
    marginTop: 16,
    color: "#000000",
  };

  const fairnessHeader: React.CSSProperties = {
    padding: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  };

  const fairnessTitle: React.CSSProperties = { fontWeight: 950, fontSize: 15, color: GOLD_2 };
  const fairnessSub: React.CSSProperties = {
    fontWeight: 800,
    fontSize: 11,
    color: "rgba(201,162,39,.82)",
    marginTop: 4,
  };

  const table2: React.CSSProperties = { width: "100%", borderCollapse: "separate", borderSpacing: 0 };

  const th2: React.CSSProperties = {
    background: "linear-gradient(180deg, #e8d4ab 0%, #dcc391 100%)",
    color: "#000000",
    WebkitTextFillColor: "#000000",
    border: "2px solid #111827",
    padding: 10,
    textAlign: "center",
    fontWeight: 1000,
    whiteSpace: "nowrap",
  };

  const td2: React.CSSProperties = {
    background: "#f2e8d3",
    color: "#000000",
    WebkitTextFillColor: "#000000",
    border: "2px solid #111827",
    padding: 10,
    textAlign: "center",
    fontWeight: 1000,
    verticalAlign: "middle",
  };

  const totalBadge: React.CSSProperties = {
    display: "inline-flex",
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(201,162,39,.18)",
    border: "2px solid #111827",
    color: "#000000",
    boxShadow: "0 10px 20px rgba(0,0,0,.25)",
  };

  const pill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    border: "3px solid #111827",
    background: "#f2e8d3",
    color: "#000000",
    WebkitTextFillColor: "#000000",
    fontWeight: 1000,
  };

  const fairnessTableScroll: React.CSSProperties = {
    maxHeight: "55vh",
    overflow: "auto",
    borderTop: `1px solid ${LINE}`,
  };

  const fairnessSearchInput: React.CSSProperties = {
    minHeight: 44,
    border: "3px solid #111827",
    borderRadius: 16,
    padding: "10px 12px",
    background: "#f2e8d3",
    color: "#000000",
    WebkitTextFillColor: "#000000",
    outline: "none",
    fontWeight: 1000,
  };

  const grid3Responsive = grid3;

  const boolText = (v: boolean) => (v ? tr("مفعل","Enabled") : tr("غير مفعل","Disabled"));

  const reasonLabelUI = (code?: string) => {
    switch (code) {
      case "NO_TEACHERS":
        return tr("لا يوجد معلمين","No teachers available");
      case "MAX_TASKS_REACHED":
        return tr("وصل الحد الأقصى للنصاب","Maximum quota reached");
      case "PERIOD_CONFLICT":
        return tr("تعارض في نفس الفترة","Same period conflict");
      case "BACK_TO_BACK_BLOCK":
        return tr("منع حسب القيود","Blocked by constraints");
      case "SPECIALTY_BLOCK":
        return tr("ممنوع لمعلم المادة","Blocked for subject teacher");
      case "ARABIC_ONCE":
        return tr("اللغة العربية (مرة واحدة)","Arabic once only");
      case "UNAVAILABLE":
        return tr("غير متاح (غياب/عدم توفر)","Unavailable (absence/unavailability)");
      default:
        return tr("سبب غير معروف","Unknown reason");
    }
  };

  // ✅ تم حذف شرط السماح بفترتين في اليوم الواحد من الكرت الثالث.
  // نمرر قيمًا ثابتة للـ component للحفاظ على توافق الـ props فقط، بدون تفعيل أي منطق مرتبط به.
  const allowTwo = false;
  const twoAllDates = true;
  const twoDates: string[] = [];

  function toggleDate(_dateISO: string) {
    // intentionally disabled: شرط السماح بفترتين محذوف من الواجهة والمنطق
  }

  if (!taskRun12AccessVerified) {
    return (
      <div
        style={{
          direction: isRTL ? "rtl" : "ltr",
          minHeight: "100vh",
          background: "linear-gradient(180deg, #fffdf7 0%, #f8f4e8 100%)",
          color: "#000000",
          padding: 18,
          boxSizing: "border-box",
          display: "grid",
          placeItems: "center",
          fontWeight: 1000,
        }}
      >
        <div
          style={{
            width: "min(980px, 96vw)",
            border: "4px solid #d4af37",
            borderRadius: 30,
            background: "linear-gradient(180deg, #fffdf7 0%, #f8f4e8 100%)",
            boxShadow: "0 18px 42px rgba(0,0,0,0.18)",
            padding: 24,
            color: "#000000",
            fontWeight: 1000,
          }}
        >
          <style>{`
            .taskRun12EmailCodeInput { color: #111827 !important; font-weight: 1000 !important; font-size: 20px !important; background: #fffef8 !important; -webkit-text-fill-color: #111827 !important; }
            .taskRun12EmailCodeInput::placeholder { color: #111827 !important; font-weight: 1000 !important; opacity: 0.72 !important; }
          `}</style>

          <div style={{ fontSize: 30, fontWeight: 1000, marginBottom: 12, color: "#000000", textAlign: "center", lineHeight: 1.4 }}>
            {tr("تحقق برمز البريد لفتح صفحة تشغيل توزيع المهام", "Email-code verification required to open Task Distribution Run")}
          </div>

          <div style={{ textAlign: "center", lineHeight: 1.9, fontSize: 15, color: "#111827", marginBottom: 12 }}>
            {tr("أدخل بريد الحساب الحالي، ثم رمز التحقق المرسل إلى البريد.", "Enter the current account email, then the verification code sent to the email.")}
          </div>

          <input
            className="taskRun12EmailCodeInput"
            value={taskRun12AccessEmail}
            onChange={(event) => {
              setTaskRun12AccessEmail(event.target.value);
              setTaskRun12AccessEmailConfirmed(false);
              setTaskRun12AccessCodeSent(false);
              setTaskRun12AccessCode("");
              setTaskRun12AccessError("");
              setTaskRun12AccessMessage("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") void sendTaskRun12AccessCode();
            }}
            type="text"
            inputMode="email"
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            name="taskrun12_email_gate_no_autofill"
            id="taskrun12_email_gate_no_autofill"
            placeholder={tr("أدخل البريد الإلكتروني المرتبط بالحساب", "Enter the account email")}
            style={{
              width: "100%",
              border: "3px solid #d4af37",
              borderRadius: 16,
              padding: "15px 18px",
              boxSizing: "border-box",
              outline: "none",
              marginTop: 14,
              textAlign: "center",
            }}
          />

          {taskRun12AccessCodeSent && taskRun12AccessEmailConfirmed ? (
            <input
              className="taskRun12EmailCodeInput"
              value={taskRun12AccessCode}
              onChange={(event) => setTaskRun12AccessCode(normalizeTaskRun12AccessCode(event.target.value))}
              onKeyDown={(event) => {
                if (event.key === "Enter") void verifyTaskRun12AccessCode();
              }}
              type="text"
              inputMode="numeric"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              name="taskrun12_code_gate_no_autofill"
              id="taskrun12_code_gate_no_autofill"
              maxLength={6}
              placeholder={tr("أدخل رمز التحقق المكون من 6 أرقام", "Enter the 6-digit verification code")}
              style={{
                width: "100%",
                border: "3px solid #d4af37",
                borderRadius: 16,
                padding: "15px 18px",
                boxSizing: "border-box",
                outline: "none",
                marginTop: 12,
                textAlign: "center",
                letterSpacing: 2,
              }}
            />
          ) : null}

          {taskRun12AccessMessage ? (
            <div style={{ marginTop: 12, color: "#065f46", background: "#ecfdf5", border: "2px solid #34d399", borderRadius: 14, padding: 12, fontWeight: 1000, textAlign: "center" }}>
              {taskRun12AccessMessage}
            </div>
          ) : null}

          {taskRun12AccessError ? (
            <div style={{ marginTop: 12, color: "#000000", background: "#fef2f2", border: "2px solid #ef4444", borderRadius: 14, padding: 12, fontWeight: 1000, textAlign: "center" }}>
              {taskRun12AccessError}
              {taskRun12AccessLockedUntilMs && taskRun12AccessLockRemainingSeconds > 0 ? (
                <div style={{ marginTop: 6 }}>
                  {tr(`المتبقي: ${taskRun12AccessLockRemainingSeconds} ثانية`, `Remaining: ${taskRun12AccessLockRemainingSeconds} seconds`)}
                </div>
              ) : null}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end", marginTop: 22 }}>
            <button
              type="button"
              onClick={() => nav(-1)}
              style={{
                minWidth: 120,
                border: "3px solid #93c5fd",
                borderRadius: 16,
                padding: "12px 16px",
                fontWeight: 1000,
                cursor: "pointer",
                background: "linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%)",
              }}
            >
              {tr("رجوع", "Back")}
            </button>

            <button
              type="button"
              disabled={taskRun12AccessBusy || Boolean(taskRun12AccessLockedUntilMs && taskRun12AccessLockedUntilMs > Date.now())}
              onClick={() => void sendTaskRun12AccessCode()}
              style={{
                minWidth: 160,
                border: "3px solid #22c55e",
                borderRadius: 16,
                padding: "12px 16px",
                fontWeight: 1000,
                cursor: taskRun12AccessBusy ? "not-allowed" : "pointer",
                background: "linear-gradient(180deg, #dcfce7 0%, #bbf7d0 100%)",
              }}
            >
              {taskRun12AccessBusy ? tr("جارٍ الإرسال...", "Sending...") : tr("إرسال رمز الدخول", "Send access code")}
            </button>

            <button
              type="button"
              disabled={taskRun12AccessBusy || !taskRun12AccessCodeSent || !taskRun12AccessEmailConfirmed}
              onClick={() => void verifyTaskRun12AccessCode()}
              style={{
                minWidth: 170,
                border: "3px solid #ef4444",
                borderRadius: 16,
                padding: "12px 16px",
                fontWeight: 1000,
                cursor: taskRun12AccessBusy ? "not-allowed" : "pointer",
                background: "linear-gradient(180deg, #fee2e2 0%, #fca5a5 100%)",
              }}
            >
              {taskRun12AccessBusy ? tr("جارٍ التحقق...", "Verifying...") : tr("تحقق وفتح الصفحة", "Verify and open page")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const correctionByTeacher: any[] = [];

  return (
    
    <div style={page} className="taskRunCardsLightBlackScope taskRunColoredUiScope taskRunForceDarkerOfficialBg">

      

      {showRunPhoneAuthConfirm ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={tr("التحقق من رقم الهاتف قبل تشغيل التوزيع", "Phone verification before running distribution")}
          onClick={() => {
            setShowRunPhoneAuthConfirm(false);
            setRunPhoneInput("");
            setRunPhoneError("");
            setPendingRunConstraints(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(17,24,39,.58)",
            backdropFilter: "blur(5px)",
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(540px, 100%)",
              border: "4px solid #111827",
              borderRadius: 28,
              background: "linear-gradient(180deg,#fff8e6 0%,#ead19b 100%)",
              boxShadow: "0 28px 70px rgba(0,0,0,.30)",
              padding: 24,
              color: "#000000",
              textAlign: isRTL ? "right" : "left",
              direction: isRTL ? "rtl" : "ltr",
            }}
          >
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 18,
                border: "3px solid #2563eb",
                background: "#dbeafe",
                display: "grid",
                placeItems: "center",
                fontSize: 26,
                fontWeight: 1000,
                marginBottom: 14,
              }}
            >
              ☎
            </div>
            <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 1000, color: "#000000" }}>
              {tr("أدخل رقم الهاتف لتشغيل التوزيع", "Enter the phone number to run the distribution")}
            </h2>
            <p style={{ margin: 0, lineHeight: 1.9, fontSize: 14, fontWeight: 900, color: "#111827" }}>
              {tr(
                `للمتابعة، أدخل رقم الهاتف المسجل في إعدادات المركز. الرقم المسجل: ${taskRun12MaskPhone(taskRun12GetStoredPhoneForRunAuth())}`,
                `To continue, enter the phone number registered in the center settings. Registered number: ${taskRun12MaskPhone(taskRun12GetStoredPhoneForRunAuth())}`
              )}
            </p>
            <input
              type="tel"
              value={runPhoneInput}
              onChange={(event) => {
                setRunPhoneInput(event.target.value);
                if (runPhoneError) setRunPhoneError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") confirmRunWithPhoneAuth();
              }}
              placeholder={tr("اكتب رقم الهاتف هنا", "Type the phone number here")}
              autoFocus
              style={{
                width: "100%",
                boxSizing: "border-box",
                marginTop: 16,
                minHeight: 52,
                border: "3px solid #111827",
                borderRadius: 16,
                padding: "12px 14px",
                background: "#ffffff",
                color: "#000000",
                fontSize: 18,
                fontWeight: 1000,
                outline: "none",
                textAlign: "center",
              }}
            />
            {runPhoneError ? (
              <div
                style={{
                  marginTop: 12,
                  border: "2px solid #dc2626",
                  borderRadius: 14,
                  padding: "10px 12px",
                  background: "#fee2e2",
                  color: "#000000",
                  fontWeight: 1000,
                  lineHeight: 1.8,
                }}
              >
                {runPhoneError}
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 22 }}>
              <button
                type="button"
                onClick={() => {
                  setShowRunPhoneAuthConfirm(false);
                  setRunPhoneInput("");
                  setRunPhoneError("");
                  setPendingRunConstraints(null);
                }}
                style={{
                  minWidth: 130,
                  border: "3px solid #111827",
                  borderRadius: 16,
                  padding: "12px 18px",
                  background: "#ffffff",
                  color: "#000000",
                  fontWeight: 1000,
                  cursor: "pointer",
                }}
              >
                {tr("إلغاء", "Cancel")}
              </button>
              <button
                type="button"
                onClick={confirmRunWithPhoneAuth}
                style={{
                  minWidth: 150,
                  border: "3px solid #1d4ed8",
                  borderRadius: 16,
                  padding: "12px 18px",
                  background: "linear-gradient(180deg,#dbeafe,#93c5fd)",
                  color: "#000000",
                  fontWeight: 1000,
                  cursor: "pointer",
                }}
              >
                {tr("تحقق وشغّل", "Verify and run")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDeleteDistributionConfirm ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={deletePhoneAuthStep ? tr("التحقق من رقم الهاتف قبل حذف التوزيع", "Phone verification before deleting distribution") : tr("تأكيد حذف التوزيع", "Confirm distribution deletion")}
          onClick={cancelDeleteDistributionData}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(17,24,39,.58)",
            backdropFilter: "blur(5px)",
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(520px, 100%)",
              border: "4px solid #111827",
              borderRadius: 28,
              background: "linear-gradient(180deg,#fff8e6 0%,#ead19b 100%)",
              boxShadow: "0 28px 70px rgba(0,0,0,.30)",
              padding: 24,
              color: "#000000",
              textAlign: isRTL ? "right" : "left",
              direction: isRTL ? "rtl" : "ltr",
            }}
          >
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 18,
                border: "3px solid #dc2626",
                background: "#fee2e2",
                display: "grid",
                placeItems: "center",
                fontSize: 28,
                fontWeight: 1000,
                marginBottom: 14,
              }}
            >
              !
            </div>

            {!deletePhoneAuthStep ? (
              <>
                <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 1000, color: "#000000" }}>
                  {tr("هل تريد حذف التوزيع؟", "Do you want to delete the distribution?")}
                </h2>
                <p style={{ margin: 0, lineHeight: 1.9, fontSize: 14, fontWeight: 900, color: "#111827" }}>
                  {tr(
                    "سيتم حذف نتائج التوزيع الحالية من الصفحة والجداول المحفوظة. عند الضغط على موافق سيُطلب منك إدخال رقم الهاتف المسجل قبل تنفيذ الحذف.",
                    "The current distribution results and saved tables will be deleted. When you confirm, you will be asked to enter the registered phone number before deletion is executed."
                  )}
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 22 }}>
                  <button
                    type="button"
                    onClick={cancelDeleteDistributionData}
                    style={{
                      minWidth: 130,
                      border: "3px solid #111827",
                      borderRadius: 16,
                      padding: "12px 18px",
                      background: "#ffffff",
                      color: "#000000",
                      fontWeight: 1000,
                      cursor: "pointer",
                    }}
                  >
                    {tr("إلغاء", "Cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={requestDeletePhoneAuth}
                    style={{
                      minWidth: 130,
                      border: "3px solid #991b1b",
                      borderRadius: 16,
                      padding: "12px 18px",
                      background: "linear-gradient(180deg,#fee2e2,#fca5a5)",
                      color: "#000000",
                      fontWeight: 1000,
                      cursor: "pointer",
                    }}
                  >
                    {tr("موافق", "Confirm")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 1000, color: "#000000" }}>
                  {tr("أدخل رقم الهاتف لحذف التوزيع", "Enter the phone number to delete the distribution")}
                </h2>
                <p style={{ margin: 0, lineHeight: 1.9, fontSize: 14, fontWeight: 900, color: "#111827" }}>
                  {tr(
                    `للتأكيد النهائي، أدخل رقم الهاتف المسجل في إعدادات المركز. الرقم المسجل: ${taskRun12MaskPhone(taskRun12GetStoredPhoneForRunAuth())}`,
                    `For final confirmation, enter the phone number registered in the center settings. Registered number: ${taskRun12MaskPhone(taskRun12GetStoredPhoneForRunAuth())}`
                  )}
                </p>
                <input
                  type="tel"
                  value={deletePhoneInput}
                  onChange={(event) => {
                    setDeletePhoneInput(event.target.value);
                    if (deletePhoneError) setDeletePhoneError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") confirmDeleteWithPhoneAuth();
                  }}
                  placeholder={tr("اكتب رقم الهاتف هنا", "Type the phone number here")}
                  autoFocus
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: 16,
                    border: "3px solid #111827",
                    borderRadius: 16,
                    padding: "14px 16px",
                    background: "#ffffff",
                    color: "#000000",
                    fontWeight: 1000,
                    fontSize: 18,
                    outline: "none",
                    direction: "ltr",
                    textAlign: "center",
                  }}
                />
                {deletePhoneError ? (
                  <div
                    style={{
                      marginTop: 12,
                      border: "2px solid #dc2626",
                      borderRadius: 14,
                      padding: "10px 12px",
                      background: "#fee2e2",
                      color: "#7f1d1d",
                      fontWeight: 1000,
                      lineHeight: 1.8,
                    }}
                  >
                    {deletePhoneError}
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 22 }}>
                  <button
                    type="button"
                    onClick={cancelDeleteDistributionData}
                    style={{
                      minWidth: 130,
                      border: "3px solid #111827",
                      borderRadius: 16,
                      padding: "12px 18px",
                      background: "#ffffff",
                      color: "#000000",
                      fontWeight: 1000,
                      cursor: "pointer",
                    }}
                  >
                    {tr("إلغاء", "Cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteWithPhoneAuth}
                    style={{
                      minWidth: 150,
                      border: "3px solid #991b1b",
                      borderRadius: 16,
                      padding: "12px 18px",
                      background: "linear-gradient(180deg,#fee2e2,#fca5a5)",
                      color: "#000000",
                      fontWeight: 1000,
                      cursor: "pointer",
                    }}
                  >
                    {tr("تحقق واحذف", "Verify and delete")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      <style>{`
        .taskRunForceDarkerOfficialBg {
          background:
            radial-gradient(circle at 50% 0%, rgba(150, 110, 25, 0.22), transparent 28%),
            linear-gradient(180deg, #efe0bf 0%, #e1cca2 48%, #d8bd8e 100%) !important;
        }

        .taskRunForceDarkerOfficialBg > section,
        .taskRunForceDarkerOfficialBg > div > section,
        .taskRunForceDarkerOfficialBg article,
        .taskRunForceDarkerOfficialBg div[style*="background: linear-gradient"] {
          background: linear-gradient(180deg, #efe3c6 0%, #e2cca1 100%) !important;
          border-color: #111827 !important;
        }

        .taskRunForceDarkerOfficialBg div[style*="background:#fff"],
        .taskRunForceDarkerOfficialBg div[style*="background: #fff"],
        .taskRunForceDarkerOfficialBg div[style*="background: rgba(255"] {
          background-color: #e8d0a4 !important;
          border-color: #111827 !important;
        }

        .taskRunForceDarkerOfficialBg input,
        .taskRunForceDarkerOfficialBg select,
        .taskRunForceDarkerOfficialBg textarea {
          background: #f2e4c8 !important;
          border-color: #111827 !important;
        }

        .taskRunForceDarkerOfficialBg table td {
          background: #f2e4c8 !important;
          border-color: #111827 !important;
        }


        .taskRunForceDarkerOfficialBg > div,
        .taskRunForceDarkerOfficialBg > section:not(:first-of-type) {
          font-size: 94% !important;
        }

        .taskRunForceDarkerOfficialBg table th {
          background: linear-gradient(180deg, #e8c969 0%, #c9a227 100%) !important;
          border-color: #111827 !important;
        }
      `}</style>
<section
        style={{
          background: "linear-gradient(180deg, #efe3c6 0%, #e2cca1 100%)",
          border: "5px solid #111827",
          borderRadius: 30,
          padding: "22px 26px",
          boxShadow:
            "0 0 0 6px rgba(212,175,55,0.26) inset, 0 18px 38px rgba(150,120,20,0.16)",
          marginBottom: 20,
        }}
      >
        <div
          className="taskRunOfficialHeaderInnerFrame"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, 1fr) 150px minmax(260px, 1fr)",
            gap: 22,
            alignItems: "center",
            borderBottom: "3px solid #111827",
            paddingBottom: 18,
          }
        }
          
        >
          <div style={{ display: "grid", gap: 6, textAlign: "right", lineHeight: 1.45 }}>
            <div style={{ fontSize: 20, fontWeight: 1000 }}>سلطنة عمان</div>
            <div style={{ fontSize: 20, fontWeight: 1000 }}>وزارة التعليم</div>
            <div style={{ fontSize: 17, fontWeight: 1000 }}>{officialGovernorate}</div>
            <div style={{ fontSize: 17, fontWeight: 1000 }}>{officialCenterName}</div>
          </div>

          <div
            style={{
              width: 132,
              height: 132,
              margin: "0 auto",
              borderRadius: 28,
              border: "4px solid #111827",
              background: "#fbf4e3",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 14px 28px rgba(150,120,20,0.14)",
            }}
          >
            <img
              src={officialLogo || LOGO_URL}
              alt="official logo"
              style={{ width: "82%", height: "82%", objectFit: "contain" }}
            />
          </div>

          <div style={{ display: "grid", gap: 6, textAlign: "left", lineHeight: 1.45 }}>
            <div
              style={{
                fontSize: 25,
                fontWeight: 1000,
                textDecoration: "underline",
                textUnderlineOffset: 8,
              }}
            >
              تشغيل توزيع مهام المراقبة
            </div>
            <div style={{ fontSize: 15, fontWeight: 1000 }}>{officialSemester}</div>
            <div style={{ fontSize: 15, fontWeight: 1000 }}>
              العام الدراسي {officialAcademicYear} م
            </div>
            <div style={{ fontSize: 15, fontWeight: 1000 }}>
              رمز مركز الامتحان: {officialCenterCode}
            </div>
            <div style={{ fontSize: 15, fontWeight: 1000 }}>
              رئيس المركز: {officialCenterHead}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            border: "3px solid #111827",
            borderRadius: 18,
            padding: "10px 16px",
            background: "rgba(242, 232, 211, 0.92)",
            fontWeight: 1000,
            fontSize: 15,
          }}
        >
          <span>عدد المعلمين: {teachersCount}</span>
          <span>عدد الامتحانات: {examsCount}</span>
          <span>أيام الامتحانات: {derived.uniqueDates}</span>
          <span>اسم المركز: {officialCenterName}</span>
        </div>
      </section>

      <section
        style={{
          background: "linear-gradient(180deg, #efe3c6 0%, #e2cca1 100%)",
          border: "4px solid #111827",
          borderRadius: 22,
          padding: "12px 16px",
          marginBottom: 16,
          fontWeight: 1000,
          color: "#000000",
        }}
      >
        {fsLoading
          ? tr("جاري تحميل بيانات التشغيل من السحابة...", "Loading operational data from cloud...")
          : cloudSyncError || cloudSyncMessage || tr("جاهز للتشغيل المتزامن من أي جهاز.", "Ready for synchronized run from any device.")}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8, fontSize: 12 }}>
          <span>المعلمون: {fsTeachers.length}</span>
          <span>الامتحانات: {fsExams.length}</span>
          <span>القاعات: {fsRooms.length}</span>
          <span>حظر القاعات: {fsRoomBlocks.length}</span>
        </div>
      </section>


      <style>{`
        .taskRunColoredUiScope {
          --tr-blue: #2563eb;
          --tr-green: #16a34a;
          --tr-red: #dc2626;
          --tr-purple: #9333ea;
          --tr-orange: #ea580c;
          --tr-cyan: #0891b2;
          --tr-indigo: #4f46e5;
          --tr-pink: #db2777;
          --tr-gold: #ca8a04;
          --tr-emerald: #059669;
        }

        .taskRunColoredUiScope,
        .taskRunColoredUiScope * {
          font-size: 1.025em;
          font-weight: 900 !important;
          text-shadow: none !important;
        }

        .taskRunColoredUiScope button {
          border-width: 3px !important;
          border-style: solid !important;
          font-weight: 900 !important;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.10) !important;
        }

        .taskRunColoredUiScope button:nth-of-type(10n + 1) {
          border-color: var(--tr-blue) !important;
          background: linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%) !important;
        }

        .taskRunColoredUiScope button:nth-of-type(10n + 2) {
          border-color: var(--tr-green) !important;
          background: linear-gradient(180deg, #dcfce7 0%, #bbf7d0 100%) !important;
        }

        .taskRunColoredUiScope button:nth-of-type(10n + 3) {
          border-color: var(--tr-red) !important;
          background: linear-gradient(180deg, #fee2e2 0%, #fecaca 100%) !important;
        }

        .taskRunColoredUiScope button:nth-of-type(10n + 4) {
          border-color: var(--tr-purple) !important;
          background: linear-gradient(180deg, #f3e8ff 0%, #e9d5ff 100%) !important;
        }

        .taskRunColoredUiScope button:nth-of-type(10n + 5) {
          border-color: var(--tr-orange) !important;
          background: linear-gradient(180deg, #ffedd5 0%, #fed7aa 100%) !important;
        }

        .taskRunColoredUiScope button:nth-of-type(10n + 6) {
          border-color: var(--tr-cyan) !important;
          background: linear-gradient(180deg, #cffafe 0%, #a5f3fc 100%) !important;
        }

        .taskRunColoredUiScope button:nth-of-type(10n + 7) {
          border-color: var(--tr-indigo) !important;
          background: linear-gradient(180deg, #e0e7ff 0%, #c7d2fe 100%) !important;
        }

        .taskRunColoredUiScope button:nth-of-type(10n + 8) {
          border-color: var(--tr-pink) !important;
          background: linear-gradient(180deg, #fce7f3 0%, #fbcfe8 100%) !important;
        }

        .taskRunColoredUiScope button:nth-of-type(10n + 9) {
          border-color: var(--tr-gold) !important;
          background: linear-gradient(180deg, #fef3c7 0%, #fde68a 100%) !important;
        }

        .taskRunColoredUiScope button:nth-of-type(10n + 10) {
          border-color: var(--tr-emerald) !important;
          background: linear-gradient(180deg, #d1fae5 0%, #a7f3d0 100%) !important;
        }

        .taskRunColoredUiScope div[style*="border"],
        .taskRunColoredUiScope section[style*="border"],
        .taskRunColoredUiScope article[style*="border"],
        .taskRunColoredUiScope fieldset[style*="border"] {
          border-width: 3px !important;
          border-style: solid !important;
        }

        .taskRunColoredUiScope div[style*="border"]:nth-of-type(10n + 1),
        .taskRunColoredUiScope section[style*="border"]:nth-of-type(10n + 1),
        .taskRunColoredUiScope article[style*="border"]:nth-of-type(10n + 1) {
          border-color: var(--tr-blue) !important;
        }

        .taskRunColoredUiScope div[style*="border"]:nth-of-type(10n + 2),
        .taskRunColoredUiScope section[style*="border"]:nth-of-type(10n + 2),
        .taskRunColoredUiScope article[style*="border"]:nth-of-type(10n + 2) {
          border-color: var(--tr-green) !important;
        }

        .taskRunColoredUiScope div[style*="border"]:nth-of-type(10n + 3),
        .taskRunColoredUiScope section[style*="border"]:nth-of-type(10n + 3),
        .taskRunColoredUiScope article[style*="border"]:nth-of-type(10n + 3) {
          border-color: var(--tr-red) !important;
        }

        .taskRunColoredUiScope div[style*="border"]:nth-of-type(10n + 4),
        .taskRunColoredUiScope section[style*="border"]:nth-of-type(10n + 4),
        .taskRunColoredUiScope article[style*="border"]:nth-of-type(10n + 4) {
          border-color: var(--tr-purple) !important;
        }

        .taskRunColoredUiScope div[style*="border"]:nth-of-type(10n + 5),
        .taskRunColoredUiScope section[style*="border"]:nth-of-type(10n + 5),
        .taskRunColoredUiScope article[style*="border"]:nth-of-type(10n + 5) {
          border-color: var(--tr-orange) !important;
        }

        .taskRunColoredUiScope div[style*="border"]:nth-of-type(10n + 6),
        .taskRunColoredUiScope section[style*="border"]:nth-of-type(10n + 6),
        .taskRunColoredUiScope article[style*="border"]:nth-of-type(10n + 6) {
          border-color: var(--tr-cyan) !important;
        }

        .taskRunColoredUiScope div[style*="border"]:nth-of-type(10n + 7),
        .taskRunColoredUiScope section[style*="border"]:nth-of-type(10n + 7),
        .taskRunColoredUiScope article[style*="border"]:nth-of-type(10n + 7) {
          border-color: var(--tr-indigo) !important;
        }

        .taskRunColoredUiScope div[style*="border"]:nth-of-type(10n + 8),
        .taskRunColoredUiScope section[style*="border"]:nth-of-type(10n + 8),
        .taskRunColoredUiScope article[style*="border"]:nth-of-type(10n + 8) {
          border-color: var(--tr-pink) !important;
        }

        .taskRunColoredUiScope div[style*="border"]:nth-of-type(10n + 9),
        .taskRunColoredUiScope section[style*="border"]:nth-of-type(10n + 9),
        .taskRunColoredUiScope article[style*="border"]:nth-of-type(10n + 9) {
          border-color: var(--tr-gold) !important;
        }

        .taskRunColoredUiScope div[style*="border"]:nth-of-type(10n + 10),
        .taskRunColoredUiScope section[style*="border"]:nth-of-type(10n + 10),
        .taskRunColoredUiScope article[style*="border"]:nth-of-type(10n + 10) {
          border-color: var(--tr-emerald) !important;
        }

        .taskRunColoredUiScope table {
          border-collapse: separate !important;
          border-spacing: 0 !important;
          border: 3px solid var(--tr-blue) !important;
        }

        .taskRunColoredUiScope table th,
        .taskRunColoredUiScope table td {
          border-width: 2px !important;
          border-style: solid !important;
          font-size: 1.03em !important;
          font-weight: 900 !important;
        }

        .taskRunColoredUiScope table th:nth-child(10n + 1),
        .taskRunColoredUiScope table td:nth-child(10n + 1) {
          border-color: var(--tr-blue) !important;
        }

        .taskRunColoredUiScope table th:nth-child(10n + 2),
        .taskRunColoredUiScope table td:nth-child(10n + 2) {
          border-color: var(--tr-green) !important;
        }

        .taskRunColoredUiScope table th:nth-child(10n + 3),
        .taskRunColoredUiScope table td:nth-child(10n + 3) {
          border-color: var(--tr-red) !important;
        }

        .taskRunColoredUiScope table th:nth-child(10n + 4),
        .taskRunColoredUiScope table td:nth-child(10n + 4) {
          border-color: var(--tr-purple) !important;
        }

        .taskRunColoredUiScope table th:nth-child(10n + 5),
        .taskRunColoredUiScope table td:nth-child(10n + 5) {
          border-color: var(--tr-orange) !important;
        }

        .taskRunColoredUiScope table th:nth-child(10n + 6),
        .taskRunColoredUiScope table td:nth-child(10n + 6) {
          border-color: var(--tr-cyan) !important;
        }

        .taskRunColoredUiScope table th:nth-child(10n + 7),
        .taskRunColoredUiScope table td:nth-child(10n + 7) {
          border-color: var(--tr-indigo) !important;
        }

        .taskRunColoredUiScope table th:nth-child(10n + 8),
        .taskRunColoredUiScope table td:nth-child(10n + 8) {
          border-color: var(--tr-pink) !important;
        }

        .taskRunColoredUiScope table th:nth-child(10n + 9),
        .taskRunColoredUiScope table td:nth-child(10n + 9) {
          border-color: var(--tr-gold) !important;
        }

        .taskRunColoredUiScope table th:nth-child(10n + 10),
        .taskRunColoredUiScope table td:nth-child(10n + 10) {
          border-color: var(--tr-emerald) !important;
        }

        .taskRunColoredUiScope svg,
        .taskRunColoredUiScope [role="img"],
        .taskRunColoredUiScope button span:first-child {
          filter: saturate(1.35) contrast(1.08) !important;
        }

        .taskRunColoredUiScope svg:nth-of-type(10n + 1),
        .taskRunColoredUiScope [role="img"]:nth-of-type(10n + 1) {
          color: var(--tr-blue) !important;
          fill: var(--tr-blue) !important;
        }

        .taskRunColoredUiScope svg:nth-of-type(10n + 2),
        .taskRunColoredUiScope [role="img"]:nth-of-type(10n + 2) {
          color: var(--tr-green) !important;
          fill: var(--tr-green) !important;
        }

        .taskRunColoredUiScope svg:nth-of-type(10n + 3),
        .taskRunColoredUiScope [role="img"]:nth-of-type(10n + 3) {
          color: var(--tr-red) !important;
          fill: var(--tr-red) !important;
        }

        .taskRunColoredUiScope svg:nth-of-type(10n + 4),
        .taskRunColoredUiScope [role="img"]:nth-of-type(10n + 4) {
          color: var(--tr-purple) !important;
          fill: var(--tr-purple) !important;
        }
      `}</style>

      <style>{`
        .taskRunCardsLightBlackScope,
        .taskRunCardsLightBlackScope * {
          color: #000000 !important;
          text-shadow: none !important;
        }

        .taskRunCardsLightBlackScope h1,
        .taskRunCardsLightBlackScope h2,
        .taskRunCardsLightBlackScope h3,
        .taskRunCardsLightBlackScope h4,
        .taskRunCardsLightBlackScope p,
        .taskRunCardsLightBlackScope div,
        .taskRunCardsLightBlackScope span,
        .taskRunCardsLightBlackScope label,
        .taskRunCardsLightBlackScope button,
        .taskRunCardsLightBlackScope input,
        .taskRunCardsLightBlackScope select,
        .taskRunCardsLightBlackScope textarea,
        .taskRunCardsLightBlackScope option,
        .taskRunCardsLightBlackScope strong,
        .taskRunCardsLightBlackScope b {
          color: #000000 !important;
          font-weight: 900 !important;
          text-shadow: none !important;
          -webkit-text-fill-color: #000000 !important;
        }

        .taskRunCardsLightBlackScope input,
        .taskRunCardsLightBlackScope select,
        .taskRunCardsLightBlackScope textarea {
          background: #fffdf7 !important;
          border-color: #d4af37 !important;
        }

        .taskRunCardsLightBlackScope div[style*="border"],
        .taskRunCardsLightBlackScope section[style*="border"],
        .taskRunCardsLightBlackScope article[style*="border"],
        .taskRunCardsLightBlackScope fieldset[style*="border"] {
          background:
            linear-gradient(180deg, #fffdf7 0%, #f7f3e7 100%) !important;
          color: #000000 !important;
        }
      `}</style>

      <div
        style={{
          maxWidth: 1460,
          margin: "0 auto 18px auto",
          display: "grid",
          gap: 18,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            border: "2px solid #111827",
            borderRadius: 32,
            padding: 28,
            background: "linear-gradient(180deg, #f6ecd8 0%, #ead9b8 100%)",
            boxShadow: "0 18px 36px rgba(126,98,18,0.14), inset 0 0 0 4px rgba(212,175,55,0.08)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -120,
              left: "50%",
              transform: "translateX(-50%)",
              width: 560,
              height: 560,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(212,175,55,0.14), rgba(212,175,55,0.05) 40%, transparent 72%)",
              filter: "blur(10px)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              insetInlineStart: -80,
              bottom: -120,
              width: 280,
              height: 280,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(212,175,55,0.10), transparent 72%)",
              filter: "blur(8px)",
              pointerEvents: "none",
            }}
          />

          <div style={{ display: "grid", gap: 18, position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "start" }}>
              <div style={{ maxWidth: 860, display: "grid", gap: 14 }}>
                <div
                  style={{
                    display: "inline-flex",
                    width: "fit-content",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 14px",
                    borderRadius: 999,
                    background: "rgba(212,175,55,0.14)",
                    border: "1px solid rgba(212,175,55,0.42)",
                    color: "#000000",
                    fontWeight: 950,
                    fontSize: 11,
                  }}
                >
                  {tr("تشغيل فعلي مباشر من بيانات الكادر والامتحانات","Live direct run from teaching staff and exams data")}
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "rgba(201,162,39,.84)" }}>{APP_NAME}</div>
                  <h1
                    style={{
                      margin: 0,
                      fontSize: "clamp(28px, 4vw, 30px)",
                      lineHeight: 1.02,
                      fontWeight: 950,
                      color: "#000000",
                      letterSpacing: "-0.03em",
                      textShadow: "0 4px 14px rgba(212,175,55,.12)",
                    }}
                  >
                    {tr("منصة تشغيل توزيع المهام","Task Distribution Run Platform")}
                  </h1>
                </div>


                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {[
                    { label: tr("مصدر التشغيل","Run Source"), value: fsLoaded ? tr("بيانات الجهة المباشرة","Live tenant data") : tr("بيانات التطبيق الحالية","Current app data") },
                    { label: tr("الجاهزية","Readiness"), value: hasBasics ? tr("جاهز للتشغيل","Ready to run") : tr("ينتظر اكتمال البيانات","Waiting for complete data") },
                    { label: tr("آخر تشغيل","Last Run"), value: latestRunSummary?.createdAtISO ? String(latestRunSummary.createdAtISO).slice(0, 16).replace("T", " ") : tr("لا يوجد","None") },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        minWidth: 190,
                        border: "2px solid #111827",
                        borderRadius: 18,
                        padding: "12px 14px",
                        background: "rgba(255,253,247,.95)",
                        boxShadow: "0 10px 22px rgba(126,98,18,0.12)",
                      }}
                    >
                      <div style={{ fontSize: 11, color: "rgba(201,162,39,.68)", fontWeight: 800 }}>{item.label}</div>
                      <div style={{ marginTop: 6, fontSize: 14, color: "#000000", fontWeight: 950 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  minWidth: 300,
                  maxWidth: 390,
                  width: "100%",
                  border: "2px solid #111827",
                  borderRadius: 28,
                  padding: 22,
                  background: "linear-gradient(180deg, #fffdf7 0%, #f8f1dd 100%)",
                  boxShadow: "inset 0 0 0 3px rgba(212,175,55,.08)",
                  display: "grid",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    width: "fit-content",
                    padding: "8px 12px",
                    borderRadius: 999,
                    background: runtimeError || errors.length ? "rgba(239,68,68,.12)" : "rgba(212,175,55,.14)",
                    border: runtimeError || errors.length ? "1px solid rgba(239,68,68,.30)" : "1px solid rgba(212,175,55,.42)",
                    color: "#000000",
                    fontWeight: 950,
                    fontSize: 11,
                  }}
                >
                  {runtimeError || errors.length ? tr("يحتاج مراجعة قبل التشغيل","Needs review before running") : tr("الوضع التشغيلي جاهز","Operational status is ready")}
                </div>

                <div style={{ fontSize: 24, lineHeight: 1.45, fontWeight: 950, color: "#000000" }}>
                  {runOut
                    ? tr(""," ")
                    : tr(".","")}
                </div>

                
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                gap: 14,
              }}
            >
              {[
                {
                  label: tr("المعلمون","Teachers"),
                  value: teachersCount,
                  hint: tr("الكادر الجاهز للتوزيع","Teaching staff ready for distribution"),
                  tone: "#f8e7a6",
                },
                {
                  label: tr("الاختبارات","Exams"),
                  value: examsCount,
                  hint: tr("المواد/الفترات الفعلية","Actual subjects/periods"),
                  tone: "#93c5fd",
                },
                {
                  label: tr("اللجان","Committees"),
                  value: derived.totalRooms,
                  hint: tr("إجمالي القاعات المطلوبة","Total required rooms"),
                  tone: "#86efac",
                },
                {
                  label: tr("أيام الامتحانات","Exam Days"),
                  value: derived.uniqueDates,
                  hint: tr("عدد الأيام الفعلية","Actual number of days"),
                  tone: "#c4b5fd",
                },
                {
                  label: tr("إسنادات آخر تشغيل","Last Run Assignments"),
                  value: latestRunSummary?.totalAssignments ?? 0,
                  hint: tr("إجمالي ما تم توليده","Total generated"),
                  tone: "#fde68a",
                },
                {
                  label: tr("تحذيرات آخر تشغيل","Last Run Warnings"),
                  value: latestRunSummary?.warnings ?? 0,
                  hint: tr("رسائل تحتاج انتباهًا","Messages needing attention"),
                  tone: (latestRunSummary?.warnings ?? 0) > 0 ? "#fca5a5" : "#bbf7d0",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    border: "2px solid #111827",
                    borderRadius: 24,
                    background: "linear-gradient(180deg, #fffdf7 0%, #f8f1dd 100%)",
                    padding: 18,
                    boxShadow: "0 12px 24px rgba(126,98,18,0.12)",
                  }}
                >
                  <div style={{ fontSize: 11, color: "#7c5a00", fontWeight: 800 }}>{item.label}</div>
                  <div style={{ marginTop: 10, fontSize: 29, fontWeight: 950, color: "#000000" }}>{item.value}</div>
                  <div style={{ marginTop: 8, fontSize: 11, color: "rgba(201,162,39,.56)", lineHeight: 1.8 }}>{item.hint}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>


      <style>{`
        .taskRun12OfficialTheme {
          font-size: 96%;
        }

        .taskRun12OfficialTheme,
        .taskRun12OfficialTheme * {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          text-shadow: none !important;
          font-weight: 900 !important;
          font-family: Tahoma, Arial, sans-serif !important;
        }

        .taskRun12OfficialTheme input,
        .taskRun12OfficialTheme select,
        .taskRun12OfficialTheme textarea,
        .taskRun12OfficialTheme option {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          background: #fffaf0 !important;
          font-weight: 1000 !important;
        }

        .taskRun12OfficialTheme table th {
          background: linear-gradient(180deg, #f2dc8a 0%, #d4af37 100%) !important;
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
        }

        .taskRun12OfficialTheme table td {
          background: #fffaf0 !important;
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
        }

        @media (max-width: 980px) {
          .taskRun12OfficialHeaderGrid {
            grid-template-columns: 1fr !important;
            text-align: center !important;
          }
        }
      `}</style>
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
        onRun={requestRunWithPhoneAuth}
        onGoHome={() => nav("/")}
        onGoResults={() => nav("/task-distribution/results")}
        onGoSuggestions={() => nav("/task-distribution/suggestions")}
        onDeleteAllDistributionData={requestDeleteDistributionData}
        onReloadConstraints={() => {
          setIsReadinessCleared(false);
          setConstraints({ ...loadDistributionConstraints({ ...DEFAULT_CONSTRAINTS }), invigilators_12: 2, dutyInvigilatorsPerDay: 2, reservePerPeriod: 2 });
        }}
        onSaveConstraints={() => {
          setIsReadinessCleared(false);
          saveDistributionConstraints({ ...constraints, invigilators_12: 2, dutyInvigilatorsPerDay: 2, reservePerPeriod: 2 });
        }}
        onClearConstraints={() => {
          clearDistributionConstraints();
          setIsReadinessCleared(false);
          setConstraints({ ...DEFAULT_CONSTRAINTS, invigilators_12: 2, dutyInvigilatorsPerDay: 2, reservePerPeriod: 2 });
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
        reasonLabel={reasonLabelUI}
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
        onDeleteAllDistributionData={requestDeleteDistributionData}
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
