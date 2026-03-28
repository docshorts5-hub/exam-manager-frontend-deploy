import { taskLabel } from "../taskUtils";
import {
  getResultsDragDropTypeMismatchMessage,
  getResultsDragDropUnsupportedMessage,
  getResultsEmptyCellOccupiedMessage,
} from "../services/resultsDragDropActionMessages";
import { resolveResultsSameTypeDropTargetUid } from "../services/resultsDragDropResolvers";
import {
  colKeyOf,
  getAssignmentsInCell,
  isDraggableTaskType,
  parseColKey,
  teacherHasInvOrResInSameSlot,
  validatePlacement,
} from "../services/resultsDragDropRules";

export function useResultsDragDropActions({
  run,
  colKeyToExamId,
  persistEditedAssignments,
  getUnavailabilityReasonForCell,
  markCellBlocked,
  normalizeSubject,
}: {
  run: any;
  colKeyToExamId: Record<string, any>;
  persistEditedAssignments: (nextAssignments: any[], note?: string, opts?: { skipUndo?: boolean }) => void;
  getUnavailabilityReasonForCell: (teacherName: string, subColKey: string, taskType: string) => string | null;
  markCellBlocked: (teacherName: string, subColKey: string, msg: string) => void;
  normalizeSubject: (subject: string) => string;
}) {
  function swapAssignmentsByUid(srcUid: string, dstUid: string) {
    if (!run) return;
    if (!srcUid || !dstUid || srcUid === dstUid) return;

    const list = Array.isArray(run.assignments) ? run.assignments : [];
    const src = list.find((x: any) => x?.__uid === srcUid) as any;
    const dst = list.find((x: any) => x?.__uid === dstUid) as any;
    if (!src || !dst) return;

    const srcType = String(src.taskType || "");
    const dstType = String(dst.taskType || "");

    if (!isDraggableTaskType(srcType) || !isDraggableTaskType(dstType)) {
      alert(getResultsDragDropUnsupportedMessage());
      return;
    }
    if (srcType !== dstType) {
      alert(getResultsDragDropTypeMismatchMessage());
      return;
    }

    const srcTeacher = String(src.teacherName || "").trim();
    const dstTeacher = String(dst.teacherName || "").trim();
    if (!srcTeacher || !dstTeacher) return;

    const srcColKey = colKeyOf(src);
    const dstColKey = colKeyOf(dst);

    const r1 = validatePlacement(list, dstTeacher, dstColKey, String(src.taskType || ""), [srcUid, dstUid]);
    if (r1) {
      alert(r1);
      return;
    }
    const r2 = validatePlacement(list, srcTeacher, srcColKey, String(dst.taskType || ""), [srcUid, dstUid]);
    if (r2) {
      alert(r2);
      return;
    }

    const m1 = getUnavailabilityReasonForCell(dstTeacher, dstColKey, srcType);
    if (m1) {
      markCellBlocked(dstTeacher, dstColKey, `غير متاح: ${m1}`);
      return;
    }
    const m2 = getUnavailabilityReasonForCell(srcTeacher, srcColKey, dstType);
    if (m2) {
      markCellBlocked(srcTeacher, srcColKey, `غير متاح: ${m2}`);
      return;
    }

    const srcCol = parseColKey(srcColKey);
    const dstCol = parseColKey(dstColKey);
    const next = list.map((a: any) => {
      if (a?.__uid === srcUid)
        return {
          ...a,
          teacherName: dstTeacher,
          dateISO: dstCol.dateISO,
          period: dstCol.period,
          subject: dstCol.subject,
          examId: colKeyToExamId[dstColKey] || a.examId,
          committeeNo: undefined,
          invigilatorIndex: undefined,
        };
      if (a?.__uid === dstUid)
        return {
          ...a,
          teacherName: srcTeacher,
          dateISO: srcCol.dateISO,
          period: srcCol.period,
          subject: srcCol.subject,
          examId: colKeyToExamId[srcColKey] || a.examId,
          committeeNo: undefined,
          invigilatorIndex: undefined,
        };
      return a;
    });

    const humanType = taskLabel(srcType as any);
    const srcIsInvRes = srcType === "INVIGILATION" || srcType === "RESERVE";
    const dstIsInvRes = dstType === "INVIGILATION" || dstType === "RESERVE";
    const srcNowConflicts = srcIsInvRes && teacherHasInvOrResInSameSlot(next, dstTeacher, dstCol.dateISO, dstCol.period, [srcUid]);
    const dstNowConflicts = dstIsInvRes && teacherHasInvOrResInSameSlot(next, srcTeacher, srcCol.dateISO, srcCol.period, [dstUid]);

    persistEditedAssignments(
      next,
      srcNowConflicts || dstNowConflicts
        ? `⚠️ تعارض نفس الفترة بعد التبديل: ${humanType} (يمكنك التراجع).`
        : `🖐️ تعديل يدوي: تبديل ${humanType} بين (${srcTeacher}) و (${dstTeacher})`
    );
  }

  function moveAssignmentToColumnTeacher(srcUid: string, dstTeacher: string, dstColKey: string) {
    if (!run) return;
    if (!srcUid || !dstTeacher || !dstColKey) return;

    const list = Array.isArray(run.assignments) ? run.assignments : [];
    const src = list.find((x: any) => x?.__uid === srcUid) as any;
    if (!src) return;

    const srcType = String(src.taskType || "");
    if (!isDraggableTaskType(srcType)) {
      alert(getResultsDragDropUnsupportedMessage());
      return;
    }

    const srcTeacher = String(src.teacherName || "").trim();
    const targetTeacher = String(dstTeacher || "").trim();
    if (!srcTeacher || !targetTeacher) return;

    const srcColKey = colKeyOf(src);
    if (srcTeacher === targetTeacher && srcColKey === dstColKey) return;

    const unMsg = getUnavailabilityReasonForCell(targetTeacher, dstColKey, srcType);
    if (unMsg) {
      markCellBlocked(targetTeacher, dstColKey, `غير متاح: ${unMsg}`);
      return;
    }

    const v = validatePlacement(list, targetTeacher, dstColKey, srcType, [srcUid]);
    if (v) {
      alert(v);
      return;
    }

    const dstCol = parseColKey(dstColKey);
    const isInvOrRes = srcType === "INVIGILATION" || srcType === "RESERVE";
    const willConflictSameSlot = isInvOrRes && teacherHasInvOrResInSameSlot(list, targetTeacher, dstCol.dateISO, dstCol.period, [srcUid]);

    const next = list.map((a: any) => {
      if (a?.__uid === srcUid) {
        return {
          ...a,
          teacherName: targetTeacher,
          dateISO: dstCol.dateISO,
          period: dstCol.period,
          subject: dstCol.subject,
          examId: colKeyToExamId[dstColKey] || a.examId,
          committeeNo: undefined,
          invigilatorIndex: undefined,
        };
      }
      return a;
    });

    const humanType = taskLabel(srcType as any);
    const from = parseColKey(srcColKey);
    const to = parseColKey(dstColKey);
    persistEditedAssignments(
      next,
      willConflictSameSlot
        ? `⚠️ تعارض نفس الفترة: نقل ${humanType} إلى (${targetTeacher}) مع وجود مهمة أخرى في نفس الفترة. (يمكنك التراجع).`
        : `🖐️ تعديل يدوي: نقل ${humanType} من (${srcTeacher}) [${from.dateISO} ${from.period} ${from.subject}] إلى (${targetTeacher}) [${to.dateISO} ${to.period} ${to.subject}]`
    );
  }

  function handleDropToCell(srcUid: string, dstTeacher: string, dstColKey: string, dstCellList: any[]) {
    if (!run) return;
    const list = Array.isArray(run.assignments) ? run.assignments : [];
    const src = list.find((x: any) => x?.__uid === srcUid) as any;
    if (!src) return;

    const srcType = String(src.taskType || "");
    if (!isDraggableTaskType(srcType)) return;

    const sameTypeTargetUid = resolveResultsSameTypeDropTargetUid(dstCellList || [], srcType, isDraggableTaskType);

    if (sameTypeTargetUid) {
      swapAssignmentsByUid(String(srcUid), sameTypeTargetUid);
      return;
    }

    moveAssignmentToColumnTeacher(String(srcUid), String(dstTeacher), String(dstColKey));
  }

  function handleDropToEmptyCell(srcUid: string, dstTeacher: string, dstColKey: string) {
    if (!run) return;
    const list = Array.isArray(run.assignments) ? run.assignments : [];
    const src = list.find((x: any) => x?.__uid === srcUid) as any;
    if (!src) return;

    const srcType = String(src.taskType || "");
    if (!isDraggableTaskType(srcType)) return;

    const dstHasAnything = getAssignmentsInCell(list, dstTeacher, dstColKey, normalizeSubject).length > 0;
    if (dstHasAnything) {
      alert(getResultsEmptyCellOccupiedMessage());
      return;
    }

    moveAssignmentToColumnTeacher(String(srcUid), String(dstTeacher), String(dstColKey));
  }

  return {
    swapAssignmentsByUid,
    moveAssignmentToColumnTeacher,
    handleDropToCell,
    handleDropToEmptyCell,
  };
}
