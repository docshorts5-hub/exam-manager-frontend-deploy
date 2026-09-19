import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { loadTenantArray, loadTenantSettings, replaceTenantArray, saveTenantSettings, writeTenantAudit } from "../services/tenantData";
import { loadRun, saveRun, RUN_UPDATED_EVENT, MASTER_TABLE_UPDATED_EVENT } from "../utils/taskDistributionStorage";
import { container } from "../styles/ui";
import { subjectColors } from "./taskDistributionResults12/constants";
import { ResultsPageHeader } from "./taskDistributionResults12/components/ResultsPageHeader";
import { ResultsTable } from "./taskDistributionResults12/components/ResultsTable";
import { ResultsEmptyRunState } from "./taskDistributionResults12/components/ResultsEmptyRunState";
import { ResultsImportConfirmDialog } from "./taskDistributionResults12/components/ResultsImportConfirmDialog";
import { ResultsFooterPanels } from "./taskDistributionResults12/components/ResultsFooterPanels";
import { ResultsFullscreenToolbar } from "./taskDistributionResults12/components/ResultsFullscreenToolbar";
import { getResultsTableHeaderStyles } from "./taskDistributionResults12/services/resultsPageStyles";
import { useResultsRunSync } from "./taskDistributionResults12/hooks/useResultsRunSync";
import { useResultsInteractionState } from "./taskDistributionResults12/hooks/useResultsInteractionState";
import { useResultsDataModel } from "./taskDistributionResults12/hooks/useResultsDataModel";
import { useResultsPageActions } from "./taskDistributionResults12/hooks/useResultsPageActions";
import { useResultsTableActions } from "./taskDistributionResults12/hooks/useResultsTableActions";
import { useResultsClipboardShortcuts } from "./taskDistributionResults12/hooks/useResultsClipboardShortcuts";

const OFFICIAL_PAGE_STYLE: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #f7f1e4 0%, #eee2c9 100%)",
  color: "#111827",
  padding: "12px 8px",
};

const OFFICIAL_PANEL_STYLE: React.CSSProperties = {
  background: "rgba(255, 253, 247, 0.98)",
  border: "1px solid #d1b66a",
  borderRadius: 12,
  boxShadow: "0 6px 16px rgba(80, 60, 20, 0.08)",
  color: "#111827",
};

const OFFICIAL_HEADER_STYLES_INPUT: Parameters<
  typeof getResultsTableHeaderStyles
>[0] = {
  tableText: "#111827",
  tableFontSize: "12px",
  goldLine: "#a98322",
  goldLineSoft: "rgba(151, 116, 28, 0.34)",
};


const RESULTS12_EXAM_CENTER_SETTINGS_DOC_ID = "diplomaExamCenter";
const RESULTS12_PHONE_GATE_PREFIX = "yr:phone-gate:task-results12:";

type Results12ExamCenterPhoneSettings = {
  phone?: string;
};

function results12DigitsOnly(value: unknown) {
  return String(value ?? "").replace(/\D+/g, "").trim();
}

function results12NormalizePhoneForCompare(value: unknown) {
  const digits = results12DigitsOnly(value);
  if (digits.length > 8 && digits.startsWith("968")) return digits.slice(3);
  return digits;
}

function results12MaskPhone(value: unknown) {
  const digits = results12NormalizePhoneForCompare(value);
  if (!digits) return "—";
  if (digits.length === 1) return "X";
  if (digits.length === 2) return `${digits[0]}${digits[1]}`;
  return `${digits[0]}${"X".repeat(Math.max(1, digits.length - 2))}${digits[digits.length - 1]}`;
}

const OFFICIAL_GOLDEN_TABLE_CSS = `
  .results12GoldenTableScope {
    background: linear-gradient(180deg, #f7f1e4 0%, #eee2c9 100%) !important;
    color: #111827 !important;
  }

  .results12GoldenTableScope table,
  .results12GoldenTableScope td,
  .results12GoldenTableScope th,
  .results12GoldenTableScope button,
  .results12GoldenTableScope input,
  .results12GoldenTableScope select,
  .results12GoldenTableScope textarea {
    box-sizing: border-box !important;
    color: #111827 !important;
    -webkit-text-fill-color: #111827 !important;
    text-shadow: none !important;
  }

  .results12GoldenTableScope input,
  .results12GoldenTableScope select,
  .results12GoldenTableScope textarea,
  .results12GoldenTableScope option {
    background: #fffdf7 !important;
    border: 1px solid #c8ad61 !important;
    border-radius: 8px !important;
    font-weight: 650 !important;
    outline: none !important;
  }

  .results12GoldenTableScope input:focus,
  .results12GoldenTableScope select:focus,
  .results12GoldenTableScope textarea:focus {
    border-color: #947329 !important;
    box-shadow: 0 0 0 2px rgba(148,115,41,0.18) !important;
  }

  .results12GoldenTableScope button {
    font-weight: 700 !important;
    border-color: rgba(148,115,41,0.36) !important;
  }

  .results12GoldenTableScope table {
    width: 100% !important;
    background: #fffdf7 !important;
    border-collapse: separate !important;
    border-spacing: 0 !important;
    border: 1px solid #c8ad61 !important;
    border-radius: 10px !important;
    overflow: hidden !important;
    box-shadow: 0 6px 18px rgba(80,60,20,0.08) !important;
  }

  .results12GoldenTableScope table thead th,
  .results12GoldenTableScope table tfoot td,
  .results12GoldenTableScope table tfoot th {
    background: linear-gradient(180deg, #f8ebc8 0%, #e3c978 100%) !important;
    border: 1px solid #b89538 !important;
    color: #111827 !important;
    -webkit-text-fill-color: #111827 !important;
    font-size: 11.5px !important;
    font-weight: 800 !important;
    line-height: 1.3 !important;
    padding: 5px 6px !important;
    vertical-align: middle !important;
    white-space: normal !important;
  }

  .results12GoldenTableScope table tbody td {
    background: #fffdf7 !important;
    border: 1px solid rgba(184,149,56,0.34) !important;
    color: #111827 !important;
    -webkit-text-fill-color: #111827 !important;
    font-size: 11.5px !important;
    font-weight: 600 !important;
    line-height: 1.3 !important;
    padding: 4px 5px !important;
    vertical-align: top !important;
    box-shadow: none !important;
  }

  .results12GoldenTableScope table tbody tr:nth-child(even) td:not(.results12TaskInvigilation):not(.results12TaskReserve):not(.results12TaskDuty):not(.results12CellEmptyOfficial) {
    background: #fbf5e6 !important;
  }

  .results12GoldenTableScope table tbody tr:hover td:not(.results12TaskInvigilation):not(.results12TaskReserve):not(.results12TaskDuty):not(.results12CellEmptyOfficial) {
    background: #f4e9c9 !important;
  }

  .results12GoldenTableScope table tbody td.results12TaskInvigilation {
    background: linear-gradient(180deg, #edf5ff 0%, #d8e9ff 100%) !important;
    border: 1.25px solid #3b78bd !important;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.38), 0 0 6px rgba(59,120,189,0.14) !important;
    animation: results12CommercialBluePulse 4.2s ease-in-out infinite !important;
  }

  .results12GoldenTableScope table tbody td.results12TaskReserve {
    background: linear-gradient(180deg, #edf9f0 0%, #d9f0df 100%) !important;
    border: 1.25px solid #3d8b5b !important;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.38), 0 0 6px rgba(61,139,91,0.14) !important;
    animation: results12CommercialGreenPulse 4.2s ease-in-out infinite !important;
  }

  .results12GoldenTableScope table tbody td.results12TaskDuty {
    background: linear-gradient(180deg, #fff0f0 0%, #f9dddd 100%) !important;
    border: 1.25px solid #bf4d4d !important;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.38), 0 0 6px rgba(191,77,77,0.14) !important;
    animation: results12CommercialRedPulse 4.2s ease-in-out infinite !important;
  }

  .results12GoldenTableScope table tbody td.results12CellEmptyOfficial,
  .results12GoldenTableScope table tbody td:empty {
    background: linear-gradient(180deg, #fff9e5 0%, #f2e1a7 100%) !important;
    border: 1.25px solid #b89538 !important;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.45) !important;
  }

  .results12GoldenTableScope table tbody td.results12TaskInvigilation > *,
  .results12GoldenTableScope table tbody td.results12TaskReserve > *,
  .results12GoldenTableScope table tbody td.results12TaskDuty > *,
  .results12GoldenTableScope table tbody td.results12CellEmptyOfficial > * {
    background: transparent !important;
    color: #111827 !important;
    -webkit-text-fill-color: #111827 !important;
    font-size: inherit !important;
    line-height: 1.3 !important;
    max-width: 100% !important;
    box-shadow: none !important;
    text-shadow: none !important;
  }

  .results12GoldenTableScope table tbody td.results12TaskInvigilation button,
  .results12GoldenTableScope table tbody td.results12TaskReserve button,
  .results12GoldenTableScope table tbody td.results12TaskDuty button,
  .results12GoldenTableScope table tbody td.results12CellEmptyOfficial button {
    background: rgba(255,255,255,0.46) !important;
    border: 1px solid rgba(17,24,39,0.16) !important;
    border-radius: 8px !important;
    padding: 3px 7px !important;
    margin: 1px 2px !important;
    min-height: auto !important;
    font-size: 11.5px !important;
    font-weight: 750 !important;
    box-shadow: none !important;
  }

  .results12GoldenTableScope table tbody td.results12CellEmptyOfficial button {
    background: #fff8df !important;
    border-color: rgba(184,149,56,0.50) !important;
  }

  .results12GoldenTableScope table tbody td.results12TaskInvigilation button:hover,
  .results12GoldenTableScope table tbody td.results12TaskReserve button:hover,
  .results12GoldenTableScope table tbody td.results12TaskDuty button:hover,
  .results12GoldenTableScope table tbody td.results12CellEmptyOfficial button:hover {
    background: rgba(255,255,255,0.72) !important;
    transform: translateY(-1px) !important;
  }

  @keyframes results12CommercialBluePulse {
    0%, 100% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.38), 0 0 4px rgba(59,120,189,0.10); }
    50% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.50), 0 0 8px rgba(59,120,189,0.20); }
  }

  @keyframes results12CommercialGreenPulse {
    0%, 100% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.38), 0 0 4px rgba(61,139,91,0.10); }
    50% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.50), 0 0 8px rgba(61,139,91,0.20); }
  }

  @keyframes results12CommercialRedPulse {
    0%, 100% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.38), 0 0 4px rgba(191,77,77,0.10); }
    50% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.50), 0 0 8px rgba(191,77,77,0.20); }
  }

  @media (prefers-reduced-motion: reduce) {
    .results12GoldenTableScope * {
      animation: none !important;
      transition: none !important;
    }
  }

  @media print {
    .results12GoldenTableScope,
    .results12GoldenTableScope * {
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
      text-shadow: none !important;
      animation: none !important;
      box-shadow: none !important;
      transition: none !important;
    }

    .results12GoldenTableScope {
      background: #ffffff !important;
      padding: 0 !important;
    }

    .results12GoldenTableScope table {
      box-shadow: none !important;
      border-radius: 0 !important;
    }

    .results12GoldenTableScope table thead th,
    .results12GoldenTableScope table tbody td,
    .results12GoldenTableScope table tfoot td,
    .results12GoldenTableScope table tfoot th {
      padding: 3px 4px !important;
      font-size: 10.5px !important;
    }
  }
`;


const RESULTS12_LATEST_RUN_SETTINGS_DOC_ID = "latestTaskDistributionRun12";
const RESULTS12_ASSIGNMENTS_SUBCOLLECTION = "taskDistributionAssignments12";
const RESULTS12_MASTER_TABLE_KEY = "exam-manager:task-distribution:master-table:v1";
const RESULTS12_RESULTS_TABLE_KEY = "exam-manager:task-distribution:results-table:v1";
const RESULTS12_ALL_TABLE_KEY = "exam-manager:task-distribution:all-table:v1";

function results12LabelForTaskType(taskType: any) {
  const normalized = normalizeResultsTaskType(taskType);
  if (normalized === "INVIGILATION") return "مراقبة";
  if (normalized === "RESERVE") return "احتياط";
  if (normalized === "DUTY_INVIGILATOR") return "مراقب دور";
  if (normalized === "REVIEW_FREE") return "فاضي للمراجعة";
  if (normalized === "CORRECTION_FREE") return "فاضي للتصحيح";
  return "مهمة";
}

function getResults12AssignmentUid(assignment: any, fallbackIndex = -1) {
  return String(
    assignment?.__uid ||
      assignment?.uid ||
      assignment?.id ||
      assignment?.assignmentId ||
      `${assignment?.teacherId || assignment?.teacherName || "teacher"}__${assignment?.dateISO || assignment?.date || "date"}__${assignment?.period || "period"}__${assignment?.taskType || "task"}__${fallbackIndex}`,
  ).trim();
}

function normalizeResults12AssignmentForPersist(
  assignment: any,
  index: number,
  runId: string,
  runCreatedAtISO: string,
) {
  const id = getResults12AssignmentUid(assignment, index) || `${runId}_${index + 1}`;
  const taskType = normalizeResultsTaskType(assignment?.taskType);
  const normalized: any = {
    ...(assignment || {}),
    id,
    __uid: String(assignment?.__uid || assignment?.uid || assignment?.id || id),
    taskType,
    taskTypeLabelAr: results12LabelForTaskType(taskType),
    subject:
      taskType === "DUTY_INVIGILATOR"
        ? "مراقب دور"
        : String(assignment?.subject || assignment?.examSubject || "").trim(),
    runId,
    runCreatedAtISO,
    updatedAtISO: new Date().toISOString(),
  };

  const committeeValue =
    assignment?.committeeNo ??
    assignment?.committeeNumber ??
    assignment?.roomNo ??
    assignment?.roomNumber ??
    assignment?.committee ??
    assignment?.room;

  if (taskType === "INVIGILATION" && committeeValue !== undefined && committeeValue !== null && String(committeeValue).trim()) {
    const committeeString = String(committeeValue).trim();
    normalized.committeeNo = committeeString;
    normalized.committeeNumber = committeeString;
    normalized.roomNo = committeeString;
    normalized.roomNumber = committeeString;
  }

  if (taskType === "DUTY_INVIGILATOR") {
    normalized.dutyInvigilator = true;
    normalized.fullDay = assignment?.fullDay ?? true;
    normalized.coversPeriods = assignment?.coversPeriods || ["AM", "PM"];
  }

  return normalized;
}

function results12AssignmentSlotKey(assignment: any) {
  return [
    String(assignment?.dateISO || assignment?.date || "").trim(),
    String(assignment?.period || "AM").trim() || "AM",
    String(assignment?.examId || "").trim(),
    normalizeSubject(String(assignment?.subject || assignment?.examSubject || "").trim()),
  ].join("__");
}

function results12GetCommitteeValue(assignment: any) {
  const value =
    assignment?.committeeNo ??
    assignment?.committeeNumber ??
    assignment?.roomNo ??
    assignment?.roomNumber ??
    assignment?.committee ??
    assignment?.room;
  const text = String(value ?? "").trim();
  return text || "";
}

function results12EnsureCommitteeNumbersForInvigilation(assignments: any[]) {
  const rows = (Array.isArray(assignments) ? assignments : []).map((item) => ({ ...(item || {}) }));
  const slotCommitteeCounts = new Map<string, Map<string, number>>();

  rows.forEach((assignment) => {
    if (normalizeResultsTaskType(assignment?.taskType) !== "INVIGILATION") return;
    const slotKey = results12AssignmentSlotKey(assignment);
    const committeeValue = results12GetCommitteeValue(assignment);
    if (!slotKey || !committeeValue) return;
    if (!slotCommitteeCounts.has(slotKey)) slotCommitteeCounts.set(slotKey, new Map<string, number>());
    const committeeMap = slotCommitteeCounts.get(slotKey)!;
    committeeMap.set(committeeValue, (committeeMap.get(committeeValue) || 0) + 1);
  });

  rows.forEach((assignment) => {
    if (normalizeResultsTaskType(assignment?.taskType) !== "INVIGILATION") return;

    const slotKey = results12AssignmentSlotKey(assignment);
    let committeeValue = results12GetCommitteeValue(assignment);
    if (!slotCommitteeCounts.has(slotKey)) slotCommitteeCounts.set(slotKey, new Map<string, number>());
    const committeeMap = slotCommitteeCounts.get(slotKey)!;

    if (!committeeValue) {
      const existingCommittees = Array.from(committeeMap.keys())
        .filter(Boolean)
        .sort((a, b) => Number(a) - Number(b) || String(a).localeCompare(String(b), "ar"));
      committeeValue = existingCommittees[0] || "1";
    }

    const nextIndex = Number(assignment?.invigilatorIndex || 0) || ((committeeMap.get(committeeValue) || 0) + 1);
    committeeMap.set(committeeValue, Math.max(committeeMap.get(committeeValue) || 0, nextIndex));

    assignment.committeeNo = committeeValue;
    assignment.committeeNumber = committeeValue;
    assignment.roomNo = committeeValue;
    assignment.roomNumber = committeeValue;
    assignment.invigilatorIndex = nextIndex;
  });

  return rows;
}


type Results12DirectColumn = {
  key: string;
  dateISO: string;
  period: string;
  subject: string;
  label: string;
};

function results12NormalizePeriodForDirect(value: any) {
  const raw = String(value || "AM").trim();
  const lower = raw.toLowerCase();
  if (raw.includes("الثانية") || lower === "pm" || lower === "p" || lower === "bm" || lower.includes("second")) return "PM";
  return "AM";
}

function results12ColumnKeyForAssignment(assignment: any) {
  const taskType = normalizeResultsTaskType(assignment?.taskType);
  const dateISO = String(assignment?.dateISO || assignment?.date || "").slice(0, 10).trim();
  const period = results12NormalizePeriodForDirect(assignment?.period);
  const subject = taskType === "DUTY_INVIGILATOR" ? "مراقب دور" : normalizeSubject(String(assignment?.subject || assignment?.examSubject || "").trim());
  if (!dateISO) return "";
  return [dateISO, period, taskType === "DUTY_INVIGILATOR" ? "DUTY_INVIGILATOR" : subject].join("__");
}

function results12TeacherKeyForDirect(value: any) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function results12SafeAssignmentList(assignments: any[]) {
  return (Array.isArray(assignments) ? assignments : [])
    .map((assignment, index) => ({ ...(assignment || {}), __directIndex: index }))
    .filter((assignment) => {
      const taskType = normalizeResultsTaskType(assignment?.taskType);
      if (!["INVIGILATION", "RESERVE", "DUTY_INVIGILATOR"].includes(taskType)) return false;
      const teacherName = String(assignment?.teacherName || assignment?.teacher || assignment?.name || "").trim();
      const dateISO = String(assignment?.dateISO || assignment?.date || "").trim();
      return Boolean(teacherName && dateISO);
    });
}

function results12CountAssignmentsDeep(value: any, seen = new WeakSet<object>()): number {
  if (!value) return 0;
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + results12CountAssignmentsDeep(item, seen), 0);
  }
  if (typeof value !== "object") return 0;
  if (seen.has(value)) return 0;
  seen.add(value);

  const maybeTaskType = normalizeResultsTaskType((value as any)?.taskType);
  const maybeTeacher = String((value as any)?.teacherName || (value as any)?.teacher || "").trim();
  const maybeDate = String((value as any)?.dateISO || (value as any)?.date || "").trim();
  if (maybeTeacher && maybeDate && ["INVIGILATION", "RESERVE", "DUTY_INVIGILATOR"].includes(maybeTaskType)) return 1;

  if (value instanceof Map) {
    let total = 0;
    value.forEach((item) => {
      total += results12CountAssignmentsDeep(item, seen);
    });
    return total;
  }

  return Object.values(value).reduce<number>((sum, item) => sum + results12CountAssignmentsDeep(item, seen), 0);
}

function Results12DirectLinkedAssignmentsTable(props: { assignments: any[]; lang: "ar" | "en" }) {
  const lang = props.lang || "ar";
  const isAr = lang === "ar";
  const assignments = results12SafeAssignmentList(props.assignments);

  const columns = React.useMemo(() => {
    const map = new Map<string, Results12DirectColumn>();
    for (const assignment of assignments) {
      const key = results12ColumnKeyForAssignment(assignment);
      if (!key || map.has(key)) continue;
      const taskType = normalizeResultsTaskType(assignment?.taskType);
      const dateISO = String(assignment?.dateISO || assignment?.date || "").slice(0, 10).trim();
      const period = results12NormalizePeriodForDirect(assignment?.period);
      const subject = taskType === "DUTY_INVIGILATOR" ? "مراقب دور" : String(assignment?.subject || assignment?.examSubject || "").trim();
      map.set(key, {
        key,
        dateISO,
        period,
        subject,
        label: `${dateISO}\n${period === "PM" ? (isAr ? "الفترة الثانية" : "Second Period") : (isAr ? "الفترة الأولى" : "First Period")}\n${subject}`,
      });
    }
    return Array.from(map.values()).sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.period.localeCompare(b.period) || a.subject.localeCompare(b.subject, isAr ? "ar" : "en"));
  }, [assignments, isAr]);

  const teachers = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const assignment of assignments) {
      const name = String(assignment?.teacherName || assignment?.teacher || assignment?.name || "").replace(/\s+/g, " ").trim();
      if (!name) continue;
      const key = results12TeacherKeyForDirect(name);
      if (!map.has(key)) map.set(key, name);
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, isAr ? "ar" : "en"));
  }, [assignments, isAr]);

  const cellMap = React.useMemo(() => {
    const map = new Map<string, any[]>();
    for (const assignment of assignments) {
      const teacher = results12TeacherKeyForDirect(assignment?.teacherName || assignment?.teacher || assignment?.name || "");
      const col = results12ColumnKeyForAssignment(assignment);
      if (!teacher || !col) continue;
      const key = `${teacher}@@${col}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(assignment);
    }
    return map;
  }, [assignments]);

  if (!assignments.length || !columns.length || !teachers.length) return null;

  const th: React.CSSProperties = {
    border: "1px solid #b89538",
    background: "linear-gradient(180deg,#f8ebc8,#e3c978)",
    color: "#111827",
    padding: "8px 6px",
    fontWeight: 950,
    fontSize: 12,
    whiteSpace: "pre-line",
    textAlign: "center",
    verticalAlign: "middle",
  };
  const td: React.CSSProperties = {
    border: "1px solid rgba(184,149,56,.45)",
    background: "#fffdf7",
    color: "#111827",
    padding: "6px",
    fontWeight: 800,
    fontSize: 12,
    verticalAlign: "top",
    minWidth: 150,
  };

  return (
    <section style={{ margin: "12px 0 16px", border: "2px solid #16a34a", borderRadius: 14, background: "#f0fdf4", padding: 12, direction: isAr ? "rtl" : "ltr" }}>
      <div style={{ fontWeight: 1000, color: "#064e3b", marginBottom: 8 }}>
        {isAr ? "✅ تم استلام بيانات التوزيع — عرض ربط مباشر احتياطي" : "✅ Distribution data received — direct fallback view"}
      </div>
      <div style={{ fontWeight: 850, color: "#111827", marginBottom: 10, lineHeight: 1.7 }}>
        {isAr
          ? "هذا العرض يظهر المهام المحفوظة مباشرة من تشغيل الخوارزمية عندما لا يستطيع جدول النتائج الأصلي بناء الخلايا بسبب اختلاف مفاتيح الربط."
          : "This view renders assignments directly from the saved run when the original results matrix cannot match cell keys."}
      </div>
      <div style={{ overflowX: "auto", maxHeight: "68vh", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: Math.max(900, 180 + columns.length * 160) }}>
          <thead>
            <tr>
              <th style={{ ...th, minWidth: 210 }}>{isAr ? "المعلم" : "Teacher"}</th>
              {columns.map((column) => <th key={column.key} style={th}>{column.label}</th>)}
              <th style={{ ...th, minWidth: 90 }}>{isAr ? "الإجمالي" : "Total"}</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((teacher) => {
              const teacherKey = results12TeacherKeyForDirect(teacher);
              let total = 0;
              return (
                <tr key={teacherKey}>
                  <td style={{ ...td, position: "sticky", right: isAr ? 0 : undefined, left: isAr ? undefined : 0, background: "#fff8df", zIndex: 1 }}>{teacher}</td>
                  {columns.map((column) => {
                    const items = cellMap.get(`${teacherKey}@@${column.key}`) || [];
                    total += items.length;
                    return (
                      <td key={column.key} style={td}>
                        {items.length ? items.map((assignment, index) => {
                          const taskType = normalizeResultsTaskType(assignment?.taskType);
                          const committee = String(assignment?.committeeNo ?? assignment?.committeeNumber ?? assignment?.roomNo ?? assignment?.roomNumber ?? "").trim();
                          const label = results12LabelForTaskType(taskType);
                          return (
                            <div key={String(assignment?.__uid || assignment?.id || assignment?.__directIndex || index)} style={{ border: "1px solid #d1b66a", borderRadius: 10, background: "#ffffff", padding: "5px 6px", marginBottom: 4, lineHeight: 1.55 }}>
                              <div>{label}</div>
                              {committee ? <div>{isAr ? "اللجنة" : "Committee"}: {committee}</div> : null}
                            </div>
                          );
                        }) : <span style={{ color: "#6b7280" }}>—</span>}
                      </td>
                    );
                  })}
                  <td style={{ ...td, textAlign: "center", fontWeight: 1000 }}>{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}


function results12RemoveUndefinedForFirestore(value: any): any {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value
      .map((item) => results12RemoveUndefinedForFirestore(item))
      .filter((item) => item !== undefined);
  }
  if (typeof value === "object") {
    const out: any = {};
    Object.entries(value).forEach(([key, item]) => {
      const cleaned = results12RemoveUndefinedForFirestore(item);
      if (cleaned !== undefined) out[key] = cleaned;
    });
    return out;
  }
  return value;
}

function normalizeSubject(subject: string) {
  return String(subject || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getCommitteeNo(a: any) {
  const value = a?.committeeNo ?? a?.committee ?? a?.roomNo ?? a?.room;
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}

function getSubjectBackground(subject?: string) {
  const normalized = normalizeSubject(String(subject || ""));
  return subjectColors[normalized] || "rgba(212,175,55,0.18)";
}

function getTenantIdFromAuth(auth: any) {
  return (
    String(
      auth?.effectiveTenantId ||
        auth?.profile?.tenantId ||
        auth?.userProfile?.tenantId ||
        auth?.user?.tenantId ||
        "default",
    ).trim() || "default"
  );
}

const OFFICIAL_TASK_CLASS_NAMES = [
  "results12TaskInvigilation",
  "results12TaskReserve",
  "results12TaskDuty",
  "results12CellEmptyOfficial",
];

function cleanArabicText(value: string) {
  return String(value || "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isAddActionText(value: string) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  const text = cleanArabicText(raw).toLowerCase();

  return (
    !text ||
    text === "+" ||
    /^\+/.test(raw) ||
    /^(اضافة|إضافة|add)(\s|$)/i.test(raw) ||
    /\+\s*(احتياط|مراقبة|مراقب|فاضي|review|correction|reserve|invigilation|duty)/i.test(raw) ||
    /(فاضي\s*للمراجعة|فاضي\s*للتصحيح|free\s*for\s*review|free\s*for\s*correction)/i.test(text)
  );
}

function getOfficialTaskClassFromText(value: string) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  const text = cleanArabicText(raw).toLowerCase();

  if (!text) return "results12CellEmptyOfficial";
  if (isAddActionText(raw)) return "";

  if (/مراقب\s*دور|duty\s*invigilator/.test(text)) return "results12TaskDuty";
  if (/(^|\s)(احتياط|reserve)(\s|$)/.test(text)) return "results12TaskReserve";
  if (/مراقبة|invigilation/.test(text)) return "results12TaskInvigilation";

  return "";
}

function isOfficialEmptyCellText(value: string) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  const text = cleanArabicText(raw);

  return (
    !text ||
    text === "—" ||
    text === "-" ||
    text === "+" ||
    text === "إضافة" ||
    text === "اضافة" ||
    text.toLowerCase() === "add" ||
    isAddActionText(raw)
  );
}


function getCellTextWithoutActionButtons(cell: HTMLElement) {
  const clone = cell.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll("button, [role='button']")
    .forEach((node) => node.parentElement?.removeChild(node));
  return String(clone.textContent || "").replace(/\s+/g, " ").trim();
}

function applyOfficialTaskClasses(root: HTMLElement | null) {
  if (!root) return;

  OFFICIAL_TASK_CLASS_NAMES.forEach((className) => {
    root
      .querySelectorAll(`.${className}`)
      .forEach((node) => node.classList.remove(className));
  });

  const cells = Array.from(
    root.querySelectorAll<HTMLElement>(
      "tbody td, [role='cell'], [role='gridcell']",
    ),
  );

  cells.forEach((cell) => {
    const fullCellText = String(cell.textContent || "");
    const textWithoutButtons = getCellTextWithoutActionButtons(cell);
    const buttons = Array.from(
      cell.querySelectorAll<HTMLElement>("button, [role='button']"),
    );
    const hasAddActionButton = buttons.some((button) =>
      isAddActionText(button.textContent || ""),
    );
    const hasOnlyAddActions =
      buttons.length > 0 &&
      buttons.every((button) => isAddActionText(button.textContent || ""));

    if (
      hasOnlyAddActions ||
      (hasAddActionButton && isOfficialEmptyCellText(textWithoutButtons)) ||
      isOfficialEmptyCellText(fullCellText)
    ) {
      cell.classList.add("results12CellEmptyOfficial");
      return;
    }

    const cellClass = getOfficialTaskClassFromText(
      textWithoutButtons || fullCellText,
    );
    if (cellClass) {
      cell.classList.add(cellClass);
    }
  });
}

function normalizeResultsTaskType(taskType: any) {
  const raw = String(taskType || "")
    .trim()
    .toUpperCase();

  if (
    raw === "INVIGILATION" ||
    raw === "RESERVE" ||
    raw === "DUTY_INVIGILATOR" ||
    raw === "REVIEW_FREE" ||
    raw === "CORRECTION_FREE"
  ) {
    return raw;
  }

  return raw || "DUTY_INVIGILATOR";
}

function normalizeRunForDutyInvigilator(run: any) {
  if (!run || !Array.isArray(run.assignments)) return run;

  return {
    ...run,
    assignments: run.assignments.map((assignment: any) => {
      const taskType = normalizeResultsTaskType(assignment?.taskType);
      if (taskType !== "DUTY_INVIGILATOR") return { ...assignment, taskType };

      const subject = "مراقب دور";

      return {
        ...assignment,
        taskType: "DUTY_INVIGILATOR",
        taskTypeLabelAr: "مراقب دور",
        subject,
        dutyInvigilator: true,
        fullDay: assignment?.fullDay ?? true,
        coversPeriods: assignment?.coversPeriods || ["AM", "PM"],
        reviewBySubject1Only: undefined,
        correctionFixedNextDayOnly: undefined,
        basedOnExamTableOnly: undefined,
      };
    }),
  };
}

function results12ReadJsonSafe<T = any>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function results12ExtractAssignments(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.assignments)) return payload.assignments;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.run?.assignments)) return payload.run.assignments;
  return [];
}

function results12BuildRunFromStoredBridge(existingRun?: any) {
  const payloads = [
    results12ReadJsonSafe<any>(RESULTS12_MASTER_TABLE_KEY),
    results12ReadJsonSafe<any>(RESULTS12_ALL_TABLE_KEY),
    results12ReadJsonSafe<any>(RESULTS12_RESULTS_TABLE_KEY),
  ].filter(Boolean);

  for (const payload of payloads) {
    const assignments = results12ExtractAssignments(payload);
    if (!assignments.length) continue;

    const meta = payload?.meta || {};
    const runId = String(payload?.runId || payload?.run?.runId || meta?.runId || existingRun?.runId || `results12_local_${Date.now()}`).trim();
    const createdAtISO = String(payload?.createdAtISO || payload?.run?.createdAtISO || meta?.runCreatedAtISO || meta?.createdAtISO || existingRun?.createdAtISO || new Date().toISOString()).trim();

    return normalizeRunForDutyInvigilator({
      ...(existingRun || {}),
      ...(payload?.run || {}),
      runId,
      createdAtISO,
      updatedAtISO: String(meta?.updatedAtISO || payload?.updatedAtISO || new Date().toISOString()).trim(),
      assignments: assignments.map((assignment: any, index: number) =>
        normalizeResults12AssignmentForPersist(assignment, index, runId, createdAtISO),
      ),
      warnings: Array.isArray(payload?.warnings) ? payload.warnings : Array.isArray(payload?.run?.warnings) ? payload.run.warnings : existingRun?.warnings || [],
      debug: payload?.debug || payload?.run?.debug || existingRun?.debug || null,
    });
  }

  return existingRun || null;
}

function results12BuildRunFromCloudBridge(settings: any, assignmentRows: any[], existingRun?: any) {
  const settingsAssignments = Array.isArray(settings?.assignments) ? settings.assignments : [];
  const runAssignments = Array.isArray(settings?.run?.assignments) ? settings.run.assignments : [];
  const sourceAssignments = Array.isArray(assignmentRows) && assignmentRows.length
    ? assignmentRows
    : runAssignments.length
      ? runAssignments
      : settingsAssignments;

  if (!sourceAssignments.length) return null;

  const runId = String(settings?.run?.runId || settings?.runId || existingRun?.runId || `results12_cloud_${Date.now()}`).trim();
  const createdAtISO = String(settings?.run?.createdAtISO || settings?.createdAtISO || settings?.updatedAtISO || existingRun?.createdAtISO || new Date().toISOString()).trim();

  return normalizeRunForDutyInvigilator({
    ...(existingRun || {}),
    ...(settings?.run || {}),
    runId,
    createdAtISO,
    updatedAtISO: String(settings?.updatedAtISO || new Date().toISOString()).trim(),
    assignments: sourceAssignments.map((assignment: any, index: number) =>
      normalizeResults12AssignmentForPersist(assignment, index, runId, createdAtISO),
    ),
    warnings: Array.isArray(settings?.run?.warnings)
      ? settings.run.warnings
      : Array.isArray(settings?.warnings)
        ? settings.warnings
        : existingRun?.warnings || [],
    debug: settings?.run?.debug || settings?.debug || existingRun?.debug || null,
  });
}

function results12PersistRunBridge(tenantId: string, nextRun: any, setRun?: (run: any) => void, source = "task-distribution-results12-bridge", notifyLinkedPages = false) {
  if (!nextRun || !Array.isArray(nextRun.assignments) || !nextRun.assignments.length) return;

  const runId = String(nextRun.runId || `results12_bridge_${Date.now()}`).trim();
  const createdAtISO = String(nextRun.createdAtISO || new Date().toISOString()).trim();
  const updatedAtISO = new Date().toISOString();

  const payload = {
    rows: nextRun.assignments,
    data: nextRun.assignments,
    assignments: nextRun.assignments,
    meta: {
      runId,
      runCreatedAtISO: createdAtISO,
      createdAtISO,
      updatedAtISO,
      assignmentsCount: nextRun.assignments.length,
      source,
    },
    warnings: Array.isArray(nextRun?.warnings) ? nextRun.warnings : [],
    debug: nextRun?.debug || null,
  };

  saveRun(tenantId, { ...nextRun, runId, createdAtISO, updatedAtISO });

  try {
    localStorage.setItem(RESULTS12_MASTER_TABLE_KEY, JSON.stringify(payload));
    localStorage.setItem(RESULTS12_RESULTS_TABLE_KEY, JSON.stringify(payload));
    localStorage.setItem(RESULTS12_ALL_TABLE_KEY, JSON.stringify(payload));
  } catch {}

  try {
    setRun?.({ ...nextRun, runId, createdAtISO, updatedAtISO });
  } catch {}

  if (notifyLinkedPages) {
    try {
      window.dispatchEvent(new CustomEvent(RUN_UPDATED_EVENT, { detail: { tenantId, source, runId, timestamp: Date.now() } }));
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent(MASTER_TABLE_UPDATED_EVENT, { detail: { tenantId, source, runId, timestamp: Date.now() } }));
    } catch {}
  }
}

export default function TaskDistributionResults() {
  const nav = useNavigate();
  const auth = useAuth();
  const { lang } = useI18n();
  const tr = React.useCallback(
    (ar: string, en: string) => (lang === "ar" ? ar : en),
    [lang],
  );
  const tenantId = React.useMemo(() => getTenantIdFromAuth(auth), [auth]);
  const currentUserId = React.useMemo(
    () => String((auth as any)?.user?.email || (auth as any)?.user?.uid || "").trim(),
    [auth],
  );
  const printAreaRef = React.useRef<HTMLDivElement>(null);
  const [showTeacherSidebar, setShowTeacherSidebar] = React.useState(true);

  const phoneGateKey = React.useMemo(
    () => `${RESULTS12_PHONE_GATE_PREFIX}${tenantId}`,
    [tenantId],
  );
  const [registeredPhone, setRegisteredPhone] = React.useState("");
  const [phoneGateInput, setPhoneGateInput] = React.useState("");
  const [phoneGateError, setPhoneGateError] = React.useState("");
  const [phoneGateLoading, setPhoneGateLoading] = React.useState(true);
  const [phoneGatePassed, setPhoneGatePassed] = React.useState(() => {
    try {
      return sessionStorage.getItem(`${RESULTS12_PHONE_GATE_PREFIX}${tenantId}`) === "ok";
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    let mounted = true;
    setPhoneGateLoading(true);
    setPhoneGateError("");

    try {
      setPhoneGatePassed(sessionStorage.getItem(phoneGateKey) === "ok");
    } catch {
      setPhoneGatePassed(false);
    }

    async function loadPhoneForGate() {
      try {
        const settings = await loadTenantSettings<Results12ExamCenterPhoneSettings>(
          tenantId,
          RESULTS12_EXAM_CENTER_SETTINGS_DOC_ID,
          {},
        );
        if (!mounted) return;
        setRegisteredPhone(results12NormalizePhoneForCompare(settings?.phone || ""));
      } catch {
        if (!mounted) return;
        setRegisteredPhone("");
        setPhoneGateError(tr("تعذر تحميل رقم الهاتف المسجل من السحابة.", "Could not load the registered phone number from cloud."));
      } finally {
        if (mounted) setPhoneGateLoading(false);
      }
    }

    void loadPhoneForGate();

    return () => {
      mounted = false;
    };
  }, [tenantId, phoneGateKey, tr]);

  const verifyPhoneGate = React.useCallback(() => {
    const saved = results12NormalizePhoneForCompare(registeredPhone);
    const entered = results12NormalizePhoneForCompare(phoneGateInput);

    if (!saved) {
      setPhoneGateError(tr("لا يوجد رقم هاتف محفوظ في إعدادات مركز الدبلوم.", "No phone number is saved in the Diploma Center settings."));
      return;
    }

    if (!entered) {
      setPhoneGateError(tr("أدخل رقم الهاتف أولًا.", "Enter the phone number first."));
      return;
    }

    if (entered !== saved) {
      setPhoneGateError(tr("رقم الهاتف غير مطابق.", "The phone number does not match."));
      return;
    }

    try {
      sessionStorage.setItem(phoneGateKey, "ok");
    } catch {}
    setPhoneGateError("");
    setPhoneGatePassed(true);
  }, [phoneGateInput, phoneGateKey, registeredPhone, tr]);


  const formatPeriod = React.useCallback(
    (period?: string) => {
      const raw = String(period || "AM").replace(/\s+/g, " ").trim();
      const lower = raw.toLowerCase();
      const compact = lower.replace(/[\.\s_-]+/g, "");
      const isSecond =
        raw.includes("الثانية") ||
        raw.includes("ثانيه") ||
        lower.includes("second") ||
        compact === "pm" ||
        compact === "bm" ||
        compact === "p2" ||
        compact === "period2" ||
        compact === "2" ||
        compact === "p";

      return isSecond
        ? tr("الفترة الثانية", "Second Period")
        : tr("الفترة الأولى", "First Period");
    },
    [tr],
  );

  const taskLabel = React.useCallback(
    (taskType: any) => {
      switch (String(taskType || "")) {
        case "INVIGILATION":
          return tr("مراقبة", "Invigilation");
        case "RESERVE":
          return tr("احتياط", "Reserve");
        case "DUTY_INVIGILATOR":
          return tr("مراقب دور", "Duty Invigilator");
        case "REVIEW_FREE":
          return tr("فاضي للمراجعة", "Free for review");
        case "CORRECTION_FREE":
          return tr("فاضي للتصحيح", "Free for correction");
        default:
          return tr("مهمة", "Task");
      }
    },
    [tr],
  );

  const formatDateWithDay = React.useCallback(
    (dateISO: string) => {
      const value = String(dateISO || "").trim();
      if (!value) return { day: "—", full: "—", line: "—" };

      const d = new Date(`${value}T00:00:00`);
      if (Number.isNaN(d.getTime()))
        return { day: value, full: value, line: value };

      const locale = lang === "ar" ? "ar" : "en";
      const day = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(
        d,
      );
      const full = new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);

      return { day, full, line: `${day} ${full}` };
    },
    [lang],
  );

  const { run, setRun } = useResultsRunSync(tenantId);
  const runForResults = React.useMemo(
    () => normalizeRunForDutyInvigilator(run),
    [run],
  );
  React.useEffect(() => {
    let cancelled = false;

    const hydrateFromLocalBridge = () => {
      const nextRun = results12BuildRunFromStoredBridge(loadRun(tenantId) || run);
      if (!cancelled && nextRun?.assignments?.length) {
        results12PersistRunBridge(tenantId, nextRun, setRun, "task-distribution-results12-local-bridge");
      }
    };

    hydrateFromLocalBridge();

    const hydrateFromCloudBridge = async () => {
      try {
        const [settings, assignmentRows] = await Promise.all([
          loadTenantSettings<any>(tenantId, RESULTS12_LATEST_RUN_SETTINGS_DOC_ID, {}).catch(() => ({})),
          loadTenantArray<any>(tenantId, RESULTS12_ASSIGNMENTS_SUBCOLLECTION, { cacheFallback: true } as any).catch(() => []),
        ]);

        if (cancelled) return;

        const nextRun = results12BuildRunFromCloudBridge(settings, Array.isArray(assignmentRows) ? assignmentRows : [], loadRun(tenantId) || run);
        if (nextRun?.assignments?.length) {
          results12PersistRunBridge(tenantId, nextRun, setRun, "task-distribution-results12-cloud-bridge");
        }
      } catch {
        // local bridge above remains the safe fallback
      }
    };

    void hydrateFromCloudBridge();

    const onLinkedRunUpdated = (event: any) => {
      const eventTenantId = String(event?.detail?.tenantId || "").trim();
      if (eventTenantId && eventTenantId !== tenantId) return;
      hydrateFromLocalBridge();
    };

    window.addEventListener(RUN_UPDATED_EVENT, onLinkedRunUpdated as any);
    window.addEventListener(MASTER_TABLE_UPDATED_EVENT, onLinkedRunUpdated as any);
    window.addEventListener("focus", hydrateFromLocalBridge);

    return () => {
      cancelled = true;
      window.removeEventListener(RUN_UPDATED_EVENT, onLinkedRunUpdated as any);
      window.removeEventListener(MASTER_TABLE_UPDATED_EVENT, onLinkedRunUpdated as any);
      window.removeEventListener("focus", hydrateFromLocalBridge);
    };
  }, [tenantId, run?.runId, setRun]);

  const interaction = useResultsInteractionState(tenantId);
  const dataModel = useResultsDataModel({
    tenantId,
    run: runForResults,
    normalizeSubject,
  });

  const pageActions = useResultsPageActions({
    tenantId,
    run: runForResults,
    setRun,
    setUndoStack: interaction.setUndoStack,
    fileInputRef: interaction.fileInputRef,
    printAreaRef,
    pendingImported: interaction.pendingImported,
    setPendingImported: interaction.setPendingImported,
    pendingImportedFilename: interaction.pendingImportedFilename,
    setPendingImportedFilename: interaction.setPendingImportedFilename,
    setImportDialogOpen: interaction.setImportDialogOpen,
    importError: interaction.importError,
    setImportError: interaction.setImportError,
    onArchived: () => nav("/archive"),
  });

  const persistEditedAssignments12 = React.useCallback(
    (nextAssignmentsInput: any[], note?: string, opts?: { skipUndo?: boolean }) => {
      const nowISO = new Date().toISOString();
      const runId = String(runForResults?.runId || `results12_${Date.now()}`).trim();
      const createdAtISO = String(runForResults?.createdAtISO || nowISO).trim();
      const normalizedAssignments = results12EnsureCommitteeNumbersForInvigilation(
        (Array.isArray(nextAssignmentsInput) ? nextAssignmentsInput : []).map(
          (assignment: any, index: number) =>
            results12RemoveUndefinedForFirestore(
              normalizeResults12AssignmentForPersist(assignment, index, runId, createdAtISO),
            ),
        ),
      ).map((assignment: any) => results12RemoveUndefinedForFirestore(assignment));

      const nextRun = results12RemoveUndefinedForFirestore(
        normalizeRunForDutyInvigilator({
          ...(runForResults || {}),
          runId,
          createdAtISO,
          updatedAtISO: nowISO,
          assignments: normalizedAssignments,
        }),
      );

      const tablePayload = {
        rows: normalizedAssignments,
        data: normalizedAssignments,
        assignments: normalizedAssignments,
        meta: {
          runId,
          runCreatedAtISO: createdAtISO,
          updatedAtISO: nowISO,
          source: "task-distribution-results12",
          note: note || "manual_edit_from_results12",
        },
        warnings: Array.isArray(nextRun?.warnings) ? nextRun.warnings : [],
        debug: nextRun?.debug || null,
      };

      try {
        if (!opts?.skipUndo) {
          interaction.setUndoStack((prev: any[]) =>
            [runForResults, ...(Array.isArray(prev) ? prev : [])].filter(Boolean).slice(0, 20),
          );
        }
      } catch {}

      saveRun(tenantId, nextRun);

      try {
        localStorage.setItem(RESULTS12_MASTER_TABLE_KEY, JSON.stringify(tablePayload));
        localStorage.setItem(RESULTS12_RESULTS_TABLE_KEY, JSON.stringify(tablePayload));
        localStorage.setItem(RESULTS12_ALL_TABLE_KEY, JSON.stringify(tablePayload));
      } catch {}

      try {
        setRun(nextRun as any);
      } catch {}

      try {
        window.dispatchEvent(
          new CustomEvent(RUN_UPDATED_EVENT, { detail: { tenantId, source: "task-distribution-results12", note } }),
        );
      } catch {}
      try {
        window.dispatchEvent(
          new CustomEvent(MASTER_TABLE_UPDATED_EVENT, { detail: { tenantId, source: "task-distribution-results12", note } }),
        );
      } catch {}

      void (async () => {
        try {
          await replaceTenantArray(tenantId, RESULTS12_ASSIGNMENTS_SUBCOLLECTION, normalizedAssignments as any[], {
            by: currentUserId || undefined,
            audit: {
              entity: RESULTS12_ASSIGNMENTS_SUBCOLLECTION,
              meta: { source: "task-distribution-results12", note: note || "manual_edit", runId, count: normalizedAssignments.length },
            },
          } as any);

          await saveTenantSettings(
            tenantId,
            RESULTS12_LATEST_RUN_SETTINGS_DOC_ID,
            results12RemoveUndefinedForFirestore({
              runId,
              createdAtISO,
              updatedAtISO: nowISO,
              assignmentsCount: normalizedAssignments.length,
              assignments: normalizedAssignments,
              warnings: Array.isArray(nextRun?.warnings) ? nextRun.warnings : [],
              debug: nextRun?.debug || null,
              summary: nextRun?.debug?.summary || null,
              run: nextRun,
              updatedBy: currentUserId || undefined,
            }),
            { by: currentUserId || undefined } as any,
          );

          void writeTenantAudit(tenantId, {
            action: "task_distribution_results12_manual_edit",
            entity: RESULTS12_ASSIGNMENTS_SUBCOLLECTION,
            by: currentUserId || undefined,
            meta: { note: note || "manual_edit", runId, count: normalizedAssignments.length },
          }).catch(() => {});
        } catch (error) {
          console.error("Failed to persist TaskDistributionResults12 changes", error);
          alert(
            tr(
              "تم تعديل الجدول محليًا، لكن تعذر حفظه في السحابة. تحقق من الاتصال أو صلاحيات Firestore.",
              "The table was updated locally, but cloud saving failed. Check connection or Firestore permissions.",
            ),
          );
        }
      })();

      return nextRun;
    },
    [currentUserId, interaction, runForResults, setRun, tenantId, tr],
  );

  const tableActions = useResultsTableActions({
    tenantId,
    run: runForResults,
    teacherNameToId: dataModel.teacherNameToId,
    colKeyToExamId: dataModel.colKeyToExamId,
    examKeyToCommittees: dataModel.examKeyToCommittees,
    invigilatorsPerRoomForSubject: dataModel.invigilatorsPerRoomForSubject,
    unavailIndex: interaction.unavailIndex,
    unavailReasonMap: interaction.unavailReasonMap,
    markCellBlocked: interaction.markCellBlocked,
    normalizeSubject,
    persistEditedAssignments: persistEditedAssignments12,
    displayDates: dataModel.displayDates,
    dateToSubCols: dataModel.dateToSubCols,
    allSubCols: dataModel.allSubCols,
    allTeachers: dataModel.allTeachers,
    matrix2: dataModel.matrix2,
    committeesCountBySubCol: dataModel.committeesCountBySubCol,
    totalsDetailBySubCol: dataModel.totalsDetailBySubCol,
    teacherTotals: dataModel.teacherTotals,
  });

  const addTaskToEmptyCellSynced = React.useCallback(
    (dstTeacher: string, dstColKey: string, taskType: string) => {
      const safeTaskType =
        normalizeResultsTaskType(taskType) || "DUTY_INVIGILATOR";
      tableActions.addTaskToEmptyCell(dstTeacher, dstColKey, safeTaskType);
    },
    [tableActions],
  );

  const isDraggableTaskTypeSynced = React.useCallback(
    (taskType: any) =>
      String(taskType || "")
        .trim()
        .toUpperCase() === "DUTY_INVIGILATOR" ||
      tableActions.isDraggableTaskType(taskType),
    [tableActions],
  );

  const getAssignmentsInCell = React.useCallback(
    (teacher: string, subColKey: string) =>
      tableActions.getAssignmentsInCell(
        runForResults?.assignments || [],
        teacher,
        subColKey,
        normalizeSubject,
      ),
    [runForResults, tableActions],
  );

  useResultsClipboardShortcuts({
    selectedCell: interaction.selectedCell,
    clipboardUid: interaction.clipboardUid,
    setClipboardUid: interaction.setClipboardUid,
    run: runForResults,
    getAssignmentsInCell,
    swapAssignmentsByUid: tableActions.swapAssignmentsByUid,
    moveAssignmentToColumnTeacher: tableActions.moveAssignmentToColumnTeacher,
    isDraggableTaskType: isDraggableTaskTypeSynced,
  });

  const columnColor = React.useCallback((index: number) => {
    const tones = [
      { colBg: "rgba(2,132,199,.14)", headBg: "rgba(2,132,199,.22)" },
      { colBg: "rgba(99,102,241,.14)", headBg: "rgba(99,102,241,.22)" },
      { colBg: "rgba(168,85,247,.14)", headBg: "rgba(168,85,247,.22)" },
      { colBg: "rgba(34,197,94,.14)", headBg: "rgba(34,197,94,.22)" },
    ];
    return tones[index % tones.length];
  }, []);

  const teacherRowColor = React.useCallback(
    (index: number) => ({
      stripe: ["#38bdf8", "#c084fc", "#22c55e", "#f59e0b", "#ef4444"][
        index % 5
      ],
    }),
    [],
  );

  const styles = React.useMemo(
    () => ({
      ...OFFICIAL_HEADER_STYLES_INPUT,
      ...getResultsTableHeaderStyles(OFFICIAL_HEADER_STYLES_INPUT),
    }),
    [],
  );

  const hasRun = Boolean(
    runForResults &&
    Array.isArray(runForResults.assignments) &&
    runForResults.assignments.length,
  );

  const directFallbackAssignments = React.useMemo(
    () => results12SafeAssignmentList(runForResults?.assignments || []),
    [runForResults],
  );

  const visibleMatrixAssignmentsCount = React.useMemo(
    () => results12CountAssignmentsDeep(dataModel?.matrix2),
    [dataModel?.matrix2],
  );

  const shouldShowDirectLinkedFallback = Boolean(
    hasRun && directFallbackAssignments.length > 0 && visibleMatrixAssignmentsCount === 0,
  );

  React.useEffect(() => {
    if (!hasRun) return;

    const apply = () => applyOfficialTaskClasses(printAreaRef.current);
    const frame = window.requestAnimationFrame(apply);

    if (typeof MutationObserver === "undefined" || !printAreaRef.current) {
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new MutationObserver(() => apply());
    observer.observe(printAreaRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [
    hasRun,
    runForResults,
    dataModel.allSubCols.length,
    dataModel.allTeachers.length,
    showTeacherSidebar,
    interaction.tableFullScreen,
  ]);

  const content = !hasRun ? (
    <ResultsEmptyRunState
      importError={interaction.importError}
      fileInputRef={interaction.fileInputRef}
      onBack={() => nav("/task-distribution/run")}
      onPickImportFile={pageActions.handlePickImportFile}
      onImportFileSelected={pageActions.handleImportFileSelected}
    />
  ) : (
    <>
      {!interaction.tableFullScreen ? (
        <div style={OFFICIAL_PANEL_STYLE}>
          <ResultsPageHeader
            runId={String(runForResults?.runId || "—")}
            createdAtISO={runForResults?.createdAtISO}
            importError={interaction.importError || undefined}
            tableFullScreen={interaction.tableFullScreen}
            undoDisabled={!interaction.undoStack.length}
            onGoHome={() => nav("/task-distribution/run")}
            onPickImportFile={pageActions.handlePickImportFile}
            onExportPdf={pageActions.handleExportPdf}
            onArchiveSnapshot={pageActions.handleArchiveSnapshot}
            onToggleFullscreen={() =>
              interaction.setTableFullScreen(!interaction.tableFullScreen)
            }
            onUndo={() => pageActions.handleUndo(interaction.undoStack)}
            onExportExcel={tableActions.exportExcel}
            onPrintTableOnly={pageActions.handlePrintTableOnly}
            showTeacherSidebar={showTeacherSidebar}
            onToggleTeacherSidebar={() => setShowTeacherSidebar((v) => !v)}
          />
        </div>
      ) : null}

      <div ref={printAreaRef}>
        {shouldShowDirectLinkedFallback ? (
          <Results12DirectLinkedAssignmentsTable
            assignments={directFallbackAssignments}
            lang={lang}
          />
        ) : null}

        <ResultsTable
          displayDates={dataModel.displayDates}
          dateToSubCols={dataModel.dateToSubCols}
          allSubCols={dataModel.allSubCols}
          allTeachers={dataModel.allTeachers}
          matrix2={dataModel.matrix2}
          committeesCountBySubCol={dataModel.committeesCountBySubCol}
          totalsDetailBySubCol={dataModel.totalsDetailBySubCol}
          teacherTotals={dataModel.teacherTotals}
          columnColor={columnColor}
          teacherRowColor={teacherRowColor}
          getSubjectBackground={getSubjectBackground}
          taskLabel={taskLabel}
          normalizeSubject={normalizeSubject}
          formatPeriod={formatPeriod}
          getCommitteeNo={getCommitteeNo}
          isDraggableTaskType={isDraggableTaskTypeSynced}
          dragSrcUid={interaction.dragSrcUid}
          dragOverUid={interaction.dragOverUid}
          setDragSrcUid={interaction.setDragSrcUid}
          setDragOverUid={interaction.setDragOverUid}
          onSwap={tableActions.swapAssignmentsByUid}
          onDropToEmpty={tableActions.handleDropToEmptyCell}
          onDropToCell={tableActions.handleDropToCell}
          onAddToEmpty={addTaskToEmptyCellSynced}
          onDeleteByUid={tableActions.deleteAssignmentByUid}
          onDeleteSubCol={tableActions.deleteAssignmentsBySubCol}
          styles={styles as any}
          formatDateWithDayAr={formatDateWithDay}
          containerMaxHeight={
            interaction.tableFullScreen ? "calc(100vh - 120px)" : "72vh"
          }
          selectedCell={interaction.selectedCell}
          onSelectCell={interaction.setSelectedCell}
          isConflictUid={(uid) => dataModel.conflictUids.has(uid)}
          getUnavailabilityReasonForCell={
            tableActions.getUnavailabilityReasonForCell
          }
          blockedCellMsg={interaction.blockedCellMsg}
          showTeacherSidebar={showTeacherSidebar}
        />

        <div style={{ marginTop: 16 }}>
          <ResultsFooterPanels
            warnings={dataModel.warnings}
            assignmentsCount={dataModel.assignments.length}
            daysCount={dataModel.displayDates.length}
            columnsCount={dataModel.allSubCols.length}
            teachersCount={dataModel.allTeachers.length}
          />
        </div>
      </div>
    </>
  );

  const sharedImportControls = (
    <>
      <input
        ref={interaction.fileInputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        style={{ display: "none" }}
        onChange={pageActions.handleImportFileSelected}
      />

      <ResultsImportConfirmDialog
        open={interaction.importDialogOpen}
        filename={interaction.pendingImportedFilename}
        onConfirm={pageActions.confirmImportReplace}
        onCancel={pageActions.closeImportDialog}
      />
    </>
  );


  if (!phoneGatePassed) {
    return (
      <div className="results12GoldenTableScope" style={OFFICIAL_PAGE_STYLE}>
        <style>{OFFICIAL_GOLDEN_TABLE_CSS}</style>
        <div style={{ ...container, width: "min(780px, 100%)", maxWidth: "100%", margin: "0 auto", paddingTop: 48 }}>
          <section
            style={{
              ...OFFICIAL_PANEL_STYLE,
              padding: 24,
              borderRadius: 20,
              border: "2px solid #b89538",
              boxShadow: "0 18px 44px rgba(80,60,20,0.18)",
              direction: lang === "ar" ? "rtl" : "ltr",
            }}
          >
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 950, color: "#111827" }}>
              {tr("مصادقة رقم الهاتف", "Phone authentication")}
            </h1>
            <p style={{ margin: "12px 0 0", fontSize: 14, fontWeight: 800, lineHeight: 1.9, color: "#374151" }}>
              {tr(
                "أدخل رقم الهاتف المسجل في إعدادات مركز الدبلوم لفتح صفحة نتائج التوزيع.",
                "Enter the phone number saved in Diploma Center settings to open the distribution results page.",
              )}
            </p>

            <div style={{ marginTop: 18, padding: 12, border: "1px solid #d1b66a", borderRadius: 14, background: "#fff8df", fontWeight: 900 }}>
              {tr("الرقم المسجل:", "Registered number:")} {phoneGateLoading ? tr("جاري التحميل...", "Loading...") : results12MaskPhone(registeredPhone)}
            </div>

            <input
              type="tel"
              inputMode="numeric"
              autoComplete="off"
              value={phoneGateInput}
              onChange={(event) => {
                setPhoneGateInput(event.target.value);
                setPhoneGateError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") verifyPhoneGate();
              }}
              placeholder={tr("أدخل رقم الهاتف", "Enter phone number")}
              disabled={phoneGateLoading}
              style={{
                width: "100%",
                marginTop: 14,
                padding: "14px 16px",
                borderRadius: 14,
                border: "2px solid #947329",
                background: "#fffdf7",
                color: "#111827",
                fontSize: 18,
                fontWeight: 900,
                outline: "none",
                boxSizing: "border-box",
              }}
            />

            {phoneGateError ? (
              <div style={{ marginTop: 12, padding: 10, borderRadius: 12, border: "1px solid #dc2626", background: "#fef2f2", color: "#991b1b", fontWeight: 900 }}>
                {phoneGateError}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-start", flexWrap: "wrap", marginTop: 18 }}>
              <button
                type="button"
                onClick={verifyPhoneGate}
                disabled={phoneGateLoading}
                style={{
                  border: "2px solid #111827",
                  borderRadius: 14,
                  background: "linear-gradient(180deg, #f8ebc8 0%, #e3c978 100%)",
                  color: "#111827",
                  padding: "11px 18px",
                  cursor: phoneGateLoading ? "not-allowed" : "pointer",
                  fontWeight: 950,
                }}
              >
                {tr("دخول", "Enter")}
              </button>
              <button
                type="button"
                onClick={() => nav("/task-distribution/run")}
                style={{
                  border: "2px solid #6b7280",
                  borderRadius: 14,
                  background: "#fffdf7",
                  color: "#111827",
                  padding: "11px 18px",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                {tr("عودة", "Back")}
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (interaction.tableFullScreen && hasRun) {
    return (
      <div
        className="results12GoldenTableScope"
        style={{ ...OFFICIAL_PAGE_STYLE, padding: 8 }}
      >
        <style>{OFFICIAL_GOLDEN_TABLE_CSS}</style>
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "#f8f2e6",
            padding: 8,
            overflow: "auto",
          }}
        >
          <div
            style={{
              ...container,
              width: "100%",
              maxWidth: "100%",
              padding: 0,
            }}
          >
            <ResultsFullscreenToolbar
              undoDisabled={!interaction.undoStack.length}
              onUndo={() => pageActions.handleUndo(interaction.undoStack)}
              onClose={() => interaction.setTableFullScreen(false)}
              showTeacherSidebar={showTeacherSidebar}
              onToggleTeacherSidebar={() => setShowTeacherSidebar((v) => !v)}
            />
            {sharedImportControls}
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="results12GoldenTableScope" style={OFFICIAL_PAGE_STYLE}>
      <style>{OFFICIAL_GOLDEN_TABLE_CSS}</style>
      <div
        style={{ ...container, width: "min(1880px, 100%)", maxWidth: "100%" }}
      >
        {sharedImportControls}
        {content}
      </div>
    </div>
  );
}
