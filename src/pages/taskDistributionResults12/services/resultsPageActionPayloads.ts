import { ensureUidsOnRun } from '../uidUtils';
import { buildResultsRunSubtitle } from './resultsActions';

export function buildResultsPdfActionPayload(args: {
  run: any;
  htmlBody: string;
  mode: 'print' | 'pdf';
}) {
  const { run, htmlBody, mode } = args;
  const subtitle = buildResultsRunSubtitle(run?.runId, run?.createdAtISO);
  const action: 'distribution_print_table' | 'distribution_export_pdf' =
    mode === 'print' ? 'distribution_print_table' : 'distribution_export_pdf';
  const entityId = String(run?.runId || run?.id || 'task-distribution-results');

  return {
    action,
    entityId,
    title:
      mode === 'print'
        ? 'طباعة جدول التوزيع (حسب اليوم ← امتحانات اليوم حسب الفترة)'
        : 'تصدير PDF — جدول التوزيع (حسب اليوم ← امتحانات اليوم حسب الفترة)',
    subtitle,
    htmlBody,
  };
}

export function finalizeImportedResultsRun(pendingImported: any) {
  return ensureUidsOnRun(pendingImported?.run);
}

export function buildClosedImportDialogState() {
  return {
    importDialogOpen: false,
    pendingImported: null,
    pendingImportedFilename: '',
  };
}
