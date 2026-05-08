import type { Exam } from "./exams.service";
import type { Room } from "./rooms.service";
import type { RoomBlock } from "./roomBlocks.service";
import type { Teacher } from "./teachers.service";

export type SmartAlertLevel = "critical" | "warning" | "info" | "success";

export type SmartAlert = {
  id: string;
  level: SmartAlertLevel;
  title: string;
  message: string;
  route?: string;
};

type AssignmentLike = {
  examId?: string;
  roomId?: string;
  roomName?: string;
};

type TaskLike = {
  teacherId?: string;
  teacherName?: string;
  fullName?: string;
};

type SmartAlertModel = {
  teachers?: Teacher[];
  exams?: Exam[];
  rooms?: Room[];
  roomBlocks?: RoomBlock[];
  examRoomAssignments?: AssignmentLike[];
  taskAssignments?: TaskLike[];
};

function isSameSession(examPeriod: string | undefined, blockSession: string | undefined) {
  const p = String(examPeriod || "").trim();
  const s = String(blockSession || "").trim();
  if (!s || s === "full-day") return true;
  return p === s;
}

function isBlockActiveForDate(dateISO: string | undefined, block: RoomBlock) {
  const d = String(dateISO || "").trim();
  if (!d) return false;
  return String(block.status || "") === "active" && d >= String(block.startDate || "") && d <= String(block.endDate || "");
}

export function buildSmartAlerts(model: SmartAlertModel): SmartAlert[] {
  const teachers = Array.isArray(model.teachers) ? model.teachers : [];
  const exams = Array.isArray(model.exams) ? model.exams : [];
  const rooms = Array.isArray(model.rooms) ? model.rooms : [];
  const roomBlocks = Array.isArray(model.roomBlocks) ? model.roomBlocks : [];
  const examRoomAssignments = Array.isArray(model.examRoomAssignments) ? model.examRoomAssignments : [];
  const taskAssignments = Array.isArray(model.taskAssignments) ? model.taskAssignments : [];

  const alerts: SmartAlert[] = [];
  const activeRooms = rooms.filter((room) => String(room.status || "active") === "active");
  const activeBlocks = roomBlocks.filter((block) => String(block.status || "") === "active");

  const assignedByExam = new Map<string, AssignmentLike[]>();
  for (const assignment of examRoomAssignments) {
    const examId = String(assignment.examId || "").trim();
    if (!examId) continue;
    const current = assignedByExam.get(examId) || [];
    current.push(assignment);
    assignedByExam.set(examId, current);
  }

  const unfilled = exams.filter((exam) => {
    const required = Math.max(1, Number((exam as any).roomsCount) || 1);
    const linked = (assignedByExam.get(String(exam.id || "")) || []).length;
    return linked < required;
  });
  if (unfilled.length) {
    alerts.push({
      id: "exam-room-gap",
      level: unfilled.length >= 3 ? "critical" : "warning",
      title: "نقص في ربط القاعات",
      message: `يوجد ${unfilled.length} امتحان لم يكتمل له عدد القاعات المطلوبة حتى الآن.`,
      route: "/exams",
    });
  }

  const blockedConflicts = exams.flatMap((exam) => {
    const linked = assignedByExam.get(String(exam.id || "")) || [];
    return linked.filter((assignment) =>
      activeBlocks.some((block) =>
        String(block.roomId || "") === String(assignment.roomId || "") &&
        isBlockActiveForDate((exam as any).dateISO, block) &&
        isSameSession((exam as any).period, block.session)
      )
    );
  });
  if (blockedConflicts.length) {
    alerts.push({
      id: "blocked-room-conflict",
      level: "critical",
      title: "تعارض مع القاعات المحظورة",
      message: `تم رصد ${blockedConflicts.length} حالة ربط على قاعات محظورة في نفس اليوم أو الفترة.`,
      route: "/rooms",
    });
  }

  const blockedRate = activeRooms.length ? Math.round((activeBlocks.length / activeRooms.length) * 100) : 0;
  if (blockedRate >= 40) {
    alerts.push({
      id: "high-block-rate",
      level: "warning",
      title: "ارتفاع معدل حظر القاعات",
      message: `نسبة الحظر النشط وصلت إلى ${blockedRate}% من القاعات النشطة، وقد تؤثر على الجدولة.`,
      route: "/rooms",
    });
  }

  const teacherLoad = new Map<string, number>();
  for (const task of taskAssignments) {
    const name = String(task.teacherName || task.fullName || task.teacherId || "").trim();
    if (!name) continue;
    teacherLoad.set(name, (teacherLoad.get(name) || 0) + 1);
  }
  const loads = [...teacherLoad.values()];
  if (loads.length) {
    const max = Math.max(...loads);
    const min = Math.min(...loads);
    const gap = max - min;
    if (gap >= 4) {
      alerts.push({
        id: "teacher-load-gap",
        level: "warning",
        title: "عدم توازن في الأحمال",
        message: `فجوة التكليف الحالية بين أعلى وأقل معلم وصلت إلى ${gap} مهام.`,
        route: "/analytics",
      });
    }
  }

  if (!alerts.length) {
    alerts.push({
      id: "ops-stable",
      level: "success",
      title: "الوضع التشغيلي مستقر",
      message: "لا توجد تنبيهات تشغيلية حرجة ظاهرة الآن، ويمكن متابعة التشغيل بصورة آمنة.",
      route: "/analytics",
    });
  }

  if (!teachers.length) {
    alerts.push({
      id: "teachers-empty",
      level: "info",
      title: "لا توجد بيانات معلمين كافية",
      message: "أضيفي بيانات الكادر التعليمي كاملة لتحسين دقة التحليلات والتنبيهات الذكية.",
      route: "/teachers",
    });
  }

  return alerts.slice(0, 6);
}
