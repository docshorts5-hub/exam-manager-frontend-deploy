import { describe, expect, it } from 'vitest';
import {
  buildClosedImportDialogState,
  buildResultsPdfActionPayload,
  finalizeImportedResultsRun,
} from '../services/resultsPageActionPayloads';

describe('resultsPageActionPayloads', () => {
  it('يبني حمولة الطباعة بشكل صحيح', () => {
    const payload = buildResultsPdfActionPayload({
      run: { runId: 'run-1', createdAtISO: '2026-01-01T10:00:00.000Z' },
      htmlBody: '<div>table</div>',
      mode: 'print',
    });

    expect(payload.action).toBe('distribution_print_table');
    expect(payload.entityId).toBe('run-1');
    expect(payload.title).toContain('طباعة جدول التوزيع');
    expect(payload.htmlBody).toBe('<div>table</div>');
  });

  it('يبني حمولة PDF بشكل صحيح', () => {
    const payload = buildResultsPdfActionPayload({
      run: { runId: 'run-2', createdAtISO: '2026-01-01T10:00:00.000Z' },
      htmlBody: '<div>pdf</div>',
      mode: 'pdf',
    });

    expect(payload.action).toBe('distribution_export_pdf');
    expect(payload.title).toContain('تصدير PDF');
  });

  it('يعيد حالة إغلاق حوار الاستيراد بشكل موحد', () => {
    expect(buildClosedImportDialogState()).toEqual({
      importDialogOpen: false,
      pendingImported: null,
      pendingImportedFilename: '',
    });
  });

  it('يمرر التشغيل المستورد عبر ensureUidsOnRun', () => {
    const result = finalizeImportedResultsRun({
      run: {
        runId: 'run-3',
        createdAtISO: '2026-01-01T10:00:00.000Z',
        assignments: [{ teacher: 'أحمد', date: '2026-01-10', period: 'الأولى', taskType: 'INVIGILATION' }],
      },
    });

    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].uid).toBeTruthy();
  });
});
