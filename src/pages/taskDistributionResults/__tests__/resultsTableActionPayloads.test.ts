import { describe, expect, it } from 'vitest';
import { buildResultsBlockedCellMessage, buildResultsExcelExportPayload } from '../services/resultsTableActionPayloads';

describe('resultsTableActionPayloads', () => {
  it('builds a normalized blocked cell message', () => {
    expect(buildResultsBlockedCellMessage('  معتذر اليوم  ')).toBe('غير متاح: معتذر اليوم');
  });

  it('falls back to a default blocked cell message when reason is empty', () => {
    expect(buildResultsBlockedCellMessage('   ')).toBe('غير متاح: غير متاح');
  });

  it('builds the excel export payload without changing references', () => {
    const payload = buildResultsExcelExportPayload({
      run: { id: 'run-1' },
      displayDates: ['2026-06-01'],
      dateToSubCols: { '2026-06-01': [{ key: 'A' }] },
      allSubCols: [{ key: 'A' }],
      allTeachers: ['أحمد'],
      matrix2: { أحمد: { A: [] } },
      committeesCountBySubCol: { A: 3 },
      totalsDetailBySubCol: { A: { invigilation: 2 } },
      teacherTotals: { أحمد: 2 },
    });

    expect(payload.run).toEqual({ id: 'run-1' });
    expect(payload.displayDates).toEqual(['2026-06-01']);
    expect(payload.dateToSubCols['2026-06-01'][0].key).toBe('A');
    expect(payload.allTeachers).toEqual(['أحمد']);
    expect(payload.committeesCountBySubCol.A).toBe(3);
    expect(payload.teacherTotals['أحمد']).toBe(2);
  });
});
