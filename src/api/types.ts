export type ID = string;

export type Teacher = {
  id: ID;
  fullName: string;
  employeeNo?: string;
  phone?: string;
  notes?: string;
  maxPerDay?: number; // الحد اليومي
  subjects?: string[]; // مواد يدرّسها
};

export type Exam = {
  id: ID;
  subject: string;
  date: string; // YYYY-MM-DD
  dayName?: string;
  period: 1 | 2;
  startTime: string; // HH:MM
  durationMinutes: number;
  roomsCount: number; // عدد القاعات/اللجان
};

export type Room = {
  id: ID;
  number: number;
  label?: string;
  capacity?: number;
};

export type Unavailability = {
  id: ID;
  teacherId: ID;
  date: string;
  period: 1 | 2;
  reason?: string;
};

export type RoomBlock = {
  id: ID;
  date: string;
  period: 1 | 2;
  roomNumber: number;
  reason?: string;
};

export type TaskType = "مراقبة" | "مراجعة" | "تصحيح" | "احتياط";

export type Task = {
  id: ID;
  runId: ID;
  examId: ID;
  teacherId: ID;
  taskType: TaskType;
  roomNumber?: number;
  createdAt: number;
};

export type Run = {
  id: ID;
  createdAt: number;
  label: string; // اسم/وصف التشغيل
  constraints: DistributionPolicy;
  stats: {
    tasks: number;
    teachersUsed: number;
    exams: number;
  };
};

export type DistributionPolicy = {
  maxPerDayDefault: number;          // الحد اليومي الافتراضي
  avoidBackToBack: boolean;          // منع مهام متتالية (تبسيط)
  binPolicyMode: "OFF" | "SOFT" | "STRICT"; // سياسة "بن"
  prefer12ForSubject12: boolean;
  ban13LastDay: boolean;
  ban14LastTwoDays: boolean;
};

export type SchoolSettings = {
  id: ID;
  schoolName: string;
  authority?: string;
  academicYear?: string;
  term?: string;
  phone?: string;
  logoDataUrl?: string; // اختياري
  policy: DistributionPolicy;
};

export type AuditLog = {
  id: ID;
  at: number;
  action: string;
  details?: string;
};
