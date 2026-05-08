import * as React from 'react';
import { saveRun, RUN_UPDATED_EVENT } from '../../../utils/taskDistributionStorage';
import { parseExcelToAssignments } from '../excelImport';
import {
  buildImportedResultsRun,
  isExcelImportFilenameSupported,
  toImportErrorMessage,
} from '../services/resultsPageActionHelpers';
import {
  buildClosedImportDialogState,
  buildResultsPdfActionPayload,
  finalizeImportedResultsRun,
} from '../services/resultsPageActionPayloads';
import { exportResultsPdfDocument } from '../services/resultsPdfActions';
import { archiveResultsRunSnapshot, openResultsImportPicker } from '../services/resultsImportArchive';
import { persistEditedResultsRun, undoEditedResultsRun } from '../services/resultsRunMutations';
import { writeMasterTable } from '../masterTableStorage';

function tr(ar: string, en: string) {
  try {
    const lang = String(document?.documentElement?.lang || "").toLowerCase();
    if (lang.startsWith("en")) return en;
  } catch {}
  return ar;
}

export function useResultsPageActions({
  tenantId,
  run,
  setRun,
  setUndoStack,
  fileInputRef,
  printAreaRef,
  pendingImported,
  setPendingImported,
  pendingImportedFilename,
  setPendingImportedFilename,
  setImportDialogOpen,
  importError,
  setImportError,
  onArchived,
}: {
  tenantId: string;
  run: any;
  setRun: (value: any) => void;
  setUndoStack: React.Dispatch<React.SetStateAction<any[][]>>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  printAreaRef: React.RefObject<HTMLDivElement | null>;
  pendingImported: any;
  setPendingImported: (value: any) => void;
  pendingImportedFilename: string;
  setPendingImportedFilename: (value: string) => void;
  setImportDialogOpen: (value: boolean) => void;
  importError: string | null;
  setImportError: (value: string | null) => void;
  onArchived: () => void;
}) {
  const handlePickImportFile = React.useCallback(() => {
    setImportError(null);
    openResultsImportPicker(fileInputRef.current);
  }, [fileInputRef, setImportError]);

  const persistEditedAssignments = React.useCallback(
    (nextAssignments: any[], note?: string, opts?: { skipUndo?: boolean }) => {
      if (!run) return;

      if (!opts?.skipUndo) {
        setUndoStack((prev) => {
          try {
            const snap = JSON.parse(JSON.stringify(run.assignments || []));
            return [snap, ...prev].slice(0, 30);
          } catch {
            return prev;
          }
        });
      }

      const updated = persistEditedResultsRun({
        tenantId,
        run,
        nextAssignments,
        note,
      });
      setRun(updated);

      try {
        window.dispatchEvent(new Event(RUN_UPDATED_EVENT));
      } catch {}
    },
    [run, setRun, setUndoStack, tenantId]
  );

  const handleUndo = React.useCallback(
    (undoStack: any[][]) => {
      if (!run) return;
      const last = undoStack[0];
      if (!last) return;

      const updated = undoEditedResultsRun({
        tenantId,
        run,
        assignments: last,
      });
      setRun(updated);
      setUndoStack((prev) => prev.slice(1));

      try {
        window.dispatchEvent(new Event(RUN_UPDATED_EVENT));
      } catch {}
    },
    [run, setRun, setUndoStack, tenantId]
  );

  const handleImportFileSelected = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      setImportError(null);
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;

      if (!isExcelImportFilenameSupported(file.name)) {
        setImportError(tr('الرجاء اختيار ملف Excel بصيغة .xlsx أو .xls', 'Please choose an Excel file in .xlsx or .xls format.'));
        return;
      }

      try {
        const assignments = await parseExcelToAssignments(file, run);
        const importedRun = buildImportedResultsRun({
          assignments,
          filename: file.name,
        });

        setPendingImported({ run: importedRun, assignments });
        setPendingImportedFilename(file.name);
        setImportDialogOpen(true);
      } catch (err: any) {
        setImportError(toImportErrorMessage(err));
      }
    },
    [run, setImportDialogOpen, setImportError, setPendingImported, setPendingImportedFilename]
  );

  const confirmImportReplace = React.useCallback(() => {
    if (!pendingImported) return;

    const importedRun = finalizeImportedResultsRun(pendingImported);

    saveRun(tenantId, importedRun);
    setRun(importedRun);

    writeMasterTable(importedRun.assignments || [], {
      runId: importedRun.runId,
      runCreatedAtISO: importedRun.createdAtISO,
      source: 'import',
    });

    try {
      window.dispatchEvent(new Event(RUN_UPDATED_EVENT));
    } catch {}

    try {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'exam-manager:task-distribution:master-table:v1',
        })
      );
    } catch {}

    const nextDialogState = buildClosedImportDialogState();
    setImportDialogOpen(nextDialogState.importDialogOpen);
    setPendingImported(nextDialogState.pendingImported);
    setPendingImportedFilename(nextDialogState.pendingImportedFilename);
    setImportError(null);
  }, [
    pendingImported,
    setImportDialogOpen,
    setPendingImported,
    setPendingImportedFilename,
    setRun,
    tenantId,
    setImportError,
  ]);

  const closeImportDialog = React.useCallback(() => {
    const nextDialogState = buildClosedImportDialogState();
    setImportDialogOpen(nextDialogState.importDialogOpen);
    setPendingImported(nextDialogState.pendingImported);
    setPendingImportedFilename(nextDialogState.pendingImportedFilename);
  }, [setImportDialogOpen, setPendingImported, setPendingImportedFilename]);

  const handlePrintTableOnly = React.useCallback(() => {
    if (!run) return;
    exportResultsPdfDocument(
      buildResultsPdfActionPayload({
        run,
        htmlBody: printAreaRef.current?.innerHTML || '',
        mode: 'print',
      })
    );
  }, [printAreaRef, run]);

  const handleExportPdf = React.useCallback(() => {
    if (!run) return;
    exportResultsPdfDocument(
      buildResultsPdfActionPayload({
        run,
        htmlBody: printAreaRef.current?.innerHTML || '',
        mode: 'pdf',
      })
    );
  }, [printAreaRef, run]);

  const handleArchiveSnapshot = React.useCallback(() => {
    if (!run) return;
    archiveResultsRunSnapshot(tenantId, run);
    onArchived();
  }, [onArchived, run, tenantId]);

  return {
    importError,
    pendingImportedFilename,
    handlePickImportFile,
    persistEditedAssignments,
    handleUndo,
    handleImportFileSelected,
    confirmImportReplace,
    closeImportDialog,
    handlePrintTableOnly,
    handleExportPdf,
    handleArchiveSnapshot,
  };
}
