export const DRAGGABLE_TASK_TYPES = new Set<string>(["INVIGILATION", "RESERVE", "CORRECTION_FREE"]);
export const MAX_TASKS_PER_COLUMN_PER_TEACHER = 2;

export function isDraggableTaskType(taskType: any) {
  return DRAGGABLE_TASK_TYPES.has(String(taskType || ""));
}

export function conflictInvReserve(incomingType: string, existingTypes: Set<string>) {
  const t = String(incomingType || "");
  if (t === "INVIGILATION" && existingTypes.has("RESERVE")) return true;
  if (t === "RESERVE" && existingTypes.has("INVIGILATION")) return true;
  return false;
}

export function colKeyOf(a: any) {
  const d = String(a?.dateISO || "").trim();
  const p = String(a?.period || "AM").toUpperCase() || "AM";
  const s = String(a?.subject || "").trim();
  return `${d}__${p}__${s}`;
}

export function parseColKey(colKey: string): { dateISO: string; period: string; subject: string } {
  const [dateISO = "", period = "AM", ...rest] = String(colKey || "").split("__");
  return {
    dateISO,
    period: String(period || "AM").toUpperCase() || "AM",
    subject: rest.join("__") || "",
  };
}

export function teacherColAssignments(list: any[], teacher: string, colKey: string, excludeUids: string[] = []) {
  const t = String(teacher || "").trim();
  const ex = new Set(excludeUids.filter(Boolean));
  return list.filter((a: any) => {
    if (!a) return false;
    if (ex.has(String(a.__uid || ""))) return false;
    if (String(a.teacherName || "").trim() !== t) return false;
    return colKeyOf(a) === colKey;
  });
}

export function validatePlacement(list: any[], teacher: string, colKey: string, incomingType: string, excludeUids: string[] = []) {
  const existing = teacherColAssignments(list, teacher, colKey, excludeUids);
  const t = String(incomingType || "");

  if (existing.length + 1 > MAX_TASKS_PER_COLUMN_PER_TEACHER) {
    return `❌ لا يمكن النقل: الحد الأقصى (${MAX_TASKS_PER_COLUMN_PER_TEACHER}) مهمتين في نفس العمود للمعلم.`;
  }

  if (isDraggableTaskType(t) && existing.some((x: any) => String(x?.taskType || "") === t)) {
    return "❌ لا يمكن النقل: المعلم الهدف لديه نفس نوع المهمة في نفس العمود.";
  }

  const existingTypes = new Set(existing.map((x: any) => String(x?.taskType || "")));
  if (conflictInvReserve(t, existingTypes)) {
    return "❌ لا يمكن النقل: ممنوع اجتماع (مراقبة + احتياط) لنفس المعلم داخل نفس العمود.";
  }

  return null;
}

export function teacherHasInvOrResInSameSlot(list: any[], teacher: string, dateISO: string, period: string, excludeUids: string[] = []) {
  const t = String(teacher || "").trim();
  const d = String(dateISO || "").trim();
  const p = String(period || "AM").toUpperCase();
  const ex = new Set(excludeUids.filter(Boolean));
  return list.some((a: any) => {
    if (!a) return false;
    if (ex.has(String(a.__uid || ""))) return false;
    if (String(a.teacherName || "").trim() !== t) return false;
    if (String(a.dateISO || "").trim() !== d) return false;
    if (String(a.period || "AM").toUpperCase() !== p) return false;
    const tt = String(a.taskType || "");
    return tt === "INVIGILATION" || tt === "RESERVE";
  });
}

export function getAssignmentsInCell(assignments: any[], teacherName: string, subColKey: string, normalizeSubject: (subject: string) => string) {
  const t = String(teacherName || "").trim();
  const key = String(subColKey || "").trim();

  return assignments.filter((a) => {
    const teacher = String((a as any).teacherName || "").trim();
    if (teacher !== t) return false;

    const dateISO = String((a as any).dateISO || "").trim();
    const period = String((a as any).period || "AM").toUpperCase() || "AM";
    const subject = normalizeSubject(String((a as any).subject || "").trim());
    const k = `${dateISO}__${period}__${subject}`;
    return k === key;
  });
}
