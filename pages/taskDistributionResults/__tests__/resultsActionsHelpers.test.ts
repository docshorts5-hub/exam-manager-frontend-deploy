import { describe, expect, it } from 'vitest';
import { buildArchiveSnapshotName, buildResultsRunSubtitle } from '../services/resultsActions';

describe('resultsActions helpers', () => {
  it('builds subtitle with run id and date slice', () => {
    expect(buildResultsRunSubtitle('run-123', '2026-03-01T10:20:30.000Z')).toBe('Run ID: run-123 • 2026-03-01');
  });

  it('falls back gracefully when date is missing', () => {
    expect(buildResultsRunSubtitle('run-123')).toBe('Run ID: run-123 • —');
  });

  it('builds deterministic archive snapshot fields', () => {
    const now = new Date('2026-03-07T12:34:56.000Z');
    const result = buildArchiveSnapshotName(now);
    expect(result.iso).toBe('2026-03-07T12:34:56.000Z');
    expect(result.archiveId).toBe('arch-2026-03-07T12:34:56.000Z');
    expect(result.name.startsWith('2026-03-07 ')).toBe(true);
  });
});
