import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  loadExamRoomAssignments,
  saveExamRoomAssignments,
  subscribeExamRoomAssignments,
  type ExamRoomAssignment,
} from "../services/examRoomAssignments.service";
import { useTenantArrayState } from "./useTenantArrayState";

export function useExamRoomAssignmentsData() {
  const auth = useAuth() as any;
  const user = auth?.user;

  // ✅ توحيد tenantId حتى لا يتم الحفظ في مسار والقراءة من مسار آخر
  const tenantId =
    String(
      auth?.effectiveTenantId ||
        auth?.tenantId ||
        auth?.profile?.tenantId ||
        auth?.userProfile?.tenantId ||
        user?.tenantId ||
        "default"
    ).trim() || "default";

  const state = useTenantArrayState<ExamRoomAssignment>({
    tenantId,
    userId: auth?.user?.uid,
    load: loadExamRoomAssignments,
    save: saveExamRoomAssignments,
    subscribe: subscribeExamRoomAssignments,
  });

  const itemsRef = useRef<ExamRoomAssignment[]>(state.items);

  useEffect(() => {
    itemsRef.current = state.items;
  }, [state.items]);

  const replaceExamRoomAssignments = useCallback(
    async (next: ExamRoomAssignment[]) => {
      await state.persistNow(next);
    },
    [state.persistNow]
  );

  return useMemo(
    () => ({
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
    }),
    [
      tenantId,
      state.items,
      state.setItems,
      state.saving,
      state.loading,
      state.loaded,
      state.error,
      state.reload,
      state.persistNow,
      replaceExamRoomAssignments,
    ]
  );
}
