export type Teacher = {
  id: string;
  fullName: string;
  jobNo: string;

  subject1?: string;
  subject2?: string;
  subject3?: string;
  subject4?: string;

  grades?: string; // مثال: "10,11" أو "10-12"
  phone?: string;
  notes?: string;

  createdAt: string;
  updatedAt: string;
};

export type Exam = {
  id: string;
  subject: string;
  date: string; // YYYY-MM-DD
  day: string;
  period: "الفترة الأولى" | "الفترة الثانية";
  time: string; // HH:mm
  durationMinutes: number;
  roomsCount: number;
  createdAt: string;
  updatedAt: string;
};

const KEYS = {
  teachers: "exam_manager_teachers_v1",
  exams: "exam_manager_exams_v1",
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readArray<T>(key: string): T[] {
  return safeParse<T[]>(localStorage.getItem(key), []);
}

function writeArray<T>(key: string, value: T[]) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** TEACHERS **/
export function getTeachers(): Teacher[] {
  return readArray<Teacher>(KEYS.teachers).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function saveTeachers(items: Teacher[]) {
  writeArray(KEYS.teachers, items);
}

export function upsertTeacher(t: Omit<Teacher, "createdAt" | "updatedAt"> & Partial<Pick<Teacher, "createdAt" | "updatedAt">>) {
  const now = new Date().toISOString();
  const items = getTeachers();

  const idx = items.findIndex(x => x.id === t.id);
  if (idx === -1) {
    const createdAt = t.createdAt ?? now;
    const next: Teacher = {
      ...t,
      createdAt,
      updatedAt: now,
    } as Teacher;
    saveTeachers([next, ...items]);
    return next;
  } else {
    const next: Teacher = {
      ...items[idx],
      ...t,
      updatedAt: now,
    } as Teacher;
    const copy = [...items];
    copy[idx] = next;
    saveTeachers(copy);
    return next;
  }
}

export function deleteTeacher(id: string) {
  const items = getTeachers().filter(x => x.id !== id);
  saveTeachers(items);
}

export function findTeacherByJobNo(jobNo: string) {
  const clean = jobNo.trim();
  if (!clean) return undefined;
  return getTeachers().find(t => t.jobNo === clean);
}

/** EXAMS **/
export function getExams(): Exam[] {
  return readArray<Exam>(KEYS.exams).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function saveExams(items: Exam[]) {
  writeArray(KEYS.exams, items);
}

export function upsertExam(e: Omit<Exam, "createdAt" | "updatedAt"> & Partial<Pick<Exam, "createdAt" | "updatedAt">>) {
  const now = new Date().toISOString();
  const items = getExams();

  const idx = items.findIndex(x => x.id === e.id);
  if (idx === -1) {
    const createdAt = e.createdAt ?? now;
    const next: Exam = {
      ...e,
      createdAt,
      updatedAt: now,
    } as Exam;
    saveExams([next, ...items]);
    return next;
  } else {
    const next: Exam = {
      ...items[idx],
      ...e,
      updatedAt: now,
    } as Exam;
    const copy = [...items];
    copy[idx] = next;
    saveExams(copy);
    return next;
  }
}

export function deleteExam(id: string) {
  const items = getExams().filter(x => x.id !== id);
  saveExams(items);
}
