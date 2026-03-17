import { describe, expect, it, vi } from 'vitest';
import {
  isResultsClipboardCopyKey,
  isResultsClipboardPasteKey,
  resolveResultsPasteAction,
} from '../services/resultsClipboardHelpers';

describe('resultsClipboardHelpers', () => {
  it('detects copy/cut and paste shortcut keys only with modifier', () => {
    expect(isResultsClipboardCopyKey('c', true)).toBe(true);
    expect(isResultsClipboardCopyKey('x', true)).toBe(true);
    expect(isResultsClipboardCopyKey('c', false)).toBe(false);
    expect(isResultsClipboardPasteKey('v', true)).toBe(true);
    expect(isResultsClipboardPasteKey('v', false)).toBe(false);
  });

  it('returns noop when clipboard or selected cell is missing', () => {
    const getAssignmentsInCell = vi.fn();
    expect(
      resolveResultsPasteAction({
        clipboardUid: null,
        selectedCell: { teacher: 'أحمد', subColKey: 'k1' },
        runAssignments: [],
        getAssignmentsInCell,
        isDraggableTaskType: () => true,
      })
    ).toEqual({ kind: 'noop' });

    expect(
      resolveResultsPasteAction({
        clipboardUid: 'u1',
        selectedCell: null,
        runAssignments: [],
        getAssignmentsInCell,
        isDraggableTaskType: () => true,
      })
    ).toEqual({ kind: 'noop' });
  });

  it('returns swap when destination contains same draggable task type', () => {
    const action = resolveResultsPasteAction({
      clipboardUid: 'src-1',
      selectedCell: { teacher: 'أحمد', subColKey: 'k1' },
      runAssignments: [{ __uid: 'src-1', taskType: 'INVIGILATION' }],
      getAssignmentsInCell: () => [{ __uid: 'dst-1', taskType: 'INVIGILATION' }],
      isDraggableTaskType: (t) => t === 'INVIGILATION' || t === 'RESERVE',
    });

    expect(action).toEqual({ kind: 'swap', srcUid: 'src-1', dstUid: 'dst-1' });
  });

  it('returns move when source is draggable and no same-type destination exists', () => {
    const action = resolveResultsPasteAction({
      clipboardUid: 'src-2',
      selectedCell: { teacher: 'سارة', subColKey: 'k2' },
      runAssignments: [{ __uid: 'src-2', taskType: 'RESERVE' }],
      getAssignmentsInCell: () => [],
      isDraggableTaskType: (t) => t === 'INVIGILATION' || t === 'RESERVE',
    });

    expect(action).toEqual({
      kind: 'move',
      srcUid: 'src-2',
      dstTeacher: 'سارة',
      dstColKey: 'k2',
    });
  });

  it('returns noop when source is not draggable', () => {
    const action = resolveResultsPasteAction({
      clipboardUid: 'src-3',
      selectedCell: { teacher: 'ليلى', subColKey: 'k3' },
      runAssignments: [{ __uid: 'src-3', taskType: 'CORRECTION_FREE' }],
      getAssignmentsInCell: () => [],
      isDraggableTaskType: (t) => t === 'INVIGILATION',
    });

    expect(action).toEqual({ kind: 'noop' });
  });
});
