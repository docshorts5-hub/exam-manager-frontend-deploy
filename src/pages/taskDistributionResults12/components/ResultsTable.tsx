import React from "react";
import { useI18n } from "../../../i18n/I18nProvider";
import type { Assignment } from "../../../contracts/taskDistributionContract";
import type { SubCol } from "./TeacherRow";
import { TeacherRow } from "./TeacherRow";
import { ResultsTableHeader } from "./ResultsTableHeader";
import { ResultsTotalsRow } from "./ResultsTotalsRow";
import { buildInvigilationDeficitBySubCol, buildRequiredBySubCol, buildReserveCountBySubCol } from "../services/resultsTableDerivedMaps";
import { getResultsTableContainerStyle, RESULTS_TABLE_CONFLICT_CSS } from "../services/resultsTablePresentation";


const COMMERCIAL_RESULTS_TABLE_CSS = `
  .resultsTableCommercialScope {
    background: linear-gradient(180deg, #fffaf0 0%, #f6ecd5 100%);
    border: 1px solid #c9a84f;
    border-radius: 14px;
    box-shadow: 0 10px 26px rgba(84, 63, 20, 0.10);
    padding: 8px;
  }

  .resultsTableCommercialScope table {
    border-collapse: separate !important;
    border-spacing: 4px 6px !important;
    color: #000000 !important;
  }

  .resultsTableCommercialScope,
  .resultsTableCommercialScope table,
  .resultsTableCommercialScope thead,
  .resultsTableCommercialScope tbody,
  .resultsTableCommercialScope tfoot,
  .resultsTableCommercialScope tr,
  .resultsTableCommercialScope th,
  .resultsTableCommercialScope td,
  .resultsTableCommercialScope div,
  .resultsTableCommercialScope span,
  .resultsTableCommercialScope strong,
  .resultsTableCommercialScope small,
  .resultsTableCommercialScope p,
  .resultsTableCommercialScope button {
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    text-shadow: none !important;
  }

  .resultsTableCommercialScope tbody tr > th:first-child,
  .resultsTableCommercialScope tbody tr > td:first-child,
  .resultsTableCommercialScope tbody tr > th:first-child *,
  .resultsTableCommercialScope tbody tr > td:first-child * {
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    font-weight: 900 !important;
    opacity: 1 !important;
    visibility: visible !important;
  }

  .resultsTableCommercialScope tbody tr > th:first-child,
  .resultsTableCommercialScope tbody tr > td:first-child {
    background: linear-gradient(180deg, #fff7df 0%, #f1dda0 100%) !important;
    border-color: rgba(137, 100, 22, 0.65) !important;
    min-width: 190px !important;
    white-space: normal !important;
  }

  .resultsTableCommercialScope th,
  .resultsTableCommercialScope td {
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    border: 1px solid rgba(169, 131, 34, 0.42) !important;
    border-radius: 10px !important;
    box-shadow: none !important;
    text-shadow: none !important;
    line-height: 1.35 !important;
    vertical-align: middle !important;
  }

  .resultsTableCommercialScope thead th {
    background: linear-gradient(180deg, #f6e4b3 0%, #e7c96c 100%) !important;
    font-size: 12px !important;
    font-weight: 800 !important;
    padding: 7px 8px !important;
    border-color: rgba(137, 100, 22, 0.55) !important;
  }

  .resultsTableCommercialScope tbody td {
    background: #fffaf0 !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    padding: 5px 6px !important;
  }

  .resultsTableCommercialScope tfoot td,
  .resultsTableCommercialScope tfoot th {
    font-size: 12px !important;
    font-weight: 800 !important;
    padding: 6px 8px !important;
    background: #f3dfaa !important;
  }

  .resultsTableCommercialScope tbody tr:hover td:not(.results12TaskInvigilation):not(.results12TaskReserve):not(.results12TaskDuty):not(.results12CellEmptyOfficial):not(.resultsTableCommercialTaskInvigilation):not(.resultsTableCommercialTaskReserve):not(.resultsTableCommercialTaskDuty):not(.resultsTableCommercialCellEmpty) {
    background-color: #fff4d9 !important;
  }

  .resultsTableCommercialScope tbody td {
    overflow: hidden !important;
    position: relative !important;
  }

  .resultsTableCommercialScope td > div,
  .resultsTableCommercialScope td > section,
  .resultsTableCommercialScope td > article {
    background: transparent !important;
    background-color: transparent !important;
    box-shadow: none !important;
    text-shadow: none !important;
    max-width: 100% !important;
    min-width: 0 !important;
    overflow: hidden !important;
  }

  .resultsTableCommercialScope tbody td > div > div,
  .resultsTableCommercialScope tbody td > div > section,
  .resultsTableCommercialScope tbody td > div > article {
    background-color: transparent !important;
    max-width: 100% !important;
    min-width: 0 !important;
    overflow: hidden !important;
  }


  .resultsTableCommercialScope tbody td [role="button"]:not(button) {
    max-width: 100% !important;
    min-width: 0 !important;
    width: auto !important;
    white-space: normal !important;
    word-break: normal !important;
    overflow-wrap: normal !important;
    writing-mode: horizontal-tb !important;
  }

  .resultsTableCommercialScope button {
    min-height: 24px !important;
    max-width: 118px !important;
    min-width: 48px !important;
    padding: 3px 8px !important;
    border-radius: 8px !important;
    font-size: 10.5px !important;
    font-weight: 800 !important;
    line-height: 1.25 !important;
    box-shadow: none !important;
    white-space: nowrap !important;
    word-break: keep-all !important;
    overflow-wrap: normal !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    flex-shrink: 0 !important;
    writing-mode: horizontal-tb !important;
  }

  .resultsTableCommercialScope tbody td button {
    max-width: 96px !important;
    min-width: 56px !important;
  }

  .resultsTableCommercialScope tbody td button[title] {
    max-width: 108px !important;
  }

  .resultsTableCommercialScope tbody td button + button {
    margin-inline-start: 3px !important;
  }

  .resultsTableCommercialScope tbody td.resultsTableCommercialTaskInvigilation,
  .resultsTableCommercialScope tbody td.resultsTableCommercialTaskReserve,
  .resultsTableCommercialScope tbody td.resultsTableCommercialTaskDuty,
  .resultsTableCommercialScope tbody td.resultsTableCommercialCellEmpty {
    padding: 5px 6px !important;
    min-height: 58px !important;
  }

  .resultsTableCommercialScope tbody td.resultsTableCommercialTaskInvigilation > *,
  .resultsTableCommercialScope tbody td.resultsTableCommercialTaskReserve > *,
  .resultsTableCommercialScope tbody td.resultsTableCommercialTaskDuty > *,
  .resultsTableCommercialScope tbody td.resultsTableCommercialCellEmpty > * {
    max-width: 100% !important;
    min-width: 0 !important;
    overflow: hidden !important;
  }

  .resultsTableCommercialScope tbody td.resultsTableCommercialTaskInvigilation *,
  .resultsTableCommercialScope tbody td.resultsTableCommercialTaskReserve *,
  .resultsTableCommercialScope tbody td.resultsTableCommercialTaskDuty *,
  .resultsTableCommercialScope tbody td.resultsTableCommercialCellEmpty * {
    word-break: normal !important;
    overflow-wrap: normal !important;
    white-space: normal !important;
    letter-spacing: normal !important;
  }

  .resultsTableCommercialScope td.results12TaskInvigilation,
  .resultsTableCommercialScope .results12TaskInvigilation,
  .resultsTableCommercialScope td.resultsTableCommercialTaskInvigilation {
    background: linear-gradient(180deg, #eaf4ff 0%, #b9dcff 58%, #93c5fd 100%) !important;
    background-color: #93c5fd !important;
    border-color: #2563eb !important;
    box-shadow: inset 0 0 0 1px rgba(37,99,235,0.18), 0 0 7px rgba(37,99,235,0.12) !important;
    animation: resultsTableCommercialBluePulse 3.2s ease-in-out infinite !important;
  }

  .resultsTableCommercialScope td.results12TaskReserve,
  .resultsTableCommercialScope .results12TaskReserve,
  .resultsTableCommercialScope td.resultsTableCommercialTaskReserve,
  .resultsTableCommercialScope .resultsTableCommercialTaskReserve {
    background: linear-gradient(180deg, #dcfce7 0%, #86efac 58%, #4ade80 100%) !important;
    background-color: #4ade80 !important;
    border-color: #15803d !important;
    box-shadow: inset 0 0 0 1px rgba(21,128,61,0.22), 0 0 8px rgba(22,163,74,0.18) !important;
    animation: resultsTableCommercialGreenPulse 3.2s ease-in-out infinite !important;
  }

  .resultsTableCommercialScope td.results12TaskDuty,
  .resultsTableCommercialScope .results12TaskDuty,
  .resultsTableCommercialScope td.resultsTableCommercialTaskDuty {
    background: linear-gradient(180deg, #fff1f2 0%, #fecdd3 58%, #fca5a5 100%) !important;
    background-color: #fca5a5 !important;
    border-color: #dc2626 !important;
    box-shadow: inset 0 0 0 1px rgba(220,38,38,0.18), 0 0 7px rgba(220,38,38,0.12) !important;
    animation: resultsTableCommercialRedPulse 3.2s ease-in-out infinite !important;
  }

  .resultsTableCommercialScope td.results12CellEmptyOfficial,
  .resultsTableCommercialScope .results12CellEmptyOfficial,
  .resultsTableCommercialScope td.resultsTableCommercialCellEmpty {
    background: linear-gradient(180deg, #fff8df 0%, #f1dda0 100%) !important;
    background-color: #f1dda0 !important;
    border-color: #c9a84f !important;
  }

  .resultsTableCommercialScope td.results12TaskInvigilation *,
  .resultsTableCommercialScope td.resultsTableCommercialTaskInvigilation *,
  .resultsTableCommercialScope td.results12TaskReserve *,
  .resultsTableCommercialScope td.resultsTableCommercialTaskReserve *,
  .resultsTableCommercialScope td.results12TaskDuty *,
  .resultsTableCommercialScope td.resultsTableCommercialTaskDuty *,
  .resultsTableCommercialScope td.results12CellEmptyOfficial *,
  .resultsTableCommercialScope td.resultsTableCommercialCellEmpty * {
    background: transparent !important;
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
  }

  .resultsTableCommercialScope td.results12CellEmptyOfficial button,
  .resultsTableCommercialScope td.resultsTableCommercialCellEmpty button {
    background: #fffaf0 !important;
    border: 1px solid rgba(169, 131, 34, 0.48) !important;
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
  }

  @keyframes resultsTableCommercialBluePulse {
    0%, 100% { box-shadow: inset 0 0 0 1px rgba(91, 155, 213, 0.16); }
    50% { box-shadow: inset 0 0 0 1px rgba(91, 155, 213, 0.34), 0 0 8px rgba(91, 155, 213, 0.20); }
  }

  @keyframes resultsTableCommercialGreenPulse {
    0%, 100% { box-shadow: inset 0 0 0 1px rgba(21, 128, 61, 0.20), 0 0 4px rgba(22, 163, 74, 0.12); }
    50% { box-shadow: inset 0 0 0 1px rgba(21, 128, 61, 0.42), 0 0 10px rgba(22, 163, 74, 0.24); }
  }

  @keyframes resultsTableCommercialRedPulse {
    0%, 100% { box-shadow: inset 0 0 0 1px rgba(209, 93, 93, 0.16); }
    50% { box-shadow: inset 0 0 0 1px rgba(209, 93, 93, 0.34), 0 0 8px rgba(209, 93, 93, 0.18); }
  }

  .resultsTableCommercialDuplicateTextHidden {
    display: none !important;
  }

  .resultsTableCommercialScope tbody tr > th:first-child .resultsTableCommercialDuplicateTextHidden,
  .resultsTableCommercialScope tbody tr > td:first-child .resultsTableCommercialDuplicateTextHidden {
    display: revert !important;
  }

  .resultsTableCommercialScope tbody tr > th:first-child,
  .resultsTableCommercialScope tbody tr > td:first-child {
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    font-weight: 900 !important;
    opacity: 1 !important;
  }

  .resultsTableCommercialScope tbody td div,
  .resultsTableCommercialScope tbody td span,
  .resultsTableCommercialScope tbody td strong,
  .resultsTableCommercialScope tbody td small {
    line-height: 1.28 !important;
  }


  .resultsTableCommercialScope tbody td,
  .resultsTableCommercialScope tbody td div,
  .resultsTableCommercialScope tbody td span,
  .resultsTableCommercialScope tbody td strong,
  .resultsTableCommercialScope tbody td small,
  .resultsTableCommercialScope tbody td p {
    word-break: normal !important;
    overflow-wrap: normal !important;
    letter-spacing: normal !important;
    writing-mode: horizontal-tb !important;
    text-orientation: mixed !important;
  }

  .resultsTableCommercialScope tbody td span,
  .resultsTableCommercialScope tbody td strong,
  .resultsTableCommercialScope tbody td small {
    display: inline-block !important;
    max-width: 100% !important;
  }

  .resultsTableCommercialScope tbody td > div {
    margin-top: 2px !important;
    margin-bottom: 2px !important;
  }

  @media print {
    .resultsTableCommercialScope {
      background: #ffffff !important;
      border: 1px solid #9ca3af !important;
      box-shadow: none !important;
      padding: 0 !important;
    }

    .resultsTableCommercialScope table {
      border-spacing: 2px !important;
      font-size: 10px !important;
    }

    .resultsTableCommercialScope th,
    .resultsTableCommercialScope td,
    .resultsTableCommercialScope * {
      animation: none !important;
      box-shadow: none !important;
      text-shadow: none !important;
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
    }

    .resultsTableCommercialScope th,
    .resultsTableCommercialScope td {
      border: 1px solid #9ca3af !important;
      border-radius: 0 !important;
      padding: 3px 4px !important;
    }

    .resultsTableCommercialScope button {
      display: none !important;
    }
  }
`;

const COMMERCIAL_DUPLICATE_TEXT_CLASS = "resultsTableCommercialDuplicateTextHidden";
const COMMERCIAL_TASK_INVIGILATION_CLASS = "resultsTableCommercialTaskInvigilation";
const COMMERCIAL_TASK_RESERVE_CLASS = "resultsTableCommercialTaskReserve";
const COMMERCIAL_TASK_DUTY_CLASS = "resultsTableCommercialTaskDuty";
const COMMERCIAL_CELL_EMPTY_CLASS = "resultsTableCommercialCellEmpty";
const COMMERCIAL_TASK_CELL_CLASSES = [
  COMMERCIAL_TASK_INVIGILATION_CLASS,
  COMMERCIAL_TASK_RESERVE_CLASS,
  COMMERCIAL_TASK_DUTY_CLASS,
  COMMERCIAL_CELL_EMPTY_CLASS,
];

function isCommercialTeacherNameCell(cell: HTMLElement) {
  const root = cell.closest<HTMLElement>(".resultsTableCommercialScope");
  const hasTeacherSidebar = root?.dataset?.showTeacherSidebar === "true";
  const tableCell = cell as HTMLTableCellElement;
  const cellIndex = typeof tableCell.cellIndex === "number" ? tableCell.cellIndex : -1;

  return Boolean(hasTeacherSidebar && cellIndex === 0);
}

function getCommercialCellTextWithoutActions(cell: HTMLElement) {
  const cloned = cell.cloneNode(true) as HTMLElement;
  cloned
    .querySelectorAll("button,input,select,textarea")
    .forEach((node) => node.remove());
  return normalizeCommercialCellText(cloned.textContent || "");
}

function isCommercialOnlyActionCell(cell: HTMLElement) {
  const textWithoutActions = getCommercialCellTextWithoutActions(cell);
  if (textWithoutActions) return false;

  const actionText = normalizeCommercialCellText(
    Array.from(cell.querySelectorAll<HTMLElement>("button"))
      .map((button) => button.textContent || "")
      .join(" "),
  );

  return Boolean(actionText);
}

function getCommercialTaskCellClassFromText(value: string, cell?: HTMLElement) {
  const text = normalizeCommercialCellText(value).toLowerCase();

  if (!text) {
    return cell && isCommercialOnlyActionCell(cell) ? COMMERCIAL_CELL_EMPTY_CLASS : "";
  }

  if (/مراقب\s*دور|duty\s*invigilator/.test(text)) return COMMERCIAL_TASK_DUTY_CLASS;
  if (/مراقبة|invigilation/.test(text)) return COMMERCIAL_TASK_INVIGILATION_CLASS;
  if (/احتياط|reserve/.test(text)) return COMMERCIAL_TASK_RESERVE_CLASS;
  if (/فاضي|empty|free|review|correction|للمراجعة|للتصحيح/.test(text)) return COMMERCIAL_CELL_EMPTY_CLASS;

  return "";
}

function applyCommercialTaskCellClasses(root: HTMLElement | null) {
  if (!root) return;

  COMMERCIAL_TASK_CELL_CLASSES.forEach((className) => {
    root
      .querySelectorAll(`.${className}`)
      .forEach((node) => node.classList.remove(className));
  });

  const cells = Array.from(root.querySelectorAll<HTMLElement>("tbody td"));

  cells.forEach((cell) => {
    if (isCommercialTeacherNameCell(cell)) return;

    const visibleText = getCommercialCellTextWithoutActions(cell);
    const className = getCommercialTaskCellClassFromText(visibleText, cell);

    if (className) {
      cell.classList.add(className);
    }
  });
}


function normalizeCommercialValue(value: any) {
  return String(value ?? "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getCommercialCommitteeNo(assignment: any) {
  return (
    assignment?.committeeNo ??
    assignment?.committee ??
    assignment?.roomNo ??
    assignment?.room ??
    assignment?.committeeNumber ??
    ""
  );
}

function getCommercialInvigilatorNo(assignment: any) {
  return (
    assignment?.invigilatorNo ??
    assignment?.invigilatorNumber ??
    assignment?.monitorNo ??
    assignment?.observerNo ??
    assignment?.slotNo ??
    ""
  );
}

function getCommercialAssignmentDate(assignment: any) {
  return (
    assignment?.dateISO ??
    assignment?.date ??
    assignment?.examDate ??
    assignment?.dayDate ??
    assignment?.exam?.dateISO ??
    ""
  );
}

function getCommercialAssignmentKey(assignment: Assignment) {
  const a: any = assignment || {};
  return [
    normalizeCommercialValue(a.taskType),
    normalizeCommercialValue(a.teacherId ?? a.teacherName ?? a.teacher),
    normalizeCommercialValue(a.subject),
    normalizeCommercialValue(getCommercialAssignmentDate(a)),
    normalizeCommercialValue(a.period),
    normalizeCommercialValue(getCommercialCommitteeNo(a)),
    normalizeCommercialValue(getCommercialInvigilatorNo(a)),
    normalizeCommercialValue(a.examId ?? a.examKey ?? a.subColKey),
  ].join("|");
}

function dedupeCommercialAssignments(assignments: Assignment[] = []) {
  const seen = new Set<string>();
  const unique: Assignment[] = [];

  assignments.forEach((assignment) => {
    const key = getCommercialAssignmentKey(assignment);
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(assignment);
  });

  return unique;
}

function buildCommercialDisplayMatrix(
  matrix2: Record<string, Record<string, Assignment[]>>,
) {
  const next: Record<string, Record<string, Assignment[]>> = {};

  Object.entries(matrix2 || {}).forEach(([teacher, cols]) => {
    next[teacher] = {};
    Object.entries(cols || {}).forEach(([subColKey, assignments]) => {
      next[teacher][subColKey] = Array.isArray(assignments)
        ? dedupeCommercialAssignments(assignments)
        : [];
    });
  });

  return next;
}

function normalizeCommercialCellText(value: string) {
  return String(value || "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCommercialDuplicateKey(value: string) {
  return normalizeCommercialCellText(value)
    .replace(/[•:：؛;,،._\-–—]/g, " ")
    .replace(/\b(first|second)\s+period\b/gi, (m) => m.toLowerCase())
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isCommercialActionText(value: string) {
  const text = normalizeCommercialCellText(value).toLowerCase();
  return (
    !text ||
    text === "+" ||
    text === "×" ||
    text === "x" ||
    text === "حذف" ||
    text === "delete" ||
    text === "إضافة" ||
    text === "اضافة" ||
    text === "add" ||
    /^\+\s*/.test(text)
  );
}

function isCommercialCleanableTextBlock(element: HTMLElement) {
  if (element.closest("button,input,select,textarea")) return false;

  const text = normalizeCommercialCellText(element.textContent || "");
  if (isCommercialActionText(text)) return false;
  if (text.length < 2 || text.length > 80) return false;

  const nestedBlocks = element.querySelectorAll("div,span,strong,small,p");
  if (nestedBlocks.length > 2) return false;

  return true;
}

function cleanupDuplicateCommercialCellText(root: HTMLElement | null) {
  if (!root) return;

  root
    .querySelectorAll(`.${COMMERCIAL_DUPLICATE_TEXT_CLASS}`)
    .forEach((node) => node.classList.remove(COMMERCIAL_DUPLICATE_TEXT_CLASS));

  const cells = Array.from(root.querySelectorAll<HTMLElement>("tbody td"));

  cells.forEach((cell) => {
    if (isCommercialTeacherNameCell(cell)) return;

    const seen = new Set<string>();
    const blocks = Array.from(
      cell.querySelectorAll<HTMLElement>("div,span,strong,small,p"),
    );

    blocks.forEach((block) => {
      if (!isCommercialCleanableTextBlock(block)) return;

      const text = normalizeCommercialCellText(block.textContent || "");
      const key = normalizeCommercialDuplicateKey(text);

      if (seen.has(key)) {
        block.classList.add(COMMERCIAL_DUPLICATE_TEXT_CLASS);
        return;
      }

      seen.add(key);
    });
  });
}

export type ResultsTableProps = {
  displayDates: string[];
  dateToSubCols: Map<string, SubCol[]>;
  allSubCols: SubCol[];
  allTeachers: string[];
  matrix2: Record<string, Record<string, Assignment[]>>;
  committeesCountBySubCol: Record<string, number>;
  totalsDetailBySubCol: Record<
    string,
    { inv: number; res: number; duty: number; total: number; deficit: number; committees: number; required?: number }
  >;
  teacherTotals: Record<string, number>;

  columnColor: (index: number) => { colBg: string; headBg: string };
  teacherRowColor: (index: number) => { stripe: string };
  getSubjectBackground: (subject?: string) => string;
  taskLabel: (t: any) => string;
  normalizeSubject: (s: string) => string;
  formatPeriod: (p?: string) => string;
  getCommitteeNo: (a: any) => string | undefined;

  isDraggableTaskType: (taskType: any) => boolean;
  dragSrcUid: string | null;
  dragOverUid: string | null;
  setDragSrcUid: (v: string | null) => void;
  setDragOverUid: (v: string | null) => void;
  onSwap: (srcUid: string, dstUid: string) => void;
  onDropToEmpty: (srcUid: string, dstTeacher: string, subColKey: string) => void;
  onDropToCell?: (srcUid: string, dstTeacher: string, subColKey: string, dstCellList: any[]) => void;
  onAddToEmpty?: (dstTeacher: string, subColKey: string, taskType: string) => void;
  onDeleteByUid?: (uid: string) => void;
  onDeleteSubCol?: (subColKey: string) => void;

  styles: {
    tableText: string;
    tableFontSize: string;
    goldLine: string;
    goldLineSoft: string;
    teacherHeaderStyle: React.CSSProperties;
    teacherTotalHeaderStyle: React.CSSProperties;
  };

  formatDateWithDayAr: (dateISO: string) => { day: string; full: string; line: string };
  containerMaxHeight?: string;
  selectedCell?: { teacher: string; subColKey: string; uid?: string } | null;
  onSelectCell?: (payload: { teacher: string; subColKey: string; uid?: string }) => void;
  isConflictUid?: (uid: string) => boolean;
  getUnavailabilityReasonForCell?: (teacherName: string, subColKey: string, taskType: string) => string | null;
  blockedCellMsg?: Record<string, string>;
  showTeacherSidebar?: boolean;
};

export function ResultsTable(props: ResultsTableProps) {
  const { lang } = useI18n();
  const {
    displayDates,
    dateToSubCols,
    allSubCols,
    allTeachers,
    committeesCountBySubCol,
    totalsDetailBySubCol,
    teacherTotals,
    styles,
    columnColor,
    teacherRowColor,
    formatDateWithDayAr,
    formatPeriod,
    showTeacherSidebar = true,
  } = props;

  const containerStyle = getResultsTableContainerStyle({
    containerMaxHeight: props.containerMaxHeight,
    goldLine: styles.goldLine,
  });
  const invigilationDeficitBySubCol = buildInvigilationDeficitBySubCol(totalsDetailBySubCol);
  const reserveCountBySubCol = buildReserveCountBySubCol(totalsDetailBySubCol);
  const requiredBySubCol = buildRequiredBySubCol(totalsDetailBySubCol);
  const tableCommercialRef = React.useRef<HTMLDivElement>(null);
  const commercialMatrix2 = React.useMemo(
    () => buildCommercialDisplayMatrix(props.matrix2),
    [props.matrix2],
  );

  React.useEffect(() => {
    const root = tableCommercialRef.current;
    if (!root) return;

    const applyCleanup = () => {
      applyCommercialTaskCellClasses(root);
      cleanupDuplicateCommercialCellText(root);
    };
    const frame = window.requestAnimationFrame(applyCleanup);

    if (typeof MutationObserver === "undefined") {
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new MutationObserver(applyCleanup);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [commercialMatrix2, allTeachers.length, allSubCols.length, showTeacherSidebar]);

  return (
    <div
      ref={tableCommercialRef}
      className="resultsTableCommercialScope"
      data-show-teacher-sidebar={showTeacherSidebar ? "true" : "false"}
      style={containerStyle}
    >
      <style>{`${RESULTS_TABLE_CONFLICT_CSS}
${COMMERCIAL_RESULTS_TABLE_CSS}`}</style>
      <table
        style={{
          width: "100%",
          minWidth: "max-content",
          tableLayout: "fixed",
          borderCollapse: "separate",
          borderSpacing: "4px 6px",
          direction: lang === "ar" ? "rtl" : "ltr",
          fontSize: styles.tableFontSize,
          fontWeight: 700,
          color: "#000000",
        }}
      >
        <colgroup>
          {showTeacherSidebar ? <col style={{ width: 220 }} /> : null}
          {allSubCols.map((sc) => {
            const isCorrection = false;
            return <col key={sc.key} style={{ width: isCorrection ? 260 : 205 }} />;
          })}
          <col style={{ width: 130 }} />
        </colgroup>

        <ResultsTableHeader
          displayDates={displayDates}
          dateToSubCols={dateToSubCols}
          allSubCols={allSubCols}
          committeesCountBySubCol={committeesCountBySubCol}
          styles={styles}
          formatDateWithDayAr={formatDateWithDayAr}
          formatPeriod={formatPeriod}
          onDeleteSubCol={props.onDeleteSubCol}
          showTeacherSidebar={showTeacherSidebar}
        />

        <tbody>
          {allTeachers.map((teacher, tIdx) => (
            <TeacherRow
              key={teacher}
              teacher={teacher}
              teacherIndex={tIdx}
              allSubCols={allSubCols}
              displayDates={displayDates}
              matrix2={commercialMatrix2}
              teacherTotals={teacherTotals}
              columnColor={columnColor}
              teacherRowColor={teacherRowColor}
              getSubjectBackground={props.getSubjectBackground}
              taskLabel={props.taskLabel}
              normalizeSubject={props.normalizeSubject}
              formatPeriod={props.formatPeriod}
              getCommitteeNo={props.getCommitteeNo}
              isDraggableTaskType={props.isDraggableTaskType}
              dragSrcUid={props.dragSrcUid}
              dragOverUid={props.dragOverUid}
              setDragSrcUid={props.setDragSrcUid}
              setDragOverUid={props.setDragOverUid}
              onSwap={props.onSwap}
              onDropToEmpty={props.onDropToEmpty}
              onDropToCell={props.onDropToCell}
              onAddToEmpty={props.onAddToEmpty}
              invigilationDeficitBySubCol={invigilationDeficitBySubCol}
              reserveCountBySubCol={reserveCountBySubCol}
              requiredBySubCol={requiredBySubCol}
              onDeleteByUid={props.onDeleteByUid}
              selectedCell={props.selectedCell}
              onSelectCell={props.onSelectCell}
              isConflictUid={props.isConflictUid}
              getUnavailabilityReasonForCell={props.getUnavailabilityReasonForCell}
              blockedCellMsg={props.blockedCellMsg}
              styles={{
                tableText: styles.tableText,
                tableFontSize: styles.tableFontSize,
                goldLine: styles.goldLine,
                goldLineSoft: styles.goldLineSoft,
              }}
              showTeacherSidebar={showTeacherSidebar}
            />
          ))}

          <ResultsTotalsRow
            allSubCols={allSubCols}
            totalsDetailBySubCol={totalsDetailBySubCol}
            committeesCountBySubCol={committeesCountBySubCol}
            styles={{
              tableFontSize: styles.tableFontSize,
              goldLine: styles.goldLine,
              goldLineSoft: styles.goldLineSoft,
            }}
            showTeacherSidebar={showTeacherSidebar}
          />
        </tbody>
      </table>
    </div>
  );
}
