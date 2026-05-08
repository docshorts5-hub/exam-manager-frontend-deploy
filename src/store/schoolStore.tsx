import React, { createContext, useContext, useMemo, useReducer, useEffect } from "react";

export type Teacher = {
  id: string;
  name: string;
  specialization?: string; // تخصص/مادة رئيسية (اختياري)
  subject1?: string;       // مادة التدريس 1
  subject2?: string;
  subject3?: string;
  subject4?: string;
};

export type Exam = {
  id: string;
  subject: string;     // مادة الامتحان
  date: string;        // YYYY-MM-DD
  day: string;         // نص اليوم (الأحد..الخ)
  time: string;        // "08:00"
  durationMin: number; // مدة بالدقائق
  period: "الفترة الأولى" | "الفترة الثانية" | string; // الفترة
  committees: number;  // عدد اللجان/القاعات
  grade?: 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | number; // الصف (مهم لحساب عدد المراقبين)
};

type State = {
  teachers: Teacher[];
  exams: Exam[];
};

type Action =
  | { type: "SET_TEACHERS"; payload: Teacher[] }
  | { type: "SET_EXAMS"; payload: Exam[] };

const initialState: State = { teachers: [], exams: [] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_TEACHERS":
      return { ...state, teachers: action.payload };
    case "SET_EXAMS":
      return { ...state, exams: action.payload };
    default:
      return state;
  }
}

const SchoolStoreContext = createContext<{
  state: State;
  setTeachers: (t: Teacher[]) => void;
  setExams: (e: Exam[]) => void;
} | null>(null);

const LS_KEY = "school_store_v1";

export function SchoolStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return init;
      return { ...init, ...JSON.parse(raw) } as State;
    } catch {
      return init;
    }
  });

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }, [state]);

  const value = useMemo(() => ({
    state,
    setTeachers: (t: Teacher[]) => dispatch({ type: "SET_TEACHERS", payload: t }),
    setExams: (e: Exam[]) => dispatch({ type: "SET_EXAMS", payload: e }),
  }), [state]);

  return <SchoolStoreContext.Provider value={value}>{children}</SchoolStoreContext.Provider>;
}

export function useSchoolStore() {
  const ctx = useContext(SchoolStoreContext);
  if (!ctx) throw new Error("useSchoolStore must be used within SchoolStoreProvider");
  return ctx;
}
