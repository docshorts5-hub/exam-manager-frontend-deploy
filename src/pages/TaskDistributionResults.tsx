import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { loadTenantSettings } from "../services/tenantData";
import { useI18n } from "../i18n/I18nProvider";
import { pageDark, container, cardDark } from "../styles/ui";
import { subjectColors } from "./taskDistributionResults/constants";
import { ResultsPageHeader } from "./taskDistributionResults/components/ResultsPageHeader";
import { ResultsTable } from "./taskDistributionResults/components/ResultsTable";
import { ResultsEmptyRunState } from "./taskDistributionResults/components/ResultsEmptyRunState";
import { ResultsImportConfirmDialog } from "./taskDistributionResults/components/ResultsImportConfirmDialog";
import { ResultsFooterPanels } from "./taskDistributionResults/components/ResultsFooterPanels";
import { ResultsFullscreenToolbar } from "./taskDistributionResults/components/ResultsFullscreenToolbar";
import { getResultsTableHeaderStyles } from "./taskDistributionResults/services/resultsPageStyles";
import { useResultsRunSync } from "./taskDistributionResults/hooks/useResultsRunSync";
import { useResultsInteractionState } from "./taskDistributionResults/hooks/useResultsInteractionState";
import { useResultsDataModel } from "./taskDistributionResults/hooks/useResultsDataModel";
import { useResultsPageActions } from "./taskDistributionResults/hooks/useResultsPageActions";
import { useResultsTableActions } from "./taskDistributionResults/hooks/useResultsTableActions";
import { useResultsClipboardShortcuts } from "./taskDistributionResults/hooks/useResultsClipboardShortcuts";


const RESULTS_PHONE_AUTH_SETTINGS_DOC_ID = "settings1";
const RESULTS_PHONE_AUTH_LOCAL_CENTER_KEY = "exam-manager:settings1:center-data:v1";
const RESULTS_PHONE_AUTH_SETTINGS_DOC_CANDIDATES = [
  "settings1",
  "schoolSettings1",
  "settings",
  "schoolSettings",
  "schoolData",
  "examCenter",
];
const RESULTS_PHONE_AUTH_LOCAL_KEY_CANDIDATES = [
  "exam-manager:settings1:center-data:v1",
  "exam-manager:settings1:school-data:v1",
  "exam-manager:school-data:v1",
  "exam-manager:settings:center-data:v1",
  "exam-manager:center-data:v1",
  "exam-manager:exam-center-data:v1",
];

function normalizePhoneForResultsAuth(value: unknown) {
  return String(value ?? "").replace(/[^\d]/g, "");
}

function maskPhoneForResultsAuth(value: unknown) {
  const digits = normalizePhoneForResultsAuth(value);
  if (!digits) return "—";
  if (digits.length <= 2) return "X".repeat(digits.length);
  return `${digits[0]}${"X".repeat(Math.max(1, digits.length - 2))}${digits[digits.length - 1]}`;
}

function firstResultsPhoneFromObject(value: any): string {
  if (!value || typeof value !== "object") return "";
  const candidates = [
    value.phone,
    value.phoneNumber,
    value.mobile,
    value.mobileNumber,
    value.centerPhone,
    value.schoolPhone,
    value.controlPhone,
    value.officialPhone,
    value.whatsapp,
    value.whatsApp,
    value?.centerData?.phone,
    value?.centerData?.phoneNumber,
    value?.schoolData?.phone,
    value?.schoolData?.phoneNumber,
    value?.data?.phone,
    value?.data?.phoneNumber,
    value?.settings1?.phone,
    value?.settings1?.phoneNumber,
  ];
  for (const item of candidates) {
    const raw = String(item ?? "").trim();
    if (normalizePhoneForResultsAuth(raw)) return raw;
  }
  return "";
}

function readResultsPhoneFromLocalStorage() {
  try {
    for (const key of RESULTS_PHONE_AUTH_LOCAL_KEY_CANDIDATES) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const phone = firstResultsPhoneFromObject(parsed);
      if (phone) return phone;
    }

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = String(localStorage.key(index) || "");
      const lowerKey = key.toLowerCase();
      const looksRelevant =
        lowerKey.includes("settings1") ||
        lowerKey.includes("settings") ||
        lowerKey.includes("school") ||
        lowerKey.includes("center") ||
        lowerKey.includes("exam-manager");
      if (!looksRelevant) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const phone = firstResultsPhoneFromObject(parsed);
        if (phone) return phone;
      } catch {}
    }
  } catch {}
  return "";
}

function resultsPhoneAuthSessionKey(tenantId: string) {
  return `yr:phone-gate:task-results:${String(tenantId || "default").trim() || "default"}`;
}


const OFFICIAL_PAGE_STYLE: React.CSSProperties = {
  ...pageDark,
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top right, rgba(180, 142, 48, 0.18), transparent 34%), linear-gradient(135deg, #f7f0df 0%, #efe2c3 46%, #fbf7ee 100%)",
  color: "#111827",
  padding: "16px 10px",
};

const OFFICIAL_CARD_STYLE: React.CSSProperties = {
  ...cardDark,
  background: "linear-gradient(180deg, rgba(255, 253, 247, 0.98), rgba(246, 238, 218, 0.98))",
  border: "1px solid rgba(151, 116, 28, 0.55)",
  borderRadius: 18,
  boxShadow: "0 14px 30px rgba(78, 59, 16, 0.12), inset 0 1px 0 rgba(255,255,255,0.72)",
  color: "#111827",
};

const OFFICIAL_FULLSCREEN_LAYER_STYLE: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  background:
    "radial-gradient(circle at top left, rgba(180, 142, 48, 0.14), transparent 30%), linear-gradient(135deg, #f7f0df 0%, #efe2c3 52%, #fbf7ee 100%)",
  padding: 8,
  overflow: "auto",
};

const OFFICIAL_RESULTS_TABLE_CSS = `
  .resultsOfficialCommercialScope,
  .resultsOfficialCommercialScope * {
    box-sizing: border-box !important;
  }

  .resultsOfficialCommercialScope {
    color: #111827 !important;
  }

  .resultsOfficialCommercialScope input,
  .resultsOfficialCommercialScope select,
  .resultsOfficialCommercialScope textarea {
    background: #fffdf7 !important;
    color: #111827 !important;
    border: 1px solid #b89435 !important;
    border-radius: 10px !important;
    font-weight: 700 !important;
  }

  .resultsOfficialCommercialScope button {
    color: #111827 !important;
    border-color: rgba(151, 116, 28, 0.42) !important;
    font-weight: 800 !important;
  }

  .resultsOfficialCommercialScope table {
    width: 100% !important;
    background: #fffdf7 !important;
    border-collapse: separate !important;
    border-spacing: 0 !important;
    border: 1px solid #a98322 !important;
    border-radius: 14px !important;
    overflow: hidden !important;
    box-shadow: 0 10px 24px rgba(78, 59, 16, 0.10) !important;
  }

  .resultsOfficialCommercialScope table thead th,
  .resultsOfficialCommercialScope table tfoot th,
  .resultsOfficialCommercialScope table tfoot td {
    background: linear-gradient(180deg, #f4e2ad 0%, #d5b45a 100%) !important;
    color: #111827 !important;
    -webkit-text-fill-color: #111827 !important;
    border: 1px solid rgba(120, 89, 14, 0.58) !important;
    font-size: 12px !important;
    font-weight: 850 !important;
    line-height: 1.28 !important;
    padding: 6px 7px !important;
    text-align: center !important;
    vertical-align: middle !important;
    white-space: normal !important;
  }

  .resultsOfficialCommercialScope table tbody td {
    background: #fffaf0 !important;
    color: #111827 !important;
    -webkit-text-fill-color: #111827 !important;
    border: 1px solid rgba(151, 116, 28, 0.34) !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    line-height: 1.28 !important;
    padding: 4px 6px !important;
    vertical-align: top !important;
    height: auto !important;
    min-height: 0 !important;
  }

  .resultsOfficialCommercialScope table tbody tr:nth-child(even) td:not(.resultsOfficialInvigilationCell):not(.resultsOfficialReserveCell):not(.resultsOfficialDutyCell):not(.resultsOfficialEmptyCell) {
    background: #f8efd8 !important;
  }

  .resultsOfficialCommercialScope table tbody tr:hover td:not(.resultsOfficialInvigilationCell):not(.resultsOfficialReserveCell):not(.resultsOfficialDutyCell):not(.resultsOfficialEmptyCell) {
    background: #f2e4bd !important;
  }

  .resultsOfficialCommercialScope table tbody td > div,
  .resultsOfficialCommercialScope table tbody td > section,
  .resultsOfficialCommercialScope table tbody td > article {
    max-width: 100% !important;
    margin: 0 !important;
  }

  .resultsOfficialCommercialScope table tbody td button,
  .resultsOfficialCommercialScope table tbody td [role="button"] {
    min-height: 0 !important;
    padding: 4px 8px !important;
    margin: 2px !important;
    border-radius: 10px !important;
    font-size: 12px !important;
    line-height: 1.2 !important;
    box-shadow: none !important;
  }

  .resultsOfficialCommercialScope table tbody td.resultsOfficialInvigilationCell,
  .resultsOfficialCommercialScope table tbody td.resultsOfficialReserveCell,
  .resultsOfficialCommercialScope table tbody td.resultsOfficialDutyCell,
  .resultsOfficialCommercialScope table tbody td.resultsOfficialEmptyCell {
    color: #111827 !important;
    -webkit-text-fill-color: #111827 !important;
    font-weight: 800 !important;
  }

  .resultsOfficialCommercialScope table tbody td.resultsOfficialInvigilationCell {
    background: linear-gradient(180deg, #dbeafe 0%, #93c5fd 100%) !important;
    border-color: rgba(29, 78, 216, 0.55) !important;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.55), 0 0 10px rgba(37, 99, 235, 0.16) !important;
    animation: resultsOfficialBluePulse 2.4s ease-in-out infinite !important;
  }

  .resultsOfficialCommercialScope table tbody td.resultsOfficialReserveCell {
    background: linear-gradient(180deg, #dcfce7 0%, #86efac 100%) !important;
    border-color: rgba(21, 128, 61, 0.55) !important;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.55), 0 0 10px rgba(22, 163, 74, 0.16) !important;
    animation: resultsOfficialGreenPulse 2.4s ease-in-out infinite !important;
  }

  .resultsOfficialCommercialScope table tbody td.resultsOfficialDutyCell {
    background: linear-gradient(180deg, #fee2e2 0%, #fca5a5 100%) !important;
    border-color: rgba(185, 28, 28, 0.55) !important;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.55), 0 0 10px rgba(220, 38, 38, 0.16) !important;
    animation: resultsOfficialRedPulse 2.4s ease-in-out infinite !important;
  }

  .resultsOfficialCommercialScope table tbody td.resultsOfficialEmptyCell,
  .resultsOfficialCommercialScope table tbody td:empty {
    background: linear-gradient(180deg, #fff6cf 0%, #efd076 100%) !important;
    border-color: rgba(151, 116, 28, 0.56) !important;
  }

  .resultsOfficialCommercialScope table tbody td.resultsOfficialInvigilationCell *,
  .resultsOfficialCommercialScope table tbody td.resultsOfficialReserveCell *,
  .resultsOfficialCommercialScope table tbody td.resultsOfficialDutyCell *,
  .resultsOfficialCommercialScope table tbody td.resultsOfficialEmptyCell * {
    color: #111827 !important;
    -webkit-text-fill-color: #111827 !important;
    text-shadow: none !important;
  }

  @keyframes resultsOfficialBluePulse {
    0%, 100% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.55), 0 0 6px rgba(37, 99, 235, 0.12); }
    50% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.70), 0 0 14px rgba(37, 99, 235, 0.25); }
  }

  @keyframes resultsOfficialGreenPulse {
    0%, 100% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.55), 0 0 6px rgba(22, 163, 74, 0.12); }
    50% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.70), 0 0 14px rgba(22, 163, 74, 0.25); }
  }

  @keyframes resultsOfficialRedPulse {
    0%, 100% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.55), 0 0 6px rgba(220, 38, 38, 0.12); }
    50% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.70), 0 0 14px rgba(220, 38, 38, 0.25); }
  }



  /* تثبيت جدول النتائج الشامل: عمود المعلم + صفوف التاريخ والمادة */
  .resultsOfficialCommercialScope .resultsOfficialStickyHost {
    position: relative !important;
    isolation: isolate !important;
  }

  .resultsOfficialCommercialScope .resultsOfficialStickyHost table {
    overflow: visible !important;
    position: relative !important;
    isolation: isolate !important;
  }

  .resultsOfficialCommercialScope .resultsOfficialStickyHost thead th,
  .resultsOfficialCommercialScope .resultsOfficialStickyHost thead td {
    position: sticky !important;
    top: var(--results-sticky-top, 0px) !important;
    z-index: var(--results-sticky-z, 80) !important;
    background: linear-gradient(180deg, #f4e2ad 0%, #d5b45a 100%) !important;
    box-shadow: 0 8px 16px rgba(78, 59, 16, 0.22) !important;
    background-clip: padding-box !important;
  }

  .resultsOfficialCommercialScope .resultsOfficialStickyHost thead tr:nth-child(1) th,
  .resultsOfficialCommercialScope .resultsOfficialStickyHost thead tr:nth-child(1) td {
    --results-sticky-top: 0px;
    --results-sticky-z: 88;
  }

  .resultsOfficialCommercialScope .resultsOfficialStickyHost thead tr:nth-child(2) th,
  .resultsOfficialCommercialScope .resultsOfficialStickyHost thead tr:nth-child(2) td {
    --results-sticky-top: var(--results-second-header-top, 68px);
    --results-sticky-z: 86;
  }

  .resultsOfficialCommercialScope .resultsOfficialStickyHost thead tr > th:first-child,
  .resultsOfficialCommercialScope .resultsOfficialStickyHost thead tr > td:first-child,
  .resultsOfficialCommercialScope .resultsOfficialStickyHost tbody tr > th:first-child,
  .resultsOfficialCommercialScope .resultsOfficialStickyHost tbody tr > td.resultsOfficialTeacherStickyCell,
  .resultsOfficialCommercialScope .resultsOfficialTeacherStickyCell {
    position: sticky !important;
    inset-inline-start: 0 !important;
    right: 0 !important;
    left: auto !important;
    z-index: 92 !important;
    background: linear-gradient(135deg, rgba(255,248,220,.99), rgba(230,198,103,.98)) !important;
    box-shadow: -12px 0 20px rgba(78, 59, 16, 0.18), inset 1px 0 0 rgba(151,116,28,.45) !important;
    background-clip: padding-box !important;
  }

  .resultsOfficialCommercialScope .resultsOfficialStickyHost thead tr > th:first-child,
  .resultsOfficialCommercialScope .resultsOfficialStickyHost thead tr > td:first-child {
    z-index: 120 !important;
    top: 0 !important;
  }

  html[dir="ltr"] .resultsOfficialCommercialScope .resultsOfficialStickyHost thead tr > th:first-child,
  html[dir="ltr"] .resultsOfficialCommercialScope .resultsOfficialStickyHost thead tr > td:first-child,
  html[dir="ltr"] .resultsOfficialCommercialScope .resultsOfficialStickyHost tbody tr > th:first-child,
  html[dir="ltr"] .resultsOfficialCommercialScope .resultsOfficialStickyHost tbody tr > td.resultsOfficialTeacherStickyCell,
  html[dir="ltr"] .resultsOfficialCommercialScope .resultsOfficialTeacherStickyCell {
    left: 0 !important;
    right: auto !important;
    box-shadow: 12px 0 20px rgba(78, 59, 16, 0.18), inset -1px 0 0 rgba(151,116,28,.45) !important;
  }

  @media print {
    .resultsOfficialCommercialScope,
    .resultsOfficialCommercialScope * {
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
      text-shadow: none !important;
      animation: none !important;
      box-shadow: none !important;
    }

    .resultsOfficialCommercialScope {
      background: #ffffff !important;
      padding: 0 !important;
    }

    .resultsOfficialCommercialScope table {
      border-radius: 0 !important;
      box-shadow: none !important;
    }
  }
`;

const OFFICIAL_CELL_CLASS_NAMES = [
  "resultsOfficialInvigilationCell",
  "resultsOfficialReserveCell",
  "resultsOfficialDutyCell",
  "resultsOfficialEmptyCell",
];

function cleanCommercialCellText(value: string) {
  return String(value || "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isCommercialEmptyActionText(value: string) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  const text = cleanCommercialCellText(raw).toLowerCase();

  return (
    !text ||
    text === "—" ||
    text === "-" ||
    /^\+/.test(raw) ||
    /(^|\s)(اضافة|إضافة|add)(\s|$)/i.test(raw) ||
    /فاضي|للمراجعة|للتصحيح|review|correction/.test(text)
  );
}

function getCommercialCellClassFromText(value: string) {
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  const text = cleanCommercialCellText(raw).toLowerCase();

  if (isCommercialEmptyActionText(raw)) return "resultsOfficialEmptyCell";
  if (/مراقب\s*دور|duty\s*invigilator/.test(text)) return "resultsOfficialDutyCell";
  if (/(^|\s)(احتياط|reserve)(\s|$)/.test(text)) return "resultsOfficialReserveCell";
  if (/مراقبة|invigilation/.test(text)) return "resultsOfficialInvigilationCell";

  return "";
}

function applyCommercialResultsCellClasses(root: HTMLElement | null) {
  if (!root) return;

  const cells = Array.from(root.querySelectorAll<HTMLElement>("tbody td"));

  cells.forEach((cell) => {
    OFFICIAL_CELL_CLASS_NAMES.forEach((className) => cell.classList.remove(className));

    const text = cell.textContent || "";
    const cellClass = getCommercialCellClassFromText(text);
    const hasActionButton = Array.from(cell.querySelectorAll<HTMLElement>("button, [role='button']")).some((button) =>
      isCommercialEmptyActionText(button.textContent || ""),
    );

    if (cellClass) {
      cell.classList.add(cellClass);
      return;
    }

    if (hasActionButton || cleanCommercialCellText(text) === "") {
      cell.classList.add("resultsOfficialEmptyCell");
    }
  });
}


function setOfficialStickyImportant(el: HTMLElement, name: string, value: string) {
  el.style.setProperty(name, value, "important");
}

function clearOfficialStickyResultsTable(root: HTMLElement | null) {
  if (!root) return;

  root.querySelectorAll<HTMLElement>(".resultsOfficialTeacherStickyCell").forEach((cell) => {
    cell.classList.remove("resultsOfficialTeacherStickyCell");
  });
}

function applyOfficialStickyResultsTable(root: HTMLElement | null, lang: string) {
  if (!root) return;

  const table = root.querySelector<HTMLElement>("table");
  if (!table) return;

  clearOfficialStickyResultsTable(root);

  setOfficialStickyImportant(table, "overflow", "visible");
  setOfficialStickyImportant(table, "position", "relative");
  setOfficialStickyImportant(table, "isolation", "isolate");

  const headerRows = Array.from(table.querySelectorAll<HTMLTableRowElement>("thead tr"));
  let topOffset = 0;

  headerRows.forEach((row, rowIndex) => {
    const rowHeight = Math.ceil(row.getBoundingClientRect().height || (rowIndex === 0 ? 68 : 96));
    const zIndex = String(120 - rowIndex * 2);

    Array.from(row.children).forEach((rawCell, cellIndex) => {
      const cell = rawCell as HTMLElement;
      setOfficialStickyImportant(cell, "position", "sticky");
      setOfficialStickyImportant(cell, "top", `${Math.max(0, topOffset)}px`);
      setOfficialStickyImportant(cell, "z-index", zIndex);
      setOfficialStickyImportant(cell, "background-clip", "padding-box");
      setOfficialStickyImportant(cell, "box-shadow", "0 8px 16px rgba(78, 59, 16, 0.22)");

      const cellText = cleanCommercialCellText(cell.textContent || "");
      const isTeacherHeader =
        cellIndex === 0 &&
        (/^(المعلم|اسم المعلم|teacher|teacher name)$/i.test(cellText) || Number((cell as HTMLTableCellElement).rowSpan || 1) > 1);

      if (isTeacherHeader) {
        cell.classList.add("resultsOfficialTeacherStickyCell");
        setOfficialStickyImportant(cell, "top", "0px");
        setOfficialStickyImportant(cell, "z-index", "160");
        setOfficialStickyImportant(cell, "inset-inline-start", "0px");
        if (lang === "ar") {
          setOfficialStickyImportant(cell, "right", "0px");
          setOfficialStickyImportant(cell, "left", "auto");
        } else {
          setOfficialStickyImportant(cell, "left", "0px");
          setOfficialStickyImportant(cell, "right", "auto");
        }
      }
    });

    topOffset += rowHeight;
  });

  root.style.setProperty("--results-second-header-top", `${Math.max(0, Math.ceil(headerRows[0]?.getBoundingClientRect().height || 68))}px`);

  const bodyRows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"));
  bodyRows.forEach((row) => {
    const teacherCell = row.querySelector<HTMLElement>('th[scope="row"], th:first-child');
    if (!teacherCell) return;

    teacherCell.classList.add("resultsOfficialTeacherStickyCell");
    setOfficialStickyImportant(teacherCell, "position", "sticky");
    setOfficialStickyImportant(teacherCell, "inset-inline-start", "0px");
    setOfficialStickyImportant(teacherCell, "z-index", "96");
    setOfficialStickyImportant(teacherCell, "background", "linear-gradient(135deg, rgba(255,248,220,.99), rgba(230,198,103,.98))");
    setOfficialStickyImportant(teacherCell, "background-clip", "padding-box");
    if (lang === "ar") {
      setOfficialStickyImportant(teacherCell, "right", "0px");
      setOfficialStickyImportant(teacherCell, "left", "auto");
      setOfficialStickyImportant(teacherCell, "box-shadow", "-12px 0 20px rgba(78, 59, 16, 0.18), inset 1px 0 0 rgba(151,116,28,.45)");
    } else {
      setOfficialStickyImportant(teacherCell, "left", "0px");
      setOfficialStickyImportant(teacherCell, "right", "auto");
      setOfficialStickyImportant(teacherCell, "box-shadow", "12px 0 20px rgba(78, 59, 16, 0.18), inset -1px 0 0 rgba(151,116,28,.45)");
    }
  });
}

function normalizeSubject(subject: string) {
  return String(subject || "").replace(/\s+/g, " ").trim();
}

function normalizeTeacherSearchText(value: string) {
  return String(value || "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ـ_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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
      auth?.effectiveTenantId || auth?.profile?.tenantId || auth?.userProfile?.tenantId || auth?.user?.tenantId || "default",
    ).trim() || "default"
  );
}

export default function TaskDistributionResults() {
  const nav = useNavigate();
  const auth = useAuth();
  const { lang } = useI18n();
  const tr = React.useCallback((ar: string, en: string) => (lang === "ar" ? ar : en), [lang]);
  const tenantId = React.useMemo(() => getTenantIdFromAuth(auth), [auth]);
  const printAreaRef = React.useRef<HTMLDivElement>(null);
  const [showTeacherSidebar, setShowTeacherSidebar] = React.useState(true);
  const [teacherSearchInput, setTeacherSearchInput] = React.useState("");
  const [activeTeacherSearch, setActiveTeacherSearch] = React.useState("");
  const [phoneAuthPassed, setPhoneAuthPassed] = React.useState(() => {
    try {
      return sessionStorage.getItem(resultsPhoneAuthSessionKey(tenantId)) === "ok";
    } catch {
      return false;
    }
  });
  const [registeredPhoneForAuth, setRegisteredPhoneForAuth] = React.useState("");
  const [phoneAuthInput, setPhoneAuthInput] = React.useState("");
  const [phoneAuthError, setPhoneAuthError] = React.useState("");
  const [phoneAuthLoading, setPhoneAuthLoading] = React.useState(false);


  React.useEffect(() => {
    let alive = true;

    async function loadRegisteredPhone() {
      setPhoneAuthLoading(true);
      setPhoneAuthError("");
      try {
        let phone = "";
        for (const docId of RESULTS_PHONE_AUTH_SETTINGS_DOC_CANDIDATES) {
          try {
            const cloud = await loadTenantSettings<any>(tenantId, docId, {});
            phone = firstResultsPhoneFromObject(cloud);
            if (phone) break;
          } catch {}
        }
        phone = String(phone || readResultsPhoneFromLocalStorage() || "").trim();
        if (!alive) return;
        setRegisteredPhoneForAuth(phone);
        if (!phone) {
          setPhoneAuthError(tr("لم يتم العثور على رقم هاتف مسجل في صفحة settings1.", "No registered phone number was found in settings1."));
        }
      } catch {
        if (!alive) return;
        const phone = readResultsPhoneFromLocalStorage();
        setRegisteredPhoneForAuth(phone);
        if (!phone) {
          setPhoneAuthError(tr("تعذر تحميل رقم الهاتف المسجل. احفظ رقم الهاتف أولًا من صفحة settings1.", "Could not load the registered phone number. Save the phone number first in settings1."));
        }
      } finally {
        if (alive) setPhoneAuthLoading(false);
      }
    }

    try {
      if (sessionStorage.getItem(resultsPhoneAuthSessionKey(tenantId)) === "ok") {
        setPhoneAuthPassed(true);
      } else {
        setPhoneAuthPassed(false);
      }
    } catch {
      setPhoneAuthPassed(false);
    }

    void loadRegisteredPhone();

    return () => {
      alive = false;
    };
  }, [tenantId, tr]);

  const handlePhoneAuthSubmit = React.useCallback((event?: React.FormEvent) => {
    event?.preventDefault();
    const expected = normalizePhoneForResultsAuth(registeredPhoneForAuth);
    const actual = normalizePhoneForResultsAuth(phoneAuthInput);

    if (!expected) {
      setPhoneAuthError(tr("لا يوجد رقم هاتف مسجل للمصادقة.", "There is no registered phone number for authentication."));
      return;
    }

    if (actual !== expected) {
      setPhoneAuthError(tr("رقم الهاتف غير مطابق.", "The phone number does not match."));
      return;
    }

    try {
      sessionStorage.setItem(resultsPhoneAuthSessionKey(tenantId), "ok");
    } catch {}
    setPhoneAuthPassed(true);
    setPhoneAuthError("");
    setPhoneAuthInput("");
  }, [phoneAuthInput, registeredPhoneForAuth, tenantId, tr]);

  const formatPeriod = React.useCallback(
    (period?: string) => {
      const p = String(period || "AM").toUpperCase();
      return p === "PM" || p === "BM" ? tr("الفترة الثانية", "Second Period") : tr("الفترة الأولى", "First Period");
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
        case "REVIEW_FREE":
          return tr("فاضي للمراجعة", "Free for review");
        case "CORRECTION_FREE":
          return tr("فاضي للتصحيح", "Free for correction");
        case "DUTY_INVIGILATOR":
          return tr("مراقب دور", "Duty Invigilator");
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
      if (Number.isNaN(d.getTime())) return { day: value, full: value, line: value };

      const locale = lang === "ar" ? "ar" : "en";
      const day = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(d);
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
  const interaction = useResultsInteractionState(tenantId);
  const dataModel = useResultsDataModel({ tenantId, run, normalizeSubject });

  const pageActions = useResultsPageActions({
    tenantId,
    run,
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

  const tableActions = useResultsTableActions({
    tenantId,
    run,
    teacherNameToId: dataModel.teacherNameToId,
    colKeyToExamId: dataModel.colKeyToExamId,
    examKeyToCommittees: dataModel.examKeyToCommittees,
    invigilatorsPerRoomForSubject: dataModel.invigilatorsPerRoomForSubject,
    unavailIndex: interaction.unavailIndex,
    unavailReasonMap: interaction.unavailReasonMap,
    markCellBlocked: interaction.markCellBlocked,
    normalizeSubject,
    persistEditedAssignments: pageActions.persistEditedAssignments,
    displayDates: dataModel.displayDates,
    dateToSubCols: dataModel.dateToSubCols,
    allSubCols: dataModel.allSubCols,
    allTeachers: dataModel.allTeachers,
    matrix2: dataModel.matrix2,
    committeesCountBySubCol: dataModel.committeesCountBySubCol,
    totalsDetailBySubCol: dataModel.totalsDetailBySubCol,
    teacherTotals: dataModel.teacherTotals,
  });

  const getAssignmentsInCell = React.useCallback(
    (teacher: string, subColKey: string) =>
      tableActions.getAssignmentsInCell(run?.assignments || [], teacher, subColKey, normalizeSubject),
    [run, tableActions],
  );

  useResultsClipboardShortcuts({
    selectedCell: interaction.selectedCell,
    clipboardUid: interaction.clipboardUid,
    setClipboardUid: interaction.setClipboardUid,
    run,
    getAssignmentsInCell,
    swapAssignmentsByUid: tableActions.swapAssignmentsByUid,
    moveAssignmentToColumnTeacher: tableActions.moveAssignmentToColumnTeacher,
    isDraggableTaskType: tableActions.isDraggableTaskType,
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

  const teacherRowColor = React.useCallback((index: number) => ({
    stripe: ["#38bdf8", "#c084fc", "#22c55e", "#f59e0b", "#ef4444"][index % 5],
  }), []);

  const styles = React.useMemo(() => {
    const officialHeaderStylesInput: Parameters<
      typeof getResultsTableHeaderStyles
    >[0] = {
      tableText: "#111827",
      tableFontSize: "12px",
      goldLine: "#a98322",
      goldLineSoft: "rgba(151, 116, 28, 0.34)",
    };

    return {
      ...officialHeaderStylesInput,
      ...getResultsTableHeaderStyles(officialHeaderStylesInput),
    };
  }, []);

  const hasRun = Boolean(run && Array.isArray(run.assignments) && run.assignments.length);

  const visibleTeachers = React.useMemo(() => {
    const query = normalizeTeacherSearchText(activeTeacherSearch);
    if (!query) return dataModel.allTeachers;

    return dataModel.allTeachers.filter((teacherName: string) =>
      normalizeTeacherSearchText(teacherName).includes(query),
    );
  }, [activeTeacherSearch, dataModel.allTeachers]);

  const hasActiveTeacherSearch = normalizeTeacherSearchText(activeTeacherSearch).length > 0;

  const handleApplyTeacherSearch = React.useCallback(() => {
    setActiveTeacherSearch(teacherSearchInput);
  }, [teacherSearchInput]);

  const handleClearTeacherSearch = React.useCallback(() => {
    setTeacherSearchInput("");
    setActiveTeacherSearch("");
  }, []);

  React.useEffect(() => {
    if (!hasRun) return;

    const apply = () => {
      applyCommercialResultsCellClasses(printAreaRef.current);
      applyOfficialStickyResultsTable(printAreaRef.current, lang);
    };
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
      clearOfficialStickyResultsTable(printAreaRef.current);
    };
  }, [hasRun, run, dataModel.allSubCols.length, visibleTeachers.length, showTeacherSidebar, interaction.tableFullScreen, lang]);

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
        <div style={OFFICIAL_CARD_STYLE}>
          <ResultsPageHeader
            runId={String(run?.runId || "—")}
            createdAtISO={run?.createdAtISO}
            importError={interaction.importError || undefined}
            tableFullScreen={interaction.tableFullScreen}
            undoDisabled={!interaction.undoStack.length}
            onGoHome={() => nav("/task-distribution/run")}
            onPickImportFile={pageActions.handlePickImportFile}
            onExportPdf={pageActions.handleExportPdf}
            onArchiveSnapshot={pageActions.handleArchiveSnapshot}
            onToggleFullscreen={() => interaction.setTableFullScreen(!interaction.tableFullScreen)}
            onUndo={() => pageActions.handleUndo(interaction.undoStack)}
            onExportExcel={tableActions.exportExcel}
            onPrintTableOnly={pageActions.handlePrintTableOnly}
            showTeacherSidebar={showTeacherSidebar}
            onToggleTeacherSidebar={() => setShowTeacherSidebar((v) => !v)}
          />
        </div>
      ) : null}

      <div ref={printAreaRef} className="resultsOfficialStickyHost">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            justifyContent: "flex-end",
            margin: "10px 0 12px",
            padding: "10px 12px",
            border: "1px solid rgba(151,116,28,.45)",
            borderRadius: 14,
            background: "linear-gradient(180deg, rgba(255,253,247,.98), rgba(246,238,218,.98))",
            boxShadow: "0 8px 18px rgba(78,59,16,.10)",
            direction: lang === "ar" ? "rtl" : "ltr",
          }}
        >
          <label style={{ fontWeight: 900, color: "#111827" }}>
            {tr("بحث باسم المعلم", "Search teacher name")}
          </label>
          <input
            value={teacherSearchInput}
            onChange={(event) => setTeacherSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleApplyTeacherSearch();
              if (event.key === "Escape") handleClearTeacherSearch();
            }}
            placeholder={tr("اكتب اسم المعلم", "Type teacher name")}
            style={{
              minWidth: 260,
              maxWidth: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #b89435",
              background: "#fffdf7",
              color: "#111827",
              fontWeight: 800,
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={handleApplyTeacherSearch}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid rgba(151,116,28,.65)",
              background: "linear-gradient(180deg, #f4e2ad 0%, #d5b45a 100%)",
              color: "#111827",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {tr("بحث", "Search")}
          </button>
          <button
            type="button"
            onClick={handleClearTeacherSearch}
            disabled={!teacherSearchInput && !activeTeacherSearch}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid rgba(151,116,28,.42)",
              background: "#fffaf0",
              color: "#111827",
              fontWeight: 900,
              cursor: teacherSearchInput || activeTeacherSearch ? "pointer" : "not-allowed",
              opacity: teacherSearchInput || activeTeacherSearch ? 1 : 0.58,
            }}
          >
            {tr("إظهار الكل", "Show all")}
          </button>
          {hasActiveTeacherSearch ? (
            <span style={{ fontWeight: 800, color: "#374151" }}>
              {tr("النتائج:", "Results:")} {visibleTeachers.length} / {dataModel.allTeachers.length}
            </span>
          ) : null}
        </div>

        <ResultsTable
          displayDates={dataModel.displayDates}
          dateToSubCols={dataModel.dateToSubCols}
          allSubCols={dataModel.allSubCols}
          allTeachers={visibleTeachers}
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
          isDraggableTaskType={tableActions.isDraggableTaskType}
          dragSrcUid={interaction.dragSrcUid}
          dragOverUid={interaction.dragOverUid}
          setDragSrcUid={interaction.setDragSrcUid}
          setDragOverUid={interaction.setDragOverUid}
          onSwap={tableActions.swapAssignmentsByUid}
          onDropToEmpty={tableActions.handleDropToEmptyCell}
          onDropToCell={tableActions.handleDropToCell}
          onAddToEmpty={tableActions.addTaskToEmptyCell}
          onDeleteByUid={tableActions.deleteAssignmentByUid}
          onDeleteSubCol={tableActions.deleteAssignmentsBySubCol}
          styles={styles as any}
          formatDateWithDayAr={formatDateWithDay}
          containerMaxHeight={interaction.tableFullScreen ? "calc(100vh - 120px)" : "72vh"}
          selectedCell={interaction.selectedCell}
          onSelectCell={interaction.setSelectedCell}
          isConflictUid={(uid) => dataModel.conflictUids.has(uid)}
          getUnavailabilityReasonForCell={tableActions.getUnavailabilityReasonForCell}
          blockedCellMsg={interaction.blockedCellMsg}
          showTeacherSidebar={showTeacherSidebar}
        />

        <div style={{ marginTop: 16 }}>
          <ResultsFooterPanels
            warnings={dataModel.warnings}
            assignmentsCount={dataModel.assignments.length}
            daysCount={dataModel.displayDates.length}
            columnsCount={dataModel.allSubCols.length}
            teachersCount={visibleTeachers.length}
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

  if (!phoneAuthPassed) {
    return (
      <div className="resultsOfficialCommercialScope" style={OFFICIAL_PAGE_STYLE}>
        <style>{OFFICIAL_RESULTS_TABLE_CSS}</style>
        <div style={{ ...container, width: "min(720px, 100%)", maxWidth: "100%" }}>
          <section
            style={{
              ...OFFICIAL_CARD_STYLE,
              marginTop: 60,
              padding: 28,
              direction: lang === "ar" ? "rtl" : "ltr",
              textAlign: lang === "ar" ? "right" : "left",
            }}
          >
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 950, color: "#111827" }}>
              {tr("المصادقة برقم الهاتف", "Phone authentication")}
            </h1>
            <p style={{ margin: "12px 0 0", fontSize: 14, fontWeight: 800, color: "#374151", lineHeight: 1.9 }}>
              {tr("أدخل رقم الهاتف المسجل في settings1 لفتح صفحة نتائج التوزيع.", "Enter the phone number registered in settings1 to open the distribution results page.")}
            </p>
            <div
              style={{
                marginTop: 14,
                border: "1px solid rgba(151,116,28,.45)",
                borderRadius: 14,
                padding: "10px 12px",
                background: "#fffaf0",
                fontWeight: 900,
                color: "#111827",
              }}
            >
              {tr("الرقم المسجل:", "Registered number:")} {maskPhoneForResultsAuth(registeredPhoneForAuth)}
            </div>

            <form onSubmit={handlePhoneAuthSubmit} style={{ marginTop: 18, display: "grid", gap: 12 }}>
              <input
                value={phoneAuthInput}
                onChange={(event) => {
                  setPhoneAuthInput(event.target.value);
                  setPhoneAuthError("");
                }}
                placeholder={tr("أدخل رقم الهاتف", "Enter phone number")}
                inputMode="tel"
                autoComplete="off"
                disabled={phoneAuthLoading || !registeredPhoneForAuth}
                style={{
                  width: "100%",
                  minHeight: 48,
                  borderRadius: 14,
                  border: "2px solid #b89435",
                  padding: "10px 12px",
                  background: "#fffdf7",
                  color: "#111827",
                  fontWeight: 900,
                  fontSize: 16,
                  outline: "none",
                }}
              />

              {phoneAuthError ? (
                <div
                  style={{
                    border: "1px solid rgba(220,38,38,.45)",
                    background: "rgba(254,226,226,.86)",
                    color: "#7f1d1d",
                    borderRadius: 12,
                    padding: "10px 12px",
                    fontWeight: 900,
                    lineHeight: 1.8,
                  }}
                >
                  {phoneAuthError}
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-start" }}>
                <button
                  type="submit"
                  disabled={phoneAuthLoading || !registeredPhoneForAuth}
                  style={{
                    border: "1px solid rgba(151,116,28,.65)",
                    borderRadius: 14,
                    padding: "11px 18px",
                    background: "linear-gradient(180deg, #f4e2ad 0%, #d5b45a 100%)",
                    color: "#111827",
                    fontWeight: 950,
                    cursor: phoneAuthLoading || !registeredPhoneForAuth ? "not-allowed" : "pointer",
                    opacity: phoneAuthLoading || !registeredPhoneForAuth ? 0.65 : 1,
                  }}
                >
                  {phoneAuthLoading ? tr("جاري التحميل...", "Loading...") : tr("دخول", "Enter")}
                </button>
                <button
                  type="button"
                  onClick={() => nav("/task-distribution/run")}
                  style={{
                    border: "1px solid rgba(151,116,28,.42)",
                    borderRadius: 14,
                    padding: "11px 18px",
                    background: "#fffaf0",
                    color: "#111827",
                    fontWeight: 950,
                    cursor: "pointer",
                  }}
                >
                  {tr("رجوع", "Back")}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    );
  }

  if (interaction.tableFullScreen && hasRun) {
    return (
      <div className="resultsOfficialCommercialScope" style={{ ...OFFICIAL_PAGE_STYLE, padding: 8 }}>
        <style>{OFFICIAL_RESULTS_TABLE_CSS}</style>
        <div style={OFFICIAL_FULLSCREEN_LAYER_STYLE}>
          <div style={{ ...container, width: "100%", maxWidth: "100%", padding: 0 }}>
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
    <div className="resultsOfficialCommercialScope" style={OFFICIAL_PAGE_STYLE}>
      <style>{OFFICIAL_RESULTS_TABLE_CSS}</style>
      <div style={{ ...container, width: "min(1880px, 100%)", maxWidth: "100%" }}>
        {sharedImportControls}
        {content}
      </div>
    </div>
  );
}
