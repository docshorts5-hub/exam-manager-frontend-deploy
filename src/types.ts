// src/types.ts
export interface Teacher {
  id: string;
  name: string;
  fullName: string;
  subjects: string[];
  grades: number[];
  unavailableDates: string[];
  isAvailable: boolean;
  maxTasks: number;
  specialization?: string;
  notes?: string;
}

export interface Exam {
  id: string;
  name: string;
  subject: string;
  grade: number;
  date: string;
  day: string;
  time: string;
  duration: string;
  period: number;
  hall: string;
  numberOfRooms: number;
  totalStudents: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// التوزيع الأساسي - جميع الخصائص مطلوبة
export interface DistributionRecord {
  examId: string;
  examDate: string;
  period: number;
  subject: string;
  grade: number;
  hall: string;
  teacherName: string;
  status: string;
  // هذه الخصائص اختيارية في الواجهة الأساسية
  examSubject?: string;
  examDay?: string;
  teacherId?: string;
}

export interface FairnessStat {
  teacherName: string;
  monitoring: number;
  reserve: number;
  review: number;
  correction: number;
  total: number;
}

export interface DistributionSettings {
  reserveTeachersPerDay: number;
  maxAssignmentsPerTeacher: number;
  maxGradingDaysPerTeacher: number;
  invigilatorsPerHallGrade10: number;
  invigilatorsPerHallGrade11: number;
  invigilatorsPerHallOther: number;
  avoidBackToBack: boolean;
  smartBySpecialization: boolean;
  freeAllSubjectTeachersForGrading: boolean;
  allowTwoPeriodsPerDay: boolean;
  
  // إعدادات إضافية للتوافق
  invigilators_5to10: number;
  invigilators_11: number;
  invigilators_12: number;
  maxTotalTasks: number;
  maxReserveDaily: number;
  maxCorrectionDays: number;
  avoidConsecutive: boolean;
  smartSubjectDistribution: boolean;
  freeAllTeachersForCorrection: boolean;
}

// نوع موسع - يمكن أن يوسع أو يتجاوز الخصائص
export interface ExtendedDistributionRecord extends Omit<DistributionRecord, 'examSubject' | 'examDay'> {
  examSubject: string;
  examDay: string;
  type?: "مراقبة" | "احتياط" | "فاضي للمراجعة" | "فاضي للتصحيح" | "فارغ";
  room?: number;
}