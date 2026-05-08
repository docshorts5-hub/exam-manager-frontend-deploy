import { useEffect } from "react";
import {
  isResultsClipboardCopyKey,
  isResultsClipboardPasteKey,
  resolveResultsPasteAction,
} from "../services/resultsClipboardHelpers";

export function useResultsClipboardShortcuts({
  selectedCell,
  clipboardUid,
  setClipboardUid,
  run,
  getAssignmentsInCell,
  swapAssignmentsByUid,
  moveAssignmentToColumnTeacher,
  isDraggableTaskType,
}: {
  selectedCell: { teacher: string; subColKey: string; uid?: string } | null;
  clipboardUid: string | null;
  setClipboardUid: (uid: string | null) => void;
  run: any;
  getAssignmentsInCell: (teacher: string, subColKey: string) => any[];
  swapAssignmentsByUid: (srcUid: string, dstUid: string) => void;
  moveAssignmentToColumnTeacher: (srcUid: string, dstTeacher: string, dstColKey: string) => void;
  isDraggableTaskType: (taskType: any) => boolean;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = String(e.key || "").toLowerCase();
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      if (isResultsClipboardCopyKey(key, isMod)) {
        if (!selectedCell?.uid) return;
        e.preventDefault();
        setClipboardUid(String(selectedCell.uid));
        try {
          navigator.clipboard?.writeText?.(String(selectedCell.uid)).catch(() => void 0);
        } catch {
          // ignore clipboard failures
        }
        return;
      }

      if (isResultsClipboardPasteKey(key, isMod)) {
        e.preventDefault();
        const action = resolveResultsPasteAction({
          clipboardUid,
          selectedCell,
          runAssignments: run?.assignments || [],
          getAssignmentsInCell,
          isDraggableTaskType,
        });
        if (action.kind === "swap") {
          swapAssignmentsByUid(action.srcUid, action.dstUid);
          return;
        }
        if (action.kind === "move") {
          moveAssignmentToColumnTeacher(action.srcUid, action.dstTeacher, action.dstColKey);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    clipboardUid,
    selectedCell,
    run,
    getAssignmentsInCell,
    swapAssignmentsByUid,
    moveAssignmentToColumnTeacher,
    isDraggableTaskType,
    setClipboardUid,
  ]);
}
