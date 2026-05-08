import { useEffect, useMemo, useRef, useState } from "react";
import { buildUnavailabilityIndex, buildUnavailabilityReasonMap, syncUnavailabilityFromTenant, UNAVAIL_UPDATED_EVENT } from "../../../utils/taskDistributionUnavailability";
import { safeLoadResultsUnavailability } from "../services/resultsInteractionHelpers";
import { buildInitialResultsInteractionState } from "../services/resultsInteractionStateBootstrap";
import { scheduleResultsBlockedCellMessage } from "../services/resultsBlockedCellLifecycle";

export type ResultsSelectedCell = { teacher: string; subColKey: string; uid?: string } | null;

export function useResultsInteractionState(tenantId?: string) {
  const initialState = useMemo(() => buildInitialResultsInteractionState(), []);

  const [unavailRules, setUnavailRules] = useState(() => initialState.unavailRules);
  const [blockedCellMsg, setBlockedCellMsg] = useState<Record<string, string>>(() => initialState.blockedCellMsg);
  const [dragSrcUid, setDragSrcUid] = useState<string | null>(() => initialState.dragSrcUid);
  const [dragOverUid, setDragOverUid] = useState<string | null>(() => initialState.dragOverUid);
  const [dragOverEmptyCell, setDragOverEmptyCell] = useState<string | null>(() => initialState.dragOverEmptyCell);
  const [selectedCell, setSelectedCell] = useState<ResultsSelectedCell>(() => initialState.selectedCell);
  const [clipboardUid, setClipboardUid] = useState<string | null>(() => initialState.clipboardUid);
  const [undoStack, setUndoStack] = useState<any[][]>(() => initialState.undoStack);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(() => initialState.importDialogOpen);
  const [pendingImported, setPendingImported] = useState<{ run: any; assignments: any[] } | null>(() => initialState.pendingImported);
  const [pendingImportedFilename, setPendingImportedFilename] = useState<string>(() => initialState.pendingImportedFilename);
  const [importError, setImportError] = useState<string | null>(() => initialState.importError);
  const [tableFullScreen, setTableFullScreen] = useState(() => initialState.tableFullScreen);

  useEffect(() => {
    const refreshUnavail = () => {
      try {
        setUnavailRules(safeLoadResultsUnavailability(tenantId));
      } catch {
        setUnavailRules([]);
      }
    };

    void syncUnavailabilityFromTenant(tenantId)
      .then(() => refreshUnavail())
      .catch(() => refreshUnavail());

    const on = (event?: any) => {
      const eventTenantId = String(event?.detail?.tenantId ?? "").trim();
      if (eventTenantId && tenantId && eventTenantId !== tenantId) return;
      refreshUnavail();
    };
    window.addEventListener(UNAVAIL_UPDATED_EVENT, on as any);
    return () => window.removeEventListener(UNAVAIL_UPDATED_EVENT, on as any);
  }, [tenantId]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (tableFullScreen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [tableFullScreen]);

  const unavailIndex = useMemo(() => buildUnavailabilityIndex(unavailRules || []), [unavailRules]);
  const unavailReasonMap = useMemo(() => buildUnavailabilityReasonMap(unavailRules || []), [unavailRules]);

  const markCellBlocked = (teacherName: string, subColKey: string, msg: string) => {
    scheduleResultsBlockedCellMessage(setBlockedCellMsg, teacherName, subColKey, msg);
  };

  return {
    unavailRules,
    unavailIndex,
    unavailReasonMap,
    blockedCellMsg,
    markCellBlocked,
    dragSrcUid,
    setDragSrcUid,
    dragOverUid,
    setDragOverUid,
    dragOverEmptyCell,
    setDragOverEmptyCell,
    selectedCell,
    setSelectedCell,
    clipboardUid,
    setClipboardUid,
    undoStack,
    setUndoStack,
    fileInputRef,
    importDialogOpen,
    setImportDialogOpen,
    pendingImported,
    setPendingImported,
    pendingImportedFilename,
    setPendingImportedFilename,
    importError,
    setImportError,
    tableFullScreen,
    setTableFullScreen,
  };
}
