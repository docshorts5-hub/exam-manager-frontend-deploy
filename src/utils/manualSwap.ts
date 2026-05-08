
// @ts-nocheck
// src/utils/manualSwap.ts
import type { Assignment, AssignmentType, Constraints, FairnessRow } from "./distributionEngine";

function canAllowTwoPeriods(date: string, c: Constraints): boolean {
  if (c.allowTwoPeriodsDates === "ALL") return c.allowTwoPeriodsSameDay;
  if (!c.allowTwoPeriodsSameDay) return false;
  return c.allowTwoPeriodsDates.includes(date);
}

function includesBen(name: string): boolean {
  return name.includes("بن");
}

function computeLastDays(assignments: Assignment[]): { lastDay: string | null; lastTwo: Set<string> } {
  const dates = Array.from(new Set(assignments.map(a => a.date).filter(Boolean))).sort();
  if (dates.length === 0) return { lastDay: null, lastTwo: new Set() };
  const lastDay = dates[dates.length - 1];
  const lastTwo = new Set<string>();
  lastTwo.add(lastDay);
  if (dates.length >= 2) lastTwo.add(dates[dates.length - 2]);
  return { lastDay, lastTwo };
}

export function computeFairnessFromAssignments(assignments: Assignment[]): FairnessRow[] {
  const m = new Map<string, FairnessRow>();
  for (const a of assignments) {
    if (!a.teacherId) continue;
    const key = a.teacherId;
    const row =
      m.get(key) ??
      ({
        teacherId: a.teacherId,
        teacherName: a.teacherName,
        مراقبة: 0,
        احتياط: 0,
        مراجعة: 0,
        تصحيح: 0,
        الإجمالي: 0,
      } as FairnessRow);

    const t = (a.type ?? "فارغ") as AssignmentType;
    if (t === "مراقبة") row.مراقبة += 1;
    else if (t === "احتياط") row.احتياط += 1;
    else if (t === "فاضي للمراجعة") row.مراجعة += 1;
    else if (t === "فاضي للتصحيح") row.تصحيح += 1;

    row.الإجمالي += 1;
    m.set(key, row);
  }
  const out = Array.from(m.values());
  out.sort((a, b) => a.teacherName.localeCompare(b.teacherName, "ar"));
  return out;
}

export type SwapIssue = { ok: true } | { ok: false; message: string };

type ValidateOptions = {
  /**
   * عند التحرير اليدوي نحتاج السماح بوجود مقاعد/خانات فارغة مؤقتاً.
   * يتم إظهارها كملاحظة داخل الواجهة.
   */
  allowEmptySlots?: boolean;
};

function validateGlobal(assignments: Assignment[], constraints: Constraints, opts: ValidateOptions = {}): SwapIssue {
  const allowEmpty = !!opts.allowEmptySlots;
  const { lastDay, lastTwo } = computeLastDays(assignments);

  // Per teacher aggregates
  const byTeacher = new Map<string, Assignment[]>();
  for (const a of assignments) {
    if (!a.teacherId) continue;
    const arr = byTeacher.get(a.teacherId) ?? [];
    arr.push(a);
    byTeacher.set(a.teacherId, arr);
  }

  for (const [teacherId, arr] of byTeacher.entries()) {
    // max tasks
    if (arr.length > constraints.maxTasksPerTeacher) {
      return { ok: false, message: `تجاوز النصاب: المعلم (${arr[0]?.teacherName ?? teacherId}) لديه ${arr.length} مهام (الحد ${constraints.maxTasksPerTeacher}).` };
    }

    // blocked days by review/correction
    const blockedReview = new Set(arr.filter(x => x.type === "فاضي للمراجعة").map(x => x.date));
    const blockedCorr = new Set(arr.filter(x => x.type === "فاضي للتصحيح").map(x => x.date));

    for (const d of blockedReview) {
      const others = arr.filter(x => x.date === d && x.type !== "فاضي للمراجعة");
      if (others.length > 0) return { ok: false, message: `مخالفة: المعلم (${arr[0]?.teacherName}) فاضي للمراجعة بتاريخ ${d} ولا يجوز تكليفه بمهام أخرى في نفس اليوم.` };
    }
    for (const d of blockedCorr) {
      const others = arr.filter(x => x.date === d && x.type !== "فاضي للتصحيح");
      if (others.length > 0) return { ok: false, message: `مخالفة: المعلم (${arr[0]?.teacherName}) فاضي للتصحيح بتاريخ ${d} ولا يجوز تكليفه بمهام أخرى في نفس اليوم.` };
    }

    // one task per day unless allow two periods
    const byDate = new Map<string, Assignment[]>();
    for (const a of arr) {
      const list = byDate.get(a.date) ?? [];
      list.push(a);
      byDate.set(a.date, list);
    }
    for (const [date, list] of byDate.entries()) {
      if (list.length <= 1) continue;
      if (!canAllowTwoPeriods(date, constraints)) {
        return { ok: false, message: `مخالفة: المعلم (${arr[0]?.teacherName}) لديه أكثر من مهمة في يوم ${date}.` };
      }
      // even when allowed, لا نسمح بأكثر من فترتين
      const periods = new Set(list.map(x => x.period));
      if (periods.size < list.length && list.length > 2) {
        return { ok: false, message: `مخالفة: المعلم (${arr[0]?.teacherName}) لديه أكثر من فترتين في يوم ${date}.` };
      }
      if (list.length > 2) {
        return { ok: false, message: `مخالفة: المعلم (${arr[0]?.teacherName}) لديه ${list.length} مهام في يوم ${date} (المسموح حد أقصى مهمتين).` };
      }
    }

    // long monitor rule (>= 180)
    const longMonitors = arr.filter(a => a.type === "مراقبة" && (a.durationMin ?? 0) >= 180);
    if (longMonitors.length > 1) {
      return { ok: false, message: `مخالفة: المعلم (${arr[0]?.teacherName}) تم تكليفه بمراقبة 3 ساعات أكثر من مرة.` };
    }

    // 13/14 name rules on monitor
    const name = arr[0]?.teacherName ?? "";
    const has13 = name.includes("13");
    const has14 = name.includes("14");
    if (lastDay) {
      if (has13) {
        const bad = arr.some(a => a.type === "مراقبة" && a.date === lastDay);
        if (bad) return { ok: false, message: `مخالفة: المعلم (${name}) يحتوي على "13" ولا يسمح له بالمراقبة في آخر يوم (${lastDay}).` };
      }
      if (has14) {
        const bad = arr.some(a => a.type === "مراقبة" && lastTwo.has(a.date));
        if (bad) return { ok: false, message: `مخالفة: المعلم (${name}) يحتوي على "14" ولا يسمح له بالمراقبة في آخر يومين.` };
      }
    }
  }

  // Pairing rules by room for monitor assignments
  const byRoom = new Map<string, Assignment[]>();
  for (const a of assignments) {
    if (a.type !== "مراقبة") continue;
    const key = `${a.examId}|${a.date}|${a.period}|${a.roomIndex ?? -1}`;
    const list = byRoom.get(key) ?? [];
    list.push(a);
    byRoom.set(key, list);
  }
  for (const [key, list] of byRoom.entries()) {
    // ignore if no roomIndex (older data)
    const roomIndex = list[0]?.roomIndex;
    if (roomIndex === undefined || roomIndex === null || roomIndex < 0) continue;

    // seats count
    const seats = list
      .slice()
      .sort((a, b) => (a.withinRoomIndex ?? 0) - (b.withinRoomIndex ?? 0));

    // في وضع التحرير اليدوي نسمح بمقاعد فارغة مؤقتاً ولا نكسر قاعدة "بن" حتى يكتمل الإسناد.
    if (allowEmpty) {
      const anyEmpty = seats.some(s => !s.teacherId || !String(s.teacherName ?? "").trim());
      if (anyEmpty) continue;
    }

    // في وضع السماح بالمقاعد الفارغة: نتجاوز قواعد "بن" إذا كان هناك مقعد غير مُعيّن.
    const hasEmpty = seats.some(s => !s.teacherId);
    if (hasEmpty && opts.allowEmptySlots) continue;

    if (seats.length === 1) {
      const n = seats[0]?.teacherName ?? "";
      if (!includesBen(n)) return { ok: false, message: `مخالفة قاعدة "بن": القاعة (${roomIndex + 1}) مراقب واحد ويجب أن يحتوي الاسم على "بن".` };
    } else if (seats.length >= 2) {
      const aName = seats[0]?.teacherName ?? "";
      const bName = seats[1]?.teacherName ?? "";
      const aBen = includesBen(aName);
      const bBen = includesBen(bName);
      if (!aBen && !bBen) return { ok: false, message: `مخالفة قاعدة "بن": القاعة (${roomIndex + 1}) مراقبان ولا يجوز أن يكونا كلاهما بدون "بن".` };
    }
  }

  return { ok: true };
}

export function validateManualSwap(args: {
  assignments: Assignment[];
  sourceIndex: number;
  targetIndex: number;
  constraints: Constraints;
}): SwapIssue {
  const { assignments, sourceIndex, targetIndex, constraints } = args;
  if (sourceIndex === targetIndex) return { ok: true };
  const a = assignments[sourceIndex];
  const b = assignments[targetIndex];
  if (!a || !b) return { ok: false, message: "عناصر غير صحيحة." };

  const allowed = (t?: AssignmentType) => t === "مراقبة" || t === "احتياط";
  if (!allowed(a.type) || !allowed(b.type)) {
    return { ok: false, message: "السحب والإفلات متاح فقط لتبديل (مراقبة/احتياط) حالياً." };
  }
  // Swap should keep slot metadata; just swap teachers.
  const next = assignments.map((x, i) => {
    if (i === sourceIndex) return { ...x, teacherId: b.teacherId, teacherName: b.teacherName };
    if (i === targetIndex) return { ...x, teacherId: a.teacherId, teacherName: a.teacherName };
    return x;
  });

  return validateGlobal(next, constraints, { allowEmptySlots: true });
}

export function applyManualSwap(assignments: Assignment[], sourceIndex: number, targetIndex: number): Assignment[] {
  const a = assignments[sourceIndex];
  const b = assignments[targetIndex];
  if (!a || !b || sourceIndex === targetIndex) return assignments;
  return assignments.map((x, i) => {
    if (i === sourceIndex) return { ...x, teacherId: b.teacherId, teacherName: b.teacherName };
    if (i === targetIndex) return { ...x, teacherId: a.teacherId, teacherName: a.teacherName };
    return x;
  });
}

export function validateAssignTeacherToSlot(args: {
  assignments: Assignment[];
  slotIndex: number;
  teacherId: string;
  teacherName: string;
  constraints: Constraints;
}): SwapIssue {
  const { assignments, slotIndex, teacherId, teacherName, constraints } = args;
  const slot = assignments[slotIndex];
  if (!slot) return { ok: false, message: "عنصر غير صحيح." };
  const allowed = (t?: AssignmentType) => t === "مراقبة" || t === "احتياط";
  if (!allowed(slot.type)) return { ok: false, message: "الإسناد اليدوي متاح فقط لـ (مراقبة/احتياط)." };

  const next = assignments.map((x, i) => (i === slotIndex ? { ...x, teacherId, teacherName } : x));
  return validateGlobal(next, constraints, { allowEmptySlots: true });
}

export function applyAssignTeacherToSlot(assignments: Assignment[], slotIndex: number, teacherId: string, teacherName: string): Assignment[] {
  const slot = assignments[slotIndex];
  if (!slot) return assignments;
  return assignments.map((x, i) => (i === slotIndex ? { ...x, teacherId, teacherName } : x));
}

export function clearSlot(assignments: Assignment[], slotIndex: number): Assignment[] {
  const slot = assignments[slotIndex];
  if (!slot) return assignments;
  return assignments.map((x, i) => (i === slotIndex ? { ...x, teacherId: "", teacherName: "" } : x));
}

export function addEmptySlot(assignments: Assignment[], basedOnIndex: number): Assignment[] {
  const base = assignments[basedOnIndex];
  if (!base) return assignments;
  // ننشئ Slot فارغ مطابق (للسماح بالنقل لمكان فارغ)
  const extra: Assignment = {
    ...base,
    id: `${base.id || `${base.examId}-${base.date}-${base.period}`}-manual-${Date.now()}`,
    teacherId: "",
    teacherName: "",
    // علامة لمقاعد يدوية إضافية
    manualExtra: true as any,
    // إن كانت مراقبة داخل قاعة، نعطي مقعد جديد (أكبر ضمن القاعة)
    withinRoomIndex:
      base.type === "مراقبة" && base.roomIndex != null
        ? 1 +
          Math.max(
            -1,
            ...assignments
              .filter(a => a.type === "مراقبة" && a.examId === base.examId && a.date === base.date && a.period === base.period && a.roomIndex === base.roomIndex)
              .map(a => a.withinRoomIndex ?? -1)
          )
        : base.withinRoomIndex,
  } as any;
  return [...assignments, extra];
}

export function removeManualExtraSlot(assignments: Assignment[], slotIndex: number): Assignment[] {
  const slot = assignments[slotIndex] as any;
  if (!slot) return assignments;
  if (!slot.manualExtra) return assignments;
  return assignments.filter((_, i) => i !== slotIndex);
}

export function validateAssignmentsForSave(assignments: Assignment[], constraints: Constraints): SwapIssue {
  // عند الحفظ النهائي نمنع المقاعد الفارغة
  return validateGlobal(assignments, constraints, { allowEmptySlots: false });
}

export function validateAssignToSlot(args: {
  assignments: Assignment[];
  slotIndex: number;
  teacherId: string;
  teacherName: string;
  constraints: Constraints;
}): SwapIssue {
  const { assignments, slotIndex, teacherId, teacherName, constraints } = args;
  const slot = assignments[slotIndex];
  if (!slot) return { ok: false, message: "عنصر الهدف غير صحيح." };
  const allowed = (t?: AssignmentType) => t === "مراقبة" || t === "احتياط";
  if (!allowed(slot.type)) return { ok: false, message: "يمكن التعيين يدويًا فقط في (مراقبة/احتياط)." };

  const next = assignments.map((x, i) => {
    if (i !== slotIndex) return x;
    return { ...x, teacherId, teacherName };
  });
  return validateGlobal(next, constraints, { allowEmptySlots: true });
}

export function applyAssignToSlot(assignments: Assignment[], slotIndex: number, teacherId: string, teacherName: string): Assignment[] {
  const slot = assignments[slotIndex];
  if (!slot) return assignments;
  return assignments.map((x, i) => (i === slotIndex ? { ...x, teacherId, teacherName } : x));
}


export function addEmptySlotLike(assignments: Assignment[], likeIndex: number): Assignment[] {
  const like = assignments[likeIndex];
  if (!like) return assignments;
  const copy: Assignment = {
    ...like,
    id: `${like.id || like.examId || "slot"}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    teacherId: "",
    teacherName: "",
    // علامة داخلية حتى نستطيع حذفها لاحقاً
    manualExtra: true as any,
  };
  // لو مراقبة وبها roomIndex/withinRoomIndex: نضيف مقعد جديد بنفس القاعة بأكبر withinRoomIndex+1
  if (copy.type === "مراقبة" && copy.roomIndex != null) {
    const sameRoom = assignments.filter(
      (a) => a.type === "مراقبة" && a.examId === copy.examId && a.date === copy.date && a.period === copy.period && a.roomIndex === copy.roomIndex
    );
    const maxSeat = Math.max(-1, ...sameRoom.map((a) => a.withinRoomIndex ?? -1));
    copy.withinRoomIndex = maxSeat + 1;
  }
  return [...assignments, copy];
}


export function validateAssignmentsForEditing(assignments: Assignment[], constraints: Constraints): SwapIssue {
  return validateGlobal(assignments, constraints, { allowEmptySlots: true });
}
