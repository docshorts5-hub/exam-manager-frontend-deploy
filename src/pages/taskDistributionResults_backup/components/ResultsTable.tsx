import React from "react";
import type { Assignment } from "../../../contracts/taskDistributionContract";
import type { SubCol } from "./TeacherRow";
import { TeacherRow } from "./TeacherRow";
import { ResultsTableHeader } from "./ResultsTableHeader";
import { ResultsTotalsRow } from "./ResultsTotalsRow";
import { buildInvigilationDeficitBySubCol, buildRequiredBySubCol, buildReserveCountBySubCol } from "../services/resultsTableDerivedMaps";
import { getResultsTableContainerStyle, RESULTS_TABLE_CONFLICT_CSS } from "../services/resultsTablePresentation";

export type ResultsTableProps = {
  displayDates: string[];
  dateToSubCols: Map<string, SubCol[]>;
  allSubCols: SubCol[];
  allTeachers: string[];
  matrix2: Record<string, Record<string, Assignment[]>>;
  committeesCountBySubCol: Record<string, number>;
  totalsDetailBySubCol: Record<
    string,
    { inv: number; res: number; corr: number; total: number; deficit: number; committees: number; required?: number }
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

  return (
    <div style={containerStyle}>
      <style>{RESULTS_TABLE_CONFLICT_CSS}</style>
      <table
        style={{
          width: "100%",
          minWidth: "max-content",
          tableLayout: "fixed",
          borderCollapse: "separate",
          borderSpacing: "6px 8px",
          direction: "rtl",
          fontSize: styles.tableFontSize,
          fontWeight: 800,
          color: styles.tableText,
        }}
      >
        <colgroup>
          {showTeacherSidebar ? <col style={{ width: 260 }} /> : null}
          {allSubCols.map((sc) => {
            const isCorrection =
              String(sc.subject || "").includes("تصحيح") || String(sc.key || "").includes("تصحيح");
            return <col key={sc.key} style={{ width: isCorrection ? 290 : 240 }} />;
          })}
          <col style={{ width: 160 }} />
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
              matrix2={props.matrix2}
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
