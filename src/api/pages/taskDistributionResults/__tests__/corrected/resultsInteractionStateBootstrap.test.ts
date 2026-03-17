import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/resultsInteractionHelpers', () => ({
  safeLoadResultsUnavailability: vi.fn(() => [{ teacherId: 't1' }]),
}));

import { buildInitialResultsInteractionState } from '../services/resultsInteractionStateBootstrap';

describe('buildInitialResultsInteractionState', () => {
  it('builds consistent default interaction state', () => {
    const state = buildInitialResultsInteractionState();

    expect(state.unavailRules).toEqual([{ teacherId: 't1' }]);
    expect(state.blockedCellMsg).toEqual({});
    expect(state.dragSrcUid).toBeNull();
    expect(state.dragOverUid).toBeNull();
    expect(state.dragOverEmptyCell).toBeNull();
    expect(state.selectedCell).toBeNull();
    expect(state.clipboardUid).toBeNull();
    expect(state.undoStack).toEqual([]);
    expect(state.importDialogOpen).toBe(false);
    expect(state.pendingImported).toBeNull();
    expect(state.pendingImportedFilename).toBe('');
    expect(state.importError).toBeNull();
    expect(state.tableFullScreen).toBe(false);
  });
});
