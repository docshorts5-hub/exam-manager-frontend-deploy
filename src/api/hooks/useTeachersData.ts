import { useMemo } from "react";
import { useAuth } from "../auth/AuthContext";
import { loadTeachers, saveTeachers, type Teacher } from "../services/teachers.service";
import { useTenantArrayState } from "./useTenantArrayState";

export function useTeachersData() {
  const { user, effectiveTenantId } = useAuth() as any;
  const tenantId = String(effectiveTenantId || "").trim();

  const state = useTenantArrayState<Teacher>({
    tenantId,
    userId: user?.uid,
    load: loadTeachers,
    save: saveTeachers,
  });

  return useMemo(() => ({
    tenantId,
    teachers: state.items,
    setTeachers: state.setItems,
    teachersLoading: state.loading,
    teachersLoaded: state.loaded,
    teachersError: state.error,
    reloadTeachers: state.reload,
    persistTeachersNow: state.persistNow,
  }), [tenantId, state]);
}
