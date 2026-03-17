import { taskLabel } from "../taskUtils";
import { getAssignmentsInCell, parseColKey } from "./resultsDragDropRules";
import { computeMissingCommitteeSlotForResultsCell, isSupportedResultsTaskType } from "./resultsCellMutationHelpers";

export function deleteAssignmentFromResultsRun({
  run,
  uid,
  normalizeSubject,
  persistEditedAssignments,
}: {
  run: any;
  uid: string;
  normalizeSubject: (subject: string) => string;
  persistEditedAssignments: (nextAssignments: any[], note?: string, opts?: { skipUndo?: boolean }) => void;
}) {
  if (!run) return;
  const u = String(uid || "").trim();
  if (!u) return;
  const list = Array.isArray(run.assignments) ? (run.assignments as any[]) : [];
  const target = list.find((x) => String((x as any)?.__uid || "") === u);
  if (!target) return;

  const next = list.filter((x) => String((x as any)?.__uid || "") !== u);
  const humanType = taskLabel(String((target as any)?.taskType || "") as any);
  const tName = String((target as any)?.teacherName || "").trim();
  const d = String((target as any)?.dateISO || "").trim();
  const p = String((target as any)?.period || "AM").toUpperCase();
  const s = normalizeSubject(String((target as any)?.subject || "").trim());
  persistEditedAssignments(next, `🗑️ حذف ${humanType} من (${tName}) [${d} ${p} ${s}]`);
}

export function addTaskToResultsEmptyCell({
  run,
  dstTeacher,
  dstColKey,
  taskType,
  normalizeSubject,
  getUnavailabilityReasonForCell,
  markCellBlocked,
  teacherNameToId,
  colKeyToExamId,
  examKeyToCommittees,
  invigilatorsPerRoomForSubject,
  persistEditedAssignments,
}: {
  run: any;
  dstTeacher: string;
  dstColKey: string;
  taskType: string;
  normalizeSubject: (subject: string) => string;
  getUnavailabilityReasonForCell: (teacherName: string, subColKey: string, taskType: string) => string | null;
  markCellBlocked: (teacherName: string, subColKey: string, msg: string) => void;
  teacherNameToId: Map<string, string>;
  colKeyToExamId: Record<string, any>;
  examKeyToCommittees: Record<string, any>;
  invigilatorsPerRoomForSubject: (subject: string) => number;
  persistEditedAssignments: (nextAssignments: any[], note?: string, opts?: { skipUndo?: boolean }) => void;
}) {
  if (!run) return;
  const tName = String(dstTeacher || "").trim();
  const colKey = String(dstColKey || "").trim();
  const tt = String(taskType || "").trim();
  if (!tName || !colKey || !tt) return;

  if (!isSupportedResultsTaskType(tt)) return;

  const currentAssignments = Array.isArray(run?.assignments) ? (run.assignments as any[]) : [];
  const dstHasAnything = getAssignmentsInCell(currentAssignments, tName, colKey, normalizeSubject).length > 0;
  if (dstHasAnything) {
    alert("هذه الخلية ليست فارغة. يمكن الإضافة فقط في الخلايا الفارغة.");
    return;
  }

  const col = parseColKey(colKey);
  const unMsg = getUnavailabilityReasonForCell(tName, colKey, tt);
  if (unMsg) {
    markCellBlocked(tName, colKey, `غير متاح: ${unMsg}`);
    return;
  }

  const missingSlot = computeMissingCommitteeSlotForResultsCell({
    taskType: tt,
    currentAssignments,
    dstColKey,
    col,
    examKeyToCommittees,
    invigilatorsPerRoomForSubject,
    normalizeSubject,
  });
  const now = Date.now();
  const id = `manual-${tt}-${now}-${Math.random().toString(16).slice(2)}`;
  const teacherId = teacherNameToId.get(tName) || tName;

  const newAss: any = {
    id,
    __uid: id,
    teacherId,
    teacherName: tName,
    dateISO: col.dateISO,
    period: (String(col.period || "AM").toUpperCase() as any) || "AM",
    taskType: tt,
    subject: col.subject,
    examId: colKeyToExamId[colKey] || undefined,
    committeeNo: missingSlot.committeeNo,
    invigilatorIndex: missingSlot.invigilatorIndex,
  };

  const next = [...currentAssignments, newAss];
  const humanType = taskLabel(tt as any);
  const note = `➕ إضافة ${humanType} إلى (${tName}) [${col.dateISO} ${col.period} ${col.subject}]`;
  persistEditedAssignments(next, note);
}


export function deleteAssignmentsForSubColFromResultsRun({
  run,
  subColKey,
  normalizeSubject,
  persistEditedAssignments,
}: {
  run: any;
  subColKey: string;
  normalizeSubject: (subject: string) => string;
  persistEditedAssignments: (nextAssignments: any[], note?: string, opts?: { skipUndo?: boolean }) => void;
}) {
  if (!run) return;
  const key = String(subColKey || "").trim();
  if (!key) return;

  const list = Array.isArray(run.assignments) ? (run.assignments as any[]) : [];
  const removed = list.filter((x) => String((x as any)?.colKey || "") === key);
  if (!removed.length) return;

  const kept = list.filter((x) => String((x as any)?.colKey || "") !== key);
  const sample = removed[0] || {};
  const subject = normalizeSubject(String((sample as any)?.subject || "").trim());
  const period = String((sample as any)?.period || "AM").toUpperCase();
  const dateISO = String((sample as any)?.dateISO || "").trim();

  persistEditedAssignments(
    kept,
    `🧹 حذف جميع تكليفات العمود [${dateISO} ${period} ${subject}] (${removed.length})`
  );
}
