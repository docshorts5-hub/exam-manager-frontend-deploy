export const EXAMS_KEY = "exam-manager:exams:v1";

export function loadExams<T = any[]>(): T {
  try {
    return JSON.parse(localStorage.getItem(EXAMS_KEY) || "[]");
  } catch {
    return [] as T;
  }
}
