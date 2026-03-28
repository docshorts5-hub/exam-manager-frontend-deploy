import { describe, expect, it } from 'vitest';
import { computeMissingCommitteeSlotForResultsCell, isSupportedResultsTaskType } from '../services/resultsCellMutationHelpers';

describe('resultsCellMutationHelpers', () => {
  it('accepts supported task types only', () => {
    expect(isSupportedResultsTaskType('INVIGILATION')).toBe(true);
    expect(isSupportedResultsTaskType('RESERVE')).toBe(true);
    expect(isSupportedResultsTaskType('OTHER')).toBe(false);
  });

  it('returns first free invigilation slot for the target column', () => {
    const result = computeMissingCommitteeSlotForResultsCell({
      taskType: 'INVIGILATION',
      currentAssignments: [
        { dateISO: '2026-01-01', period: 'AM', subject: 'Math', taskType: 'INVIGILATION', committeeNo: 1, invigilatorIndex: 1 },
      ],
      dstColKey: '2026-01-01__AM__Math',
      col: { dateISO: '2026-01-01', period: 'AM', subject: 'Math' },
      examKeyToCommittees: { '2026-01-01__AM__Math': 2 },
      invigilatorsPerRoomForSubject: () => 2,
      normalizeSubject: (s) => s,
    });
    expect(result).toEqual({ committeeNo: 1, invigilatorIndex: 2 });
  });

  it('returns undefined slot for non invigilation tasks', () => {
    const result = computeMissingCommitteeSlotForResultsCell({
      taskType: 'RESERVE',
      currentAssignments: [],
      dstColKey: '2026-01-01__AM__Math',
      col: { dateISO: '2026-01-01', period: 'AM', subject: 'Math' },
      examKeyToCommittees: { '2026-01-01__AM__Math': 2 },
      invigilatorsPerRoomForSubject: () => 2,
      normalizeSubject: (s) => s,
    });
    expect(result).toEqual({ committeeNo: undefined, invigilatorIndex: undefined });
  });
});
