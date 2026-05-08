import { Assignment, Exam } from "../../../engine/assignmentEngine";

export type ResultsExamsLikeRow = {
  id: string;
  teacher: string;
  subject: string;
  date: string;
  day: string;
  time: string;
  period: string;
  duration: string;
  room: string;
  role: string;
};

export function buildResultsExamsLikeRows(args: {
  exams: Exam[];
  assignments: Assignment[];
  users: any[];
}): ResultsExamsLikeRow[] {
  const { exams, assignments, users } = args;

  const examById = new Map<string, Exam>();
  for (const e of exams || []) {
    if (e?.id) examById.set(String(e.id), e);
  }

  const userNameById = new Map<string, string>();
  for (const u of users || []) {
    if (u?.id) userNameById.set(String(u.id), String(u.name || u.fullName || u.label || ""));
  }

  const list: ResultsExamsLikeRow[] = (assignments || []).map((a) => {
    const ex = a?.examId ? examById.get(String(a.examId)) : undefined;
    return {
      id: String(a.examId || `${a.teacherId}-${a.examId}-${a.committeeNo}`),
      teacher: userNameById.get(String(a.teacherId)) || String(a.teacherId || ""),
      subject: ex?.subject || "—",
      date: ex?.date || "—",
      day: ex?.day || "—",
      time: ex?.time || "—",
      period: ex?.period || "—",
      duration: String(ex?.duration || "—"),
      room: String(a.committeeNo ?? "—"),
      role: String(a.role || "—"),
    };
  });

  list.sort((x, y) => {
    const d = String(x.date).localeCompare(String(y.date));
    if (d !== 0) return d;
    const t = String(x.time).localeCompare(String(y.time));
    if (t !== 0) return t;
    return String(x.teacher).localeCompare(String(y.teacher));
  });

  return list;
}
