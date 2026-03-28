import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  loadTeachers,
  saveTeachers,
  subscribeTeachers,
  type Teacher,
} from "../services/teachers.service";
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

  const createTeacher = useCallback(
    async (teacher: Teacher) => {
      const next = [teacher, ...itemsRef.current];
      await state.persistNow(next);
    },
    [state.persistNow]
  );

  const updateTeacher = useCallback(
    async (teacher: Teacher) => {
      const next = itemsRef.current.map((item) =>
        item.id === teacher.id ? teacher : item
      );
      await state.persistNow(next);
    },
    [state.persistNow]
  );

  const deleteTeacher = useCallback(
    async (teacherId: string) => {
      const next = itemsRef.current.filter((item) => item.id !== teacherId);
      await state.persistNow(next);
    },
    [state.persistNow]
  );

  const deleteAllTeachers = useCallback(async () => {
    await state.persistNow([]);
  }, [state.persistNow]);

  return useMemo(
    () => ({
      tenantId,
      teachers: state.items,
      setTeachers: state.setItems,

      teachersLoading: state.loading,
      teachersLoaded: state.loaded,
      teachersError: state.error,
      saving: state.saving,

      reloadTeachers: state.reload,
      persistTeachersNow: state.persistNow,

      createTeacher,
      updateTeacher,
      deleteTeacher,
      deleteAllTeachers,
    }),
    [
      tenantId,
      state.items,
      state.setItems,
      state.loading,
      state.loaded,
      state.error,
      state.saving,
      state.reload,
      state.persistNow,
      createTeacher,
      updateTeacher,
      deleteTeacher,
      deleteAllTeachers,
    ]
  );
}