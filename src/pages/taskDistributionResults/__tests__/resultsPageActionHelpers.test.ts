import { describe, expect, it } from 'vitest';
import {
  buildImportedResultsRun,
  isExcelImportFilenameSupported,
  toImportErrorMessage,
} from '../services/resultsPageActionHelpers';

describe('resultsPageActionHelpers', () => {
  it('accepts xlsx and xls filenames only', () => {
    expect(isExcelImportFilenameSupported('table.xlsx')).toBe(true);
    expect(isExcelImportFilenameSupported('table.XLS')).toBe(true);
    expect(isExcelImportFilenameSupported('table.csv')).toBe(false);
    expect(isExcelImportFilenameSupported('')).toBe(false);
  });

  it('builds imported run metadata with warning message', () => {
    const run = buildImportedResultsRun({
      assignments: [{ uid: '1' }],
      filename: 'demo.xlsx',
      now: new Date('2026-01-02T03:04:05.000Z'),
    });

    expect(run.runId).toBe('import-xlsx-2026-01-02T03:04:05.000Z');
    expect(run.createdAtISO).toBe('2026-01-02T03:04:05.000Z');
    expect(run.assignments).toHaveLength(1);
    expect(run.warnings).toEqual(['📥 تم استيراد الجدول الشامل من Excel: demo.xlsx']);
    expect(run.debug).toBeUndefined();
  });

  it('builds readable import error messages', () => {
    expect(toImportErrorMessage(new Error('boom'))).toBe('boom');
    expect(toImportErrorMessage({ message: 'bad file' })).toBe('bad file');
    expect(toImportErrorMessage(null)).toBe('تعذر قراءة ملف Excel.');
  });
});
