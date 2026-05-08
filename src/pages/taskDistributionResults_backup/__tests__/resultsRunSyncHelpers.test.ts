import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../utils/taskDistributionStorage', () => ({
  loadRun: vi.fn(),
  saveRun: vi.fn(),
}));

vi.mock('../uidUtils', () => ({
  ensureUidsOnRun: vi.fn((value: any) => ({ ...value, ensured: true })),
}));

import { loadRun, saveRun } from '../../../utils/taskDistributionStorage';
import { ensureUidsOnRun } from '../uidUtils';
import { loadAndPersistResultsRun, shouldRefreshResultsRun } from '../services/resultsRunSyncHelpers';

describe('resultsRunSyncHelpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads, normalizes, and persists the run', () => {
    vi.mocked(loadRun).mockReturnValue({ runId: 'r1' } as any);

    const result = loadAndPersistResultsRun('tenant-a');

    expect(loadRun).toHaveBeenCalledWith('tenant-a');
    expect(ensureUidsOnRun).toHaveBeenCalledWith({ runId: 'r1' });
    expect(saveRun).toHaveBeenCalledWith('tenant-a', { runId: 'r1', ensured: true });
    expect(result).toEqual({ runId: 'r1', ensured: true });
  });

  it('returns the loaded run even if persistence fails', () => {
    vi.mocked(loadRun).mockReturnValue({ runId: 'r2' } as any);
    vi.mocked(saveRun).mockImplementation(() => {
      throw new Error('persist failed');
    });

    const result = loadAndPersistResultsRun('tenant-b');

    expect(result).toEqual({ runId: 'r2', ensured: true });
  });

  it('refreshes when event tenant is empty or matches current tenant', () => {
    expect(shouldRefreshResultsRun('', 't1')).toBe(true);
    expect(shouldRefreshResultsRun(undefined, 't1')).toBe(true);
    expect(shouldRefreshResultsRun('t1', 't1')).toBe(true);
  });

  it('does not refresh when event tenant targets a different tenant', () => {
    expect(shouldRefreshResultsRun('t2', 't1')).toBe(false);
  });
});
