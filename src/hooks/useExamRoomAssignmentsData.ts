import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import { loadExamRoomAssignments, saveExamRoomAssignments, type ExamRoomAssignment } from "../services/examRoomAssignments.service";
import { useTenantArrayState } from "./useTenantArrayState";

export function useExamRoomAssignmentsData() {
  const { user, effectiveTenantId } = useAuth() as any;
  const tenantId = String(effectiveTenantId || "").trim();

  const state = useTenantArrayState<ExamRoomAssignment>({
    tenantId,
    userId: user?.uid,
    load: loadExamRoomAssignments,
    save: saveExamRoomAssignments,
  });

  const itemsRef = useRef<ExamRoomAssignment[]>(state.items);
  useEffect(() => {
    itemsRef.current = state.items;
  }, [state.items]);

  const replaceExamRoomAssignments = useCallback(async (next: ExamRoomAssignment[]) => {
    await state.persistNow(next);
  }, [state.persistNow]);

  return useMemo(() => ({
    tenantId,
    examRoomAssignments: state.items,
    setExamRoomAssignments: state.setItems,
    saving: state.saving,
    examRoomAssignmentsLoading: state.loading,
    examRoomAssignmentsLoaded: state.loaded,
    examRoomAssignmentsError: state.error,
    reloadExamRoomAssignments: state.reload,
    persistExamRoomAssignmentsNow: state.persistNow,
    replaceExamRoomAssignments,
  }), [tenantId, state.items, state.setItems, state.saving, state.loading, state.loaded, state.error, state.reload, state.persistNow, replaceExamRoomAssignments]);
}
