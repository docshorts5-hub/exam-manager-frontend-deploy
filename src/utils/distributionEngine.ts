// src/utils/distributionEngine.ts
// محرك التوزيع (مراقبة + احتياط) + تشخيص أسباب العجز

import { normalizeSubject } from "../lib/normalize";

/* ================== الأنواع ================== */

// ✅ "الفترة" هنا: (الفترة الأولى/الثانية) وليس (صباحي/مسائي)
export type Period = "الفترة الأولى" | "الفترة الثانية" | "غير محدد";

export type AssignmentType = "مراقبة" | "احتياط" | "فارغ";

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
  day?: string;
  time?: string; // "HH:MM"
  durationMin?: number;
  period?: Period;
  rooms: number;
};

export type Constraints = {
  maxTasksPerTeacher: number;
  dailyReserveCount: number;

  invigilators_5_10: number;
  invigilators_11: number;
  invigilators_12: number;

  // ✅ خيارات متقدمة من الواجهة
  avoidBackToBack?: boolean; // تجنب فترتين في نفس اليوم
  avoidSameSubjectInvigilation?: boolean; // منع مراقبة نفس المادة (اسم بدون رقم)

  // ✅ يسمح بفترتين في نفس اليوم (خاص بأيام محددة)
  allowTwoPeriodsSameDay?: boolean;
  allowedTwoPeriodsDays?: string[];
  // Back-compat alias used by older UI/tools
  allowTwoPeriodsDates?: "ALL" | string[]; // ["الأحد","الإثنين",...]

  // (موجودة بالعقد لكن غير مستخدمة الآن)
  freeAllSubjectTeachersForCorrection?: boolean;
};

export type Assignment = {
  examId?: string;
  date: string;
  day: string;
  subject?: string;
  period: Period;
  durationMin: number;
  type: AssignmentType;
  teacherId: string;
  teacherName: string;

  /** رقم اللجنة/القاعة (1..rooms) للمراقبة */
  committeeNo?: string;

  /** رقم المراقب داخل نفس اللجنة عند تعدد المراقبين */
  invigilatorIndex?: number;
};

export type DebugReasonCode =
  | "NO_TEACHERS"
  | "MAX_TASKS_REACHED"
  | "PERIOD_CONFLICT"
  | "BACK_TO_BACK_BLOCK"
  | "SPECIALTY_BLOCK"
  | "ARABIC_ONCE"
  | "THREE_HOURS_ALREADY"
  | "UNKNOWN";

export type UnfilledSlot = {
  kind: "INVIGILATION" | "RESERVE";
  dateISO: string;
  period: "AM" | "PM"; // AM=الأولى, PM=الثانية
  examId?: string;
  subject?: string;
  required: number;
  assigned: number;
  reasons: { code: DebugReasonCode; count: number }[];
};

export type EngineDebug = {
  summary: {
    teachersTotal: number;
    examsTotal: number;

    invRequired: number;
    invAssigned: number;
    reserveRequired: number;
    reserveAssigned: number;

    reviewFreeTeachersDays: number; // غير مستخدم الآن
    correctionFreeTeachersDays: number; // غير مستخدم الآن
  };
  unfilled: UnfilledSlot[];
};

/* ================== أدوات مساعدة ================== */

function dayNameFromDateISO(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00");
  return ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][d.getDay()];
}

type PeriodKey = "AM" | "PM"; // AM = الفترة الأولى, PM = الفترة الثانية

function toKeyPeriod(p: Period): PeriodKey {
  return p === "الفترة الثانية" ? "PM" : "AM";
}

function toMinutes(hhmm: string): number {
  const s = String(hhmm || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return NaN;
  return h * 60 + min;
}

function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

// ✅ تعريف الفترات حسب طلبك
const P1_START = 8 * 60; // 08:00
const P1_END = 11 * 60; // 11:00
const P2_START = 10 * 60 + 30; // 10:30
const P2_END = 13 * 60; // 13:00

// تصنيف الامتحان إلى (P1/P2) اعتمادًا على وقت الامتحان + مدته
function classifyPeriodByTime(examTime?: string, durationMin?: number): Period {
  const start = toMinutes(String(examTime || ""));
  const dur = Number(durationMin || 0);
  if (!Number.isFinite(start) || !Number.isFinite(dur) || dur <= 0) return "غير محدد";
  const end = start + dur;

  const inP1 = overlap(start, end, P1_START, P1_END);
  const inP2 = overlap(start, end, P2_START, P2_END);

  if (inP1 && !inP2) return "الفترة الأولى";
  if (inP2 && !inP1) return "الفترة الثانية";
  if (inP1 && inP2) return start < P2_START ? "الفترة الأولى" : "الفترة الثانية";
  return "غير محدد";
}

function parseGradeFromSubject(subject: string): number | null {
  const s = String(subject || "");
  const m = s.match(/(\d{1,2})\s*$/);
  if (!m) return null;
  const g = Number(m[1]);
  return Number.isFinite(g) ? g : null;
}

function invigilatorsPerRoomForExam(exam: Exam, constraints: Constraints): number {
  const g = parseGradeFromSubject(exam.subject);
  if (g != null && g >= 5 && g <= 10) return constraints.invigilators_5_10;
  if (g === 11) return constraints.invigilators_11;
  return constraints.invigilators_12;
}

/** اسم المادة بدون رقم (الأساس للمطابقة) */
function subjectBaseName(v: string): string {
  const cleaned = String(v || "").trim();
  // إزالة رقم الصف في آخر النص فقط
  const noGrade = cleaned.replace(/\s*\d{1,2}\s*$/g, "").trim();
  const n = normalizeSubject(noGrade);
  return (n && n.trim()) ? n.trim() : noGrade;
}

function teacherSubjectsBase(t: Teacher): string[] {
  return [t.subject1, t.subject2, t.subject3, t.subject4]
    .filter(Boolean)
    .map((s) => subjectBaseName(String(s)));
}

function teacherTeachesSameBase(t: Teacher, examSubject: string): boolean {
  const examBase = subjectBaseName(examSubject);
  return teacherSubjectsBase(t).some((sb) => sb === examBase);
}

/** هل هذا اليوم مسموح فيه فترتين لنفس المعلم؟ */
function allowTwoPeriodsOnDay(dayName: string, constraints: Constraints): boolean {
  if (!constraints.allowTwoPeriodsSameDay) return false;
  const allowedDays = Array.isArray(constraints.allowedTwoPeriodsDays)
    ? constraints.allowedTwoPeriodsDays
    : [];
  return allowedDays.includes(dayName);
}

/* ================== المحرك الرئيسي ================== */

export function runDistribution(input: { teachers: Teacher[]; exams: Exam[]; constraints: Constraints }) {
  const { teachers, exams, constraints } = input;

  const warnings: string[] = [];
  const unfilled: UnfilledSlot[] = [];

  if (!teachers.length) warnings.push("لا يوجد معلمين في المدخلات.");
  if (!exams.length) warnings.push("لا يوجد امتحانات في المدخلات.");

  // ========= خرائط مساعدة =========
  const teachersById = new Map<string, Teacher>();
  for (const t of teachers) teachersById.set(String(t.id), t);

  const tasksCount = new Map<string, number>(); // عبء كل معلم
  for (const t of teachers) tasksCount.set(String(t.id), 0);

  // ✅ شرط: المعلم لا يُكلف بمراقبة 3 ساعات أكثر من مرة طوال فترة الاختبارات
  // (يُحسب فقط على "مراقبة" وبالمدة الدقيقة 180 دقيقة)
  const threeHoursInvigilatedOnce = new Set<string>();

  // ✅ شرط خاص: مادة اللغة العربية تُسند للمعلم مرة واحدة فقط طوال فترة الامتحانات (مراقبة فقط)
  const arabicInvigilatedOnce = new Set<string>();
  const ARABIC_BASE = subjectBaseName("اللغة العربية");

  // عدّاد لتقليل تكرار نفس (اسم المادة بدون رقم) لنفس المعلم (عدالة أفضل)
  const invSubjectBaseCount = new Map<string, Map<string, number>>();

  // منع تكرار نفس المعلم داخل اليوم (مهمة واحدة يومياً)
  const dayAssigned = new Set<string>(); // teacherId__date

  // معرفة إن المعلم أخذ فترة AM/PM في هذا اليوم (لـ back-to-back)
  const periodAssigned = new Set<string>(); // teacherId__date__AM/PM

  // ========= تجهيز الامتحانات وترتيبها =========
  const examsSorted = [...exams].sort((a, b) => {
    const d = String(a.date).localeCompare(String(b.date));
    if (d !== 0) return d;

    const pa = toKeyPeriod(
      classifyPeriodByTime(a.time, a.durationMin) !== "غير محدد"
        ? classifyPeriodByTime(a.time, a.durationMin)
        : (a.period || "الفترة الأولى")
    );
    const pb = toKeyPeriod(
      classifyPeriodByTime(b.time, b.durationMin) !== "غير محدد"
        ? classifyPeriodByTime(b.time, b.durationMin)
        : (b.period || "الفترة الأولى")
    );

    if (pa !== pb) return pa === "AM" ? -1 : 1;
    return String(a.subject).localeCompare(String(b.subject), "ar");
  });

  // ========= بناء Slots =========
  type Slot = {
    dateISO: string;
    period: "AM" | "PM";
    kind: "INVIGILATION" | "RESERVE";
    exam?: Exam;
    required: number;
  };
  const slots: Slot[] = [];

  // Slots المراقبة (حسب قاعات كل امتحان)
  for (const e of examsSorted) {
    const rooms = Number(e.rooms || 0);
    const invPerRoom = invigilatorsPerRoomForExam(e, constraints);
    const required = Math.max(0, rooms) * Math.max(0, invPerRoom);

    if (required > 0) {
      const p = classifyPeriodByTime(e.time, e.durationMin);
      const effective = p !== "غير محدد" ? p : (e.period || "الفترة الأولى");
      slots.push({
        dateISO: String(e.date),
        period: toKeyPeriod(effective),
        kind: "INVIGILATION",
        exam: e,
        required,
      });
    }
  }

  // Slots الاحتياط (لكل تاريخ+فترة)
  const reserveNeededByDatePeriod = new Map<string, number>();
  for (const e of examsSorted) {
    const dateISO = String(e.date);
    const p = classifyPeriodByTime(e.time, e.durationMin);
    const effective = p !== "غير محدد" ? p : (e.period || "الفترة الأولى");
    const period = toKeyPeriod(effective);
    reserveNeededByDatePeriod.set(`${dateISO}__${period}`, constraints.dailyReserveCount || 0);
  }
  for (const [key, required] of reserveNeededByDatePeriod.entries()) {
    const [dateISO, period] = key.split("__") as [string, "AM" | "PM"];
    if (required > 0) slots.push({ dateISO, period, kind: "RESERVE", required });
  }

  // ========= ترتيب Slots لتقليل العجز بدون خرق الشروط =========
  // الفكرة: داخل نفس اليوم/الفترة نعطي الأولوية للامتحانات الأكثر "ندرة" (عدد مرشحين أقل) والأكبر احتياجًا.
  function eligibleCountForExam(exam: Exam): number {
    const subject = exam?.subject;
    if (!subject) return teachers.length;
    if (!constraints.avoidSameSubjectInvigilation) return teachers.length;
    const base = subjectBaseName(subject);
    let c = 0;
    for (const t of teachers) {
      // المرشح المؤهل مبدئيًا هو من لا يدرّس نفس المادة (بالاسم بدون رقم)
      if (!teacherTeachesSameBase(t, base)) c += 1;
    }
    return c;
  }

  slots.sort((a, b) => {
    const d = String(a.dateISO).localeCompare(String(b.dateISO));
    if (d !== 0) return d;
    if (a.period !== b.period) return a.period === "AM" ? -1 : 1;

    // المراقبة قبل الاحتياط
    if (a.kind !== b.kind) return a.kind === "INVIGILATION" ? -1 : 1;

    // داخل المراقبة: الأقل مرشحين ثم الأعلى احتياجًا
    if (a.kind === "INVIGILATION" && b.kind === "INVIGILATION") {
      const ea = a.exam ? eligibleCountForExam(a.exam) : 999999;
      const eb = b.exam ? eligibleCountForExam(b.exam) : 999999;
      if (ea !== eb) return ea - eb;
      if (a.required !== b.required) return b.required - a.required;
      return String(a.exam?.subject || "").localeCompare(String(b.exam?.subject || ""), "ar");
    }

    return 0;
  });

  // ========= دوال القيود =========

  function teacherAtMax(teacherId: string) {
    const c = tasksCount.get(teacherId) || 0;
    return c >= (constraints.maxTasksPerTeacher || 0);
  }

  function teacherHasPeriodConflict(teacherId: string, dateISO: string, period: "AM" | "PM") {
    return periodAssigned.has(`${teacherId}__${dateISO}__${period}`);
  }

  function teacherHasDayTask(teacherId: string, dateISO: string) {
    return dayAssigned.has(`${teacherId}__${dateISO}`);
  }

  function teacherHasBackToBack(teacherId: string, dateISO: string, period: "AM" | "PM") {
    // إذا المستخدم يسمح بفترتين في هذا اليوم، لا تمنع
    const dayName = dayNameFromDateISO(dateISO);
    if (allowTwoPeriodsOnDay(dayName, constraints)) return false;

    // إذا avoidBackToBack = false -> لا تمنع
    if (!constraints.avoidBackToBack) return false;

    // ممنوع فترتين بنفس اليوم
    const other: "AM" | "PM" = period === "AM" ? "PM" : "AM";
    return periodAssigned.has(`${teacherId}__${dateISO}__${other}`);
  }

  function subjectCountForTeacher(teacherId: string, base: string): number {
    const m = invSubjectBaseCount.get(teacherId);
    return m ? (m.get(base) || 0) : 0;
  }

  function rankCandidates(candidates: Teacher[], examSubject?: string) {
    const base = examSubject ? subjectBaseName(examSubject) : "";
    return [...candidates].sort((a, b) => {
      const ca = tasksCount.get(String(a.id)) || 0;
      const cb = tasksCount.get(String(b.id)) || 0;
      if (ca !== cb) return ca - cb;

      // ✅ عدالة إضافية: قلل تكرار نفس المادة (بالاسم بدون رقم) لنفس المعلم
      if (base) {
        const sa = subjectCountForTeacher(String(a.id), base);
        const sb = subjectCountForTeacher(String(b.id), base);
        if (sa !== sb) return sa - sb;
      }
      return String(a.name).localeCompare(String(b.name), "ar");
    });
  }

  /**
   * اختيار معلم:
   * - يمنع نفس المعلم في نفس اليوم (1 فقط)
   * - يمنع back-to-back إلا في أيام محددة
   * - يمنع مراقبة نفس المادة (بالاسم بدون رقم) للمراقبة
   * - الاحتياط: يمنع نفس المادة، لكن عند العجز يسمح
   */
  function pickTeacherForSlot(
    dateISO: string,
    period: "AM" | "PM",
    kind: "INVIGILATION" | "RESERVE",
    examSubject?: string,
    examDurationMin?: number
  ) {
    const reasonsCount: Record<DebugReasonCode, number> = {
      NO_TEACHERS: 0,
      MAX_TASKS_REACHED: 0,
      PERIOD_CONFLICT: 0,
      BACK_TO_BACK_BLOCK: 0,
      SPECIALTY_BLOCK: 0,
      ARABIC_ONCE: 0,
      THREE_HOURS_ALREADY: 0,
      UNKNOWN: 0,
    };

    if (!teachers.length) {
      reasonsCount.NO_TEACHERS = 1;
      return { teacher: null as Teacher | null, reasonsCount };
    }

    // المرحلة 1: تطبيق جميع القيود (بما فيها منع نفس المادة للاحتياط)
    const strictCandidates: Teacher[] = [];
    for (const t of teachers) {
      const id = String(t.id);

      if (teacherAtMax(id)) {
        reasonsCount.MAX_TASKS_REACHED += 1;
        continue;
      }

      // ✅ شرط: منع تكرار مراقبة 3 ساعات لنفس المعلم طوال فترة الاختبارات
      if (kind === "INVIGILATION" && Number(examDurationMin || 0) === 180 && threeHoursInvigilatedOnce.has(id)) {
        reasonsCount.THREE_HOURS_ALREADY += 1;
        continue;
      }

      // ✅ شرط: اللغة العربية مرة واحدة طوال الامتحانات (مراقبة فقط)
      if (kind === "INVIGILATION" && examSubject) {
        const base = subjectBaseName(examSubject);
        if (base === ARABIC_BASE && arabicInvigilatedOnce.has(id)) {
          reasonsCount.ARABIC_ONCE += 1;
          continue;
        }
      }

      // 1- عدم تكرار نفس المعلم داخل اليوم
      if (teacherHasDayTask(id, dateISO)) {
        reasonsCount.PERIOD_CONFLICT += 1; // نسجلها كتعرض عام
        continue;
      }

      if (teacherHasPeriodConflict(id, dateISO, period)) {
        reasonsCount.PERIOD_CONFLICT += 1;
        continue;
      }

      if (teacherHasBackToBack(id, dateISO, period)) {
        reasonsCount.BACK_TO_BACK_BLOCK += 1;
        continue;
      }

      // 2- منع معلم مادته من المراقبة مادته (بالاسم بدون رقم)
      // ويطبق أيضاً على الاحتياط في الوضع الصارم
      if (constraints.avoidSameSubjectInvigilation && examSubject) {
        const isSame = teacherTeachesSameBase(t, examSubject);
        if (isSame) {
          reasonsCount.SPECIALTY_BLOCK += 1;
          continue;
        }
      }

      strictCandidates.push(t);
    }

    if (strictCandidates.length) {
      const ranked = rankCandidates(strictCandidates, examSubject);
      return { teacher: ranked[0], reasonsCount };
    }

    // المرحلة 2: عند العجز -> اسمح للاحتياط فقط أن يأخذ معلم مادته
    if (kind === "RESERVE" && constraints.avoidSameSubjectInvigilation && examSubject) {
      const relaxedCandidates: Teacher[] = [];
      for (const t of teachers) {
        const id = String(t.id);

        if (teacherAtMax(id)) continue;
        if (teacherHasDayTask(id, dateISO)) continue;
        if (teacherHasPeriodConflict(id, dateISO, period)) continue;
        if (teacherHasBackToBack(id, dateISO, period)) continue;

        // هنا لا نمنع نفس المادة
        relaxedCandidates.push(t);
      }

      if (relaxedCandidates.length) {
        const ranked = rankCandidates(relaxedCandidates, examSubject);
        return { teacher: ranked[0], reasonsCount };
      }
    }

    return { teacher: null as Teacher | null, reasonsCount };
  }

  // ========= توليد Assignments =========
  const assignments: Assignment[] = [];

  function addAssignment(a: Assignment) {
    assignments.push(a);

    // ✅ شرط: مرة واحدة فقط لمراقبة 3 ساعات طوال الاختبارات
    if (a.type === "مراقبة" && Number(a.durationMin) === 180) {
      threeHoursInvigilatedOnce.add(String(a.teacherId));
    }

    // ✅ اللغة العربية مرة واحدة (مراقبة فقط)
    if (a.type === "مراقبة" && a.subject) {
      const base = subjectBaseName(a.subject);
      if (base === ARABIC_BASE) arabicInvigilatedOnce.add(String(a.teacherId));

      // عدّاد المادة (لعدالة أفضل)
      const tid = String(a.teacherId);
      let m = invSubjectBaseCount.get(tid);
      if (!m) {
        m = new Map();
        invSubjectBaseCount.set(tid, m);
      }
      m.set(base, (m.get(base) || 0) + 1);
    }

    // تحديث العدّادات
    const id = String(a.teacherId);
    tasksCount.set(id, (tasksCount.get(id) || 0) + 1);
    dayAssigned.add(`${id}__${a.date}`);

    const p = toKeyPeriod(a.period);
    periodAssigned.add(`${id}__${a.date}__${p}`);
  }

  let invRequired = 0;
  let invAssigned = 0;
  let reserveRequired = 0;
  let reserveAssigned = 0;

  // توزيع slots
  for (const s of slots) {
    if (s.kind === "INVIGILATION") invRequired += s.required;
    if (s.kind === "RESERVE") reserveRequired += s.required;

    const dateISO = s.dateISO;
    const periodKey = s.period;
    const legacyPeriod: Period = periodKey === "PM" ? "الفترة الثانية" : "الفترة الأولى";
    const day = dayNameFromDateISO(dateISO);

    let assignedHere = 0;
    const reasonsAgg: Record<DebugReasonCode, number> = {
      NO_TEACHERS: 0,
      MAX_TASKS_REACHED: 0,
      PERIOD_CONFLICT: 0,
      BACK_TO_BACK_BLOCK: 0,
      SPECIALTY_BLOCK: 0,
      ARABIC_ONCE: 0,
      THREE_HOURS_ALREADY: 0,
      UNKNOWN: 0,
    };

    const exam = s.exam;
    const examSubject = exam?.subject;

    // للمراقبة: نحتاج عدد المراقبين لكل قاعة لحساب رقم اللجنة
    const invPerRoomForThisExam =
      s.kind === "INVIGILATION" && exam ? invigilatorsPerRoomForExam(exam, constraints) : 0;

    for (let i = 0; i < s.required; i++) {
      const pick = pickTeacherForSlot(dateISO, periodKey, s.kind, examSubject, Number(exam?.durationMin || 0));
      for (const [k, v] of Object.entries(pick.reasonsCount)) {
        reasonsAgg[k as DebugReasonCode] += v;
      }

      if (!pick.teacher) break;
      const t = pick.teacher;

      // ✅ رقم اللجنة/القاعة + ترتيب المراقب داخل نفس اللجنة
      let committeeNo: string | undefined = undefined;
      let invigilatorIndex: number | undefined = undefined;
      if (s.kind === "INVIGILATION" && exam && invPerRoomForThisExam > 0) {
        const roomNo = Math.floor(i / invPerRoomForThisExam) + 1; // 1..rooms
        committeeNo = String(roomNo);
        invigilatorIndex = (i % invPerRoomForThisExam) + 1;
      }

      addAssignment({
        examId: exam?.id,
        date: dateISO,
        day,
        subject: examSubject,
        period: legacyPeriod,
        durationMin: Number(exam?.durationMin || 0),
        type: s.kind === "INVIGILATION" ? "مراقبة" : "احتياط",
        teacherId: String(t.id),
        teacherName: String(t.name),
        committeeNo,
        invigilatorIndex,
      });

      assignedHere += 1;
    }

    if (s.kind === "INVIGILATION") invAssigned += assignedHere;
    if (s.kind === "RESERVE") reserveAssigned += assignedHere;

    if (assignedHere < s.required) {
      const reasons = Object.entries(reasonsAgg)
        .filter(([, v]) => v > 0)
        .map(([code, count]) => ({ code: code as DebugReasonCode, count }))
        .sort((a, b) => b.count - a.count);

      unfilled.push({
        kind: s.kind,
        dateISO,
        period: periodKey,
        examId: exam?.id,
        subject: examSubject,
        required: s.required,
        assigned: assignedHere,
        reasons: reasons.length ? reasons : [{ code: "UNKNOWN", count: 1 }],
      });
    }
  }

  // ========= تحذيرات =========
  if (invRequired > 0 && invAssigned === 0) warnings.push("لم يتم توزيع أي مهام مراقبة. تحقق من rooms/القيود.");
  if (reserveRequired > 0 && reserveAssigned === 0) warnings.push("لم يتم توزيع أي احتياط. تحقق من dailyReserveCount.");

  // ========= Debug =========
  const debug: EngineDebug = {
    summary: {
      teachersTotal: teachers.length,
      examsTotal: exams.length,
      invRequired,
      invAssigned,
      reserveRequired,
      reserveAssigned,
      reviewFreeTeachersDays: 0,
      correctionFreeTeachersDays: 0,
    },
    unfilled,
  };

  return {
    assignments,
    warnings,
    debug,
  };
}
