// src/context/AppDataContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Teacher, Exam } from "../api/types";
import { listTeachers, listExams, migrateFromLocalStorageIfNeeded, saveTeachers, saveExams } from "../services/dataRepo";

type AppDataContextType = {
  teachers: Teacher[];
  exams: Exam[];
  reloadAll: () => Promise<void>;
  setTeachers: (t: Teacher[]) => Promise<void>;
  setExams: (e: Exam[]) => Promise<void>;
};

const AppDataContext = createContext<AppDataContextType | null>(null);

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [teachers, setTeachersState] = useState<Teacher[]>([]);
  const [exams, setExamsState] = useState<Exam[]>([]);

  async function reloadAll() {
    const [t, e] = await Promise.all([listTeachers(), listExams()]);
    setTeachersState(t);
    setExamsState(e);
  }

  async function setTeachers(items: Teacher[]) {
    await saveTeachers(items);
    await reloadAll();
  }

  async function setExams(items: Exam[]) {
    await saveExams(items);
    await reloadAll();
  }

  useEffect(() => {
    (async () => {
      // Migration مرة واحدة – يحل مشكلة "لا يقرأ"
      await migrateFromLocalStorageIfNeeded().catch(() => null);
      await reloadAll().catch(() => null);
    })();
  }, []);

  const value = useMemo<AppDataContextType>(
    () => ({ teachers, exams, reloadAll, setTeachers, setExams }),
    [teachers, exams]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
