import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import { loadExams, saveExams, subscribeExams, type Exam } from "../services/exams.service";
import { useTenantArrayState } from "./useTenantArrayState";

export function useExamsData() {
  const { user, effectiveTenantId } = useAuth() as any;
  const tenantId = String(effectiveTenantId || "").trim();

  const state = useTenantArrayState<Exam>({
    tenantId,
    userId: user?.uid,
    load: loadExams,
    save: saveExams,
    subscribe: subscribeExams,
  });

  const itemsRef = useRef<Exam[]>(state.items);
  useEffect(() => {
    itemsRef.current = state.items;
  }, [state.items]);

  const createExam = useCallback(async (exam: Exam) => {
    await state.persistNow([exam, ...itemsRef.current]);
  }, [state.persistNow]);

  const updateExam = useCallback(async (exam: Exam) => {
    await state.persistNow(itemsRef.current.map((item) => item.id === exam.id ? exam : item));
  }, [state.persistNow]);

  const deleteExam = useCallback(async (examId: string) => {
    await state.persistNow(itemsRef.current.filter((item) => item.id !== examId));
  }, [state.persistNow]);

  const deleteAllExams = useCallback(async () => {
    await state.persistNow([]);
  }, [state.persistNow]);

  return useMemo(() => ({
    tenantId,
    exams: state.items,
    setExams: state.setItems,
    loading: state.loading,
    loaded: state.loaded,
    error: state.error,
    saving: state.saving,
    examsLoading: state.loading,
    examsLoaded: state.loaded,
    examsError: state.error,
    reloadExams: state.reload,
    persistExamsNow: state.persistNow,
    createExam,
    updateExam,
    deleteExam,
    deleteAllExams,
  }), [tenantId, state.items, state.setItems, state.loading, state.loaded, state.error, state.saving, state.reload, state.persistNow, createExam, updateExam, deleteExam, deleteAllExams]);
}
