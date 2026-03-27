import { useMemo } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  loadExamRoomAssignments,
  saveExamRoomAssignments,
  subscribeExamRoomAssignments,
  type ExamRoomAssignment,
} from "../services/examRoomAssignments.service";
import { useTenantArrayState } from "./useTenantArrayState";

export function useExamRoomAssignmentsData() {
  const { user, effectiveTenantId } = useAuth() as any;
  const tenantId = String(effectiveTenantId || "").trim();

  const state = useTenantArrayState<ExamRoomAssignment>({
    tenantId,
    userId: user?.uid,
    load: loadExamRoomAssignments,
    save: saveExamRoomAssignments,
    subscribe: subscribeExamRoomAssignments,
  });

  return useMemo(() => ({
    tenantId,
    examRoomAssignments: state.items,
    setExamRoomAssignments: state.setItems,
    examRoomAssignmentsLoading: state.loading,
    examRoomAssignmentsLoaded: state.loaded,
    examRoomAssignmentsError: state.error,
    reloadExamRoomAssignments: state.reload,
    persistExamRoomAssignmentsNow: state.persistNow,
  }), [tenantId, state.items, state.setItems, state.loading, state.loaded, state.error, state.reload, state.persistNow]);
}
