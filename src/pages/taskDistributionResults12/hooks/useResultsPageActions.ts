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


type ResultsPrintMode = 'print' | 'pdf';

function getResultsDocumentTitle(run: any, mode: ResultsPrintMode) {
  const runId = String(run?.runId || '').trim();
  const suffix = runId ? ` - ${runId}` : '';
  return mode === 'pdf'
    ? `Task Distribution Results PDF${suffix}`
    : `Task Distribution Results Print${suffix}`;
}

function getResultsPrintStylesFromCurrentPage() {
  try {
    return Array.from(
      document.querySelectorAll<HTMLStyleElement | HTMLLinkElement>(
        'style, link[rel="stylesheet"]',
      ),
    )
      .map((node) => node.outerHTML)
      .join('\n');
  } catch {
    return '';
  }
}

function removeControlsFromPrintableClone(clone: HTMLElement) {
  clone
    .querySelectorAll<HTMLElement>(
      'button,input,select,textarea,[data-print-hide="true"],[aria-hidden="true"]',
    )
    .forEach((node) => node.remove());
}

function buildFallbackResultsPrintCss(mode: ResultsPrintMode) {
  return `
    <style>
      @page {
        size: A4 landscape;
        margin: 7mm;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #ffffff !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        font-family: "Arial", "Tahoma", sans-serif;
        direction: rtl;
      }

      body {
        padding: 10px;
      }

      .resultsPrintExportRoot,
      .resultsPrintExportRoot * {
        color: #000000 !important;
        -webkit-text-fill-color: #000000 !important;
        text-shadow: none !important;
        box-sizing: border-box !important;
      }

      .resultsPrintExportRoot {
        width: 100%;
        max-width: 100%;
        overflow: visible !important;
        background: #ffffff !important;
      }

      .resultsPrintExportRoot table {
        width: 100% !important;
        max-width: none !important;
        border-collapse: separate !important;
        border-spacing: 2px !important;
        table-layout: fixed !important;
        page-break-inside: auto;
        font-size: ${mode === 'pdf' ? '9px' : '10px'} !important;
      }

      .resultsPrintExportRoot thead {
        display: table-header-group;
      }

      .resultsPrintExportRoot tfoot {
        display: table-row-group;
      }

      .resultsPrintExportRoot tr,
      .resultsPrintExportRoot td,
      .resultsPrintExportRoot th {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      .resultsPrintExportRoot th,
      .resultsPrintExportRoot td {
        border: 1px solid #9ca3af !important;
        border-radius: 0 !important;
        padding: 3px 4px !important;
        vertical-align: middle !important;
        overflow: hidden !important;
        line-height: 1.25 !important;
        background-clip: padding-box !important;
      }

      .resultsPrintExportRoot button,
      .resultsPrintExportRoot input,
      .resultsPrintExportRoot select,
      .resultsPrintExportRoot textarea {
        display: none !important;
      }

      .resultsPrintExportRoot * {
        animation: none !important;
        transition: none !important;
        box-shadow: none !important;
        word-break: normal !important;
        overflow-wrap: normal !important;
        letter-spacing: normal !important;
        writing-mode: horizontal-tb !important;
      }

      .resultsPrintExportRoot .resultsTableCommercialScope {
        border: 1px solid #9ca3af !important;
        box-shadow: none !important;
        padding: 0 !important;
        background: #ffffff !important;
      }
    </style>
  `;
}

function buildResultsPrintHtml({
  run,
  printRoot,
  mode,
}: {
  run: any;
  printRoot: HTMLElement | null;
  mode: ResultsPrintMode;
}) {
  if (!printRoot) return '';

  const clone = printRoot.cloneNode(true) as HTMLElement;
  removeControlsFromPrintableClone(clone);
  clone.classList.add('resultsPrintExportRoot');

  const title = getResultsDocumentTitle(run, mode);
  const currentPageStyles = getResultsPrintStylesFromCurrentPage();
  const fallbackCss = buildFallbackResultsPrintCss(mode);
  const lang = document?.documentElement?.lang || 'ar';

  return `<!doctype html>
<html lang="${lang}" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  ${currentPageStyles}
  ${fallbackCss}
</head>
<body>
  ${clone.outerHTML}
</body>
</html>`;
}

function openResultsPrintWindow(htmlDocument: string) {
  if (!htmlDocument) return false;

  const printWindow = window.open('', '_blank', 'width=1400,height=900,scrollbars=yes,resizable=yes');
  if (!printWindow) return false;

  printWindow.document.open();
  printWindow.document.write(htmlDocument);
  printWindow.document.close();

  const runPrint = () => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch {}
  };

  printWindow.onload = () => window.setTimeout(runPrint, 350);
  window.setTimeout(runPrint, 700);
  return true;
}

function exportResultsPrintOrPdf({
  run,
  printRoot,
  mode,
}: {
  run: any;
  printRoot: HTMLElement | null;
  mode: ResultsPrintMode;
}) {
  const htmlDocument = buildResultsPrintHtml({ run, printRoot, mode });

  if (!htmlDocument) {
    window.alert(
      tr(
        'لا توجد منطقة جدول جاهزة للطباعة. يرجى تحديث الصفحة والمحاولة مرة أخرى.',
        'No printable table area was found. Please refresh the page and try again.',
      ),
    );
    return;
  }

  const opened = openResultsPrintWindow(htmlDocument);
  if (opened) return;

  exportResultsPdfDocument(
    buildResultsPdfActionPayload({
      run,
      htmlBody: htmlDocument,
      mode,
    }),
  );
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
    exportResultsPrintOrPdf({
      run,
      printRoot: printAreaRef.current,
      mode: 'print',
    });
  }, [printAreaRef, run]);

  const handleExportPdf = React.useCallback(() => {
    if (!run) return;
    exportResultsPrintOrPdf({
      run,
      printRoot: printAreaRef.current,
      mode: 'pdf',
    });
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
