import { describe, expect, it } from 'vitest';
import { createResultsCellUnavailabilityResolver } from '../services/resultsTableActionResolvers';

describe('createResultsCellUnavailabilityResolver', () => {
  it('returns null for available cells', () => {
    const resolve = createResultsCellUnavailabilityResolver({
      teacherNameToId: new Map([['أحمد', 't-1']]),
      unavailIndex: new Set(),
      unavailReasonMap: new Map(),
    });

    expect(resolve('أحمد', '2026-01-01|AM|رياضيات', 'INVIGILATION')).toBeNull();
  });

  it('resolves typed reason using teacher id mapping', () => {
    const resolve = createResultsCellUnavailabilityResolver({
      teacherNameToId: new Map([['أحمد', 't-1']]),
      unavailIndex: new Set(['t-1|2026-01-01|AM|INVIGILATION']),
      unavailReasonMap: new Map([['t-1|2026-01-01|AM|INVIGILATION', ' لجنة أخرى ']]),
    });

    expect(resolve('أحمد', '2026-01-01|AM|رياضيات', 'INVIGILATION')).toBe('لجنة أخرى');
  });
});
