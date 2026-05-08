import { describe, expect, it } from 'vitest';
import { buildResultsExamsLikeRows } from '../services/resultsExamsLikeHelpers';

describe('buildResultsExamsLikeRows', () => {
  it('maps assignments with exam and user metadata', () => {
    const rows = buildResultsExamsLikeRows({
      exams: [{ id: 'e1', subject: 'رياضيات', date: '2026-01-01', day: 'الأحد', time: '08:00', period: '1', duration: '120' } as any],
      assignments: [{ examId: 'e1', teacherId: 't1', committeeNo: 5, role: 'INVIGILATION' } as any],
      users: [{ id: 't1', name: 'أحمد' }],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      teacher: 'أحمد',
      subject: 'رياضيات',
      room: '5',
      role: 'INVIGILATION',
    });
  });

  it('falls back safely and sorts by date/time then teacher', () => {
    const rows = buildResultsExamsLikeRows({
      exams: [
        { id: 'e2', date: '2026-01-02', time: '10:00' } as any,
        { id: 'e1', date: '2026-01-01', time: '08:00' } as any,
      ],
      assignments: [
        { examId: 'e2', teacherId: 'b', committeeNo: 2 } as any,
        { examId: 'e1', teacherId: 'a', committeeNo: 1 } as any,
      ],
      users: [{ id: 'a', name: 'أحمد' }, { id: 'b', name: 'باسم' }],
    });

    expect(rows.map((r) => r.teacher)).toEqual(['أحمد', 'باسم']);
    expect(rows[0].subject).toBe('—');
    expect(rows[0].duration).toBe('—');
  });
});
