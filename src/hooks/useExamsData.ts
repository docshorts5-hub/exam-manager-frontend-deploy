import { useMemo } from "react";
import { useAuth } from "../auth/AuthContext";
import { loadExams, saveExams, type Exam } from "../services/exams.service";
import { useTenantArrayState } from "./useTenantArrayState";

export function useExamsData() {
  const { user, effectiveTenantId } = useAuth() as any;
  const tenantId = String(effectiveTenantId || "").trim();

  const state = useTenantArrayState<Exam>({
    tenantId,
    userId: user?.uid,
    load: loadExams,
    save: saveExams,
  });

  return useMemo(() => ({
    tenantId,
    exams: state.items,
    setExams: state.setItems,
    examsLoading: state.loading,
    examsLoaded: state.loaded,
    examsError: state.error,
    reloadExams: state.reload,
    persistExamsNow: state.persistNow,
  }), [tenantId, state]);
}
