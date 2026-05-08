// src/engines/taskDistributionEngineAdapter.ts
import { newId } from "../api/db";
import { normalizeSubject } from "../lib/normalize";
import type { Teacher as ApiTeacher, Exam as ApiExam } from "../api/types";

import type {
  DistributionEngine,
  EngineInput,
  EngineOutput,
  Assignment,
  PeriodKey,
  TaskType,
  DistributionDebug,
} from "../contracts/taskDistributionContract";

// ✅ استيراد الأنواع من المحرك
import type {
  Exam as LegacyExam,
  Period as LegacyPeriod,
  Teacher as LegacyTeacher,
} from "../utils/distributionEngine";
import { runDistribution as legacyRun } from "../utils/distributionEngine";

function mapPeriod(p: any): PeriodKey {
  if (p === "AM" || p === "PM") return p;
  const n = Number(p);
  return n === 2 ? "PM" : "AM";
}

function toLegacyPeriod(p: PeriodKey): LegacyPeriod {
  return p === "AM" ? "الفترة الأولى" : "الفترة الثانية";
}

function legacyTypeToTaskType(t: string): TaskType {
  switch (t) {
    case "مراقبة":
      return "INVIGILATION";
    case "احتياط":
      return "RESERVE";
    case "فاضي للمراجعة":
      return "REVIEW_FREE";
    case "فاضي للتصحيح":
      return "CORRECTION_FREE";
    case "فارغ":
    default:
      return "FREE";
  }
}

/** تنظيف قوي للنص */
function cleanSubject(v: unknown): string {
  const s = String(v ?? "");
  return s
    .replace(/\u00A0/g, " ")
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFKC");
}

/** تطبيع آمن */
function safeNormalizeSubject(v: unknown): string {
  const cleaned = cleanSubject(v);
  const norm = normalizeSubject(cleaned);
  return norm && norm.trim() ? norm.trim() : cleaned;
}

/** قراءة roomsCount من أي اسم محتمل قادم من API/Excel */
function readRoomsCount(e: any): number {
  const candidates = [
    e?.roomsCount,
    e?.rooms,
    e?.rooms_count,
    e?.roomsNumber,
    e?.roomsNo,
    e?.committeesCount,
    e?.hallsCount,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

export const runTaskDistribution: DistributionEngine = (input: EngineInput): EngineOutput => {
  const runId = newId();
  const createdAtISO = new Date().toISOString();

  // teachers -> legacy
  const legacyTeachers: LegacyTeacher[] = input.teachers.map((t) => {
    const subjects = (t.subjects || []).slice(0, 4);
    return {
      id: t.id,
      name: t.name,
      subject1: subjects[0],
      subject2: subjects[1],
      subject3: subjects[2],
      subject4: subjects[3],
    };
  });

  // exams -> legacy
  const legacyExams: LegacyExam[] = input.exams.map((e) => ({
    id: e.id,
    subject: e.subject,
    date: e.dateISO,
    day: e.dayLabel || "",
    time: (e as any).startTime || (e as any).time || "",
    durationMin: Number((e as any).durationMinutes ?? (e as any).durationMin ?? 0) || 0,
    period: toLegacyPeriod(e.period),
    rooms: Number((e as any).roomsCount || 0) || 0,
  }));

  const legacyOut = legacyRun({
    teachers: legacyTeachers,
    exams: legacyExams,
    constraints: input.constraints as any,
  });

  const assignments: Assignment[] = (legacyOut.assignments || []).map((a: any) => ({
    id: newId(),
    teacherId: a.teacherId,
    teacherName: a.teacherName,
    dateISO: a.date,
    period: a.period === "الفترة الثانية" ? "PM" : "AM",
    taskType: legacyTypeToTaskType(a.type),
    examId: a.examId,
    subject: a.subject,

    committeeNo: a.committeeNo != null ? String(a.committeeNo) : undefined,
    invigilatorIndex:
      typeof a.invigilatorIndex === "number" && Number.isFinite(a.invigilatorIndex)
        ? a.invigilatorIndex
        : undefined,
  }));

  const warnings: string[] = [...(legacyOut.warnings || [])];

  // debug shape safety
  const legacyDbg: any = legacyOut.debug || null;
  const debug: DistributionDebug | undefined = legacyDbg
    ? {
        summary: {
          teachersTotal: Number(legacyDbg?.summary?.teachersTotal ?? input.teachers.length) || 0,
          examsTotal: Number(legacyDbg?.summary?.examsTotal ?? input.exams.length) || 0,
          invRequired: Number(legacyDbg?.summary?.invRequired ?? 0) || 0,
          invAssigned: Number(legacyDbg?.summary?.invAssigned ?? 0) || 0,
          reserveRequired: Number(legacyDbg?.summary?.reserveRequired ?? 0) || 0,
          reserveAssigned: Number(legacyDbg?.summary?.reserveAssigned ?? 0) || 0,
          reviewFreeTeachersDays: Number(legacyDbg?.summary?.reviewFreeTeachersDays ?? 0) || 0,
          correctionFreeTeachersDays: Number(legacyDbg?.summary?.correctionFreeTeachersDays ?? 0) || 0,
        },
        unfilled: Array.isArray(legacyDbg?.unfilled)
          ? legacyDbg.unfilled.map((u: any) => ({
              kind: u.kind,
              dateISO: String(u.dateISO || ""),
              period: (u.period === "PM" ? "PM" : "AM") as PeriodKey,
              examId: u.examId,
              subject: u.subject,
              required: Number(u.required || 0) || 0,
              assigned: Number(u.assigned || 0) || 0,
              reasons: Array.isArray(u.reasons)
                ? u.reasons.map((r: any) => ({ code: r.code, count: Number(r.count || 0) || 0 }))
                : [],
            }))
          : [],
      }
    : undefined;

  return {
    runId,
    createdAtISO,
    constraints: input.constraints,
    teachersCount: input.teachers.length,
    examsCount: input.exams.length,
    assignments,
    warnings,
    debug,
  };
};

export function buildEngineInputFromAppData(args: {
  teachers: ApiTeacher[];
  exams: ApiExam[];
  constraints: EngineInput["constraints"];
}): EngineInput {
  const { teachers, exams, constraints } = args;

  function extractTeacherSubjects(t: any): string[] {
    const arr: any[] = Array.isArray(t?.subjects)
      ? t.subjects
      : [t?.subject1, t?.subject2, t?.subject3, t?.subject4];
    return arr
      .filter((x) => x != null && String(x).trim() !== "")
      .map((s) => safeNormalizeSubject(s));
  }

  function extractTeacherName(t: any): string {
    return String(t?.fullName || t?.name || "").trim();
  }

  return {
    teachers: teachers.map((t) => ({
      id: t.id,
      name: extractTeacherName(t),
      subjects: extractTeacherSubjects(t),
    })),

    exams: (exams as any[]).map((e: any) => ({
      id: String(e.id),
      subject: String(e.subject || "").trim(),
      dateISO: String(e.dateISO || e.date || "").trim(),
      dayLabel: String(e.dayLabel || e.dayName || "").trim(),
      period: mapPeriod(e.period),
      startTime: String(e.startTime || e.time || "").trim(),
      durationMinutes: Number(e.durationMinutes ?? e.durationMin ?? 0) || 0,
      roomsCount: readRoomsCount(e),
    })),

    constraints,
  };
}
