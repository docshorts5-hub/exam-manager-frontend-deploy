// src/contracts/taskDistributionContract.ts

export type TaskType =
  | "INVIGILATION"
  | "RESERVE"
  | "CORRECTION_FREE"
  | "REVIEW_FREE"
  | "FREE";

export type PeriodKey = "AM" | "PM";

export type TeacherRef = {
  id: string;
  name: string;
  subjects: string[];
  groupId?: string;
};

export type ExamRef = {
  id: string;
  subject: string;
  dateISO: string;
  dayLabel?: string;
  period: PeriodKey;
  startTime?: string;
  durationMinutes?: number;
  roomsCount: number;
  grade?: string;
};

export type DistributionConstraints = {
  // ====== أساسية ======
  maxTasksPerTeacher: number;

  // الاحتياط “لكل فترة”
  dailyReserveCount: number;

  // مراقبين لكل قاعة حسب الصف
  invigilators_5_10: number;
  invigilators_11: number;
  invigilators_12: number;

  // ====== خيارات متقدمة (مثل الصورة) ======
  // تجنب المهام المتتالية (Back-to-Back)
  avoidBackToBack?: boolean;

  // منع مراقبة نفس المادة (بالاسم بدون رقم) للمراقبة فقط
  avoidSameSubjectInvigilation?: boolean;

  // لاحقاً (غير مستخدم الآن داخل المحرك هنا)
  freeAllSubjectTeachersForCorrection?: boolean;

  // السماح بفترتين في نفس اليوم بشكل عام
  allowTwoPeriodsSameDay?: boolean;

  // السماح بفترتين في أيام محددة فقط (يحددها المستخدم)
  allowedTwoPeriodsDays?: string[];
};

export type Assignment = {
  id: string;
  teacherId: string;
  teacherName: string;
  dateISO: string;
  period: PeriodKey;
  taskType: TaskType;
  examId?: string;
  subject?: string;

  /** رقم اللجنة/القاعة (اختياري) */
  committeeNo?: string;

  /** رقم المراقب داخل نفس اللجنة عند تعدد المراقبين (اختياري) */
  invigilatorIndex?: number;
};

export type DebugReason = {
  code:
    | "NO_TEACHERS"
    | "MAX_TASKS_REACHED"
    | "PERIOD_CONFLICT"
    | "BACK_TO_BACK_BLOCK"
    | "REVIEW_FREE_BLOCK"
    | "CORRECTION_FREE_BLOCK"
    | "SPECIALTY_BLOCK"
    | "UNKNOWN";
  count: number;
};

export type UnfilledSlotDebug = {
  kind: "INVIGILATION" | "RESERVE";
  dateISO: string;
  period: PeriodKey;
  examId?: string;
  subject?: string;
  required: number;
  assigned: number;
  reasons: DebugReason[];
};

export type DistributionDebug = {
  summary: {
    teachersTotal: number;
    examsTotal: number;
    invRequired: number;
    invAssigned: number;
    reserveRequired: number;
    reserveAssigned: number;
    reviewFreeTeachersDays: number;
    correctionFreeTeachersDays: number;
  };
  unfilled: UnfilledSlotDebug[];
};

export type DistributionRun = {
  runId: string;
  createdAtISO: string;
  constraints: DistributionConstraints;
  teachersCount: number;
  examsCount: number;
  assignments: Assignment[];
  warnings: string[];
  debug?: DistributionDebug;
};

export type EngineInput = {
  teachers: TeacherRef[];
  exams: ExamRef[];
  constraints: DistributionConstraints;
};

export type EngineOutput = DistributionRun;
export type DistributionEngine = (input: EngineInput) => EngineOutput;export type Exam = {
  uid: string;
  subjectName: string;
  date: string;
  day: string;
  time: string;
  period: number;
  duration: string;
};


