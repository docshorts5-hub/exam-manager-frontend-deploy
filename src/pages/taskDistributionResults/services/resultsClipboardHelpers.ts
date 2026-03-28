export type ResultsClipboardSelectedCell = { teacher: string; subColKey: string; uid?: string } | null;

export type ResultsClipboardAction =
  | { kind: 'copy'; uid: string }
  | { kind: 'noop' }
  | { kind: 'swap'; srcUid: string; dstUid: string }
  | { kind: 'move'; srcUid: string; dstTeacher: string; dstColKey: string };

export function isResultsClipboardCopyKey(key: string, isMod: boolean): boolean {
  const normalized = String(key || '').toLowerCase();
  return isMod && (normalized === 'c' || normalized === 'x');
}

export function isResultsClipboardPasteKey(key: string, isMod: boolean): boolean {
  return isMod && String(key || '').toLowerCase() === 'v';
}

export function resolveResultsPasteAction({
  clipboardUid,
  selectedCell,
  runAssignments,
  getAssignmentsInCell,
  isDraggableTaskType,
}: {
  clipboardUid: string | null;
  selectedCell: ResultsClipboardSelectedCell;
  runAssignments: any[];
  getAssignmentsInCell: (teacher: string, subColKey: string) => any[];
  isDraggableTaskType: (taskType: any) => boolean;
}): ResultsClipboardAction {
  if (!clipboardUid || !selectedCell) return { kind: 'noop' };

  const dstTeacher = String(selectedCell.teacher || '').trim();
  const dstColKey = String(selectedCell.subColKey || '').trim();
  if (!dstTeacher || !dstColKey) return { kind: 'noop' };

  const dstList = getAssignmentsInCell(dstTeacher, dstColKey) as any[];
  const src = (runAssignments || []).find((a: any) => String(a?.__uid || '') === String(clipboardUid)) as any;
  const srcType = String(src?.taskType || '');
  if (!src || !isDraggableTaskType(srcType)) return { kind: 'noop' };

  const sameTypeTarget = dstList.find(
    (x: any) => isDraggableTaskType(x?.taskType) && String(x?.taskType || '') === srcType
  );
  if (sameTypeTarget?.__uid) {
    return { kind: 'swap', srcUid: String(clipboardUid), dstUid: String(sameTypeTarget.__uid) };
  }

  return { kind: 'move', srcUid: String(clipboardUid), dstTeacher, dstColKey };
}
