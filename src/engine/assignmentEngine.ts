// src/engine/assignmentEngine.ts
import { normalizeSubject } from "../lib/normalize";

export type TaskType =
  | "مراقبة"
  | "احتياط"
  | "فارغ للمراجعة"
  | "فارغ للتصحيح";

export type Teacher = {
  id: string;
  name: string;
  subject1?: string;
  subject2?: string;
  subject3?: string;
  subject4?: string;
};

export type Exam = {
  id: string;
  subject: string;
  date: string; // YYYY-MM-DD
  rooms: number;
  day: string; // Added day
  time: string; // Added time
  period: string; // Added period
  duration: string; // Added duration
};

export type Assignment = {
  examId: string; // Correctly defined as examId
  date: string;
  subject: string;
  type: TaskType;
  teacherId: string;
  teacherName: string;
  committeeNo: string; // Added committeeNo
  role: string; // Added role
};