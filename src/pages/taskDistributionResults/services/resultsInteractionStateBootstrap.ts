import { safeLoadResultsUnavailability } from './resultsInteractionHelpers';

export function buildInitialResultsInteractionState() {
  return {
    unavailRules: safeLoadResultsUnavailability(),
    blockedCellMsg: {} as Record<string, string>,
    dragSrcUid: null as string | null,
    dragOverUid: null as string | null,
    dragOverEmptyCell: null as string | null,
    selectedCell: null,
    clipboardUid: null as string | null,
    undoStack: [] as any[][],
    importDialogOpen: false,
    pendingImported: null as { run: any; assignments: any[] } | null,
    pendingImportedFilename: '',
    importError: null as string | null,
    tableFullScreen: false,
  };
}
