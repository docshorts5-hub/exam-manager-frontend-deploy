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

type AlertLevel = "critical" | "warning" | "success" | "info";

const GOLD = "#111827";
const AMBER = "#f59e0b";
const GREEN = "#22c55e";
const RED = "#ef4444";
const BLUE = "#2563eb";
const PANEL = "linear-gradient(180deg, #fffaf0 0%, #f3e5cd 100%)";
const PANEL_SOFT = "linear-gradient(180deg, #fdf3df 0%, #ead4b2 100%)";
const STROKE = "#b88a3b";
const OFFICIAL_TEXT = "#111827";
const OFFICIAL_MUTED_TEXT = "#374151";
const OFFICIAL_BG = "linear-gradient(180deg, #f7efe2 0%, #efe1ca 48%, #e7d2b3 100%)";
const OFFICIAL_CARD_BG = "linear-gradient(180deg, #fffaf0 0%, #f3e5cd 100%)";
const OFFICIAL_PANEL_BG = "linear-gradient(180deg, #fdf3df 0%, #ead4b2 100%)";
const OFFICIAL_BORDER_COLORS = ["#b88a3b", "#2563eb", "#16a34a", "#dc2626", "#7c3aed", "#ea580c", "#0891b2", "#be123c"];

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

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}


const SUBJECT_TRANSLATIONS: Record<string, string> = {
  "العلوم البيئية 11": "Environmental Science 11",
  "العلوم البيئية 12": "Environmental Science 12",
  "الرياضيات 10": "Mathematics 10",
  "الرياضيات 11": "Mathematics 11",
  "الرياضيات 12": "Mathematics 12",
  "الرياضيات المدرسية 11": "School Sports 11",
  "الرياضيات المدرسية 12": "School Sports 12",
  "اللغة العربية 10": "Arabic Language 10",
  "اللغة العربية 11": "Arabic Language 11",
  "اللغة الإنجليزية 10": "English Language 10",
  "اللغة الإنجليزية 11": "English Language 11",
  "التربية الإسلامية 10": "Islamic Education 10",
  "التربية الإسلامية 11": "Islamic Education 11",
  "الجغرافيا البشرية 11": "Human Geography 11",
  "الدراسات الاجتماعية 10": "Social Studies 10",
  "الفنون التشكيلية 11": "Fine Arts 11",
  "الفنون التشكيلية 12": "Fine Arts 12",
  "المهارات الموسيقية 11": "Musical Skills 11",
  "الكيمياء 10": "Chemistry 10",
  "الكيمياء 11": "Chemistry 11",
  "الفيزياء 10": "Physics 10",
  "الفيزياء 11": "Physics 11",
  "الأحياء 10": "Biology 10",
  "الأحياء 11": "Biology 11",
  "التاريخ والحضارة الإسلامية 11": "Islamic History and Civilization 11",
  "تقنية المعلومات 11": "Information Technology 11",
};

function translateSubjectName(subject: string, lang: string) {
  const value = String(subject || "").trim();
  if (!value) return value;
  return lang === "ar" ? value : SUBJECT_TRANSLATIONS[value] || value;
}

function toneColor(tone: Insight["tone"] | AlertLevel) {
  if (tone === "good" || tone === "success") return GREEN;
  if (tone === "warn" || tone === "warning") return AMBER;
  if (tone === "critical") return RED;
  return BLUE;
}

function surface(borderColor = STROKE, background = OFFICIAL_CARD_BG): React.CSSProperties {
  const borderGradient = `linear-gradient(135deg, ${borderColor}, #2563eb, #16a34a, #dc2626, #7c3aed)`;
  return {
    background: `${background} padding-box, ${borderGradient} border-box`,
    color: OFFICIAL_TEXT,
    border: "2px solid transparent",
    borderRadius: 28,
    boxShadow: "0 18px 45px rgba(88, 62, 25, 0.16)",
    backdropFilter: "blur(10px)",
  };
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>
      <div style={{ color: OFFICIAL_TEXT, fontSize: 20, fontWeight: 900, letterSpacing: 0.2 }}>{title}</div>
      {subtitle ? <div style={{ color: OFFICIAL_MUTED_TEXT, lineHeight: 1.8, fontSize: 13 }}>{subtitle}</div> : null}
      <div style={{ height: 2, borderRadius: 999, background: "linear-gradient(90deg, #b88a3b, #2563eb, #16a34a, #dc2626, transparent)" }} />
    </div>
  );
}

function HeroBadge({ label, value }: { label: string; value: string | number }) {
  const border = OFFICIAL_BORDER_COLORS[Math.abs(String(label).length) % OFFICIAL_BORDER_COLORS.length];
  return (
    <div style={{
      ...surface(border, OFFICIAL_CARD_BG),
      display: "grid",
      gap: 6,
      padding: "12px 14px",
      borderRadius: 18,
      minWidth: 132,
    }}>
      <div style={{ color: OFFICIAL_MUTED_TEXT, fontSize: 12, fontWeight: 800 }}>{label}</div>
      <div style={{ color: OFFICIAL_TEXT, fontSize: 18, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "9px 14px",
      borderRadius: 999,
      border: `2px solid ${color}`,
      background: "#fff7e6",
      color: OFFICIAL_TEXT,
      fontWeight: 800,
      fontSize: 12,
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, boxShadow: `0 0 14px ${color}` }} />
      {label}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  color = GOLD,
}: {
  label: string;
  value: string | number;
  hint?: string;
  color?: string;
}) {
  const border = color || OFFICIAL_BORDER_COLORS[Math.abs(String(label).length) % OFFICIAL_BORDER_COLORS.length];
  return (
    <div style={{
      ...surface(border, OFFICIAL_CARD_BG),
      padding: 20,
      minHeight: 134,
      display: "grid",
      gap: 12,
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", insetInlineEnd: -20, top: -28, width: 110, height: 110, borderRadius: "50%", background: `${border}14`, filter: "blur(3px)" }} />
      <div style={{ color: OFFICIAL_TEXT, fontWeight: 800, fontSize: 14, position: "relative" }}>{label}</div>
      <div style={{ color: OFFICIAL_TEXT, fontWeight: 900, fontSize: 34, lineHeight: 1.05, position: "relative", wordBreak: "break-word" }}>{value}</div>
      <div style={{ color: OFFICIAL_MUTED_TEXT, fontSize: 12, lineHeight: 1.7, position: "relative" }}>{hint || "—"}</div>
    </div>
  );
}

function MeterRow({ label, value, color }: { label: string; value: number; color: string }) {
  const safeValue = clampPercent(value);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ color: OFFICIAL_TEXT, fontWeight: 700 }}>{label}</div>
        <div style={{ color: OFFICIAL_TEXT, fontWeight: 900 }}>{formatPct(safeValue)}</div>
      </div>
      <div style={{ height: 14, borderRadius: 999, background: "#ead7b8", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.max(6, safeValue)}%`, background: color, borderRadius: 999, boxShadow: `0 0 20px ${color}44` }} />
      </div>
    </div>
  );
}

function MiniBarChart({
  items,
  title,
  empty,
  subtitle,
}: {
  items: { label: string; value: number; color?: string; subLabel?: string }[];
  title: string;
  empty: string;
  subtitle?: string;
}) {
  const max = Math.max(0, ...items.map((item) => item.value));
  return (
    <div style={{ ...surface("#b88a3b", OFFICIAL_CARD_BG), padding: 22 }}>
      <SectionHeader title={title} subtitle={subtitle} />
      {!items.length ? (
        <div style={emptyStateStyle}>{empty}</div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {items.map((item) => {
            const width = max ? Math.max(10, (item.value / max) * 100) : 0;
            return (
              <div key={item.label} style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, color: OFFICIAL_TEXT, alignItems: "center" }}>
                  <div style={{ fontWeight: 700, lineHeight: 1.6 }}>{item.label}</div>
                  <div style={{ fontWeight: 900, color: OFFICIAL_TEXT, whiteSpace: "nowrap" }}>{item.value} {item.subLabel || ""}</div>
                </div>
                <div style={{ height: 12, borderRadius: 999, background: "#ead7b8", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${width}%`, background: item.color || GOLD, borderRadius: 999, boxShadow: `0 0 18px ${(item.color || GOLD)}33` }} />
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
  const color = toneColor(item.tone);
  const title = lang === "ar" ? item.titleAr : item.titleEn;
  const body = lang === "ar" ? item.bodyAr : item.bodyEn;
  return (
    <div style={{
      ...surface(color, OFFICIAL_CARD_BG),
      padding: 18,
      display: "grid",
      gap: 10,
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", insetInlineEnd: -30, top: -34, width: 90, height: 90, borderRadius: "50%", background: `${color}14` }} />
      <div style={{ color: OFFICIAL_TEXT, fontWeight: 900, fontSize: 16, position: "relative" }}>{title}</div>
      <div style={{ color: OFFICIAL_TEXT, lineHeight: 1.9, position: "relative" }}>{body}</div>
    </div>
  );
}

function AlertCard({ title, message, level }: { title: string; message: string; level: AlertLevel }) {
  const color = toneColor(level);
  return (
    <div style={{ ...surface(color, OFFICIAL_CARD_BG), padding: 18, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: 999, background: color, boxShadow: `0 0 16px ${color}` }} />
        <div style={{ color: OFFICIAL_TEXT, fontWeight: 900 }}>{title}</div>
      </div>
      <div style={{ color: OFFICIAL_TEXT, lineHeight: 1.8 }}>{message}</div>
    </div>
  );
}

const emptyStateStyle: React.CSSProperties = {
  ...surface("#b88a3b", OFFICIAL_CARD_BG),
  color: OFFICIAL_MUTED_TEXT,
  lineHeight: 1.9,
  padding: 22,
  textAlign: "center",
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
    () => [...derived.examsBySubject.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label: translateSubjectName(label, lang), value, color: GOLD })),
    [derived.examsBySubject]
  );

  const teacherLoadBars = useMemo(
    () => derived.topTeachers.map((item) => ({ label: item.teacher, value: item.total, color: GREEN, subLabel: tr("مهمة", "tasks") })),
    [derived.topTeachers, lang]
  );

  const taskTypeBars = useMemo(
    () => [
      { label: tr("مراقبة", "Invigilation"), value: derived.taskCounts.INVIGILATION, color: GOLD },
      { label: tr("احتياط", "Reserve"), value: derived.taskCounts.RESERVE, color: AMBER },
      { label: tr("مراجعة", "Review"), value: derived.taskCounts.REVIEW_FREE, color: BLUE },
      { label: tr("تصحيح", "Correction"), value: derived.taskCounts.CORRECTION_FREE, color: GREEN },
    ].filter((item) => item.value > 0),
    [derived.taskCounts, lang]
  );

  const readiness = useMemo(
    () => [
      { label: tr("اكتمال ربط القاعات", "Room linking completion"), value: derived.coverage, color: derived.coverage >= 95 ? GREEN : AMBER },
      { label: tr("توازن التوزيع", "Distribution balance"), value: derived.teacherLoadRows.length ? Math.max(0, 100 - derived.loadGap * 12) : 0, color: derived.loadGap <= 2 ? GREEN : BLUE },
      { label: tr("سلامة الحظر", "Block safety"), value: derived.blockedAssignments.length ? Math.max(0, 100 - derived.blockedAssignments.length * 20) : 100, color: derived.blockedAssignments.length ? RED : GREEN },
    ],
    [derived.coverage, derived.teacherLoadRows.length, derived.loadGap, derived.blockedAssignments.length, lang]
  );

  const executiveSummary = useMemo(
    () => [
      tr(`${model.examRoomAssignments.length} ربط قاعات`, `${model.examRoomAssignments.length} room links`),
      tr(`${model.teachers.length} معلم داخل النظام`, `${model.teachers.length} teachers in system`),
      tr(`${derived.teacherLoadRows.length} معلم لديهم تكليفات`, `${derived.teacherLoadRows.length} teachers with assignments`),
      tr(`استخدام القاعات ${formatPct(derived.utilization)}`, `Utilization ${formatPct(derived.utilization)}`),
    ],
    [model.examRoomAssignments.length, model.teachers.length, derived.teacherLoadRows.length, derived.utilization, lang]
  );

  const healthScore = useMemo(() => {
    const coverageScore = clampPercent(derived.coverage);
    const balanceScore = derived.teacherLoadRows.length ? clampPercent(100 - derived.loadGap * 12) : 0;
    const blockScore = derived.blockedAssignments.length ? clampPercent(100 - derived.blockedAssignments.length * 20) : 100;
    return Math.round((coverageScore * 0.45) + (balanceScore * 0.35) + (blockScore * 0.2));
  }, [derived.coverage, derived.teacherLoadRows.length, derived.loadGap, derived.blockedAssignments.length]);

  const healthTone = healthScore >= 85 ? GREEN : healthScore >= 65 ? AMBER : RED;
  const systemModeLabel = healthScore >= 85
    ? tr("جاهزية عالية", "High readiness")
    : healthScore >= 65
      ? tr("بحاجة لبعض الضبط", "Needs fine-tuning")
      : tr("يتطلب مراجعة تشغيلية", "Operational review required");

  const hasData = Boolean(model.exams.length || model.examRoomAssignments.length || model.taskAssignments.length);

  return (
    <div id="analyticsOfficialPage" style={{
      direction: isRTL ? "rtl" : "ltr",
      minHeight: "100vh",
      background: `radial-gradient(circle at top, rgba(180,135,55,0.18), transparent 28%), radial-gradient(circle at 80% 20%, rgba(37,99,235,0.08), transparent 25%), ${OFFICIAL_BG}`,
      color: OFFICIAL_TEXT,
      padding: 24,
      boxSizing: "border-box",
    }}>
      <style>{`
        #analyticsOfficialPage,
        #analyticsOfficialPage * {
          color: #111827 !important;
        }

        #analyticsOfficialPage button,
        #analyticsOfficialPage input,
        #analyticsOfficialPage select,
        #analyticsOfficialPage textarea {
          background: #fffaf0 !important;
          color: #111827 !important;
          border: 2px solid #b88a3b !important;
        }

        #analyticsOfficialPage table,
        #analyticsOfficialPage th,
        #analyticsOfficialPage td {
          background: #fffaf0 !important;
          color: #111827 !important;
          border-color: #b88a3b !important;
        }
      `}</style>
      <div style={{ maxWidth: 1520, margin: "0 auto", display: "grid", gap: 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <div style={{ ...surface("#2563eb", OFFICIAL_CARD_BG), padding: 16, display: "grid", gap: 8 }}>
            <div style={{ color: OFFICIAL_TEXT, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8 }}>{tr("درجة الصحة التشغيلية", "Operational health score")}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <div style={{ color: OFFICIAL_TEXT, fontSize: 36, fontWeight: 900 }}>{healthScore}</div>
              <div style={{ color: OFFICIAL_MUTED_TEXT, fontWeight: 700 }}>/100</div>
            </div>
            <div style={{ color: OFFICIAL_TEXT, lineHeight: 1.8 }}>{systemModeLabel}</div>
          </div>
          <div style={{ ...surface("#b88a3b", OFFICIAL_CARD_BG), padding: 16, display: "grid", gap: 8 }}>
            <div style={{ color: OFFICIAL_TEXT, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8 }}>{tr("نبض التشغيل", "Operational pulse")}</div>
            <div style={{ color: OFFICIAL_TEXT, fontSize: 22, fontWeight: 900 }}>{tr("لوحة متابعة تنفيذية لحظية", "Real-time executive monitoring")}</div>
            <div style={{ color: OFFICIAL_MUTED_TEXT, lineHeight: 1.8 }}>{tr("تعكس الحالة المباشرة للقاعات والامتحانات والتوزيع والتنبيهات ضمن واجهة موحدة عالية الوضوح.", "A single high-clarity surface for rooms, exams, workload, and alerts.")}</div>
          </div>
          <div style={{ ...surface("#16a34a", OFFICIAL_CARD_BG), padding: 16, display: "grid", gap: 8 }}>
            <div style={{ color: OFFICIAL_TEXT, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8 }}>{tr("وضع البيانات", "Data mode")}</div>
            <div style={{ color: OFFICIAL_TEXT, fontSize: 22, fontWeight: 900 }}>{tr("بيانات حقيقية فقط", "Live data only")}</div>
            <div style={{ color: OFFICIAL_MUTED_TEXT, lineHeight: 1.8 }}>{tr("لا يتم عرض أي بيانات افتراضية. ظهور المحتوى التحليلي مرتبط فقط بوجود بيانات تشغيل فعلية من النظام.", "No sample data is rendered. Analytics appear only when real operational records exist in the platform.")}</div>
          </div>
        </div>
        <div style={{
          ...surface("#b88a3b", OFFICIAL_PANEL_BG),
          padding: 26,
          overflow: "hidden",
          position: "relative",
        }}>
          <div style={{ position: "absolute", insetInlineEnd: -80, top: -90, width: 260, height: 260, borderRadius: "50%", background: "rgba(212,175,55,0.13)", filter: "blur(12px)" }} />
          <div style={{ position: "absolute", insetInlineStart: -30, bottom: -60, width: 180, height: 180, borderRadius: "50%", background: "rgba(56,189,248,0.08)", filter: "blur(10px)" }} />
          <div style={{ position: "relative", display: "grid", gap: 18 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <StatusPill label={tr("لوحة تنفيذية متصلة مباشرة", "Directly connected executive dashboard")} color={GOLD} />
                <StatusPill label={tr("بيانات حقيقية فقط", "Live data only")} color={BLUE} />
                <StatusPill label={tr(loading ? "جاري التحديث" : "جاهز للمتابعة", loading ? "Syncing" : "Ready for review")} color={loading ? AMBER : GREEN} />
              </div>
              <div style={{ color: OFFICIAL_MUTED_TEXT, fontSize: 13, fontWeight: 700 }}>{tenantId ? `${tr("معرّف الجهة", "Tenant")}: ${tenantId}` : tr("لم يتم تحديد الجهة الحالية", "No active tenant detected")}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(300px, 0.9fr)", gap: 18 }}>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ color: OFFICIAL_TEXT, fontWeight: 800, fontSize: 14, letterSpacing: 0.5 }}>{tr("MASTERPIECE ANALYTICS", "MASTERPIECE ANALYTICS")}</div>
                <div style={{ color: OFFICIAL_TEXT, fontWeight: 900, fontSize: "clamp(28px, 4.7vw, 54px)", lineHeight: 1.04 }}>
                  {tr("مركز التحكم التحليلي لمنظومة الامتحانات", "The analytical command center for the exam platform")}
                </div>
                <div style={{ color: OFFICIAL_MUTED_TEXT, lineHeight: 1.9, fontSize: 15, maxWidth: 930 }}>
                  {tr(
                    "واجهة تنفيذية فائقة الجودة تربط بين القاعات والامتحانات والحظر والتوزيع والتنبيهات الذكية، وتحوّل البيانات التشغيلية المباشرة إلى صورة قرار واضحة وعالمية المستوى.",
                    "A premium executive layer that unifies rooms, exams, blocks, workload distribution, and smart alerts, turning live operational data into a world-class decision surface."
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {executiveSummary.map((item) => <StatusPill key={item} label={item} color="rgba(248,231,168,0.95)" />)}
                </div>
              </div>

              <div style={{
                ...surface("#2563eb", OFFICIAL_CARD_BG),
                padding: 18,
                display: "grid",
                alignContent: "start",
                gap: 12,
              }}>
                <div style={{ color: OFFICIAL_TEXT, fontWeight: 900, fontSize: 16 }}>{tr("لوحة الحالة التنفيذية", "Executive status board")}</div>
                <div style={{ color: OFFICIAL_MUTED_TEXT, lineHeight: 1.8, fontSize: 13 }}>
                  {tr(
                    "ملخص سريع لحالة الجاهزية الحالية من حيث الربط والتوازن والحظر والاعتماد على البيانات الفعلية من النظام.",
                    "A fast status brief for current readiness across linking, balance, room blocks, and live-source integrity."
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  <HeroBadge label={tr("التغطية", "Coverage")} value={formatPct(derived.coverage)} />
                  <HeroBadge label={tr("الاستخدام", "Utilization")} value={formatPct(derived.utilization)} />
                  <HeroBadge label={tr("فجوة الحمل", "Load gap")} value={derived.loadGap} />
                  <HeroBadge label={tr("القاعات المتاحة", "Available rooms")} value={`${roomHealth.availableRoomsAfterBlocks}/${roomHealth.activeRooms}`} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ ...surface(), padding: 24, color: OFFICIAL_TEXT, fontWeight: 800 }}>{tr("جاري تحميل التحليلات الفعلية من النظام", "Loading live analytics from the platform")}</div>
        ) : !hasData ? (
          <div style={{ ...surface(), padding: 40, textAlign: "center", display: "grid", gap: 16, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: -90, width: 240, height: 240, borderRadius: "50%", background: "rgba(212,175,55,0.08)", filter: "blur(12px)" }} />
            <div style={{ position: "relative", width: 110, height: 110, margin: "0 auto", borderRadius: "50%", border: "2px solid #b88a3b", background: "#fff7e6", display: "grid", placeItems: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.35)" }}>
              <div style={{ width: 46, height: 46, borderRadius: "50%", background: "linear-gradient(180deg, rgba(212,175,55,0.95), rgba(212,175,55,0.42))", boxShadow: "0 0 35px rgba(212,175,55,0.28)" }} />
            </div>
            <div style={{ color: OFFICIAL_TEXT, fontSize: 30, fontWeight: 900 }}>{tr("لا توجد بيانات تشغيل حقيقية متاحة حالياً", "No live operational data is currently available")}</div>
            <div style={{ color: OFFICIAL_MUTED_TEXT, lineHeight: 1.9, maxWidth: 860, margin: "0 auto" }}>
              {tr(
                "تظهر هذه الصفحة فقط البيانات الحقيقية القادمة من البرنامج. ابدأ بإضافة الامتحانات أو القاعات أو تشغيل التوزيع، ثم عد إلى هذه الصفحة للحصول على التحليلات الفعلية والتنبيهات الذكية.",
                "This page displays only real data coming from the platform. Add exams, rooms, or run the distribution first, then return here to see live analytics and smart operational insights."
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10 }}>
              <StatusPill label={tr("لا توجد بيانات افتراضية", "No sample data")} color={BLUE} />
              <StatusPill label={tr("المصدر: النظام فقط", "Source: platform only")} color={GOLD} />
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gap: 14 }}>
              <SectionHeader
                title={tr("المؤشرات التنفيذية الرئيسية", "Core executive metrics")}
                subtitle={tr("نظرة أولى سريعة على حالة الامتحانات والقاعات والتوازن التشغيلي.", "A first-glance read of exams, rooms, and workload balance.")}
              />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16 }}>
                <StatCard label={tr("إجمالي الامتحانات", "Total exams")} value={model.exams.length} hint={derived.busiestDay ? tr(`أعلى يوم ${derived.busiestDay[0]}`, `Peak day ${derived.busiestDay[0]}`) : tr("حسب البيانات الحالية", "Based on current data")} />
                <StatCard label={tr("تغطية القاعات", "Room coverage")} value={formatPct(derived.coverage)} color={derived.coverage >= 95 ? GREEN : AMBER} hint={tr("نسبة القاعات المرتبطة من المطلوب", "Assigned rooms vs. required rooms")} />
                <StatCard label={tr("الصحة التشغيلية للقاعات", "Room operational health")} value={`${roomHealth.availableRoomsAfterBlocks}/${roomHealth.activeRooms}`} color={BLUE} hint={tr("القاعات المتاحة بعد الحظر", "Available rooms after blocks")} />
                <StatCard label={tr("توازن الأحمال", "Load balance")} value={derived.teacherLoadRows.length ? `${derived.loadGap}` : 0} color={derived.loadGap <= 2 ? GREEN : AMBER} hint={tr("فجوة أعلى حمل مقابل أقل حمل", "Gap between max and min load")} />
                <StatCard label={tr("القاعات المحظورة النشطة", "Active blocked rooms")} value={derived.activeBlocks.length} color={derived.activeBlocks.length ? AMBER : GREEN} hint={tr("تحتاج مراجعة قبل الجدولة", "Requires schedule attention")} />
                <StatCard label={tr("أعلى مادة", "Top subject")} value={derived.busiestSubject?.[0] ? translateSubjectName(derived.busiestSubject[0], lang) : tr("لا يوجد", "N/A")} color={GOLD} hint={derived.busiestSubject ? tr(`${derived.busiestSubject[1]} امتحان`, `${derived.busiestSubject[1]} exams`) : tr("لا توجد مادة بارزة بعد", "No subject peak yet")} />
              </div>
            </div>

            <div style={{ ...surface(), padding: 22, display: "grid", gap: 16 }}>
              <SectionHeader
                title={tr("التنبيهات الذكية الحية", "Live smart alerts")}
                subtitle={tr("طبقة تنبيه تنفيذية تلتقط الحالات الحرجة والتحذيرية والإيجابية من البيانات المباشرة للنظام.", "An executive alert layer that surfaces critical, warning, and positive conditions from the live platform data.")}
              />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                {smartAlerts.length ? smartAlerts.map((item) => (
                  <AlertCard key={item.id} title={item.title} message={item.message} level={item.level as AlertLevel} />
                )) : (
                  <div style={emptyStateStyle}>{tr("لا توجد تنبيهات ذكية حالياً. هذا يعني أن المؤشرات الأساسية مستقرة في الوقت الحالي.", "No smart alerts right now. The core operational indicators look stable at the moment.")}</div>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18 }}>
              <div style={{ ...surface(), padding: 22, display: "grid", gap: 16 }}>
                <SectionHeader
                  title={tr("القراءة التنفيذية السريعة", "Executive quick read")}
                  subtitle={tr("خلاصة مباشرة قابلة للعرض الإداري دون الحاجة إلى فحص التفاصيل يدويًا.", "A direct, presentation-ready operational readout without manual inspection.")}
                />
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ color: OFFICIAL_TEXT, lineHeight: 1.95 }}>
                    {tr(
                      `تم ربط ${model.examRoomAssignments.length} قاعة على ${model.exams.length} امتحان. نسبة التغطية الحالية ${formatPct(derived.coverage)}، ونسبة استخدام القاعات ${formatPct(derived.utilization)} تقريبًا.`,
                      `${model.examRoomAssignments.length} room assignments are linked across ${model.exams.length} exams. Current coverage is ${formatPct(derived.coverage)}, and room utilization is about ${formatPct(derived.utilization)}.`
                    )}
                  </div>
                  <div style={{ color: OFFICIAL_TEXT, lineHeight: 1.95 }}>
                    {tr(
                      `عدد المعلمين في النظام ${model.teachers.length}، وعدد من لديهم تكليفات فعلية في آخر تشغيل ${derived.teacherLoadRows.length}.`,
                      `${model.teachers.length} teachers are in the system, and ${derived.teacherLoadRows.length} of them currently have assignments in the latest run.`
                    )}
                  </div>
                  <div style={{ color: OFFICIAL_TEXT, fontWeight: 800, lineHeight: 1.9 }}>
                    {derived.blockedAssignments.length
                      ? tr(`تنبيه: يوجد ${derived.blockedAssignments.length} ربط يحتاج مراجعة بسبب تعارض محتمل مع الحظر.`, `Alert: ${derived.blockedAssignments.length} assignments need review due to a potential block conflict.`)
                      : tr("لا توجد تعارضات ظاهرة بين ربط القاعات والحظر النشط.", "No visible conflicts between room assignments and active blocks.")}
                  </div>
                </div>
              </div>

              <div style={{ ...surface(), padding: 22, display: "grid", gap: 14 }}>
                <SectionHeader
                  title={tr("مؤشرات الاستعداد للتشغيل النهائي", "Go-live readiness indicators")}
                  subtitle={tr("شريط جاهزية سريع يوضح مدى القرب من تشغيل مستقر وآمن.", "A fast readiness strip showing how close the operation is to a stable and safe go-live.")}
                />
                {readiness.map((item) => <MeterRow key={item.label} label={item.label} value={item.value} color={item.color} />)}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18 }}>
              <MiniBarChart items={examDayBars} title={tr("ضغط الامتحانات حسب اليوم", "Exam pressure by day")} subtitle={tr("آخر الأيام المرصودة حسب التاريخ التصاعدي.", "Latest visible days in ascending order.")} empty={tr("لا توجد بيانات امتحانات كافية", "Not enough exam data yet")} />
              <MiniBarChart items={topSubjectBars} title={tr("أكثر المواد تكرارًا", "Most repeated subjects")} subtitle={tr("أكثر المواد ظهورًا ضمن البيانات الحالية.", "Subjects with the highest recurrence in the current dataset.")} empty={tr("لا توجد مواد لعرضها", "No subjects to show")} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
              <MiniBarChart items={teacherLoadBars} title={tr("أعلى المعلمين تكليفًا", "Most assigned teachers")} subtitle={tr("يعكس أحدث تشغيل محفوظ للتوزيع.", "Reflects the latest saved distribution run.")} empty={tr("لا يوجد تشغيل توزيع محفوظ بعد", "No saved distribution run yet")} />
              <MiniBarChart items={taskTypeBars} title={tr("هيكل التوزيع الحالي", "Current distribution mix")} subtitle={tr("تركيبة أنواع المهام المسندة في آخر تشغيل.", "Assignment-type composition in the latest run.")} empty={tr("لا توجد مهام موزعة بعد", "No distributed tasks yet")} />
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              <SectionHeader
                title={tr("Smart Insights", "Smart Insights")}
                subtitle={tr("ملاحظات تحليلية ذكية تختصر الحالة وتوجه الانتباه إلى النقاط الأكثر أهمية.", "AI-style analytical highlights that summarize the state and direct attention to the most important points.")}
              />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                {derived.insights.length ? derived.insights.map((item, idx) => <InsightCard key={idx} item={item} lang={lang} />) : (
                  <div style={emptyStateStyle}>{tr("أضف بيانات تشغيل أكثر لتظهر الملاحظات الذكية تلقائيًا.", "Add more live operational data to generate smart insights automatically.")}</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}