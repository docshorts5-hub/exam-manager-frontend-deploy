export type ResultsManualTaskType = "INVIGILATION" | "RESERVE" | "DUTY_INVIGILATOR";

export function normalizeManualTaskType(taskType: any): ResultsManualTaskType {
  const raw = String(taskType || "").trim().toUpperCase();

  if (raw === "INVIGILATION") return "INVIGILATION";
  if (raw === "RESERVE") return "RESERVE";
  if (raw === "DUTY_INVIGILATOR") return "DUTY_INVIGILATOR";

  // توافق مع البيانات القديمة: أي مراجعة/تصحيح قديم يعامل كمراقب دور.
  if (raw === "REVIEW_FREE" || raw === "CORRECTION_FREE") return "DUTY_INVIGILATOR";

  const arabic = String(taskType || "").trim();
  if (arabic.includes("مراقب دور")) return "DUTY_INVIGILATOR";
  if (arabic.includes("مراقبة")) return "INVIGILATION";
  if (arabic.includes("احتياط")) return "RESERVE";
  if (arabic.includes("مراجعة") || arabic.includes("تصحيح")) return "DUTY_INVIGILATOR";

  return "DUTY_INVIGILATOR";
}

export function isSupportedManualTaskType(taskType: any) {
  return ["INVIGILATION", "RESERVE", "DUTY_INVIGILATOR"].includes(normalizeManualTaskType(taskType));
}

// الاسم الذي تستورده بعض ملفات النتائج.
export function isSupportedResultsTaskType(taskType: any) {
  return isSupportedManualTaskType(taskType);
}

export function normalizeResultsTaskType(taskType: any): ResultsManualTaskType {
  return normalizeManualTaskType(taskType);
}

export function getResultsTaskTypeLabel(taskType: any) {
  switch (normalizeManualTaskType(taskType)) {
    case "INVIGILATION":
      return "مراقبة";
    case "RESERVE":
      return "احتياط";
    case "DUTY_INVIGILATOR":
      return "مراقب دور";
    default:
      return "مهمة";
  }
}

export function createResultsManualAssignment(params: any = {}) {
  const taskType = normalizeManualTaskType(params.taskType);
  const dateISO = String(params.dateISO || params.date || "").trim();
  const periodRaw = String(params.period || "AM").trim().toUpperCase();
  const period = periodRaw === "PM" || periodRaw === "BM" || periodRaw.includes("الثانية") ? "PM" : "AM";
  const subject = String(params.subject || params.examSubject || params.labelSubject || "").trim();
  const teacherName = String(params.teacherName || params.dstTeacher || params.teacher || "").trim();
  const teacherId = String(params.teacherId || params.dstTeacherId || "").trim();

  const uid = [
    "manual",
    taskType,
    dateISO,
    period,
    subject,
    teacherId || teacherName,
    Date.now(),
    Math.random().toString(36).slice(2, 8),
  ].join("__");

  return {
    __uid: params.__uid || params.uid || uid,
    id: params.id || params.__uid || params.uid || uid,
    teacherId,
    teacherName,
    taskType,
    taskTypeLabelAr: getResultsTaskTypeLabel(taskType),
    dateISO,
    date: dateISO,
    period,
    subject,
    examId: params.examId || "",
    examSubject: params.examSubject || subject,
    manual: true,
    source: params.source || "RESULTS_MANUAL_EDIT",
    createdAtISO: params.createdAtISO || new Date().toISOString(),
    ...(params.extra || {}),
  };
}

function readAssignments(params: any = {}) {
  if (Array.isArray(params.assignments)) return params.assignments;
  if (Array.isArray(params.nextAssignments)) return params.nextAssignments;
  if (Array.isArray(params.currentAssignments)) return params.currentAssignments;
  if (Array.isArray(params.run?.assignments)) return params.run.assignments;
  return [];
}

function parseSubColKey(key: string) {
  const parts = String(key || "").split("__");
  return {
    dateISO: parts[0] || "",
    period: parts[1] || "AM",
    subject: parts.slice(2).join("__") || "",
  };
}

/**
 * الاسم الأساسي الذي تستورده resultsCellMutations.ts.
 * يرجع بيانات المهمة المقترحة بدون كسر التوافق مع أي استدعاء قديم.
 */
export function computeMissingCommitteesSlotForResultsCell(params: any = {}) {
  const parsed = parseSubColKey(params.dstColKey || params.subColKey || params.colKey || "");
  const taskType = normalizeManualTaskType(params.taskType || "DUTY_INVIGILATOR");

  const assignment = createResultsManualAssignment({
    ...params,
    taskType,
    dateISO: params.dateISO || parsed.dateISO,
    period: params.period || parsed.period,
    subject: params.subject || parsed.subject,
    teacherName: params.teacherName || params.dstTeacher || params.teacher,
  });

  const assignments = readAssignments(params);
  const nextAssignments = [...assignments, assignment];

  return {
    assignment,
    assignments: nextAssignments,
    nextAssignments,
    next: nextAssignments,
  };
}

/**
 * اسم بديل قد تستخدمه نسخ أخرى من الكود.
 */
export function commitMissingCommitteesSlotForResultsCell(params: any = {}) {
  const result = computeMissingCommitteesSlotForResultsCell(params);

  if (typeof params.persistEditedAssignments === "function") {
    params.persistEditedAssignments(result.nextAssignments, params.note || "إضافة مهمة يدوية من جدول النتائج");
  }

  if (typeof params.onCommit === "function") {
    params.onCommit(result.nextAssignments, result.assignment);
  }

  return result;
}

// Alias للتوافق مع بعض الملفات التي تستورد الاسم بدون s في Committee.
export function computeMissingCommitteeSlotForResultsCell(params: any = {}) {
  return computeMissingCommitteesSlotForResultsCell(params);
}

export function commitMissingCommitteeSlotForResultsCell(params: any = {}) {
  return commitMissingCommitteesSlotForResultsCell(params);
}

export function buildMissingCommitteesSlotForResultsCell(params: any = {}) {
  return computeMissingCommitteesSlotForResultsCell(params);
}

export function getMissingCommitteesSlotForResultsCell(params: any = {}) {
  return computeMissingCommitteesSlotForResultsCell(params);
}

export default {
  normalizeManualTaskType,
  normalizeResultsTaskType,
  isSupportedManualTaskType,
  isSupportedResultsTaskType,
  getResultsTaskTypeLabel,
  createResultsManualAssignment,
  computeMissingCommitteesSlotForResultsCell,
  computeMissingCommitteeSlotForResultsCell,
  commitMissingCommitteesSlotForResultsCell,
  commitMissingCommitteeSlotForResultsCell,
  buildMissingCommitteesSlotForResultsCell,
  getMissingCommitteesSlotForResultsCell,
};
