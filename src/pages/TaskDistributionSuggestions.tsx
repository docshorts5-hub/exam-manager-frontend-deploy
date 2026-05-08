// src/pages/TaskDistributionSuggestions.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { loadRun, saveRun } from "../utils/taskDistributionStorage";

/**
 * ✅ صفحة الاقتراحات:
 * - اقتراحات نقل التفريغ للتصحيح عند وجود عجز مراقبة في ذلك اليوم
 * - اقتراحات لسد عجز المراقبة (تعديلات قيود) مع تطبيق مباشر عبر Auto-Run
 */

const CONSTRAINTS_KEY = "exam-manager:task-distribution:constraints:v2";
const AUTORUN_KEY = "exam-manager:task-distribution:autorun:v1";

function readJson<T = any>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function getEffectiveTenantId(userTenantId: string | null | undefined) {
  return (userTenantId && String(userTenantId).trim()) || "default";
}

type CorrectionShiftSuggestion = {
  teacherId: string;
  teacherName: string;
  originalDateISO: string;
  appliedDateISO: string | null;
  suggestedDates: string[];
  reason: "INV_SHORTAGE" | "NO_AVAILABLE";
};

export default function TaskDistributionSuggestions() {
  const nav = useNavigate();
  const { user } = useAuth();
  const tenantId = getEffectiveTenantId(user?.tenantId);

  const runOut = loadRun(tenantId) as any;

  const constraints = readJson<any>(CONSTRAINTS_KEY) || {};

  const debug = runOut?.debug || {};
  const summary = debug?.summary || {};
  const unfilled: any[] = Array.isArray(debug?.unfilled) ? debug.unfilled : [];

  const correctionShiftSuggestions: CorrectionShiftSuggestion[] = Array.isArray(debug?.correctionShiftSuggestions)
    ? debug.correctionShiftSuggestions
    : [];

  const invShortages = useMemo(() => {
    const rows = unfilled.filter((u) => String(u?.kind || "") === "INVIGILATION" && Number(u?.required || 0) > Number(u?.assigned || 0));
    // group by date
    const map = new Map<string, any[]>();
    for (const r of rows) {
      const d = String(r?.dateISO || "").trim();
      if (!d) continue;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(r);
    }
    return Array.from(map.entries()).map(([dateISO, items]) => ({ dateISO, items }));
  }, [unfilled]);

  
  // =========================
  // ✅ اقتراحات بأسماء معلمين لسد عجز المراقبة
  // =========================
  const TEACHERS_KEY = "exam-manager:teachers:v1";
  const EXAMS_KEY = "exam-manager:exams:v1";

  const teachersFromLS: any[] = Array.isArray(readJson(TEACHERS_KEY)) ? (readJson(TEACHERS_KEY) as any[]) : [];
  const examsFromLS: any[] = Array.isArray(readJson(EXAMS_KEY)) ? (readJson(EXAMS_KEY) as any[]) : [];

  function periodToAMPM(p: string): "AM" | "PM" {
    const x = String(p || "").trim();
    if (!x) return "AM";
    if (x === "AM" || x === "PM") return x;
    if (x.includes("الثانية")) return "PM";
    if (x.includes("الأولى")) return "AM";
    return "AM";
  }

  
  // =========================
  // ✅ Helpers: منع مراقبة نفس المادة في الاقتراحات (باستخدام مجموعات المواد)
  // =========================
  function normSubj(s: string) {
    return String(s || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function getCorrectionGroupKey(subject: string) {
    const s = normSubj(subject);

    if (s.includes("رياضيات") || s.includes("الرياضيات")) return "MATH";
    if (s.includes("التربية الإسلامية") || s.includes("اسلامية") || s.includes("إسلامية")) return "ISLAMIC";
    if (s.includes("اللغة العربية") || s === "عربي" || s.includes("عربية")) return "ARABIC";
    if (s.includes("اللغة الإنجليزية") || s.includes("انجليزي") || s.includes("إنجليزي") || s.includes("english")) return "ENGLISH";
    if (s.includes("فيزياء")) return "PHYSICS";
    if (s.includes("كيمياء")) return "CHEMISTRY";
    if (s.includes("احياء") || s.includes("أحياء")) return "BIOLOGY";
    if (s.includes("العلوم") || s.includes("البيئة")) return "SCI_ENV";
    if (s.includes("رياضة") || s.includes("الرياضة")) return "SPORTS";
    if (s.includes("فنون") || s.includes("الفنون")) return "ART";
    if (s.includes("موسيقى") || s.includes("المهارات الموسيقية")) return "MUSIC";
    if (s.includes("اجتماعية") || s.includes("التاريخ") || s.includes("الجغرافيا") || s.includes("هذا وطني")) return "SOCIAL";
    if (s.includes("تقنية المعلومات") || s.includes("حاسوب") || s.includes("كمبيوتر") || s.includes("it")) return "IT";

    return `SUBJECT:${s}`;
  }

  // teacherId -> Set(groups)
  const teacherGroupsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const t of teachersFromLS || []) {
      const tid = String(t.id ?? "").trim();
      if (!tid) continue;
      const set = new Set<string>();
      [t.subject1, t.subject2, t.subject3, t.subject4]
        .map((x: any) => String(x ?? "").trim())
        .filter(Boolean)
        .forEach((subj) => set.add(getCorrectionGroupKey(subj)));
      map.set(tid, set);
    }
    return map;
  }, [teachersFromLS]);

  function isTeacherSameSubjectAsExam(teacherId: string, examSubject: string) {
    const groups = teacherGroupsMap.get(String(teacherId || "").trim());
    if (!groups || groups.size === 0) return false;
    const eg = getCorrectionGroupKey(examSubject);
    return groups.has(eg);
  }

function canAllowTwo(dateISO: string) {
    if (!constraints.allowTwoPeriodsSameDay) return false;
    if (constraints.allowTwoPeriodsSameDayAllDates) return true;
    const arr: string[] = Array.isArray(constraints.allowTwoPeriodsSameDayDates) ? constraints.allowTwoPeriodsSameDayDates : [];
    return arr.includes(dateISO);
  }

  function guessInvigilatorsPerRoomBySubject(subject: string): number {
    const s = String(subject || "");
    if (/\b11\b/.test(s) || s.includes("11")) return Number(constraints.invigilators_11 || 2) || 2;
    if (/\b10\b/.test(s) || s.includes("10")) return Number(constraints.invigilators_5_10 || 2) || 2;
    return Number(constraints.invigilators_12 || 2) || 2;
  }

  function quotaCountForTeacher(assignments: any[], teacherId: string) {
    let c = 0;
    const seenReview = new Set<string>();
    for (const a of assignments) {
      if (String(a.teacherId) !== teacherId) continue;
      const t = String(a.taskType || "");
      if (t === "INVIGILATION" || t === "RESERVE") c++;
      if (t === "REVIEW_FREE") {
        const d = String(a.dateISO || a.date || "");
        const k = `${teacherId}__${d}`;
        if (!seenReview.has(k)) { seenReview.add(k); c++; }
      }
    }
    return c;
  }

  function teacherHasAnyInDay(assignments: any[], teacherId: string, dateISO: string) {
    return assignments.some((a) => String(a.teacherId) === teacherId && String(a.dateISO || a.date || "") === dateISO);
  }

  function teacherHasSlot(assignments: any[], teacherId: string, dateISO: string, period: "AM" | "PM") {
    return assignments.some((a) => String(a.teacherId) === teacherId && String(a.dateISO || a.date || "") === dateISO && String(a.period) === period);
  }

  function computeNextCommitteeInfo(assignments: any[], dateISO: string, period: "AM" | "PM", subject: string) {
    const exam = examsFromLS.find((e: any) => {
      const d = String(e.dateISO ?? e.date ?? "").trim();
      const p = periodToAMPM(String(e.period || ""));
      const sub = String(e.subject || "").trim();
      return d === dateISO && p === period && sub === String(subject || "").trim();
    });

    const roomsCount = Number(exam?.roomsCount ?? 0) || 0;
    const invPerRoom = guessInvigilatorsPerRoomBySubject(subject);
    const totalNeeded = Math.max(1, roomsCount * invPerRoom);

    const existingInv = assignments.filter((a) => String(a.taskType) === "INVIGILATION" && String(a.dateISO || a.date || "") === dateISO && String(a.period) === period);
    const nextIndex = Math.min(totalNeeded, existingInv.length + 1);
    const committeeNo = Math.ceil(nextIndex / invPerRoom);
    const invigilatorIndex = ((nextIndex - 1) % invPerRoom) + 1;

    return { committeeNo, invigilatorIndex };
  }

  function applyCoverSuggestion(params: { dateISO: string; period: "AM" | "PM"; subject: string; teacherId: string; mode: "CONVERT_RESERVE" | "ADD_NEW" }) {
    const out = loadRun(tenantId) as any;
    if (!out) return;

    const assigns: any[] = Array.isArray(out.assignments) ? out.assignments : [];
    const debug = out.debug || {};
    const summary = debug.summary || {};
    const unfilled: any[] = Array.isArray(debug.unfilled) ? debug.unfilled : [];

    const teacher = teachersFromLS.find((t: any) => String(t.id) === params.teacherId);
    const teacherName = String(teacher?.fullName || teacher?.name || teacher?.employeeNo || params.teacherId).trim();

    const { committeeNo, invigilatorIndex } = computeNextCommitteeInfo(assigns, params.dateISO, params.period, params.subject);

    if (params.mode === "CONVERT_RESERVE") {
      const idx = assigns.findIndex((a) =>
        String(a.taskType) === "RESERVE" &&
        String(a.dateISO || a.date || "") === params.dateISO &&
        String(a.period) === params.period &&
        String(a.teacherId) === params.teacherId
      );
      if (idx >= 0) {
        assigns[idx].taskType = "INVIGILATION";
        assigns[idx].taskTypeLabelAr = "مراقبة";
        assigns[idx].committeeNo = committeeNo;
        assigns[idx].invigilatorIndex = invigilatorIndex;
        assigns[idx].__manualCover = true;
        if (typeof summary.invAssigned === "number") summary.invAssigned += 1;
        if (typeof summary.reserveAssigned === "number") summary.reserveAssigned -= 1;
      }
    } else {
      assigns.push({
        teacherId: params.teacherId,
        teacherName,
        taskType: "INVIGILATION",
        taskTypeLabelAr: "مراقبة",
        dateISO: params.dateISO,
        date: params.dateISO,
        period: params.period,
        subject: params.subject,
        committeeNo,
        invigilatorIndex,
        __manualCover: true,
      });
      if (typeof summary.invAssigned === "number") summary.invAssigned += 1;
    }

    // تحديث سطر العجز (assigned++)
    const u = unfilled.find((x) => String(x.kind) === "INVIGILATION" && String(x.dateISO) === params.dateISO && String(x.period) === params.period && String(x.subject) === params.subject);
    if (u) u.assigned = Number(u.assigned || 0) + 1;

    out.assignments = assigns;
    out.debug = { ...debug, summary, unfilled };
    saveRun(tenantId, out);

    // إعادة تحميل الصفحة لإظهار التحديث فوراً
    window.location.reload();
  }

  const coverSuggestionsByItemKey = useMemo(() => {
    const out = loadRun(tenantId) as any;
    const assigns: any[] = Array.isArray(out?.assignments) ? out.assignments : [];
    const maxTasks = Number(constraints.maxTasksPerTeacher ?? 10) || 10;

    const nameMap = new Map<string, string>();
    for (const t of teachersFromLS) {
      const id = String(t.id ?? "").trim();
      if (!id) continue;
      nameMap.set(id, String(t.fullName || t.name || t.employeeNo || id).trim());
    }

    const res: Record<string, { reserve: any[]; free: any[] }> = {};

    for (const g of invShortages) {
      for (const it of g.items) {
        const dateISO = String(it.dateISO || "").trim();
        const period = String(it.period || "") === "PM" ? "PM" : "AM";
        const subject = String(it.subject || "").trim();
        const key = `${dateISO}__${period}__${subject}`;

        // 1) مرشحو تحويل الاحتياط لنفس السلوط
        const reserve = assigns
          .filter((a) => String(a.taskType) === "RESERVE" && String(a.dateISO || a.date || "") === dateISO && String(a.period) === period)
          .filter((a) => !constraints.smartBySpecialty || !isTeacherSameSubjectAsExam(String(a.teacherId || ""), subject))
          .map((a) => ({
            teacherId: String(a.teacherId),
            teacherName: String(a.teacherName || nameMap.get(String(a.teacherId)) || a.teacherId),
            mode: "CONVERT_RESERVE" as const,
          }));

        // 2) مرشحو معلمين فاضيين لهذا السلوط
        const free: any[] = [];
        for (const t of teachersFromLS) {
          const tid = String(t.id || "").trim();
          if (!tid) continue;

          // تعارض نفس السلوط
          if (teacherHasSlot(assigns, tid, dateISO, period)) continue;

          // منع مرتين في اليوم إلا عند السماح بفترتين
          if ((constraints.avoidBackToBack ?? true) && teacherHasAnyInDay(assigns, tid, dateISO) && !canAllowTwo(dateISO)) continue;

          // منع مراقبة نفس المادة (عند التفعيل)
          if (constraints.smartBySpecialty && isTeacherSameSubjectAsExam(tid, subject)) continue;

          // نصاب
          if (quotaCountForTeacher(assigns, tid) >= maxTasks) continue;

          free.push({
            teacherId: tid,
            teacherName: nameMap.get(tid) || tid,
            mode: "ADD_NEW" as const,
          });
          if (free.length >= 10) break;
        }

        res[key] = { reserve: reserve.slice(0, 8), free: free.slice(0, 8) };
      }
    }

    return res;
  }, [tenantId, invShortages, teachersFromLS, examsFromLS]);

const [selectedCorrectionDate, setSelectedCorrectionDate] = useState<Record<string, string>>({}); // key teacherId__original -> selected date

  const page: React.CSSProperties = {
    direction: "rtl",
    minHeight: "100vh",
    background: "#0a1020",
    padding: 18,
    boxSizing: "border-box",
    color: "#d4af37",
  };

  const card: React.CSSProperties = {
    background: `linear-gradient(180deg, #0b1b3a, #0a1630)`,
    borderRadius: 20,
    padding: 16,
    boxShadow: "0 12px 35px rgba(0,0,0,.45)",
    border: `1px solid rgba(201,162,39,.18)`,
    color: "#d4af37",
    marginBottom: 16,
  };

  const hBtn: React.CSSProperties = {
    border: `1px solid rgba(201,162,39,.18)`,
    background: "rgba(255,255,255,.06)",
    color: "#d4af37",
    borderRadius: 14,
    padding: "10px 14px",
    fontWeight: 950,
    cursor: "pointer",
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
  };

  const pill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,.06)",
    border: `1px solid rgba(201,162,39,.18)`,
    fontWeight: 900,
    color: "#d4af37",
  };

  const note: React.CSSProperties = { color: "rgba(201,162,39,.82)", fontWeight: 800, fontSize: 12 };

  function applyAutoRunPatch(patch: any, title: string) {
    // ✅ يحفظ التعديل ثم يوجّه لصفحة التشغيل لتطبيقه مباشرة
    writeJson(AUTORUN_KEY, { patch, title, ts: Date.now() });
    nav("/task-distribution/run");
  }

  function applyCorrectionShift(item: CorrectionShiftSuggestion, toDateISO: string) {
    if (!runOut?.assignments?.length) return;

    const teacherId = String(item.teacherId || "").trim();
    const original = String(item.originalDateISO || "").trim();
    const to = String(toDateISO || "").trim();
    if (!teacherId || !original || !to) return;

    // ✅ ابحث عن تكليف التصحيح الذي يحمل originalCorrectionDateISO
    const assigns: any[] = Array.isArray(runOut.assignments) ? runOut.assignments : [];
    const a = assigns.find((x) => {
      if (String(x?.taskType || "") !== "CORRECTION_FREE") return false;
      if (String(x?.teacherId || "") !== teacherId) return false;
      return String(x?.originalCorrectionDateISO || "") === original;
    });

    if (!a) return;

    a.dateISO = to;
    a.date = to;
    a.period = "AM";
    a.correctionShiftedToISO = to;

    // تحديث الاقتراحات داخل debug
    if (Array.isArray(runOut?.debug?.correctionShiftSuggestions)) {
      const s = runOut.debug.correctionShiftSuggestions.find(
        (x: any) => String(x.teacherId) === teacherId && String(x.originalDateISO) === original
      );
      if (s) s.appliedDateISO = to;
    }

    // تحديث correctionByTeacher (عرض)
    if (Array.isArray(runOut?.debug?.correctionByTeacher)) {
      const row = runOut.debug.correctionByTeacher.find((x: any) => String(x.teacherId) === teacherId);
      if (row) {
        const dates = new Set<string>(Array.isArray(row.correctionDates) ? row.correctionDates : []);
        // إزالة التاريخ السابق (قد يكون shifted)
        if (item.appliedDateISO) dates.delete(item.appliedDateISO);
        dates.add(to);
        row.correctionDates = Array.from(dates).sort();
        row.correctionDaysCount = row.correctionDates.length;
      }
    }

    saveRun(tenantId, runOut);
    nav("/task-distribution/results");
  }

  const hasRun = !!runOut;

  return (
    <div style={page}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <button type="button" style={hBtn} onClick={() => nav("/task-distribution/run")}>
          ⟵ الرجوع للتشغيل
        </button>
        <button type="button" style={hBtn} onClick={() => nav("/task-distribution/results")}>
          📋 الجدول الشامل
        </button>
        <button type="button" style={hBtn} onClick={() => nav("/task-distribution/print")}>
          🖨️ التقرير
        </button>
      </div>

      {!hasRun ? (
        <div style={card}>
          لا توجد نتائج توزيع محفوظة. شغّل التوزيع أولاً.
        </div>
      ) : (
        <>
          <div style={card}>
            <div style={{ fontWeight: 950, fontSize: 18 }}>صفحة الاقتراحات</div>
            <div style={{ marginTop: 6, ...note }}>
              هنا ستجد:
              (1) بدائل نقل التفريغ للتصحيح عندما يوجد عجز مراقبة في نفس اليوم
              (2) اقتراحات لسد عجز المراقبة مع تطبيق مباشر للتوزيع
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <span style={pill}>مراقبة: {summary.invAssigned}/{summary.invRequired}</span>
              <span style={pill}>احتياط: {summary.reserveAssigned}/{summary.reserveRequired}</span>
              <span style={pill}>أيام عجز مراقبة: {Array.isArray(summary.daysNoReserveBecauseInvShortage) ? summary.daysNoReserveBecauseInvShortage.length : 0}</span>
              <span style={pill}>نصاب: {constraints.maxTasksPerTeacher ?? "-"}</span>
            </div>
          </div>

          {/* ✅ اقتراحات التصحيح */}
          <div style={card}>
            <div style={{ fontWeight: 950, fontSize: 16 }}>اقتراحات نقل التفريغ للتصحيح</div>
            <div style={{ marginTop: 6, ...note }}>
              إذا وُجد عجز مراقبة في يوم التصحيح، لن يتم التفريغ في ذلك اليوم وسيُقترح أقرب يوم متاح.
            </div>

            {correctionShiftSuggestions.length === 0 ? (
              <div style={{ marginTop: 10, ...note }}>لا توجد اقتراحات نقل للتصحيح.</div>
            ) : (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {correctionShiftSuggestions.map((it) => {
                  const key = `${it.teacherId}__${it.originalDateISO}`;
                  const selected = selectedCorrectionDate[key] || (it.appliedDateISO || it.suggestedDates?.[0] || "");
                  const options = Array.from(new Set([...(it.suggestedDates || []), ...(it.appliedDateISO ? [it.appliedDateISO] : [])])).filter(Boolean);

                  return (
                    <div
                      key={key}
                      style={{
                        border: "1px solid rgba(201,162,39,.18)",
                        background: "rgba(255,255,255,.03)",
                        borderRadius: 16,
                        padding: 12,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 950 }}>{it.teacherName}</div>
                          <div style={note}>
                            التاريخ الأصلي: {it.originalDateISO} — المطبق حالياً: {it.appliedDateISO || "-"}
                          </div>
                          {it.reason === "NO_AVAILABLE" ? (
                            <div style={{ ...note, marginTop: 4 }}>⚠️ لا يوجد تاريخ متاح ضمن نطاق الاقتراحات.</div>
                          ) : null}
                        </div>

                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <select
                            value={selected}
                            onChange={(e) =>
                              setSelectedCorrectionDate((p) => ({
                                ...p,
                                [key]: e.target.value,
                              }))
                            }
                            style={{
                              padding: "10px 12px",
                              borderRadius: 14,
                              border: "1px solid rgba(201,162,39,.18)",
                              background: "rgba(255,255,255,.06)",
                              fontWeight: 950,
                              color: "#d4af37",
                              outline: "none",
                              minWidth: 170,
                            }}
                            disabled={it.reason === "NO_AVAILABLE"}
                          >
                            <option value="" disabled>
                              اختر تاريخًا
                            </option>
                            {options.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            style={hBtn}
                            onClick={() => applyCorrectionShift(it, selected)}
                            disabled={!selected || it.reason === "NO_AVAILABLE"}
                          >
                            ✅ تطبيق
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ✅ اقتراحات سد العجز */}
          <div style={card}>
            <div style={{ fontWeight: 950, fontSize: 16 }}>اقتراحات لسد عجز المراقبة (اختر ثم يتم تطبيقه مباشرة)</div>
            <div style={{ marginTop: 6, ...note }}>
              هذه الاقتراحات تقوم بتعديل القيود ثم إعادة تشغيل التوزيع مباشرة.
            </div>

            {invShortages.length === 0 ? (
              <div style={{ marginTop: 10, ...note }}>✅ لا يوجد عجز مراقبة حالياً.</div>
            ) : (
              <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                {invShortages.map((g) => {
                  const dateISO = g.dateISO;
                  return (
                    <div
                      key={dateISO}
                      style={{
                        border: "1px solid rgba(201,162,39,.18)",
                        background: "rgba(255,255,255,.03)",
                        borderRadius: 16,
                        padding: 12,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 950 }}>📅 تاريخ العجز: {dateISO}</div>
                          <div style={note}>
                            عدد سلوطات العجز: {g.items.length} (افتح لوحة Debug في صفحة التشغيل لرؤية التفاصيل)
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          {/* 1) السماح بفترتين لهذا اليوم */}
                          <button
                            type="button"
                            style={hBtn}
                            onClick={() =>
                              applyAutoRunPatch(
                                {
                                  allowTwoPeriodsSameDay: true,
                                  allowTwoPeriodsSameDayAllDates: false,
                                  allowTwoPeriodsSameDayDates: Array.from(new Set([...(constraints.allowTwoPeriodsSameDayDates || []), dateISO])).sort(),
                                },
                                `السماح بفترتين في ${dateISO}`
                              )
                            }
                          >
                            ✅ السماح بفترتين لهذا اليوم
                          </button>

                          {/* 2) زيادة النصاب */}
                          <button
                            type="button"
                            style={hBtn}
                            onClick={() =>
                              applyAutoRunPatch(
                                { maxTasksPerTeacher: Number(constraints.maxTasksPerTeacher || 10) + 1 },
                                "زيادة الحد الأقصى للنصاب +1"
                              )
                            }
                          >
                            ➕ زيادة النصاب +1
                          </button>

                          {/* 3) تقليل الاحتياط */}
                          <button
                            type="button"
                            style={hBtn}
                            onClick={() =>
                              applyAutoRunPatch(
                                { reservePerPeriod: Math.max(0, Number(constraints.reservePerPeriod || 0) - 1) },
                                "تقليل الاحتياط لكل فترة"
                              )
                            }
                          >
                            ➖ تقليل الاحتياط
                          </button>

                          {/* 4) إلغاء منع مراقبة نفس المادة */}
                          <button
                            type="button"
                            style={hBtn}
                            onClick={() =>
                              applyAutoRunPatch(
                                { smartBySpecialty: false },
                                "إلغاء منع مراقبة نفس المادة"
                              )
                            }
                          >
                            🔓 إلغاء منع مراقبة نفس المادة
                          </button>
                        </div>
                      </div>

                      {/* ✅ اقتراحات بأسماء معلمين لسد العجز (بدون تغيير القيود) */}
                      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                        {g.items.map((it: any, idx: number) => {
                          const period = String(it?.period || "") === "PM" ? "PM" : "AM";
                          const subject = String(it?.subject || "").trim();
                          const itemKey = `${dateISO}__${period}__${subject}`;
                          const sug = (coverSuggestionsByItemKey as any)[itemKey];
                          const remaining = Math.max(0, Number(it?.required || 0) - Number(it?.assigned || 0));

                          return (
                            <div
                              key={`${itemKey}-${idx}`}
                              style={{
                                border: "1px solid rgba(201,162,39,.18)",
                                background: "rgba(255,255,255,.02)",
                                borderRadius: 16,
                                padding: 12,
                              }}
                            >
                              <div style={{ fontWeight: 950 }}>
                                📌 {subject || "-"} — {period === "AM" ? "الفترة الأولى" : "الفترة الثانية"} — المتبقي: {remaining}
                              </div>
                              <div style={{ ...note, marginTop: 6 }}>
                                اختر معلماً لتغطية العجز (سيتم التطبيق مباشرة على الجدول الشامل/التقرير).
                              </div>

                              {sug && (sug.reserve?.length || sug.free?.length) ? (
                                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                                  {sug.reserve?.length ? (
                                    <div>
                                      <div style={{ fontWeight: 900, marginBottom: 6 }}>✅ تحويل احتياط موجود لنفس السلوط</div>
                                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        {sug.reserve.map((c: any) => (
                                          <button
                                            key={`r-${itemKey}-${c.teacherId}`}
                                            type="button"
                                            style={hBtn}
                                            onClick={() =>
                                              applyCoverSuggestion({
                                                dateISO,
                                                period,
                                                subject,
                                                teacherId: c.teacherId,
                                                mode: c.mode,
                                              })
                                            }
                                          >
                                            {c.teacherName}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}

                                  {sug.free?.length ? (
                                    <div>
                                      <div style={{ fontWeight: 900, marginBottom: 6 }}>➕ معلمون فاضيون لهذا السلوط</div>
                                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        {sug.free.map((c: any) => (
                                          <button
                                            key={`f-${itemKey}-${c.teacherId}`}
                                            type="button"
                                            style={hBtn}
                                            onClick={() =>
                                              applyCoverSuggestion({
                                                dateISO,
                                                period,
                                                subject,
                                                teacherId: c.teacherId,
                                                mode: c.mode,
                                              })
                                            }
                                          >
                                            {c.teacherName}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <div style={{ marginTop: 10, ...note }}>لا توجد اقتراحات أسماء مناسبة لهذا السلوط حسب القيود الحالية.</div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ marginTop: 10, ...note }}>
                        ملاحظة: يمكنك تطبيق أكثر من اقتراح (واحدًا تلو الآخر) حتى يصل التوزيع إلى تغطية كاملة.
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
