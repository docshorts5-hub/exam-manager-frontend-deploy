// src/types/index.ts

// ────────────────────────────────────────────────
// المعلم
// ────────────────────────────────────────────────
export interface Teacher {
  id: string;
  name: string; // الاسم المستخدم في التوزيع
  fullName?: string; // الاسم الكامل (للتوافق مع البيانات القديمة)
  subjects?: string[]; // المواد التي يدرسها (مصفوفة)
  grades?: number[]; // الصفوف التي يدرسها
  unavailableDates?: string[]; // تواريخ غير متاح فيها
  isAvailable?: boolean; // حالة التوفر العامة
  maxTasks?: number; // الحد الأقصى للمهام للمعلم (يحل محل الإعداد العام إذا وجد)
  specialization?: string; // التخصص (اختياري)
  notes?: string; // ملاحظات إضافية
}

// ────────────────────────────────────────────────
// الامتحان
// ────────────────────────────────────────────────
export interface Exam {
  id: string;
  subject: string; // المادة
  grade: number; // الصف (مثل 10، 11، 12)
  date: string; // التاريخ (YYYY-MM-DD)
  day?: string; // اسم اليوم (اختياري)
  time?: string; // وقت الامتحان
  duration?: string; // مدة الامتحان
  period: number; // الفترة (1، 2، ...)
  numberOfRooms?: number; // عدد القاعات/اللجان
  totalStudents?: number; // عدد الطلاب (اختياري)
  hall?: string; // اسم القاعة (اختياري)
  notes?: string; // ملاحظات
  createdAt?: string;
  updatedAt?: string;
}

// ────────────────────────────────────────────────
// سجل التوزيع
// ────────────────────────────────────────────────
export interface DistributionRecord {
  examId: string;
  examSubject: string;
  examDate: string;
  examDay: string;
  period: number | string;
  teacherId: string;
  teacherName: string;
  type: "مراقبة" | "احتياط" | "فاضي للمراجعة" | "فاضي للتصحيح" | "فارغ";
  room?: number;
}

// ────────────────────────────────────────────────
// إحصائيات العدالة
// ────────────────────────────────────────────────
export interface FairnessStat {
  teacherName: string;
  monitoring: number; // مراقبة
  reserve: number; // احتياط
  review: number; // مراجعة
  correction: number; // تصحيح
  total: number; // الإجمالي
}

// ────────────────────────────────────────────────
// إعدادات التوزيع (مع التوافق بين الأسماء القديمة والجديدة)
// ────────────────────────────────────────────────
export interface DistributionSettings {
  // عدد المراقبين حسب الصف
  invigilators_5to10: number;
  invigilators_11: number;
  invigilators_12: number;

  // القيود العامة
  maxTotalTasks: number;
  maxReserveDaily: number;
  maxCorrectionDays: number;

  // الخيارات المتقدمة
  avoidConsecutive: boolean; // تجنب المهام المتتالية
  smartSubjectDistribution: boolean; // توزيع ذكي حسب التخصص
  freeAllTeachersForCorrection: boolean; // تفريغ معلمي المادة للتصحيح
  allowTwoPeriodsPerDay: boolean; // السماح بفترتين في اليوم

  // توافق مع الأسماء القديمة (اختياري)
  invigilatorsPerHallGrade10?: number;
  invigilatorsPerHallGrade11?: number;
  invigilatorsPerHallOther?: number;
  maxAssignmentsPerTeacher?: number;
  maxGradingDaysPerTeacher?: number;
  reserveTeachersPerDay?: number;
  avoidBackToBack?: boolean;
  smartBySpecialization?: boolean;
  freeAllSubjectTeachersForGrading?: boolean;
}

// ────────────────────────────────────────────────
// نوع موسع للسجلات (للاستخدام داخلي)
// ✅ FIX: لا يمكن جعل خصائص مطلوبة اختيارية عبر extends
// لذلك نستخدم Omit ثم نعيد تعريفها كاختيارية
// ────────────────────────────────────────────────
export type ExtendedDistributionRecord = Omit<
  DistributionRecord,
  "teacherId" | "examSubject" | "examDay"
> & {
  teacherId?: string;
  examSubject?: string;
  examDay?: string;
  room?: number;
  status?: string; // توافق مع status القديم
};

// ────────────────────────────────────────────────
// بيانات التوزيع الكاملة
// ────────────────────────────────────────────────
export interface DistributionData {
  records: DistributionRecord[];
  fairness: FairnessStat[];
  summary?: {
    totalExams: number;
    totalTeachers: number;
    totalMonitoring: number;
    totalReserve: number;
    totalReview: number;
    totalCorrection: number;
    fairnessRatio: number;
  };
}

// ────────────────────────────────────────────────
// بيانات التخزين
// ────────────────────────────────────────────────
export interface StoredData {
  teachers: Teacher[];
  exams: Exam[];
  distribution?: DistributionData;
  settings?: DistributionSettings;
}

// ────────────────────────────────────────────────
// أنواع مساعدة
// ────────────────────────────────────────────────
export type LoadFunction<T> = (key: string, defaultValue: T) => T;
export type SaveFunction = (key: string, data: any) => void;

// أنواع للتصفية والبحث (اختياري للتوسع المستقبلي)
export interface FilterOptions {
  teacherName?: string;
  subject?: string;
  grade?: number;
  dateRange?: { start: string; end: string };
  status?: DistributionRecord["type"];
}