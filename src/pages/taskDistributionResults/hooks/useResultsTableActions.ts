import { exportExcelStyledLikeTable } from "../excelExport";
import { useResultsDragDropActions } from "./useResultsDragDropActions";
import { addTaskToResultsEmptyCell, deleteAssignmentFromResultsRun, deleteAssignmentsForSubColFromResultsRun } from "../services/resultsCellMutations";
import { getAssignmentsInCell, isDraggableTaskType } from "../services/resultsDragDropRules";
import { createResultsCellUnavailabilityResolver } from "../services/resultsTableActionResolvers";
import { buildResultsBlockedCellMessage, buildResultsExcelExportPayload } from "../services/resultsTableActionPayloads";

type Args = {
  run: any;
  tenantId: string;
  teacherNameToId: Map<string, string>;
  colKeyToExamId: Record<string, any>;
  examKeyToCommittees: Record<string, any>;
  invigilatorsPerRoomForSubject: (subject: string) => number;
  unavailIndex: any;
  unavailReasonMap: Map<string, string>;
  markCellBlocked: (teacherName: string, subColKey: string, msg: string) => void;
  normalizeSubject: (subject: string) => string;
  persistEditedAssignments: (nextAssignments: any[], note?: string, opts?: { skipUndo?: boolean }) => void;
  displayDates: any[];
  dateToSubCols: Map<string, any[]>;
  allSubCols: any[];
  allTeachers: string[];
  matrix2: Record<string, any>;
  committeesCountBySubCol: Record<string, number>;
  totalsDetailBySubCol: Record<string, any>;
  teacherTotals: Record<string, number>;
};

export function useResultsTableActions({
  run,
  teacherNameToId,
  colKeyToExamId,
  examKeyToCommittees,
  invigilatorsPerRoomForSubject,
  unavailIndex,
  unavailReasonMap,
  markCellBlocked,
  normalizeSubject,
  persistEditedAssignments,
  displayDates,
  dateToSubCols,
  allSubCols,
  allTeachers,
  matrix2,
  committeesCountBySubCol,
  totalsDetailBySubCol,
  teacherTotals,
}: Args) {
  const getUnavailabilityReasonForCell = createResultsCellUnavailabilityResolver({
    teacherNameToId,
    unavailIndex,
    unavailReasonMap,
  });

  const dragDropActions = useResultsDragDropActions({
    run,
    colKeyToExamId,
    persistEditedAssignments,
    getUnavailabilityReasonForCell,
    markCellBlocked,
    normalizeSubject,
  });

  const deleteAssignmentByUid = (uid: string) => {
    deleteAssignmentFromResultsRun({
      run,
      uid,
      normalizeSubject,
      persistEditedAssignments,
    });
  };

  const addTaskToEmptyCell = (dstTeacher: string, dstColKey: string, taskType: string) => {
    addTaskToResultsEmptyCell({
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
    });
  };


  const deleteAssignmentsBySubCol = (subColKey: string) => {
    deleteAssignmentsForSubColFromResultsRun({
      run,
      subColKey,
      normalizeSubject,
      persistEditedAssignments,
    });
  };

  const exportExcel = () => {
    exportExcelStyledLikeTable(buildResultsExcelExportPayload({
      run,
      displayDates,
      dateToSubCols,
      allSubCols,
      allTeachers,
      matrix2,
      committeesCountBySubCol,
      totalsDetailBySubCol,
      teacherTotals,
    }));
  };

  return {
    getUnavailabilityReasonForCell,
    swapAssignmentsByUid: dragDropActions.swapAssignmentsByUid,
    moveAssignmentToColumnTeacher: dragDropActions.moveAssignmentToColumnTeacher,
    handleDropToCell: dragDropActions.handleDropToCell,
    handleDropToEmptyCell: dragDropActions.handleDropToEmptyCell,
    deleteAssignmentByUid,
    deleteAssignmentsBySubCol,
    addTaskToEmptyCell,
    exportExcel,
    getAssignmentsInCell,
    isDraggableTaskType,
  };
}
