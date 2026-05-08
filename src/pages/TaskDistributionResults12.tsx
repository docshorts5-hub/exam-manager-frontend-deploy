import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { pageDark, container, cardDark } from "../styles/ui";
import { GOLD_LINE, GOLD_LINE_SOFT, subjectColors, TABLE_FONT_SIZE, TABLE_TEXT } from "./taskDistributionResults12/constants";
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
import { loadTenantArray, loadTenantSettings, replaceTenantArray, saveTenantSettings, subscribeTenantArray } from "../services/tenantData";

function normalizeSubject(subject: string) {
  return String(subject || "").replace(/\s+/g, " ").trim();
}

const RESULTS12_ASSIGNMENTS_SUBCOLLECTION = "taskDistributionAssignments12";
const RESULTS12_LATEST_RUN_SETTINGS_DOC_ID = "latestTaskDistributionRun12";

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


function normalizeResultsTaskType(taskType: any) {
  const raw = String(taskType || "").trim().toUpperCase();
  if (raw === "INVIGILATION" || raw === "RESERVE" || raw === "DUTY_INVIGILATOR") return raw;
  return "DUTY_INVIGILATOR";
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

function ensureResultsRun(run: any, assignmentsFallback: any[] = []) {
  const assignments =
    Array.isArray(run?.assignments) && run.assignments.length
      ? run.assignments
      : Array.isArray(assignmentsFallback)
      ? assignmentsFallback
      : [];

  if (!run && !assignments.length) return null;

  return normalizeRunForDutyInvigilator({
    ...(run || {}),
    runId: String(run?.runId || `cloud_run_${Date.now()}`).trim(),
    createdAtISO: String(run?.createdAtISO || run?.runCreatedAtISO || new Date().toISOString()).trim(),
    assignments,
    warnings: Array.isArray(run?.warnings) ? run.warnings : [],
    debug: run?.debug || null,
  });
}

function normalizeCloudAssignment(row: any, index: number) {
  const id = String(row?.__uid || row?.id || `assignment_${index + 1}`).trim();

  return {
    ...row,
    id,
    __uid: String(row?.__uid || id),
  };
}

function buildResultsRunSignature(run: any) {
  const assignments = Array.isArray(run?.assignments) ? run.assignments : [];

  return JSON.stringify({
    runId: String(run?.runId || ""),
    createdAtISO: String(run?.createdAtISO || ""),
    count: assignments.length,
    assignments: assignments.map((assignment: any, index: number) => ({
      id: String(assignment?.__uid || assignment?.id || index),
      teacherId: String(assignment?.teacherId || ""),
      teacherName: String(assignment?.teacherName || ""),
      dateISO: String(assignment?.dateISO || assignment?.date || ""),
      period: String(assignment?.period || ""),
      taskType: normalizeResultsTaskType(assignment?.taskType),
      subject: String(assignment?.subject || ""),
      committeeNo: String(assignment?.committeeNo || assignment?.roomNo || ""),
      invigilatorIndex: String(assignment?.invigilatorIndex || ""),
    })),
  });
}

async function persistResultsRunToCloud(tenantId: string, run: any, by?: string) {
  const safeRun = ensureResultsRun(run);
  if (!safeRun) return;

  const runId = String(safeRun?.runId || `run_${Date.now()}`).trim();
  const createdAtISO = String(safeRun?.createdAtISO || new Date().toISOString()).trim();

  const assignments = (Array.isArray(safeRun.assignments) ? safeRun.assignments : []).map((assignment: any, index: number) => ({
    ...normalizeCloudAssignment(assignment, index),
    runId,
    runCreatedAtISO: createdAtISO,
    updatedAtISO: new Date().toISOString(),
  }));

  await replaceTenantArray(tenantId, RESULTS12_ASSIGNMENTS_SUBCOLLECTION, assignments as any[], {
    by,
    audit: {
      entity: RESULTS12_ASSIGNMENTS_SUBCOLLECTION,
      meta: {
        summary: "saved task distribution results from results page",
        runId,
        count: assignments.length,
      },
    },
  });

  await saveTenantSettings(
    tenantId,
    RESULTS12_LATEST_RUN_SETTINGS_DOC_ID,
    {
      runId,
      createdAtISO,
      updatedAtISO: new Date().toISOString(),
      assignmentsCount: assignments.length,
      assignments,
      warnings: Array.isArray(safeRun?.warnings) ? safeRun.warnings : [],
      debug: safeRun?.debug || null,
      summary: safeRun?.debug?.summary || null,
      run: {
        ...safeRun,
        assignments,
      },
    },
    { by },
  );
}

export default function TaskDistributionResults() {
  const nav = useNavigate();
  const auth = useAuth();
  const { lang } = useI18n();
  const tr = React.useCallback((ar: string, en: string) => (lang === "ar" ? ar : en), [lang]);
  const tenantId = React.useMemo(() => getTenantIdFromAuth(auth), [auth]);
  const currentUserId = React.useMemo(
    () => String((auth as any)?.user?.email || (auth as any)?.user?.uid || "").trim(),
    [auth],
  );
  const printAreaRef = React.useRef<HTMLDivElement>(null);
  const [showTeacherSidebar, setShowTeacherSidebar] = React.useState(true);

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
  const runForResults = React.useMemo(() => normalizeRunForDutyInvigilator(run), [run]);
  const [cloudLoading, setCloudLoading] = React.useState(false);
  const [cloudStatus, setCloudStatus] = React.useState("");
  const [cloudError, setCloudError] = React.useState("");
  const cloudHydratedRef = React.useRef(false);
  const cloudSignatureRef = React.useRef("");

  React.useEffect(() => {
    let mounted = true;
    let unsubscribeAssignments: (() => void) | undefined;

    async function loadCloudResults() {
      setCloudLoading(true);
      setCloudError("");
      setCloudStatus(tr("جاري تحميل نتائج التوزيع من السحابة...", "Loading distribution results from cloud..."));

      try {
        const [cloudSettings, cloudRows] = await Promise.all([
          loadTenantSettings<any>(tenantId, RESULTS12_LATEST_RUN_SETTINGS_DOC_ID, {}),
          loadTenantArray<any>(tenantId, RESULTS12_ASSIGNMENTS_SUBCOLLECTION, { cacheFallback: true }),
        ]);

        if (!mounted) return;

        const rows = Array.isArray(cloudRows) ? cloudRows.map(normalizeCloudAssignment) : [];
        const cloudRun = ensureResultsRun(cloudSettings?.run || null, rows.length ? rows : cloudSettings?.assignments || []);

        if (cloudRun && Array.isArray(cloudRun.assignments) && cloudRun.assignments.length) {
          const signature = buildResultsRunSignature(cloudRun);
          cloudSignatureRef.current = signature;
          (setRun as any)(cloudRun);
          setCloudStatus(tr("تم تحميل نتائج التوزيع من السحابة.", "Distribution results loaded from cloud."));
        } else {
          setCloudStatus(tr("لا توجد نتائج توزيع محفوظة في السحابة بعد.", "No saved distribution results in cloud yet."));
        }

        cloudHydratedRef.current = true;

        unsubscribeAssignments = subscribeTenantArray<any>(
          tenantId,
          RESULTS12_ASSIGNMENTS_SUBCOLLECTION,
          (items) => {
            const rows = (Array.isArray(items) ? items : []).map(normalizeCloudAssignment);
            if (!rows.length) return;

            (setRun as any)((prev: any) => {
              const nextRun = ensureResultsRun(prev, rows);
              if (!nextRun) return prev;

              const signature = buildResultsRunSignature(nextRun);
              cloudSignatureRef.current = signature;
              return nextRun;
            });

            setCloudStatus(tr("تم تحديث النتائج من السحابة.", "Results updated from cloud."));
          },
          () => {
            setCloudError(tr("تعذر الاتصال اللحظي بنتائج السحابة.", "Realtime cloud results connection failed."));
          },
        );
      } catch {
        if (!mounted) return;
        cloudHydratedRef.current = true;
        setCloudError(tr("تعذر تحميل نتائج التوزيع من السحابة؛ يتم عرض آخر نسخة مؤقتة.", "Could not load distribution results from cloud; showing last temporary copy."));
      } finally {
        if (mounted) setCloudLoading(false);
      }
    }

    void loadCloudResults();

    return () => {
      mounted = false;
      unsubscribeAssignments?.();
    };
  }, [tenantId, setRun, tr]);

  React.useEffect(() => {
    if (!cloudHydratedRef.current) return;
    if (!runForResults || !Array.isArray(runForResults.assignments) || !runForResults.assignments.length) return;

    const signature = buildResultsRunSignature(runForResults);
    if (signature === cloudSignatureRef.current) return;

    const timeout = window.setTimeout(() => {
      cloudSignatureRef.current = signature;
      setCloudStatus(tr("جاري حفظ تعديلات النتائج في السحابة...", "Saving result edits to cloud..."));

      void persistResultsRunToCloud(tenantId, runForResults, currentUserId || undefined)
        .then(() => {
          setCloudStatus(tr("تم حفظ تعديلات النتائج في السحابة.", "Result edits saved to cloud."));
        })
        .catch(() => {
          setCloudError(tr("تم تعديل النتائج محليًا، لكن تعذر حفظها في السحابة.", "Results were edited locally, but cloud save failed."));
        });
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [tenantId, runForResults, currentUserId, tr]);

  const interaction = useResultsInteractionState(tenantId);
  const dataModel = useResultsDataModel({ tenantId, run: runForResults, normalizeSubject });

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

  const addTaskToEmptyCellSynced = React.useCallback(
    (dstTeacher: string, dstColKey: string, taskType: string) => {
      const safeTaskType = normalizeResultsTaskType(taskType) || "DUTY_INVIGILATOR";
      tableActions.addTaskToEmptyCell(dstTeacher, dstColKey, safeTaskType);
    },
    [tableActions],
  );

  const isDraggableTaskTypeSynced = React.useCallback(
    (taskType: any) => String(taskType || "").trim().toUpperCase() === "DUTY_INVIGILATOR" || tableActions.isDraggableTaskType(taskType),
    [tableActions],
  );


  const getAssignmentsInCell = React.useCallback(
    (teacher: string, subColKey: string) =>
      tableActions.getAssignmentsInCell(runForResults?.assignments || [], teacher, subColKey, normalizeSubject),
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

  const hasRun = Boolean(runForResults && Array.isArray(runForResults.assignments) && runForResults.assignments.length);

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
            runId={String(runForResults?.runId || "—")}
            createdAtISO={runForResults?.createdAtISO}
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

  const cloudSyncStatusCard = (
        <div
          style={{
            ...cardDark,
            marginBottom: 12,
            border: "3px solid rgba(212,175,55,0.75)",
            color: TABLE_TEXT,
            fontWeight: 900,
          }}
        >
          {cloudLoading
            ? tr("تحميل نتائج التوزيع من السحابة...", "Loading distribution results from cloud...")
            : cloudError || cloudStatus || tr("جاهز لعرض النتائج المتزامنة من أي جهاز.", "Ready to show synchronized results from any device.")}
        </div>
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
            {sharedImportControls}
            {cloudSyncStatusCard}
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageDark}>
      <div style={{ ...container, width: "min(1880px, 100%)", maxWidth: "100%" }}>
        {sharedImportControls}
        {cloudSyncStatusCard}
        {content}
      </div>
    </div>
  );
}
