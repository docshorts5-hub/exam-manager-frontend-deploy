// src/services/dataRepo.ts
/**
 * طبقة موحّدة للبيانات (Commercial-ready):
 * - مصدر واحد للحقيقة (IndexedDB عبر api/db.ts)
 * - Migration من مفاتيح LocalStorage القديمة لتفادي "لا يقرأ"
 */
import { STORES, getAll, put, clear as clearStore } from "../api/db";
import type { Teacher, Exam } from "../api/types";
import { normalizeSubject } from "../lib/normalize";

const LS_KEYS = {
  teachers_old: "exam-manager:teachers:v1",
  exams_old: "exam-manager:exams:v1",
};

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// ===== Teachers
export async function listTeachers(): Promise<Teacher[]> {
  return (await getAll<Teacher>(STORES.teachers)).sort((a, b) => (a.fullName || "").localeCompare(b.fullName || "", "ar"));
}

export async function saveTeachers(items: Teacher[]): Promise<void> {
  // IMPORTANT: replace-all semantics (so deleting all works)
  await clearStore(STORES.teachers);
  for (const t of items) await put(STORES.teachers, t);
}

// ===== Exams
export async function listExams(): Promise<Exam[]> {
  return (await getAll<Exam>(STORES.exams)).sort((a, b) => (a.date + String(a.period)).localeCompare(b.date + String(b.period)));
}

export async function saveExams(items: Exam[]): Promise<void> {
  // IMPORTANT: replace-all semantics (so deleting all works)
  await clearStore(STORES.exams);
  for (const e of items) await put(STORES.exams, e);
}

export async function resetAllData(): Promise<void> {
  await Promise.all([
    clearStore(STORES.teachers),
    clearStore(STORES.exams),
    clearStore(STORES.tasks),
    clearStore(STORES.runs),
    clearStore(STORES.unavailability),
    clearStore(STORES.roomBlocks),
    clearStore(STORES.rooms),
    clearStore(STORES.settings),
    clearStore(STORES.audit),
  ]).catch(() => {});
}

/**
 * ✅ Migration: إن كان المستخدم لديه بيانات في LocalStorage من النسخ السابقة
 * ننقلها إلى IndexedDB مرة واحدة.
 */
export async function migrateFromLocalStorageIfNeeded(): Promise<{ migrated: boolean; notes: string[] }> {
  const notes: string[] = [];
  const existingTeachers = await getAll(STORES.teachers).catch(() => []);
  const existingExams = await getAll(STORES.exams).catch(() => []);
  if ((existingTeachers?.length ?? 0) > 0 || (existingExams?.length ?? 0) > 0) {
    return { migrated: false, notes: ["IndexedDB already has data."] };
  }

  const rawT = localStorage.getItem(LS_KEYS.teachers_old);
  const rawE = localStorage.getItem(LS_KEYS.exams_old);
  const teachersOld = safeParse<any[]>(rawT, []);
  const examsOld = safeParse<any[]>(rawE, []);

  if (!teachersOld.length && !examsOld.length) return { migrated: false, notes: ["No legacy LocalStorage data found."] };

  // Teachers mapping (old Distribution/Exams pages were using: {id,name,s1..s4})
  const teachers: Teacher[] = teachersOld
    .map((t) => {
      const subjects = [t.subject1, t.subject2, t.subject3, t.subject4, t.s1, t.s2, t.s3, t.s4]
        .filter(Boolean)
        .map((x: string) => normalizeSubject(x))
        .filter(Boolean);
      return {
        id: String(t.id ?? crypto.randomUUID()),
        fullName: String(t.fullName ?? t.name ?? "").trim(),
        employeeNo: t.employeeNo ?? t.jobNo ?? "",
        phone: t.phone ?? "",
        notes: t.notes ?? "",
        subjects,
      } as Teacher;
    })
    .filter((t) => t.fullName);

  // Exams mapping
  const exams: Exam[] = examsOld
    .map((e) => ({
      id: String(e.id ?? crypto.randomUUID()),
      subject: String(e.subject ?? "").trim(),
      date: String(e.date ?? e.dateISO ?? "").slice(0, 10),
      dayName: String(e.dayName ?? e.dayLabel ?? ""),
      period: (e.period === 2 || e.period === "الفترة الثانية" ? 2 : 1) as 1 | 2,
      startTime: String(e.startTime ?? e.time ?? e.timeHHMM ?? "08:00"),
      durationMinutes: Number(e.durationMinutes ?? e.durationMin ?? e.durationMinutes ?? 0) || 0,
      roomsCount: Number(e.roomsCount ?? e.rooms ?? 0) || 0,
    }))
    .filter((e) => e.subject && e.date && e.roomsCount > 0);

  if (teachers.length) {
    await saveTeachers(teachers);
    notes.push(`Migrated teachers: ${teachers.length}`);
  }
  if (exams.length) {
    await saveExams(exams);
    notes.push(`Migrated exams: ${exams.length}`);
  }

  return { migrated: teachers.length > 0 || exams.length > 0, notes };
}
