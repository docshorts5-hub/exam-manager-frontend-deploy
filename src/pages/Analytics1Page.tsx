import React, { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";

type Lang = "ar" | "en";
type TaskType = "INVIGILATION" | "RESERVE" | "REVIEW_FREE" | "CORRECTION_FREE";

type Assignment = {
  teacherName?: string;
  teacher?: { name?: string } | string;
  name?: string;
  taskType?: string;
  type?: string;
};

type TeacherAnalyticsRow = {
  teacher: string;
  monitoring: number;
  reserve: number;
  review: number;
  correction: number;
  total: number;
};

type TransferSuggestion = {
  taskType: TaskType;
  from: string;
  to: string;
  reason: string;
};

type DistributionItem = {
  key: TaskType;
  nameAr: string;
  nameEn: string;
  value: number;
  color: string;
};

const MASTER_TABLE_KEY = "exam-manager:task-distribution:master-table:v1";
const RUN_STORAGE_KEYS = [
  "exam-manager:task-distribution:current-run:v1",
  "exam-manager:task-distribution:run:v1",
  "exam-manager:dist-stats:last-run:v1",
];

const COLORS: Record<TaskType, string> = {
  INVIGILATION: "#facc15",
  RESERVE: "#fb923c",
  REVIEW_FREE: "#4ade80",
  CORRECTION_FREE: "#e5e7eb",
};

function tr(lang: Lang, ar: string, en: string) {
  return lang === "ar" ? ar : en;
}

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function getTeacherName(item: Assignment): string {
  if (typeof item.teacher === "string") return item.teacher.trim();
  return String(item.teacherName || item.teacher?.name || item.name || "").trim();
}

function getTaskType(item: Assignment): TaskType | "" {
  const raw = String(item.taskType || item.type || "").trim();
  if (raw === "INVIGILATION" || raw === "مراقبة") return "INVIGILATION";
  if (raw === "RESERVE" || raw === "احتياط") return "RESERVE";
  if (raw === "REVIEW_FREE" || raw === "مراجعة") return "REVIEW_FREE";
  if (raw === "CORRECTION_FREE" || raw === "تصحيح") return "CORRECTION_FREE";
  return "";
}

function readAssignmentsFromStorage(): Assignment[] {
  if (typeof window === "undefined") return [];

  for (const key of RUN_STORAGE_KEYS) {
    const parsed = safeParseJson<{ assignments?: Assignment[] }>(window.localStorage.getItem(key));
    if (Array.isArray(parsed?.assignments) && parsed.assignments.length) return parsed.assignments;
  }

  const masterData = safeParseJson<{ rows?: Assignment[]; data?: Assignment[] }>(
    window.localStorage.getItem(MASTER_TABLE_KEY)
  );
  const rows = Array.isArray(masterData?.rows)
    ? masterData.rows
    : Array.isArray(masterData?.data)
    ? masterData.data
    : [];
  if (rows.length) return rows;

  return [];
}

function buildTeacherAnalytics(assignments: Assignment[]): TeacherAnalyticsRow[] {
  const map = new Map<string, TeacherAnalyticsRow>();

  for (const assignment of assignments) {
    const teacher = getTeacherName(assignment);
    if (!teacher) continue;

    const current = map.get(teacher) || {
      teacher,
      monitoring: 0,
      reserve: 0,
      review: 0,
      correction: 0,
      total: 0,
    };

    const taskType = getTaskType(assignment);
    if (taskType === "INVIGILATION") current.monitoring += 1;
    else if (taskType === "RESERVE") current.reserve += 1;
    else if (taskType === "REVIEW_FREE") current.review += 1;
    else if (taskType === "CORRECTION_FREE") current.correction += 1;

    current.total = current.monitoring + current.reserve + current.review;
    map.set(teacher, current);
  }

  return Array.from(map.values()).sort(
    (a, b) => b.total - a.total || a.teacher.localeCompare(b.teacher, "ar")
  );
}

function buildTaskDistribution(rows: TeacherAnalyticsRow[]): DistributionItem[] {
  const monitoring = rows.reduce((sum, row) => sum + row.monitoring, 0);
  const reserve = rows.reduce((sum, row) => sum + row.reserve, 0);
  const review = rows.reduce((sum, row) => sum + row.review, 0);
  const correction = rows.reduce((sum, row) => sum + row.correction, 0);

  return [
    {
      key: "INVIGILATION",
      nameAr: "مراقبة",
      nameEn: "Invigilation",
      value: monitoring,
      color: COLORS.INVIGILATION,
    },
    {
      key: "RESERVE",
      nameAr: "احتياط",
      nameEn: "Reserve",
      value: reserve,
      color: COLORS.RESERVE,
    },
    {
      key: "REVIEW_FREE",
      nameAr: "مراجعة",
      nameEn: "Review",
      value: review,
      color: COLORS.REVIEW_FREE,
    },
    {
      key: "CORRECTION_FREE",
      nameAr: "تصحيح",
      nameEn: "Correction",
      value: correction,
      color: COLORS.CORRECTION_FREE,
    },
  ];
}

function scoreFairness(rows: TeacherAnalyticsRow[]): number {
  if (!rows.length) return 100;
  const totals = rows.map((row) => row.total);
  const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
  if (avg === 0) return 100;
  const variance =
    totals.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / totals.length;
  const std = Math.sqrt(variance);
  return Math.max(0, Math.min(100, Math.round(100 - (std / avg) * 45)));
}

function labelTaskType(type: TaskType, lang: Lang): string {
  const map: Record<TaskType, { ar: string; en: string }> = {
    INVIGILATION: { ar: "مراقبة", en: "Invigilation" },
    RESERVE: { ar: "احتياط", en: "Reserve" },
    REVIEW_FREE: { ar: "مراجعة", en: "Review" },
    CORRECTION_FREE: { ar: "تصحيح", en: "Correction" },
  };
  return lang === "ar" ? map[type].ar : map[type].en;
}

function buildAutoRedistributionSuggestions(
  rows: TeacherAnalyticsRow[],
  lang: Lang
): TransferSuggestion[] {
  const suggestions: TransferSuggestion[] = [];
  const taskTypes: TaskType[] = ["INVIGILATION", "RESERVE", "REVIEW_FREE"];

  const getValue = (row: TeacherAnalyticsRow, taskType: TaskType) => {
    if (taskType === "INVIGILATION") return row.monitoring;
    if (taskType === "RESERVE") return row.reserve;
    if (taskType === "REVIEW_FREE") return row.review;
    return row.correction;
  };

  const highestTotal = [...rows].sort((a, b) => b.total - a.total)[0];
  const lowestTotal = [...rows].sort((a, b) => a.total - b.total)[0];

  if (
    highestTotal &&
    lowestTotal &&
    highestTotal.teacher !== lowestTotal.teacher &&
    highestTotal.total - lowestTotal.total >= 3
  ) {
    suggestions.push({
      taskType: "INVIGILATION",
      from: highestTotal.teacher,
      to: lowestTotal.teacher,
      reason: tr(
        lang,
        `إجمالي الحمل على ${highestTotal.teacher} أعلى بوضوح من ${lowestTotal.teacher}، لذلك يفضّل نقل مهمة عامة أو أكثر بالتدرج.`,
        `${highestTotal.teacher} has a clearly heavier total workload than ${lowestTotal.teacher}, so gradually moving one or more general tasks is recommended.`
      ),
    });
  }

  for (const taskType of taskTypes) {
    const sorted = [...rows].sort((a, b) => getValue(b, taskType) - getValue(a, taskType));
    const from = sorted[0];
    const to = [...sorted].reverse().find((row) => row.teacher !== from?.teacher);
    if (!from || !to) continue;
    const difference = getValue(from, taskType) - getValue(to, taskType);
    if (difference >= 2) {
      suggestions.push({
        taskType,
        from: from.teacher,
        to: to.teacher,
        reason: tr(
          lang,
          `يوصى بنقل مهمة ${labelTaskType(taskType, lang)} واحدة من ${from.teacher} إلى ${to.teacher} لتقليل الفارق وتحسين التوازن.`,
          `Move one ${labelTaskType(taskType, lang)} task from ${from.teacher} to ${to.teacher} to reduce the gap and improve balance.`
        ),
      });
    }
  }

  return suggestions.slice(0, 6);
}

function buildInsights(rows: TeacherAnalyticsRow[], lang: Lang): string[] {
  if (!rows.length) {
    return [
      tr(
        lang,
        "لا توجد بيانات كافية لاستخراج ملاحظات تحليلية حالياً.",
        "There is not enough data yet to generate analytical insights."
      ),
    ];
  }

  const highest = [...rows].sort((a, b) => b.total - a.total)[0];
  const lowest = [...rows].sort((a, b) => a.total - b.total)[0];
  const fairness = scoreFairness(rows);
  const withoutReserve = rows.filter((row) => row.reserve === 0).length;
  const withoutReview = rows.filter((row) => row.review === 0).length;

  return [
    tr(
      lang,
      `درجة عدالة التوزيع الحالية تقارب ${fairness}%.`,
      `Current workload fairness is about ${fairness}%.`
    ),
    tr(
      lang,
      `أعلى حمل على ${highest.teacher} بإجمالي ${highest.total} مهام.`,
      `${highest.teacher} has the highest load with ${highest.total} tasks.`
    ),
    tr(
      lang,
      `أقل حمل على ${lowest.teacher} بإجمالي ${lowest.total} مهام.`,
      `${lowest.teacher} has the lowest load with ${lowest.total} tasks.`
    ),
    tr(
      lang,
      `عدد المعلمين بدون احتياط: ${withoutReserve}، وبدون مراجعة: ${withoutReview}.`,
      `${withoutReserve} teachers have no reserve tasks, and ${withoutReview} have no review tasks.`
    ),
  ];
}

function runSelfTests(): void {
  const sample: Assignment[] = [
    { teacherName: "A", taskType: "INVIGILATION" },
    { teacherName: "A", taskType: "RESERVE" },
    { teacherName: "B", taskType: "CORRECTION_FREE" },
    { teacherName: "B", taskType: "CORRECTION_FREE" },
    { teacherName: "B", taskType: "REVIEW_FREE" },
  ];

  const rows = buildTeacherAnalytics(sample);
  const tests = [
    {
      name: "aggregates total tasks per teacher excluding correction",
      pass: rows.find((row) => row.teacher === "A")?.total === 2,
    },
    {
      name: "correction is counted visually but excluded from total",
      pass:
        rows.find((row) => row.teacher === "B")?.correction === 2 &&
        rows.find((row) => row.teacher === "B")?.total === 1,
    },
    {
      name: "distribution total equals rows total",
      pass:
        buildTaskDistribution(rows).reduce((sum, item) => sum + item.value, 0) ===
        rows.reduce((sum, row) => sum + row.total, 0),
    },
    {
      name: "fairness score is bounded",
      pass: scoreFairness(rows) >= 0 && scoreFairness(rows) <= 100,
    },
    {
      name: "suggestions array is produced safely",
      pass: Array.isArray(buildAutoRedistributionSuggestions(rows, "ar")),
    },
  ];

  const failed = tests.filter((test) => !test.pass);
  if (failed.length) {
    console.warn("Analytics dashboard self-tests failed", failed);
  }
}

function KpiCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle: string;
}) {
  return (
    <div style={styles.kpiCard}>
      <div style={styles.kpiTitle}>{title}</div>
      <div style={styles.kpiValue}>{value}</div>
      <div style={styles.kpiSubtitle}>{subtitle}</div>
    </div>
  );
}

function ProgressBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const width = max > 0 ? Math.max(8, (value / max) * 100) : 0;
  return (
    <div style={styles.progressTrack}>
      {value > 0 ? (
        <div style={{ ...styles.progressFill, width: `${width}%`, background: color }} />
      ) : null}
    </div>
  );
}

function LegendItem({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div style={styles.legendItem}>
      <div style={{ ...styles.legendDot, background: color }} />
      <div style={styles.legendText}>{label}</div>
      <div style={styles.legendValue}>{value}</div>
    </div>
  );
}

function PieLikeChart({ data, lang }: { data: DistributionItem[]; lang: Lang }) {
  const total = Math.max(1, data.reduce((sum, item) => sum + item.value, 0));
  let current = 0;
  const segments = data.map((item) => {
    const start = current;
    const end = current + item.value / total;
    current = end;
    return { ...item, start, end };
  });

  const gradient = segments.length
    ? segments
        .map((segment) => `${segment.color} ${segment.start * 100}% ${segment.end * 100}%`)
        .join(", ")
    : "#333 0% 100%";

  return (
    <div style={styles.panel}>
      <SectionHeader
        title={tr(lang, "توزيع أنواع المهام", "Task-type distribution")}
        subtitle={tr(
          lang,
          "عرض بصري مباشر لحجم كل نوع من التكليفات",
          "A direct visual summary of each assignment type."
        )}
      />
      <div style={styles.chartWrap}>
        <div style={{ ...styles.pieCircle, background: `conic-gradient(${gradient})` }}>
          <div style={styles.pieHole}>
            <div style={styles.pieLabel}>{tr(lang, "الإجمالي", "Total")}</div>
            <div style={styles.pieValue}>
              {data.reduce((sum, item) => sum + item.value, 0)}
            </div>
          </div>
        </div>
        <div style={styles.legendList}>
          {data.map((item) => (
            <LegendItem
              key={item.key}
              color={item.color}
              label={lang === "ar" ? item.nameAr : item.nameEn}
              value={item.value}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TeacherBars({ rows, lang }: { rows: TeacherAnalyticsRow[]; lang: Lang }) {
  const topRows = rows.slice(0, 8);
  const maxTotal = Math.max(1, ...topRows.map((row) => row.total));

  return (
    <div style={styles.panel}>
      <SectionHeader
        title={tr(lang, "مقارنة أحمال المعلمين", "Teacher workload comparison")}
        subtitle={tr(lang, "أعلى 8 معلمين من حيث إجمالي الحمل", "Top 8 teachers by total workload.")}
      />
      <div style={styles.barList}>
        {topRows.map((row) => (
          <div key={row.teacher} style={styles.barRow}>
            <div style={styles.barTeacher}>{row.teacher}</div>
            <div style={styles.barTrack}>
              <div style={{ ...styles.barFill, width: `${(row.total / maxTotal) * 100}%` }} />
            </div>
            <div style={styles.barValue}>{row.total}</div>
          </div>
        ))}
      </div>
      <div style={styles.legendRow}>
        <LegendItem color={COLORS.INVIGILATION} label={tr(lang, "مراقبة", "Invigilation")} value={0} />
        <LegendItem color={COLORS.RESERVE} label={tr(lang, "احتياط", "Reserve")} value={0} />
        <LegendItem color={COLORS.REVIEW_FREE} label={tr(lang, "مراجعة", "Review")} value={0} />
      </div>
    </div>
  );
}

function StatusBadge({
  label,
  tone = "gold",
}: {
  label: string;
  tone?: "gold" | "green" | "blue";
}) {
  const palette = {
    gold: {
      bg: "rgba(250,204,21,0.12)",
      border: "rgba(250,204,21,0.22)",
      color: "#fde68a",
    },
    green: {
      bg: "rgba(16,185,129,0.12)",
      border: "rgba(16,185,129,0.22)",
      color: "#a7f3d0",
    },
    blue: {
      bg: "rgba(96,165,250,0.12)",
      border: "rgba(96,165,250,0.22)",
      color: "#bfdbfe",
    },
  } as const;
  const current = palette[tone];

  return (
    <span
      style={{
        ...styles.statusBadge,
        background: current.bg,
        borderColor: current.border,
        color: current.color,
      }}
    >
      {label}
    </span>
  );
}

function SummaryTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div style={styles.summaryTile}>
      <div style={styles.summaryTileLabel}>{label}</div>
      <div style={styles.summaryTileValue}>{value}</div>
      <div style={styles.summaryTileHint}>{hint}</div>
    </div>
  );
}

function StatusChip({
  label,
  tone = "gold",
}: {
  label: string;
  tone?: "gold" | "green" | "blue" | "slate";
}) {
  const toneStyles: Record<string, React.CSSProperties> = {
    gold: {
      background: "rgba(245, 158, 11, 0.12)",
      color: "#fde68a",
      border: "1px solid rgba(245, 158, 11, 0.22)",
    },
    green: {
      background: "rgba(16, 185, 129, 0.12)",
      color: "#a7f3d0",
      border: "1px solid rgba(16, 185, 129, 0.22)",
    },
    blue: {
      background: "rgba(59, 130, 246, 0.12)",
      color: "#bfdbfe",
      border: "1px solid rgba(59, 130, 246, 0.22)",
    },
    slate: {
      background: "rgba(148, 163, 184, 0.12)",
      color: "#e2e8f0",
      border: "1px solid rgba(148, 163, 184, 0.2)",
    },
  };

  return <span style={{ ...styles.statusChip, ...toneStyles[tone] }}>{label}</span>;
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={styles.sectionHeaderWrap}>
      <div>
        <div style={styles.sectionTitle}>{title}</div>
        {subtitle ? <div style={styles.sectionSub}>{subtitle}</div> : null}
      </div>
      <div style={styles.sectionLine} />
    </div>
  );
}

export default function AnalyticsDashboardProductionGrade() {
  const { lang } = useI18n();
  const [assignments, setAssignments] = useState<Assignment[]>(() => readAssignmentsFromStorage());
  const [showSuggestions, setShowSuggestions] = useState(true);

  useEffect(() => {
    runSelfTests();

    const refresh = () => setAssignments(readAssignmentsFromStorage());
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === MASTER_TABLE_KEY || RUN_STORAGE_KEYS.includes(event.key)) {
        refresh();
      }
    };

    window.addEventListener("focus", refresh);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const isRTL = lang === "ar";
  const rows = useMemo(() => buildTeacherAnalytics(assignments), [assignments]);
  const taskDistribution = useMemo(() => buildTaskDistribution(rows), [rows]);
  const insights = useMemo(() => buildInsights(rows, lang), [rows, lang]);
  const suggestions = useMemo(
    () => buildAutoRedistributionSuggestions(rows, lang),
    [rows, lang]
  );
  const fairness = useMemo(() => scoreFairness(rows), [rows]);
  const totalTasks = useMemo(() => rows.reduce((sum, row) => sum + row.total, 0), [rows]);
  const highest = rows[0];
  const lowest = [...rows].sort((a, b) => a.total - b.total)[0];
  const gapValue = highest && lowest ? highest.total - lowest.total : 0;
  const fairnessLabel =
    fairness >= 85
      ? tr(lang, "متوازن جداً", "Highly balanced")
      : fairness >= 70
      ? tr(lang, "جيد", "Good")
      : tr(lang, "بحاجة لتحسين", "Needs improvement");
  const activeTaskTypes = taskDistribution.filter((item) => item.value > 0).length;
  const maxMonitoring = Math.max(1, ...rows.map((row) => row.monitoring));
  const maxReserve = Math.max(1, ...rows.map((row) => row.reserve));
  const maxReview = Math.max(1, ...rows.map((row) => row.review));
  const maxCorrection = Math.max(1, ...rows.map((row) => row.correction));

  return (
    <div dir={isRTL ? "rtl" : "ltr"} style={styles.page}>
      <div style={styles.pageGlowTop} />
      <div style={styles.pageGlowSide} />
      <div style={styles.pageGlowBottom} />
      <div style={styles.container}>
        <div style={styles.topBar}>
          <div style={styles.topBarBrandWrap}>
            <div style={styles.brandMark}>EM</div>
            <div>
              <div style={styles.topBarTitle}>
                {tr(lang, "مركز قيادة التحليلات", "Ultra Analytics Command Center")}
              </div>
              <div style={styles.topBarSub}>
                {tr(
                  lang,
                  "لوحة تنفيذية فائقة الفخامة لقراءة الأحمال واتخاذ القرار",
                  "Ultra-premium executive dashboard for workload visibility and decision support"
                )}
              </div>
            </div>
          </div>
          <div style={styles.topBarBadges}>
            <StatusBadge label={tr(lang, "بيانات حقيقية فقط", "Real data only")} tone="green" />
            <StatusBadge
              label={tr(lang, `حالة التوازن: ${fairnessLabel}`, `Balance status: ${fairnessLabel}`)}
              tone={fairness >= 70 ? "gold" : "blue"}
            />
          </div>
        </div>

        <div style={styles.premiumRibbon}>
          <div style={styles.premiumRibbonItem}>
            {tr(lang, "رؤية تنفيذية فورية", "Instant executive visibility")}
          </div>
          <div style={styles.premiumRibbonDivider} />
          <div style={styles.premiumRibbonItem}>
            {tr(lang, "تحليلات مباشرة من النظام", "Direct analytics from the system")}
          </div>
          <div style={styles.premiumRibbonDivider} />
          <div style={styles.premiumRibbonItem}>
            {tr(lang, "قرار أسرع بثقة أعلى", "Faster decisions with higher confidence")}
          </div>
        </div>

        <div style={styles.hero}>
          <div style={styles.heroGrid}>
            <div>
              <div style={styles.heroEyebrow}>
                {tr(lang, "نظام إدارة الامتحانات المطور", "Enhanced Exam Management System")}
              </div>
              <h1 style={styles.heroTitle}>
                {tr(lang, "لوحة التحليل الذكي", "Smart Analytics Dashboard")}
              </h1>
              <p style={styles.heroText}>
                {tr(
                  lang,
                  "واجهة تحليل متقدمة تمنح المسؤول رؤية فورية لحالة توزيع المهام، وتعرض العدالة والفجوات والتوصيات بشكل بصري احترافي يعكس قوة النظام من أول لحظة دخول.",
                  "An advanced analytics experience that gives administrators an immediate view of task distribution, fairness, workload gaps, and smart recommendations in a premium visual presentation."
                )}
              </p>

              <div style={styles.heroFeatureRow}>
                <div style={styles.heroFeatureCard}>
                  <div style={styles.heroFeatureValue}>{rows.length}</div>
                  <div style={styles.heroFeatureLabel}>{tr(lang, "معلم مشارك", "Active teachers")}</div>
                </div>
                <div style={styles.heroFeatureCard}>
                  <div style={styles.heroFeatureValue}>{totalTasks}</div>
                  <div style={styles.heroFeatureLabel}>{tr(lang, "حمل فعلي", "Real workload")}</div>
                </div>
                <div style={styles.heroFeatureCard}>
                  <div style={styles.heroFeatureValue}>{`${fairness}%`}</div>
                  <div style={styles.heroFeatureLabel}>{tr(lang, "توازن الأحمال", "Workload balance")}</div>
                </div>
              </div>
            </div>

            <div style={styles.heroSpotlight}>
              <div style={styles.heroSpotlightBadge}>
                {tr(lang, "تحليل مباشر من بيانات البرنامج", "Live analytics from program data")}
              </div>
              <div style={styles.heroSpotlightTitle}>
                {tr(
                  lang,
                  "رؤية أوضح. قرار أسرع. واجهة عالمية تبهر المستخدم من اللحظة الأولى.",
                  "Sharper visibility. Faster decisions. A dashboard that impresses."
                )}
              </div>
              <div style={styles.heroSpotlightText}>
                {tr(
                  lang,
                  "الواجهة تعرض المؤشرات الأساسية والرسوم التحليلية والملاحظات واقتراحات إعادة التوزيع ضمن تجربة مرئية فاخرة، مع الحفاظ الكامل على منطق الصفحة ومصدر البيانات الحقيقي فقط.",
                  "The interface presents KPIs, visual analytics, insights, and redistribution suggestions in a polished premium experience while preserving the original logic and real data source only."
                )}
              </div>
              <div style={styles.heroButtons}>
                <button
                  style={styles.primaryButton}
                  onClick={() => setAssignments(readAssignmentsFromStorage())}
                >
                  {tr(lang, "تحديث الآن", "Refresh now")}
                </button>
                <button
                  style={styles.secondaryButton}
                  onClick={() => setShowSuggestions((value) => !value)}
                >
                  {showSuggestions
                    ? tr(lang, "إخفاء اقتراحات AI", "Hide AI suggestions")
                    : tr(lang, "إظهار اقتراحات AI", "Show AI suggestions")}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.executiveStrip}>
          <SummaryTile
            label={tr(lang, "ملخص تنفيذي", "Executive summary")}
            value={rows.length ? fairnessLabel : tr(lang, "بانتظار البيانات", "Awaiting data")}
            hint={tr(lang, "قراءة سريعة لحالة التشغيل الحالية", "A quick reading of the current run")}
          />
          <SummaryTile
            label={tr(lang, "أنواع المهام النشطة", "Active task types")}
            value={activeTaskTypes}
            hint={tr(
              lang,
              "عدد الأنواع التي ظهرت فعلياً في هذا التشغيل",
              "Task categories that actually appeared in this run"
            )}
          />
          <SummaryTile
            label={tr(lang, "أعلى حمل", "Highest load")}
            value={highest ? highest.total : 0}
            hint={highest ? highest.teacher : tr(lang, "لا يوجد", "None")}
          />
          <SummaryTile
            label={tr(lang, "فجوة التوزيع", "Distribution gap")}
            value={gapValue}
            hint={tr(
              lang,
              "الفارق بين أعلى وأقل معلم حملاً",
              "Difference between highest and lowest load"
            )}
          />
        </div>

        <div style={styles.executiveStrip}>
          <div style={styles.executiveItem}>
            <div style={styles.executiveLabel}>{tr(lang, "الحالة التشغيلية", "Operational status")}</div>
            <div style={styles.executiveValue}>
              {rows.length ? tr(lang, "نشط", "Active") : tr(lang, "بانتظار البيانات", "Waiting for data")}
            </div>
          </div>
          <div style={styles.executiveItem}>
            <div style={styles.executiveLabel}>{tr(lang, "مصدر البيانات", "Data source")}</div>
            <div style={styles.executiveValue}>{tr(lang, "النظام فقط", "System only")}</div>
          </div>
          <div style={styles.executiveItem}>
            <div style={styles.executiveLabel}>{tr(lang, "المعلم الأعلى حملاً", "Top loaded teacher")}</div>
            <div style={styles.executiveValueSm}>{highest?.teacher || tr(lang, "—", "—")}</div>
          </div>
          <div style={styles.executiveItem}>
            <div style={styles.executiveLabel}>{tr(lang, "المعلم الأقل حملاً", "Lowest loaded teacher")}</div>
            <div style={styles.executiveValueSm}>{lowest?.teacher || tr(lang, "—", "—")}</div>
          </div>
        </div>

        <div style={styles.kpiGrid}>
          <KpiCard
            title={tr(lang, "عدد المعلمين", "Teachers")}
            value={rows.length}
            subtitle={tr(lang, "المشاركون في هذا التشغيل", "Participating in this run")}
          />
          <KpiCard
            title={tr(lang, "إجمالي الأحمال", "Total workload")}
            value={totalTasks}
            subtitle={tr(lang, "مراقبة + احتياط + مراجعة فقط", "Invigilation + reserve + review only")}
          />
          <KpiCard
            title={tr(lang, "درجة العدالة", "Fairness score")}
            value={`${fairness}%`}
            subtitle={tr(
              lang,
              "كلما ارتفعت كانت الأحمال أكثر توازناً",
              "Higher means a better-balanced workload"
            )}
          />
          <KpiCard
            title={tr(lang, "أعلى فجوة", "Highest gap")}
            value={highest && lowest ? highest.total - lowest.total : 0}
            subtitle={tr(lang, "الفرق بين أعلى وأقل حمل", "Difference between highest and lowest load")}
          />
        </div>

        <div style={styles.twoCols}>
          <PieLikeChart data={taskDistribution} lang={lang} />
          <TeacherBars rows={rows} lang={lang} />
        </div>

        <div style={styles.twoCols}>
          <div style={styles.panel}>
            <SectionHeader
              title={tr(lang, "التحليل التفصيلي للمعلمين", "Detailed teacher analytics")}
              subtitle={tr(
                lang,
                "عرض تفصيلي لكل معلم حسب نوع المهمة وإجمالي الحمل",
                "Detailed teacher-by-teacher breakdown by task type and total load."
              )}
            />
            <div style={styles.teacherList}>
              {rows.length ? (
                rows.map((row, index) => (
                  <div key={row.teacher} style={styles.teacherCard}>
                    <div style={styles.teacherHeader}>
                      <div>
                        <div style={styles.teacherName}>
                          {index + 1}. {row.teacher}
                        </div>
                        <div style={styles.teacherSub}>
                          {tr(lang, "إجمالي الحمل (بدون التصحيح)", "Total load (excluding correction)")}: {row.total}
                        </div>
                      </div>
                      <div style={styles.pillsWrap}>
                        <span
                          style={{
                            ...styles.pill,
                            background: "rgba(250,204,21,0.18)",
                            color: COLORS.INVIGILATION,
                          }}
                        >
                          {tr(lang, "مراقبة", "Invigilation")}: {row.monitoring}
                        </span>
                        <span
                          style={{
                            ...styles.pill,
                            background: "rgba(251,146,60,0.18)",
                            color: COLORS.RESERVE,
                          }}
                        >
                          {tr(lang, "احتياط", "Reserve")}: {row.reserve}
                        </span>
                        <span
                          style={{
                            ...styles.pill,
                            background: "rgba(74,222,128,0.18)",
                            color: COLORS.REVIEW_FREE,
                          }}
                        >
                          {tr(lang, "مراجعة", "Review")}: {row.review}
                        </span>
                        <span
                          style={{
                            ...styles.pill,
                            background: "rgba(229,231,235,0.18)",
                            color: COLORS.CORRECTION_FREE,
                          }}
                        >
                          {tr(lang, "تصحيح", "Correction")}: {row.correction}
                        </span>
                      </div>
                    </div>
                    <div style={styles.progressGrid}>
                      <div>
                        <div style={styles.metricLabel}>
                          {tr(lang, "مراقبة", "Invigilation")} — {row.monitoring}
                        </div>
                        <ProgressBar value={row.monitoring} max={maxMonitoring} color={COLORS.INVIGILATION} />
                      </div>
                      <div>
                        <div style={styles.metricLabel}>
                          {tr(lang, "احتياط", "Reserve")} — {row.reserve}
                        </div>
                        <ProgressBar value={row.reserve} max={maxReserve} color={COLORS.RESERVE} />
                      </div>
                      <div>
                        <div style={styles.metricLabel}>
                          {tr(lang, "مراجعة", "Review")} — {row.review}
                        </div>
                        <ProgressBar value={row.review} max={maxReview} color={COLORS.REVIEW_FREE} />
                      </div>
                      <div>
                        <div style={styles.metricLabel}>
                          {tr(lang, "تصحيح", "Correction")} — {row.correction}
                        </div>
                        <ProgressBar
                          value={row.correction}
                          max={maxCorrection}
                          color={COLORS.CORRECTION_FREE}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={styles.emptyState}>
                  <div style={styles.emptyStateIcon}>✦</div>
                  <div style={styles.emptyStateTitle}>
                    {tr(lang, "لا توجد بيانات حقيقية متاحة حالياً", "No real data is currently available")}
                  </div>
                  <div style={styles.emptyStateText}>
                    {tr(
                      lang,
                      "يرجى تنفيذ التوزيع من داخل البرنامج أولاً، ثم العودة إلى هذه الصفحة لعرض التحليلات الفعلية المستمدة من النظام فقط.",
                      "Please run the distribution from within the program first, then return to this page to view the actual analytics generated only from system data."
                    )}
                  </div>
                  <div style={styles.emptyStateHint}>
                    {tr(
                      lang,
                      "بمجرد توفر البيانات سيظهر هنا التحليل الكامل والرسوم والمؤشرات بشكل تلقائي.",
                      "Once real data is available, the complete analytics, charts, and indicators will appear here automatically."
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={styles.panel}>
            <SectionHeader
              title={tr(lang, "ملاحظات تحليلية", "Analytical notes")}
              subtitle={tr(
                lang,
                "خلاصة سريعة تساعد المسؤول على فهم الوضع الحالي",
                "Quick insights to help administrators understand the current state."
              )}
            />
            <div style={styles.notesList}>
              {insights.map((note, index) => (
                <div key={`${note}-${index}`} style={styles.noteCard}>
                  {note}
                </div>
              ))}
            </div>
          </div>
        </div>

        {showSuggestions && (
          <div style={{ ...styles.panel, borderColor: "rgba(16,185,129,0.28)" }}>
            <SectionHeader
              title={tr(lang, "اقتراحات AI لإعادة التوزيع", "AI redistribution suggestions")}
              subtitle={tr(
                lang,
                "اقتراحات استرشادية لتحسين التوازن دون تنفيذ تلقائي",
                "Advisory suggestions to improve balance without automatic execution."
              )}
            />
            <div style={styles.sectionSub}>
              {tr(
                lang,
                "اقتراحات ذكية مبنية على الفروقات الحالية بين المعلمين وأنواع المهام. الاقتراحات استرشادية وتساعد المسؤول على اتخاذ قرار أسرع.",
                "Smart suggestions based on current workload differences between teachers and task types. They are advisory and help the administrator make faster decisions."
              )}
            </div>
            {suggestions.length ? (
              <div style={styles.suggestionGrid}>
                {suggestions.map((item, index) => (
                  <div key={`${item.from}-${item.to}-${index}`} style={styles.suggestionCard}>
                    <div style={styles.suggestionTitle}>{labelTaskType(item.taskType, lang)}</div>
                    <div style={styles.suggestionBody}>{item.reason}</div>
                    <div style={styles.tagsWrap}>
                      <span
                        style={{
                          ...styles.tag,
                          background: "rgba(239,68,68,0.16)",
                          color: "#fecaca",
                        }}
                      >
                        {tr(lang, "من", "From")}: {item.from}
                      </span>
                      <span
                        style={{
                          ...styles.tag,
                          background: "rgba(16,185,129,0.16)",
                          color: "#a7f3d0",
                        }}
                      >
                        {tr(lang, "إلى", "To")}: {item.to}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.emptyState}>
                {tr(
                  lang,
                  "لا توجد فجوات كبيرة حالياً. التوزيع يبدو متوازناً بشكل جيد.",
                  "No major gaps detected right now. The distribution already looks fairly balanced."
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bgOrbOne: {
    position: "fixed",
    top: -140,
    left: -120,
    width: 360,
    height: 360,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(245,158,11,0.18), rgba(245,158,11,0) 70%)",
    pointerEvents: "none",
    filter: "blur(10px)",
  },
  bgOrbTwo: {
    position: "fixed",
    bottom: -120,
    right: -80,
    width: 420,
    height: 420,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(59,130,246,0.14), rgba(59,130,246,0) 72%)",
    pointerEvents: "none",
    filter: "blur(14px)",
  },
  bgGrid: {
    position: "fixed",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
    backgroundSize: "34px 34px",
    maskImage: "radial-gradient(circle at center, black 46%, transparent 100%)",
    pointerEvents: "none",
    opacity: 0.28,
  },
  statusChip: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 900,
    backdropFilter: "blur(10px)",
  },
  executiveStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  executiveItem: {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
    backdropFilter: "blur(16px)",
  },
  executiveLabel: {
    fontSize: 12,
    color: "rgba(226,232,240,0.72)",
    fontWeight: 800,
    marginBottom: 8,
  },
  executiveValue: {
    fontSize: 24,
    color: "#f8fafc",
    fontWeight: 900,
  },
  executiveValueSm: {
    fontSize: 16,
    color: "#f8fafc",
    fontWeight: 800,
    lineHeight: 1.7,
  },
  sectionHeaderWrap: {
    display: "grid",
    gap: 12,
    marginBottom: 16,
  },
  sectionLine: {
    height: 1,
    background:
      "linear-gradient(90deg, rgba(245,158,11,0.35), rgba(255,255,255,0.05), rgba(255,255,255,0))",
  },
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, rgba(250,204,21,0.16), transparent 22%), radial-gradient(circle at 20% 20%, rgba(59,130,246,0.09), transparent 25%), linear-gradient(180deg, #070707 0%, #030303 100%)",
    color: "#fef3c7",
    padding: 20,
    fontFamily: "Tahoma, Arial, sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  pageGlowTop: {
    position: "absolute",
    top: -160,
    left: "50%",
    transform: "translateX(-50%)",
    width: 620,
    height: 620,
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(250,204,21,0.18) 0%, rgba(250,204,21,0.05) 35%, transparent 72%)",
    pointerEvents: "none",
    filter: "blur(8px)",
  },
  pageGlowBottom: {
    position: "absolute",
    bottom: -220,
    left: -160,
    width: 520,
    height: 520,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 72%)",
    pointerEvents: "none",
    filter: "blur(16px)",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    padding: "6px 2px 0",
  },
  topBarBrandWrap: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    letterSpacing: ".06em",
    color: "#111",
    background: "linear-gradient(135deg, #fff1a6, #f59e0b)",
    boxShadow: "0 12px 28px rgba(245,158,11,0.22)",
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#fff7cc",
    lineHeight: 1.4,
  },
  topBarSub: {
    fontSize: 13,
    color: "rgba(254,243,199,0.66)",
    lineHeight: 1.7,
  },
  topBarBadges: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid transparent",
    borderRadius: 999,
    padding: "9px 12px",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.2,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },
  summaryTile: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 28,
    padding: 20,
    background: "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015))",
    boxShadow: "0 18px 46px rgba(0,0,0,0.26)",
    backdropFilter: "blur(10px)",
  },
  summaryTileLabel: {
    fontSize: 13,
    color: "rgba(191,219,254,0.92)",
    fontWeight: 800,
    marginBottom: 10,
  },
  summaryTileValue: {
    fontSize: 28,
    fontWeight: 900,
    color: "#fff7cc",
    marginBottom: 8,
    lineHeight: 1.2,
  },
  summaryTileHint: {
    fontSize: 12,
    color: "rgba(254,243,199,0.66)",
    lineHeight: 1.75,
  },
  pageGlowSide: {
    position: "absolute",
    top: 240,
    right: -180,
    width: 420,
    height: 420,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)",
    pointerEvents: "none",
    filter: "blur(10px)",
  },
  premiumRibbon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    flexWrap: "wrap",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 999,
    padding: "12px 18px",
    background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
    boxShadow: "0 16px 36px rgba(0,0,0,0.22)",
    backdropFilter: "blur(10px)",
  },
  premiumRibbonItem: {
    fontSize: 13,
    fontWeight: 800,
    color: "#fff4b0",
    letterSpacing: ".01em",
  },
  premiumRibbonDivider: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "rgba(250,204,21,0.7)",
    boxShadow: "0 0 16px rgba(250,204,21,0.45)",
  },
  container: {
    maxWidth: 1500,
    margin: "0 auto",
    display: "grid",
    gap: 22,
    position: "relative",
    zIndex: 1,
  },
  hero: {
    border: "1px solid rgba(250,204,21,0.16)",
    borderRadius: 38,
    background:
      "linear-gradient(135deg, rgba(36,29,7,0.92), rgba(0,0,0,0.92), rgba(31,24,4,0.94))",
    boxShadow:
      "0 30px 100px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(255,255,255,0.03)",
    padding: 30,
    position: "relative",
    overflow: "hidden",
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.9fr)",
    gap: 22,
    alignItems: "stretch",
  },
  heroEyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "#fde68a",
    fontWeight: 800,
    border: "1px solid rgba(250,204,21,0.2)",
    borderRadius: 999,
    padding: "8px 12px",
    background: "rgba(250,204,21,0.08)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },
  heroTitle: {
    margin: "16px 0 12px",
    fontSize: "clamp(34px, 5vw, 64px)",
    lineHeight: 1.05,
    fontWeight: 900,
    color: "#fff4b0",
    letterSpacing: "-0.02em",
    textShadow: "0 8px 30px rgba(250,204,21,0.12)",
  },
  heroText: {
    margin: 0,
    maxWidth: 840,
    fontSize: 16,
    lineHeight: 2,
    color: "rgba(254,243,199,0.84)",
  },
  heroFeatureRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 14,
    marginTop: 20,
  },
  heroFeatureCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
    borderRadius: 28,
    padding: 20,
    boxShadow: "0 14px 34px rgba(0,0,0,0.22)",
  },
  heroFeatureValue: {
    fontSize: 34,
    fontWeight: 900,
    color: "#fff1a6",
    marginBottom: 6,
  },
  heroFeatureLabel: {
    fontSize: 13,
    color: "rgba(254,243,199,0.74)",
    fontWeight: 700,
  },
  heroSpotlight: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 34,
    padding: 22,
    background: "linear-gradient(180deg, rgba(250,204,21,0.07), rgba(255,255,255,0.03))",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
    display: "grid",
    alignContent: "space-between",
    gap: 16,
  },
  heroSpotlightBadge: {
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(16,185,129,0.12)",
    border: "1px solid rgba(16,185,129,0.22)",
    color: "#a7f3d0",
    fontWeight: 800,
    fontSize: 12,
  },
  heroSpotlightTitle: {
    fontSize: 27,
    lineHeight: 1.45,
    fontWeight: 900,
    color: "#fff7cc",
  },
  heroSpotlightText: {
    fontSize: 14,
    lineHeight: 1.95,
    color: "rgba(254,243,199,0.8)",
  },
  heroButtons: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  primaryButton: {
    background: "linear-gradient(135deg, #fde047, #f59e0b)",
    color: "#111",
    border: "none",
    borderRadius: 20,
    padding: "13px 18px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(250,204,21,0.2)",
  },
  secondaryButton: {
    background: "rgba(255,255,255,0.04)",
    color: "#fef3c7",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 20,
    padding: "13px 18px",
    fontWeight: 800,
    cursor: "pointer",
    backdropFilter: "blur(6px)",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: 16,
  },
  kpiCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 30,
    background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02))",
    padding: 20,
    boxShadow: "0 18px 44px rgba(0,0,0,0.24)",
    backdropFilter: "blur(10px)",
  },
  kpiTitle: {
    fontSize: 13,
    color: "rgba(253,224,71,0.76)",
    fontWeight: 800,
    letterSpacing: ".02em",
  },
  kpiValue: {
    fontSize: 42,
    color: "#fff8c9",
    fontWeight: 900,
    marginTop: 10,
  },
  kpiSubtitle: {
    fontSize: 12,
    color: "rgba(254,243,199,0.64)",
    marginTop: 8,
    lineHeight: 1.7,
  },
  twoCols: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
    gap: 20,
  },
  panel: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 34,
    background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
    padding: 24,
    boxShadow: "0 18px 50px rgba(0,0,0,0.28)",
    backdropFilter: "blur(10px)",
  },
  sectionTitle: {
    fontSize: 30,
    fontWeight: 900,
    color: "#fff1a6",
    marginBottom: 14,
    lineHeight: 1.25,
  },
  sectionSub: {
    fontSize: 14,
    lineHeight: 1.95,
    color: "rgba(254,243,199,0.72)",
    marginBottom: 18,
  },
  chartWrap: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    alignItems: "center",
    gap: 22,
  },
  pieCircle: {
    width: 276,
    height: 276,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto",
    boxShadow: "0 18px 44px rgba(0,0,0,0.34)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  pieHole: {
    width: 138,
    height: 138,
    borderRadius: "50%",
    background: "rgba(6,6,6,0.96)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    border: "1px solid rgba(250,204,21,0.16)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },
  pieLabel: {
    fontSize: 13,
    color: "rgba(254,243,199,0.7)",
  },
  pieValue: {
    fontSize: 32,
    fontWeight: 900,
    color: "#fff1a6",
  },
  legendList: {
    display: "grid",
    gap: 12,
  },
  legendRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 18,
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: "9px 11px",
    background: "rgba(255,255,255,0.03)",
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    flex: "0 0 auto",
  },
  legendText: {
    fontSize: 14,
    color: "#fef3c7",
  },
  legendValue: {
    fontSize: 13,
    color: "#fde047",
    fontWeight: 800,
  },
  barList: {
    display: "grid",
    gap: 14,
  },
  barRow: {
    display: "grid",
    gridTemplateColumns: "minmax(150px, 220px) 1fr 48px",
    gap: 10,
    alignItems: "center",
  },
  barTeacher: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "#fef3c7",
    fontWeight: 700,
  },
  barTrack: {
    height: 18,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    boxShadow: "inset 0 1px 5px rgba(0,0,0,0.5)",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #fde047, #f97316)",
    boxShadow: "0 8px 18px rgba(250,204,21,0.18)",
  },
  barValue: {
    textAlign: "center",
    color: "#fff1a6",
    fontWeight: 900,
  },
  teacherList: {
    display: "grid",
    gap: 14,
    maxHeight: 820,
    overflowY: "auto",
    paddingRight: 4,
  },
  teacherCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 28,
    background: "linear-gradient(180deg, rgba(250,204,21,0.05), rgba(255,255,255,0.02))",
    padding: 20,
    boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
  },
  teacherHeader: {
    display: "grid",
    gap: 12,
    marginBottom: 14,
  },
  teacherName: {
    fontSize: 19,
    fontWeight: 900,
    color: "#fff1a6",
    lineHeight: 1.55,
  },
  teacherSub: {
    marginTop: 6,
    fontSize: 13,
    color: "rgba(254,243,199,0.68)",
  },
  pillsWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  pill: {
    borderRadius: 999,
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  progressGrid: {
    display: "grid",
    gap: 13,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: "#fef3c7",
    marginBottom: 6,
  },
  progressTrack: {
    width: "100%",
    height: 14,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    boxShadow: "inset 0 1px 4px rgba(0,0,0,0.6)",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    boxShadow: "0 6px 16px rgba(255,255,255,0.08)",
  },
  notesList: {
    display: "grid",
    gap: 12,
  },
  noteCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 16,
    background: "linear-gradient(180deg, rgba(250,204,21,0.06), rgba(255,255,255,0.02))",
    color: "rgba(254,243,199,0.9)",
    lineHeight: 1.95,
    boxShadow: "0 10px 24px rgba(0,0,0,0.14)",
  },
  suggestionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 15,
  },
  suggestionCard: {
    border: "1px solid rgba(16,185,129,0.18)",
    borderRadius: 28,
    background: "linear-gradient(180deg, rgba(16,185,129,0.08), rgba(255,255,255,0.02))",
    padding: 20,
    boxShadow: "0 14px 30px rgba(0,0,0,0.18)",
  },
  suggestionTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#6ee7b7",
    marginBottom: 10,
  },
  suggestionBody: {
    fontSize: 14,
    lineHeight: 1.95,
    color: "rgba(254,243,199,0.9)",
  },
  tagsWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 12,
  },
  tag: {
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid rgba(255,255,255,0.06)",
  },
  emptyState: {
    border: "1px dashed rgba(250,204,21,0.28)",
    borderRadius: 30,
    padding: "34px 22px",
    color: "rgba(254,243,199,0.78)",
    textAlign: "center",
    lineHeight: 1.9,
    background: "radial-gradient(circle at top, rgba(250,204,21,0.08), rgba(255,255,255,0.02))",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },
  emptyStateIcon: {
    textShadow: "0 0 30px rgba(250,204,21,0.35)",
    width: 72,
    height: 72,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 14px",
    fontSize: 32,
    color: "#fde047",
    background: "rgba(250,204,21,0.1)",
    border: "1px solid rgba(250,204,21,0.2)",
    boxShadow: "0 12px 30px rgba(250,204,21,0.08)",
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: 900,
    color: "#fff1a6",
    marginBottom: 10,
  },
  emptyStateText: {
    fontSize: 14,
    lineHeight: 2,
    color: "rgba(254,243,199,0.84)",
    maxWidth: 720,
    margin: "0 auto",
  },
  emptyStateHint: {
    marginTop: 14,
    fontSize: 13,
    color: "rgba(167,243,208,0.88)",
    fontWeight: 700,
  },
};