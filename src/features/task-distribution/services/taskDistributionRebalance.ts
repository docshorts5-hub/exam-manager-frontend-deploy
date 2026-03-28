const TASK_TYPE_LABEL_AR: Record<string, string> = {
  INVIGILATION: "مراقبة",
  RESERVE: "احتياط",
  REVIEW_FREE: "مراجعة",
  CORRECTION_FREE: "تصحيح",
};

function buildTeacherSubjectsMapAll(teachers: any[]) {
  const map = new Map<string, Set<string>>();
  for (const t of teachers || []) {
    const id = String(t.id ?? "").trim();
    if (!id) continue;
    const subjects = new Set<string>();
    [t.subject1, t.subject2, t.subject3, t.subject4].forEach((s: any) => {
      const v = String(s ?? "").trim();
      if (v) subjects.add(v);
    });
    map.set(id, subjects);
  }
  return map;
}

function isQuotaTaskType(t: any) {
  return t === "INVIGILATION" || t === "RESERVE" || t === "REVIEW_FREE";
}

function buildTeacherMetaMaps(teachers: any[]) {
  const nameMap = new Map<string, string>();
  const subjectsMapAll = new Map<string, Set<string>>();

  for (const t of teachers || []) {
    const id = String(t.id ?? "").trim();
    if (!id) continue;

    nameMap.set(id, String(t.fullName || t.name || t.employeeNo || id).trim());

    const subs = new Set<string>();
    [t.subject1, t.subject2, t.subject3, t.subject4].forEach((s: any) => {
      const v = String(s ?? "").trim();
      if (v) subs.add(v);
    });
    subjectsMapAll.set(id, subs);
  }

  return { nameMap, subjectsMapAll };
}

function slotKeyOf(a: any) {
  const dateISO = String(a?.dateISO || a?.date || "").trim();
  const period = String(a?.period || "").trim();
  return `${dateISO}__${period}`;
}

function isTeacherReviewFreeFullDay(assigns: any[], teacherId: string, dateISO: string) {
  return assigns.some((a) => {
    if (String(a?.teacherId || "") !== teacherId) return false;
    if (String(a?.taskType || "") !== "REVIEW_FREE") return false;
    const d = String(a?.dateISO || a?.date || "").trim();
    return d === dateISO && !!a?.fullDay;
  });
}

function isTwoPeriodsAllowedOnDate(dateISO: string, constraints: any): boolean {
  if (!constraints?.allowTwoPeriodsSameDay) return false;
  if (constraints?.allowTwoPeriodsSameDayAllDates) return true;
  const dates: string[] = Array.isArray(constraints?.allowTwoPeriodsSameDayDates)
    ? constraints.allowTwoPeriodsSameDayDates.map((x: any) => String(x || "").trim()).filter(Boolean)
    : [];
  return dates.includes(String(dateISO || "").trim());
}

function canTakeAssignment(params: {
  teacherId: string;
  a: any;
  constraints: any;
  teacherSubjectsMapAll: Map<string, Set<string>>;
  teacherSlotSet: Map<string, Set<string>>;
  teacherQuotaTotals: Map<string, number>;
  assignsAll: any[];
}) {
  const { teacherId, a, constraints, teacherSubjectsMapAll, teacherSlotSet, teacherQuotaTotals, assignsAll } = params;

  const maxTasks = Number(constraints?.maxTasksPerTeacher ?? 10) || 10;
  const currentQuota = teacherQuotaTotals.get(teacherId) || 0;
  if (currentQuota >= maxTasks) return false;

  const dateISO = String(a?.dateISO || a?.date || "").trim();
  if (dateISO && isTeacherReviewFreeFullDay(assignsAll, teacherId, dateISO)) return false;

  const sk = slotKeyOf(a);
  if (!sk || sk.startsWith("__")) return false;

  const slots = teacherSlotSet.get(teacherId) || new Set<string>();
  if (slots.has(sk)) return false;

  const smartBySpecialty = !!constraints?.smartBySpecialty;
  const type = String(a?.taskType || "").trim();

  if (smartBySpecialty && type === "INVIGILATION") {
    const subj = String(a?.subject || "").trim();
    if (subj) {
      const subs = teacherSubjectsMapAll.get(teacherId);
      if (subs && subs.has(subj)) return false;
    }
  }

  if (dateISO) {
    const allowed = isTwoPeriodsAllowedOnDate(dateISO, constraints);
    const existing = Array.from(slots).some((x) => x.startsWith(`${dateISO}__`));
    if (existing && !allowed) return false;
  }

  return true;
}

export function rebalanceReserveToCoverInvigilations(out: any, latestTeachers: any[], constraints: any) {
  const debug = out?.debug;
  const assigns: any[] = Array.isArray(out?.assignments) ? out.assignments : [];
  const unfilled: any[] = Array.isArray(debug?.unfilled) ? debug.unfilled : [];
  if (!assigns.length || !unfilled.length) return out;

  const teacherSubjectsMapAll = buildTeacherSubjectsMapAll(latestTeachers);
  const smartBySpecialty = !!constraints?.smartBySpecialty;

  function canConvert(teacherId: string, examSubject: string) {
    if (!smartBySpecialty) return true;
    const subs = teacherSubjectsMapAll.get(teacherId);
    if (!subs) return true;
    return !subs.has(String(examSubject || "").trim());
  }

  const invShortages = unfilled.filter((u) => u?.kind === "INVIGILATION" && Number(u?.required || 0) > Number(u?.assigned || 0));
  if (!invShortages.length) return out;

  const usedReserveIdx = new Set<number>();

  for (const u of invShortages) {
    const dateISO = String(u?.dateISO || "").trim();
    const period = String(u?.period || "").trim();
    const subject = String(u?.subject || "").trim();

    let need = Number(u.required || 0) - Number(u.assigned || 0);
    if (!dateISO || !period || need <= 0) continue;

    const reserveCandidates = assigns
      .map((a, idx) => ({ a, idx }))
      .filter(({ a, idx }) => {
        if (usedReserveIdx.has(idx)) return false;
        if (String(a?.taskType || "") !== "RESERVE") return false;
        const aDate = String(a?.dateISO || a?.date || "").trim();
        const aPeriod = String(a?.period || "").trim();
        return aDate === dateISO && aPeriod === period;
      });

    for (const { a, idx } of reserveCandidates) {
      if (need <= 0) break;

      const teacherId = String(a?.teacherId || "").trim();
      if (!teacherId) continue;
      if (subject && !canConvert(teacherId, subject)) continue;

      a.taskType = "INVIGILATION";
      a.taskTypeLabelAr = TASK_TYPE_LABEL_AR["INVIGILATION"];
      if (!a.subject && subject) a.subject = subject;
      a.__convertedFromReserve = true;

      usedReserveIdx.add(idx);
      need -= 1;

      if (debug?.summary) {
        if (typeof debug.summary.invAssigned === "number") debug.summary.invAssigned += 1;
        if (typeof debug.summary.reserveAssigned === "number") debug.summary.reserveAssigned -= 1;
      }
      u.assigned = Number(u.assigned || 0) + 1;
    }
  }

  return out;
}

export function rebalanceFairDistribution(out: any, latestTeachers: any[], constraints: any) {
  const assigns: any[] = Array.isArray(out?.assignments) ? out.assignments : [];
  if (!assigns.length) return out;

  const { nameMap, subjectsMapAll } = buildTeacherMetaMaps(latestTeachers);
  const teacherQuotaTotals = new Map<string, number>();
  const teacherSlotSet = new Map<string, Set<string>>();

  function bumpQuota(teacherId: string, delta: number) {
    teacherQuotaTotals.set(teacherId, (teacherQuotaTotals.get(teacherId) || 0) + delta);
  }
  function addSlot(teacherId: string, sk: string) {
    const set = teacherSlotSet.get(teacherId) || new Set<string>();
    set.add(sk);
    teacherSlotSet.set(teacherId, set);
  }
  function removeSlot(teacherId: string, sk: string) {
    const set = teacherSlotSet.get(teacherId);
    if (set) set.delete(sk);
  }

  for (const t of latestTeachers || []) {
    const id = String(t.id ?? "").trim();
    if (id) {
      teacherQuotaTotals.set(id, 0);
      teacherSlotSet.set(id, new Set<string>());
    }
  }

  for (const a of assigns) {
    const teacherId = String(a?.teacherId || "").trim();
    if (!teacherId) continue;
    const sk = slotKeyOf(a);
    if (sk && !sk.startsWith("__")) addSlot(teacherId, sk);
    const tt = String(a?.taskType || "").trim();
    if (isQuotaTaskType(tt)) bumpQuota(teacherId, 1);
  }

  const teacherIds = Array.from(teacherQuotaTotals.keys());
  if (teacherIds.length <= 1) return out;

  const movable = assigns
    .map((a) => ({ a }))
    .filter(({ a }) => {
      const tt = String(a?.taskType || "").trim();
      return tt === "INVIGILATION" || tt === "RESERVE";
    });

  if (!movable.length) return out;

  const MAX_SWAPS = Math.min(800, movable.length * 2);
  let swaps = 0;

  const sortedTeachers = () =>
    teacherIds
      .map((id) => ({ id, total: teacherQuotaTotals.get(id) || 0 }))
      .sort((a, b) => a.total - b.total);

  while (swaps < MAX_SWAPS) {
    const sorted = sortedTeachers();
    const low = sorted[0];
    const high = sorted[sorted.length - 1];
    if (!low || !high) break;
    if (high.total - low.total <= 1) break;

    const lowId = low.id;
    const highId = high.id;
    let moved = false;

    for (const { a } of movable) {
      const curTeacherId = String(a?.teacherId || "").trim();
      if (curTeacherId !== highId) continue;

      if (
        canTakeAssignment({
          teacherId: lowId,
          a,
          constraints,
          teacherSubjectsMapAll: subjectsMapAll,
          teacherSlotSet,
          teacherQuotaTotals,
          assignsAll: assigns,
        })
      ) {
        const sk = slotKeyOf(a);
        if (sk) removeSlot(highId, sk);
        a.teacherId = lowId;
        a.teacherName = nameMap.get(lowId) || a.teacherName || lowId;
        if (sk) addSlot(lowId, sk);
        bumpQuota(highId, -1);
        bumpQuota(lowId, +1);
        swaps += 1;
        moved = true;
        break;
      }
    }

    if (!moved) break;
  }

  if (swaps > 0) {
    out.warnings = Array.isArray(out.warnings) ? out.warnings : [];
    out.warnings.unshift(`✅ تم تحسين التوازن: إعادة توزيع ${swaps} مهمة لتحقيق عدالة أكبر.`);
  }

  return out;
}

export function rebalanceInvigilationsToEqualize(out: any, latestTeachers: any[], constraints: any) {
  const assigns: any[] = Array.isArray(out?.assignments) ? out.assignments : [];
  if (!assigns.length) return out;

  const { subjectsMapAll, nameMap } = buildTeacherMetaMaps(latestTeachers);
  const invCount = new Map<string, number>();
  const slotSet = new Map<string, Set<string>>();

  for (const a of assigns) {
    const teacherId = String(a?.teacherId || "").trim();
    if (!teacherId) continue;
    if (!slotSet.has(teacherId)) slotSet.set(teacherId, new Set<string>());
    slotSet.get(teacherId)!.add(slotKeyOf(a));
    if (!invCount.has(teacherId)) invCount.set(teacherId, 0);
    if (String(a?.taskType || "") === "INVIGILATION") {
      invCount.set(teacherId, (invCount.get(teacherId) || 0) + 1);
    }
  }

  const teacherIds = Array.from(invCount.keys());
  if (teacherIds.length <= 1) return out;

  const movableInv = assigns.map((a) => ({ a })).filter(({ a }) => String(a?.taskType || "") === "INVIGILATION");
  if (!movableInv.length) return out;

  const smartBySpecialty = !!constraints?.smartBySpecialty;

  function currentQuotaOf(teacherId: string) {
    return assigns.filter((x) => String(x.teacherId) === teacherId && isQuotaTaskType(x.taskType)).length;
  }

  function canReceive(teacherId: string, a: any) {
    const dateISO = String(a?.dateISO || a?.date || "").trim();
    const period = String(a?.period || "").trim();
    const subj = String(a?.subject || "").trim();

    if (dateISO && isTeacherReviewFreeFullDay(assigns, teacherId, dateISO)) return false;

    const sk = `${dateISO}__${period}`;
    const slots = slotSet.get(teacherId) || new Set<string>();
    if (slots.has(sk)) return false;

    if (dateISO) {
      const allowed = isTwoPeriodsAllowedOnDate(dateISO, constraints);
      const hasAnySameDay = Array.from(slots).some((x) => x.startsWith(`${dateISO}__`));
      if (hasAnySameDay && !allowed) return false;
    }

    if (smartBySpecialty && subj) {
      const subs = subjectsMapAll.get(teacherId);
      if (subs && subs.has(subj)) return false;
    }

    const maxTasks = Number(constraints?.maxTasksPerTeacher ?? 10) || 10;
    if (currentQuotaOf(teacherId) >= maxTasks) return false;

    return true;
  }

  const sortTeachersByInv = () =>
    teacherIds.map((id) => ({ id, inv: invCount.get(id) || 0 })).sort((a, b) => a.inv - b.inv);

  const MAX_MOVES = Math.min(1200, movableInv.length * 3);
  let moves = 0;

  while (moves < MAX_MOVES) {
    const sorted = sortTeachersByInv();
    const low = sorted[0];
    const high = sorted[sorted.length - 1];
    if (!low || !high) break;
    if (high.inv - low.inv <= 0) break;

    let moved = false;

    for (const { a } of movableInv) {
      const fromId = String(a?.teacherId || "").trim();
      if (fromId !== high.id) continue;

      if (canReceive(low.id, a)) {
        const dateISO = String(a?.dateISO || a?.date || "").trim();
        const period = String(a?.period || "").trim();
        const sk = `${dateISO}__${period}`;

        slotSet.get(fromId)?.delete(sk);
        if (!slotSet.has(low.id)) slotSet.set(low.id, new Set<string>());
        slotSet.get(low.id)!.add(sk);

        a.teacherId = low.id;
        a.teacherName = nameMap.get(low.id) || a.teacherName || low.id;

        invCount.set(high.id, (invCount.get(high.id) || 0) - 1);
        invCount.set(low.id, (invCount.get(low.id) || 0) + 1);

        moves++;
        moved = true;
        break;
      }
    }

    if (!moved) break;
  }

  out.warnings = Array.isArray(out.warnings) ? out.warnings : [];
  if (moves > 0) {
    out.warnings.unshift(`✅ تم تحسين مساواة المراقبة: تم نقل ${moves} مهمة مراقبة بين الكادر التعليمي.`);
  } else {
    out.warnings.unshift("⚠️ لم يمكن مساواة المراقبة بالكامل بسبب القيود/التعارضات الحالية.");
  }

  return out;
}
