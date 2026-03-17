import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { pageDark, container, cardDark } from "../styles/ui";
import { GOLD_LINE, GOLD_LINE_SOFT, subjectColors, TABLE_FONT_SIZE, TABLE_TEXT } from "./taskDistributionResults/constants";
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

function normalizeSubject(subject: string) {
  return String(subject || "").replace(/\s+/g, " ").trim();
}

function formatPeriod(period?: string) {
  const p = String(period || "AM").toUpperCase();
  return p === "PM" || p === "BM" ? "الفترة الثانية" : "الفترة الأولى";
}

function taskLabel(taskType: any) {
  switch (String(taskType || "")) {
    case "INVIGILATION":
      return "مراقبة";
    case "RESERVE":
      return "احتياط";
    case "REVIEW_FREE":
      return "مراجعة";
    case "CORRECTION_FREE":
      return "تصحيح";
    default:
      return "مهمة";
  }
}

function getCommitteeNo(a: any) {
  const value = a?.committeeNo ?? a?.committee ?? a?.roomNo ?? a?.room;
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}

function formatDateWithDayAr(dateISO: string) {
  const value = String(dateISO || "").trim();
  if (!value) return { day: "—", full: "—", line: "—" };
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { day: value, full: value, line: value };
  const day = new Intl.DateTimeFormat("ar", { weekday: "long" }).format(d);
  const full = new Intl.DateTimeFormat("ar", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return { day, full, line: `${day} ${full}` };
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
  const tenantId = React.useMemo(() => getTenantIdFromAuth(auth), [auth]);
  const printAreaRef = React.useRef<HTMLDivElement>(null);
  const [showTeacherSidebar, setShowTeacherSidebar] = React.useState(true);

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

  const tableActions = useResultsTableActions({ tenantId, 
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

  const styles = React.useMemo(() => ({
    tableText: TABLE_TEXT,
    tableFontSize: TABLE_FONT_SIZE,
    goldLine: GOLD_LINE,
    goldLineSoft: GOLD_LINE_SOFT,
    ...getResultsTableHeaderStyles({
      tableText: TABLE_TEXT,
      tableFontSize: TABLE_FONT_SIZE,
      goldLine: GOLD_LINE,
      goldLineSoft: GOLD_LINE_SOFT,
    }),
  }), []);

  const hasRun = Boolean(run && Array.isArray(run.assignments) && run.assignments.length);

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
        <div style={cardDark}>
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

      <input
        ref={interaction.fileInputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        style={{ display: "none" }}
        onChange={pageActions.handleImportFileSelected}
      />

      <div ref={printAreaRef}>
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
          formatDateWithDayAr={formatDateWithDayAr}
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
            teachersCount={dataModel.allTeachers.length}
          />
        </div>
      </div>

      <ResultsImportConfirmDialog
        open={interaction.importDialogOpen}
        filename={interaction.pendingImportedFilename}
        onConfirm={pageActions.confirmImportReplace}
        onCancel={pageActions.closeImportDialog}
      />
    </>
  );

  if (interaction.tableFullScreen && hasRun) {
    return (
      <div style={{ ...pageDark, padding: 8 }}>
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#020617", padding: 8, overflow: "auto" }}>
          <div style={{ ...container, width: "100%", maxWidth: "100%", padding: 0 }}>
            <ResultsFullscreenToolbar
              undoDisabled={!interaction.undoStack.length}
              onUndo={() => pageActions.handleUndo(interaction.undoStack)}
              onClose={() => interaction.setTableFullScreen(false)}
              showTeacherSidebar={showTeacherSidebar}
              onToggleTeacherSidebar={() => setShowTeacherSidebar((v) => !v)}
            />
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageDark}>
      <div style={{ ...container, width: "min(1880px, 100%)", maxWidth: "100%" }}>{content}</div>
    </div>
  );
}
