import { describe, expect, it } from 'vitest';
import { buildResultsCellUnavailabilityReason } from '../services/resultsTableActionHelpers';

describe('resultsTableActionHelpers', () => {
  const teacherNameToId = new Map<string, string>([['أحمد سالم', 'T-1']]);

  it('returns typed reason when the exact task type is blocked', () => {
    const reason = buildResultsCellUnavailabilityReason({
      teacherName: 'أحمد سالم',
      subColKey: '2026-06-01__AM__رياضيات',
      taskType: 'INVIGILATION',
      teacherNameToId,
      unavailIndex: new Set(['T-1|2026-06-01|AM|INVIGILATION']),
      unavailReasonMap: new Map([['T-1|2026-06-01|AM|INVIGILATION', 'مكلف خارجيًا']]),
    });

    expect(reason).toBe('مكلف خارجيًا');
  });

  it('falls back to ALL reason when all task types are blocked', () => {
    const reason = buildResultsCellUnavailabilityReason({
      teacherName: 'أحمد سالم',
      subColKey: '2026-06-01__PM__علوم',
      taskType: 'RESERVE',
      teacherNameToId,
      unavailIndex: new Set(['T-1|2026-06-01|PM|ALL']),
      unavailReasonMap: new Map([['T-1|2026-06-01|PM|ALL', 'معتذر كامل اليوم']]),
    });

    expect(reason).toBe('معتذر كامل اليوم');
  });

  it('uses teacher name as fallback id when no mapped id exists', () => {
    const reason = buildResultsCellUnavailabilityReason({
      teacherName: 'سارة',
      subColKey: '2026-06-02__AM__لغة عربية',
      taskType: 'INVIGILATION',
      teacherNameToId: new Map(),
      unavailIndex: new Set(['سارة|2026-06-02|AM|ALL']),
      unavailReasonMap: new Map(),
    });

    expect(reason).toBe('غير متاح');
  });

  it('returns null when the cell is available', () => {
    const reason = buildResultsCellUnavailabilityReason({
      teacherName: 'أحمد سالم',
      subColKey: '2026-06-03__AM__فيزياء',
      taskType: 'INVIGILATION',
      teacherNameToId,
      unavailIndex: new Set(),
      unavailReasonMap: new Map(),
    });

    expect(reason).toBeNull();
  });
});
