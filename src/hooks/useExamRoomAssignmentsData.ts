import { useMemo } from "react";
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

  return useMemo(() => ({
    tenantId,
    examRoomAssignments: state.items,
    setExamRoomAssignments: state.setItems,
    examRoomAssignmentsLoading: state.loading,
    examRoomAssignmentsLoaded: state.loaded,
    examRoomAssignmentsError: state.error,
    saving: state.saving,
    reloadExamRoomAssignments: state.reload,
    persistExamRoomAssignmentsNow: state.persistNow,
  }), [
    tenantId,
    state.items,
    state.setItems,
    state.loading,
    state.loaded,
    state.error,
    state.saving,
    state.reload,
    state.persistNow,
  ]);
}
