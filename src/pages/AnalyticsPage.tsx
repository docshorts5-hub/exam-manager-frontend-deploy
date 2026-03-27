import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { subscribeTenantArray } from "../services/tenantData";
import { buildSmartAlerts } from "../services/smartAlerts.service";
import { loadRun, RUN_UPDATED_EVENT } from "../utils/taskDistributionStorage";
import type { Exam } from "../entities/exam/model";
import type { Room } from "../entities/room/model";
import type { RoomBlock } from "../entities/roomBlock.model";
import type { ExamRoomAssignment } from "../entities/examRoomAssignment.model";
import type { Teacher } from "../services/teachers.service";

type TaskAssignment = {
  teacherName?: string;
  teacher?: { name?: string } | string;
  name?: string;
  taskType?: string;
  type?: string;
};

type AnalyticsModel = {
  teachers: Teacher[];
  exams: Exam[];
  rooms: Room[];
  roomBlocks: RoomBlock[];
  examRoomAssignments: ExamRoomAssignment[];
  taskAssignments: TaskAssignment[];
};

type Insight = {
  tone: "good" | "warn" | "info";
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
};

const GOLD = "#d4af37";
const AMBER = "#f59e0b";
const GREEN = "#22c55e";
const RED = "#ef4444";
const BLUE = "#38bdf8";

function getTenantId(auth: any) {
  return String(auth?.effectiveTenantId || auth?.tenantId || auth?.profile?.tenantId || "").trim();
}

function getTeacherName(item: TaskAssignment) {
  return String(item?.teacherName || (item?.teacher as any)?.name || item?.teacher || item?.name || "").trim();
}

function normalizeTaskType(item: TaskAssignment) {
  const raw = String(item?.taskType || item?.type || "").trim();
  if (raw === "INVIGILATION" || raw === "مراقبة") return "INVIGILATION";
  if (raw === "RESERVE" || raw === "احتياط") return "RESERVE";
  if (raw === "REVIEW_FREE" || raw === "مراجعة") return "REVIEW_FREE";
  if (raw === "CORRECTION_FREE" || raw === "تصحيح") return "CORRECTION_FREE";
  return raw || "OTHER";
}

function sameDateRange(dateISO: string, block: RoomBlock) {
  return dateISO >= String(block.startDate || "") && dateISO <= String(block.endDate || "");
}

function sameSession(examPeriod: string, blockSession: string) {
  return blockSession === "full-day" || String(examPeriod || "") === String(blockSession || "");
}

function avg(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function pct(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}

function formatPct(value: number) {
  return `${Math.round(value)}%`;
}

function StatCard({ label, value, hint, color = GOLD }: { label: string; value: string | number; hint?: string; color?: string }) {
  return (
    <div style={{
      background: "linear-gradient(180deg, rgba(15,15,15,0.98), rgba(4,4,4,0.96))",
      border: `1px solid ${color}55`,
      borderRadius: 24,
      padding: 20,
      minHeight: 116,
      boxShadow: "0 18px 38px rgba(0,0,0,0.35)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      gap: 8,
    }}>
      <div style={{ color: "#f8e7a8", fontWeight: 800, fontSize: 15 }}>{label}</div>
      <div style={{ color, fontWeight: 900, fontSize: 34, lineHeight: 1.1 }}>{value}</div>
      {hint ? <div style={{ color: "#c6c6c6", fontSize: 13 }}>{hint}</div> : <div />}
    </div>
  );
}

function MiniBarChart({
  items,
  title,
  empty,
}: {
  items: { label: string; value: number; color?: string; subLabel?: string }[];
  title: string;
  empty: string;
}) {
  const max = Math.max(0, ...items.map((item) => item.value));
  return (
    <div style={panelStyle}>
      <div style={sectionTitleStyle}>{title}</div>
      {!items.length ? (
        <div style={emptyStateStyle}>{empty}</div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {items.map((item) => {
            const width = max ? Math.max(10, (item.value / max) * 100) : 0;
            return (
              <div key={item.label} style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, color: "#f3f4f6" }}>
                  <div style={{ fontWeight: 700 }}>{item.label}</div>
                  <div style={{ fontWeight: 900, color: item.color || GOLD }}>{item.value} {item.subLabel || ""}</div>
                </div>
                <div style={{ height: 12, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${width}%`, background: item.color || GOLD, borderRadius: 999 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InsightCard({ item, lang }: { item: Insight; lang: string }) {
  const color = item.tone === "good" ? GREEN : item.tone === "warn" ? AMBER : BLUE;
  const title = lang === "ar" ? item.titleAr : item.titleEn;
  const body = lang === "ar" ? item.bodyAr : item.bodyEn;
  return (
    <div style={{
      background: "linear-gradient(180deg, rgba(9,9,9,0.98), rgba(18,18,18,0.96))",
      border: `1px solid ${color}55`,
      borderRadius: 22,
      padding: 18,
      boxShadow: "0 14px 28px rgba(0,0,0,0.28)",
      display: "grid",
      gap: 8,
    }}>
      <div style={{ color, fontWeight: 900 }}>{title}</div>
      <div style={{ color: "#e5e7eb", lineHeight: 1.8 }}>{body}</div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(18,18,18,0.98), rgba(7,7,7,0.96))",
  border: "1px solid rgba(212,175,55,0.22)",
  borderRadius: 28,
  padding: 22,
  boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
};

const sectionTitleStyle: React.CSSProperties = {
  color: "#fff2b6",
  fontSize: 18,
  fontWeight: 900,
  marginBottom: 16,
};

const emptyStateStyle: React.CSSProperties = {
  color: "#c2c2c2",
  lineHeight: 1.8,
  padding: "8px 0",
};

export default function AnalyticsPage() {
  const auth = useAuth();
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const tenantId = useMemo(() => getTenantId(auth), [auth]);
  const [model, setModel] = useState<AnalyticsModel>({
    teachers: [],
    exams: [],
    rooms: [],
    roomBlocks: [],
    examRoomAssignments: [],
    taskAssignments: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setModel({ teachers: [], exams: [], rooms: [], roomBlocks: [], examRoomAssignments: [], taskAssignments: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    const syncRun = () => {
      const run = loadRun(tenantId);
      const taskAssignments = Array.isArray(run?.assignments) ? run.assignments : [];
      setModel((prev) => ({ ...prev, taskAssignments }));
      setLoading(false);
    };

    syncRun();

    const unsubs = [
      subscribeTenantArray<Teacher>(tenantId, "teachers", (teachers) => {
        setModel((prev) => ({ ...prev, teachers }));
        setLoading(false);
      }),
      subscribeTenantArray<Exam>(tenantId, "exams", (exams) => {
        setModel((prev) => ({ ...prev, exams }));
        setLoading(false);
      }),
      subscribeTenantArray<Room>(tenantId, "rooms", (rooms) => {
        setModel((prev) => ({ ...prev, rooms }));
        setLoading(false);
      }),
      subscribeTenantArray<RoomBlock>(tenantId, "roomBlocks", (roomBlocks) => {
        setModel((prev) => ({ ...prev, roomBlocks }));
        setLoading(false);
      }),
      subscribeTenantArray<ExamRoomAssignment>(tenantId, "examRoomAssignments", (examRoomAssignments) => {
        setModel((prev) => ({ ...prev, examRoomAssignments }));
        setLoading(false);
      }),
    ];

    window.addEventListener(RUN_UPDATED_EVENT, syncRun as EventListener);
    window.addEventListener("focus", syncRun);

    return () => {
      unsubs.forEach((unsub) => {
        if (typeof unsub === "function") unsub();
      });
      window.removeEventListener(RUN_UPDATED_EVENT, syncRun as EventListener);
      window.removeEventListener("focus", syncRun);
    };
  }, [tenantId]);

  const derived = useMemo(() => {
    const activeRooms = model.rooms.filter((room) => String(room.status || "active") === "active");
    const activeBlocks = model.roomBlocks.filter((block) => String(block.status || "") === "active");
    const examAssignmentsMap = new Map<string, ExamRoomAssignment[]>();
    model.examRoomAssignments.forEach((assignment) => {
      const list = examAssignmentsMap.get(assignment.examId) || [];
      list.push(assignment);
      examAssignmentsMap.set(assignment.examId, list);
    });

    const examsByDay = new Map<string, number>();
    const examsBySubject = new Map<string, number>();
    const blockedAssignments: { exam: string; room: string }[] = [];
    const unfilledExams: Exam[] = [];

    model.exams.forEach((exam) => {
      const date = String(exam.dateISO || "");
      examsByDay.set(date, (examsByDay.get(date) || 0) + 1);
      const subject = String(exam.subject || "بدون مادة");
      examsBySubject.set(subject, (examsBySubject.get(subject) || 0) + 1);

      const assigned = examAssignmentsMap.get(exam.id) || [];
      if (assigned.length < Math.max(1, Number(exam.roomsCount) || 1)) {
        unfilledExams.push(exam);
      }

      assigned.forEach((assignment) => {
        const blocked = activeBlocks.some((block) => block.roomId === assignment.roomId && sameDateRange(exam.dateISO, block) && sameSession(exam.period, block.session));
        if (blocked) blockedAssignments.push({ exam: String(exam.subject || exam.id), room: String(assignment.roomName || assignment.roomId) });
      });
    });

    const taskCounts = { INVIGILATION: 0, RESERVE: 0, REVIEW_FREE: 0, CORRECTION_FREE: 0, OTHER: 0 };
    const teacherLoad = new Map<string, { total: number; monitoring: number; reserve: number; review: number; correction: number }>();

    model.taskAssignments.forEach((assignment) => {
      const teacherName = getTeacherName(assignment);
      if (!teacherName) return;
      const type = normalizeTaskType(assignment);
      taskCounts[type as keyof typeof taskCounts] = (taskCounts[type as keyof typeof taskCounts] || 0) + 1;
      const current = teacherLoad.get(teacherName) || { total: 0, monitoring: 0, reserve: 0, review: 0, correction: 0 };
      current.total += 1;
      if (type === "INVIGILATION") current.monitoring += 1;
      else if (type === "RESERVE") current.reserve += 1;
      else if (type === "REVIEW_FREE") current.review += 1;
      else if (type === "CORRECTION_FREE") current.correction += 1;
      teacherLoad.set(teacherName, current);
    });

    const teacherLoadRows = [...teacherLoad.entries()].map(([teacher, row]) => ({ teacher, ...row }));
    const topTeachers = [...teacherLoadRows].sort((a, b) => b.total - a.total).slice(0, 5);
    const loads = teacherLoadRows.map((item) => item.total);
    const averageTeacherLoad = avg(loads);
    const loadGap = loads.length ? Math.max(...loads) - Math.min(...loads) : 0;
    const balancedTeachers = teacherLoadRows.filter((item) => Math.abs(item.total - averageTeacherLoad) <= 1).length;
    const utilization = pct(model.examRoomAssignments.length, Math.max(1, activeRooms.length * Math.max(1, examsByDay.size)));
    const coverage = pct(model.examRoomAssignments.length, model.exams.reduce((sum, exam) => sum + Math.max(1, Number(exam.roomsCount) || 1), 0));
    const busiestDay = [...examsByDay.entries()].sort((a, b) => b[1] - a[1])[0];
    const busiestSubject = [...examsBySubject.entries()].sort((a, b) => b[1] - a[1])[0];

    const insights: Insight[] = [];
    if (unfilledExams.length) {
      insights.push({
        tone: "warn",
        titleAr: "نقص في ربط القاعات",
        titleEn: "Room assignment gap",
        bodyAr: `يوجد ${unfilledExams.length} امتحان لم يستكمل عدد القاعات المطلوبة. هذه أول نقطة يجب إغلاقها قبل التشغيل النهائي.`,
        bodyEn: `${unfilledExams.length} exams do not yet have their required room count assigned. This should be closed before the final run.`,
      });
    } else if (model.exams.length) {
      insights.push({
        tone: "good",
        titleAr: "تغطية القاعات مستقرة",
        titleEn: "Room coverage is stable",
        bodyAr: "كل الامتحانات الحالية مرتبطة بعدد القاعات المطلوب بدون نقص ظاهر في بيانات الربط.",
        bodyEn: "All current exams are linked to the required room count with no visible assignment shortage.",
      });
    }

    if (blockedAssignments.length) {
      insights.push({
        tone: "warn",
        titleAr: "تعارض مع حظر القاعات",
        titleEn: "Conflict with room blocks",
        bodyAr: `تم رصد ${blockedAssignments.length} حالة ربط على قاعات محظورة في نفس التاريخ أو الفترة. يفضل مراجعتها من صفحة الامتحانات وحظر القاعات.`,
        bodyEn: `${blockedAssignments.length} assignments were detected on blocked rooms during the same date or session. Review them from Exams and Room Blocks.`,
      });
    }

    if (teacherLoadRows.length) {
      insights.push({
        tone: loadGap <= 2 ? "good" : "info",
        titleAr: "توازن الأحمال",
        titleEn: "Workload balance",
        bodyAr: `متوسط تكليف المعلم ${averageTeacherLoad.toFixed(1)} مهمة، وفجوة الحمل الحالية ${loadGap} مهمة. ${balancedTeachers} معلم قريبون من المتوسط.`,
        bodyEn: `Average teacher load is ${averageTeacherLoad.toFixed(1)} tasks, and the current gap is ${loadGap} tasks. ${balancedTeachers} teachers are close to the average.`,
      });
    }

    if (busiestDay) {
      insights.push({
        tone: "info",
        titleAr: "أعلى يوم ضغط",
        titleEn: "Peak pressure day",
        bodyAr: `أعلى ضغط تشغيلي حاليًا في يوم ${busiestDay[0]} بعدد ${busiestDay[1]} امتحان. من الأفضل مراجعة التغطية والاحتياط في هذا اليوم أولاً.`,
        bodyEn: `The busiest operational day is ${busiestDay[0]} with ${busiestDay[1]} exams. Review coverage and reserve assignments there first.`,
      });
    }

    return {
      activeRooms,
      activeBlocks,
      examsByDay,
      examsBySubject,
      blockedAssignments,
      unfilledExams,
      taskCounts,
      teacherLoadRows,
      topTeachers,
      averageTeacherLoad,
      loadGap,
      balancedTeachers,
      utilization,
      coverage,
      busiestDay,
      busiestSubject,
      insights: insights.slice(0, 4),
    };
  }, [model]);

  const roomHealth = useMemo(() => {
    const activeRooms = derived.activeRooms.length;
    const blockedActive = derived.activeBlocks.length;
    return {
      activeRooms,
      blockedActive,
      availableRoomsAfterBlocks: Math.max(0, activeRooms - blockedActive),
    };
  }, [derived.activeRooms.length, derived.activeBlocks.length]);

  const smartAlerts = useMemo(() => buildSmartAlerts(model), [model]);

  const examDayBars = useMemo(
    () => [...derived.examsByDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-7).map(([label, value]) => ({ label, value, color: BLUE })),
    [derived.examsByDay]
  );

  const topSubjectBars = useMemo(
    () => [...derived.examsBySubject.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value, color: GOLD })),
    [derived.examsBySubject]
  );

  const teacherLoadBars = useMemo(
    () => derived.topTeachers.map((item) => ({ label: item.teacher, value: item.total, color: GREEN, subLabel: tr("مهمة", "tasks") })),
    [derived.topTeachers, lang]
  );

  const taskTypeBars = useMemo(() => [
    { label: tr("مراقبة", "Invigilation"), value: derived.taskCounts.INVIGILATION, color: GOLD },
    { label: tr("احتياط", "Reserve"), value: derived.taskCounts.RESERVE, color: AMBER },
    { label: tr("مراجعة", "Review"), value: derived.taskCounts.REVIEW_FREE, color: BLUE },
    { label: tr("تصحيح", "Correction"), value: derived.taskCounts.CORRECTION_FREE, color: GREEN },
  ].filter((item) => item.value > 0), [derived.taskCounts, lang]);

  return (
    <div style={{
      direction: isRTL ? "rtl" : "ltr",
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0b1020 0%, #030712 100%)",
      color: GOLD,
      padding: window.innerWidth < 768 ? 16 : 28,
      boxSizing: "border-box",
      display: "grid",
      gap: 22,
    }}>
      <div style={{
        ...panelStyle,
        display: "grid",
        gap: 10,
        background: "linear-gradient(90deg, rgba(32,23,0,0.96), rgba(5,5,5,0.98) 55%, rgba(21,15,0,0.96))",
      }}>
        <div style={{ color: "#fff1b8", fontWeight: 900, fontSize: 28 }}>{tr("التحليلات الذكية", "Smart Analytics")}</div>
        <div style={{ color: "#d1d5db", lineHeight: 1.8, maxWidth: 900 }}>
          {tr(
            "الصفحة الآن مرتبطة بالبيانات المباشرة للنظام باستخدام مزامنة لحظية، وتعرض صحة التشغيل والتنبيهات الذكية وسجل الجاهزية بصورة عملية.",
            "This page is now connected to live system data using real-time sync and shows operational health, smart alerts, and readiness indicators."
          )}
        </div>
      </div>

      {loading ? (
        <div style={panelStyle}>{tr("جاري تحميل التحليلات الفعلية", "Loading live analytics")}</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16 }}>
            <StatCard label={tr("إجمالي الامتحانات", "Total exams")} value={model.exams.length} hint={derived.busiestDay ? tr(`أعلى يوم ${derived.busiestDay[0]}`, `Peak day ${derived.busiestDay[0]}`) : undefined} />
            <StatCard label={tr("تغطية القاعات", "Room coverage")} value={formatPct(derived.coverage)} color={derived.coverage >= 95 ? GREEN : AMBER} hint={tr("نسبة القاعات المرتبطة من المطلوب", "Assigned rooms vs. required rooms")} />
            <StatCard label={tr("الصحة التشغيلية للقاعات", "Room operational health")} value={`${roomHealth.availableRoomsAfterBlocks}/${roomHealth.activeRooms}`} color={BLUE} hint={tr("القاعات المتاحة بعد الحظر", "Available rooms after blocks")} />
            <StatCard label={tr("توازن الأحمال", "Load balance")} value={derived.teacherLoadRows.length ? `${derived.loadGap}` : 0} color={derived.loadGap <= 2 ? GREEN : AMBER} hint={tr("فجوة أعلى حمل مقابل أقل حمل", "Gap between max and min load")} />
            <StatCard label={tr("القاعات المحظورة النشطة", "Active blocked rooms")} value={derived.activeBlocks.length} color={derived.activeBlocks.length ? AMBER : GREEN} hint={tr("تحتاج مراجعة قبل الجدولة", "Requires schedule attention")} />
            <StatCard label={tr("أعلى مادة", "Top subject")} value={derived.busiestSubject?.[0] || tr("لا يوجد", "N/A")} color={GOLD} hint={derived.busiestSubject ? tr(`${derived.busiestSubject[1]} امتحان`, `${derived.busiestSubject[1]} exams`) : undefined} />
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ ...sectionTitleStyle, marginBottom: 0 }}>{tr("التنبيهات الذكية الحية", "Live smart alerts")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              {smartAlerts.map((item) => {
                const color = item.level === "critical" ? RED : item.level === "warning" ? AMBER : item.level === "success" ? GREEN : BLUE;
                return (
                  <div key={item.id} style={{ background: "linear-gradient(180deg, rgba(9,9,9,0.98), rgba(18,18,18,0.96))", border: `1px solid ${color}55`, borderRadius: 22, padding: 18, boxShadow: "0 14px 28px rgba(0,0,0,0.28)", display: "grid", gap: 8 }}>
                    <div style={{ color, fontWeight: 900 }}>{item.title}</div>
                    <div style={{ color: "#e5e7eb", lineHeight: 1.8 }}>{item.message}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 18 }}>
            <MiniBarChart items={examDayBars} title={tr("ضغط الامتحانات حسب اليوم", "Exam pressure by day")} empty={tr("لا توجد بيانات امتحانات كافية", "Not enough exam data yet")} />
            <MiniBarChart items={topSubjectBars} title={tr("أكثر المواد تكرارًا", "Most repeated subjects")} empty={tr("لا توجد مواد لعرضها", "No subjects to show")} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <MiniBarChart items={teacherLoadBars} title={tr("أعلى المعلمين تكليفًا", "Most assigned teachers")} empty={tr("لا يوجد تشغيل توزيع محفوظ بعد", "No saved distribution run yet")} />
            <MiniBarChart items={taskTypeBars} title={tr("هيكل التوزيع الحالي", "Current distribution mix")} empty={tr("لا توجد مهام موزعة بعد", "No distributed tasks yet")} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div style={panelStyle}>
              <div style={sectionTitleStyle}>{tr("قراءة تنفيذية سريعة", "Executive quick read")}</div>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ color: "#e5e7eb", lineHeight: 1.9 }}>
                  {tr(
                    `تم ربط ${model.examRoomAssignments.length} قاعة على ${model.exams.length} امتحان. نسبة التغطية الحالية ${formatPct(derived.coverage)}، ونسبة استخدام القاعات ${formatPct(derived.utilization)} تقريبًا.`,
                    `${model.examRoomAssignments.length} room assignments are linked across ${model.exams.length} exams. Current coverage is ${formatPct(derived.coverage)}, and room utilization is about ${formatPct(derived.utilization)}.`
                  )}
                </div>
                <div style={{ color: "#e5e7eb", lineHeight: 1.9 }}>
                  {tr(
                    `عدد المعلمين في النظام ${model.teachers.length}، وعدد من لديهم تكليفات فعلية في آخر تشغيل ${derived.teacherLoadRows.length}.`,
                    `${model.teachers.length} teachers are in the system, and ${derived.teacherLoadRows.length} of them currently have assignments in the latest run.`
                  )}
                </div>
                <div style={{ color: derived.blockedAssignments.length ? "#fbbf24" : "#86efac", fontWeight: 800 }}>
                  {derived.blockedAssignments.length
                    ? tr(`تنبيه: يوجد ${derived.blockedAssignments.length} ربط يحتاج مراجعة بسبب تعارض محتمل مع الحظر.`, `Alert: ${derived.blockedAssignments.length} assignments need review due to a potential block conflict.`)
                    : tr("لا توجد تعارضات ظاهرة بين ربط القاعات والحظر النشط.", "No visible conflicts between room assignments and active blocks.")}
                </div>
              </div>
            </div>

            <div style={panelStyle}>
              <div style={sectionTitleStyle}>{tr("مؤشرات الاستعداد للتشغيل النهائي", "Go-live readiness indicators")}</div>
              <div style={{ display: "grid", gap: 14 }}>
                {[
                  { label: tr("اكتمال ربط القاعات", "Room linking completion"), value: derived.coverage, color: derived.coverage >= 95 ? GREEN : AMBER },
                  { label: tr("توازن التوزيع", "Distribution balance"), value: derived.teacherLoadRows.length ? Math.max(0, 100 - derived.loadGap * 12) : 0, color: derived.loadGap <= 2 ? GREEN : BLUE },
                  { label: tr("سلامة الحظر", "Block safety"), value: derived.blockedAssignments.length ? Math.max(0, 100 - derived.blockedAssignments.length * 20) : 100, color: derived.blockedAssignments.length ? RED : GREEN },
                ].map((item) => (
                  <div key={item.label} style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ color: "#fff4c3", fontWeight: 700 }}>{item.label}</div>
                      <div style={{ color: item.color, fontWeight: 900 }}>{formatPct(item.value)}</div>
                    </div>
                    <div style={{ height: 14, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.max(6, item.value)}%`, background: item.color, borderRadius: 999 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ ...sectionTitleStyle, marginBottom: 0 }}>{tr("Smart Insights", "Smart Insights")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              {derived.insights.length ? derived.insights.map((item, idx) => <InsightCard key={idx} item={item} lang={lang} />) : (
                <div style={panelStyle}>{tr("أضف بيانات تشغيل أكثر لتظهر الملاحظات الذكية تلقائيًا.", "Add more live operational data to generate smart insights automatically.")}</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
