import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import { loadTeachers, saveTeachers, subscribeTeachers, type Teacher } from "../services/teachers.service";
import { useTenantArrayState } from "./useTenantArrayState";

export function useTeachersData() {
  const { user, effectiveTenantId } = useAuth() as any;
  const tenantId = String(effectiveTenantId || "").trim();

  const state = useTenantArrayState<Teacher>({
    tenantId,
    userId: user?.uid,
    load: loadTeachers,
    save: saveTeachers,
    subscribe: subscribeTeachers,
  });

  const itemsRef = useRef<Teacher[]>(state.items);
  useEffect(() => {
    itemsRef.current = state.items;
  }, [state.items]);

  const createTeacher = useCallback(async (teacher: Teacher) => {
    await state.persistNow([teacher, ...itemsRef.current]);
  }, [state.persistNow]);

  const updateTeacher = useCallback(async (teacher: Teacher) => {
    await state.persistNow(itemsRef.current.map((item) => item.id === teacher.id ? teacher : item));
  }, [state.persistNow]);

  const deleteTeacher = useCallback(async (teacherId: string) => {
    await state.persistNow(itemsRef.current.filter((item) => item.id !== teacherId));
  }, [state.persistNow]);

  const deleteAllTeachers = useCallback(async () => {
    await state.persistNow([]);
  }, [state.persistNow]);

  return useMemo(() => ({
    tenantId,
    teachers: state.items,
    setTeachers: state.setItems,
    loading: state.loading,
    loaded: state.loaded,
    error: state.error,
    saving: state.saving,
    teachersLoading: state.loading,
    teachersLoaded: state.loaded,
    teachersError: state.error,
    reloadTeachers: state.reload,
    persistTeachersNow: state.persistNow,
    createTeacher,
    updateTeacher,
    deleteTeacher,
    deleteAllTeachers,
  }), [tenantId, state.items, state.setItems, state.loading, state.loaded, state.error, state.saving, state.reload, state.persistNow, createTeacher, updateTeacher, deleteTeacher, deleteAllTeachers]);
}
