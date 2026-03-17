export type FairnessRow = {
  teacherId: string;
  teacherName: string;
  inv: number;
  res: number;
  rev: number;
  cor: number;
  total: number;
};

export function buildFairnessRows(params: { teachers: any[]; assignments: any[] }): FairnessRow[] {
  const { teachers, assignments } = params;
  const currentTeachers = (teachers || []).map((t: any) => ({
    teacherId: String(t.id || "").trim(),
    teacherName: String(t.fullName || t.name || "").trim(),
  }));

  const map = new Map<string, FairnessRow>();
  for (const teacher of currentTeachers) {
    map.set(teacher.teacherId, {
      teacherId: teacher.teacherId,
      teacherName: teacher.teacherName,
      inv: 0,
      res: 0,
      rev: 0,
      cor: 0,
      total: 0,
    });
  }

  const seenReviewPerDay = new Set<string>();
  const seenCorrectionPerDay = new Set<string>();

  for (const assignment of assignments || []) {
    const teacherId = String(assignment?.teacherId || "").trim();
    if (!teacherId) continue;

    if (!map.has(teacherId)) {
      map.set(teacherId, {
        teacherId,
        teacherName: "",
        inv: 0,
        res: 0,
        rev: 0,
        cor: 0,
        total: 0,
      });
    }

    const row = map.get(teacherId)!;
    if (!row.teacherName) {
      const matchedTeacher = currentTeachers.find((x) => x.teacherId === teacherId);
      row.teacherName = matchedTeacher?.teacherName || String(assignment?.teacherName || teacherId);
    }

    const taskType = String(assignment?.taskType || "").trim();

    if (taskType === "INVIGILATION") row.inv += 1;
    if (taskType === "RESERVE") row.res += 1;

    if (taskType === "REVIEW_FREE") {
      const dateISO = String(assignment?.dateISO || assignment?.date || "").trim();
      const key = `${teacherId}__${dateISO}`;
      if (!seenReviewPerDay.has(key)) {
        seenReviewPerDay.add(key);
        row.rev += 1;
      }
    }

    if (taskType === "CORRECTION_FREE") {
      const dateISO = String(assignment?.dateISO || assignment?.date || "").trim();
      const key = `${teacherId}__${dateISO}`;
      if (!seenCorrectionPerDay.has(key)) {
        seenCorrectionPerDay.add(key);
        row.cor += 1;
      }
    }

    row.total = row.inv + row.res + row.rev;
  }

  return Array.from(map.values());
}
