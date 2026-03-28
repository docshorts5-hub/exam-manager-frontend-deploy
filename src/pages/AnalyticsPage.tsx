import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { loadRun, RUN_UPDATED_EVENT } from "../utils/taskDistributionStorage";
import { useI18n } from "../i18n/I18nProvider";

const MASTER_TABLE_KEY = "exam-manager:task-distribution:master-table:v1";

type AnalyticsSource = {
  assignments: any[];
};

type TeacherAnalyticsRow = {
  teacher: string;
  monitoring: number;
  reserve: number;
  review: number;
  correction: number;
};

function getTenantIdFromAuth(auth: any) {
  return (
    String(
      auth?.effectiveTenantId || auth?.profile?.tenantId || auth?.userProfile?.tenantId || auth?.user?.tenantId || "default"
    ).trim() || "default"
  );
}

function safeReadMasterTable(): AnalyticsSource | null {
  try {
    const raw = localStorage.getItem(MASTER_TABLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed?.rows) ? parsed.rows : Array.isArray(parsed?.data) ? parsed.data : [];
    if (!rows.length) return null;
    return { assignments: rows };
  } catch {
    return null;
  }
}

function loadAnalyticsSource(tenantId: string): AnalyticsSource | null {
  const run = loadRun(tenantId);
  if (run?.assignments?.length) return { assignments: run.assignments };
  return safeReadMasterTable();
}

function getTeacherName(item: any) {
  return String(item?.teacherName || item?.teacher?.name || item?.teacher || item?.name || "").trim();
}

function getTaskType(item: any) {
  const raw = String(item?.taskType || item?.type || "").trim();
  if (raw === "INVIGILATION" || raw === "مراقبة") return "INVIGILATION";
  if (raw === "RESERVE" || raw === "احتياط") return "RESERVE";
  if (raw === "REVIEW_FREE" || raw === "مراجعة") return "REVIEW_FREE";
  if (raw === "CORRECTION_FREE" || raw === "تصحيح") return "CORRECTION_FREE";
  return raw;
}

function buildTeacherAnalytics(assignments: any[]): TeacherAnalyticsRow[] {
  const map = new Map<string, TeacherAnalyticsRow>();

  for (const assignment of assignments || []) {
    const teacher = getTeacherName(assignment);
    if (!teacher) continue;

    const current = map.get(teacher) || { teacher, monitoring: 0, reserve: 0, review: 0, correction: 0 };
    const taskType = getTaskType(assignment);

    if (taskType === "INVIGILATION") current.monitoring += 1;
    else if (taskType === "RESERVE") current.reserve += 1;
    else if (taskType === "REVIEW_FREE") current.review += 1;
    else if (taskType === "CORRECTION_FREE") current.correction += 1;

    map.set(teacher, current);
  }

  return Array.from(map.values()).sort((a, b) => a.teacher.localeCompare(b.teacher, "ar"));
}

function StatCard({ value, label, accent = "#ffd400" }: { value: number; label: string; accent?: string }) {
  const isReserve = accent === "#ff8f1f";
  return (
    <div
      style={{
        background: "linear-gradient(180deg, rgba(0,0,0,0.98), rgba(3,3,3,0.96))",
        border: isReserve ? "1px solid rgba(255, 143, 31, 0.45)" : "1px solid rgba(201, 154, 0, 0.45)",
        borderRadius: 24,
        padding: "18px 20px",
        minHeight: 98,
        boxShadow: isReserve
          ? "0 0 0 1px rgba(255, 143, 31, 0.06) inset, 0 18px 38px rgba(0, 0, 0, 0.35)"
          : "0 0 0 1px rgba(255, 196, 0, 0.05) inset, 0 18px 38px rgba(0, 0, 0, 0.35)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          color: accent,
          fontSize: 30,
          fontWeight: 800,
          lineHeight: 1,
          textShadow: isReserve ? "0 2px 12px rgba(255, 143, 31, 0.22)" : "0 2px 12px rgba(255, 212, 0, 0.25)",
        }}
      >
        {value}
      </div>
      <div style={{ color: accent, fontSize: 16, fontWeight: 700, textAlign: "center" }}>{label}</div>
    </div>
  );
}

function ProgressMetric({ value, max, color, alignRight }: { value: number; max: number; color: string; alignRight: boolean }) {
  const percent = max > 0 ? Math.max(10, (value / max) * 100) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "stretch" }}>
      <div style={{ color: "#ffd400", fontWeight: 800, fontSize: 18, lineHeight: 1, textAlign: "center" }}>{value}</div>
      <div
        style={{
          height: 16,
          width: "100%",
          borderRadius: 999,
          background: "rgba(255,255,255,0.08)",
          position: "relative",
          overflow: "hidden",
          boxShadow: "inset 0 1px 4px rgba(0,0,0,0.7)",
        }}
      >
        {value > 0 ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              [alignRight ? "right" : "left"]: 0,
              width: `${percent}%`,
              borderRadius: 999,
              background: color,
              boxShadow: "0 0 12px rgba(255,255,255,0.08)",
            } as React.CSSProperties}
          />
        ) : null}
      </div>
    </div>
  );
}

function buildInsights(rows: TeacherAnalyticsRow[], lang: "ar" | "en") {
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  if (!rows.length) {
    return [tr("لا توجد بيانات كافية لاستخراج ملاحظات تحليلية حالياً.", "There is not enough data yet to generate analytical insights.")];
  }

  const monitoringTotal = rows.reduce((sum, row) => sum + row.monitoring, 0);
  const reserveTotal = rows.reduce((sum, row) => sum + row.reserve, 0);
  const reviewTotal = rows.reduce((sum, row) => sum + row.review, 0);
  const correctionTotal = rows.reduce((sum, row) => sum + row.correction, 0);

  const totals = [
    { label: tr("المراقبة", "Invigilation"), value: monitoringTotal },
    { label: tr("الاحتياط", "Reserve"), value: reserveTotal },
    { label: tr("المراجعة", "Review"), value: reviewTotal },
    { label: tr("التصحيح", "Correction"), value: correctionTotal },
  ].sort((a, b) => b.value - a.value);

  const totalTasksForTeacher = (row: TeacherAnalyticsRow) => row.monitoring + row.reserve + row.review + row.correction;
  const topTeacher = [...rows].sort((a, b) => totalTasksForTeacher(b) - totalTasksForTeacher(a))[0];
  const missingReviewCount = rows.filter((row) => row.review === 0).length;
  const missingReserveCount = rows.filter((row) => row.reserve === 0).length;
  const balancedCount = rows.filter((row) => {
    const values = [row.monitoring, row.reserve, row.review, row.correction].filter((item) => item > 0);
    if (values.length < 2) return false;
    return Math.max(...values) - Math.min(...values) <= 1;
  }).length;

  const notes = [
    tr(`${totals[0].label} هي النوع الأكثر استخداماً في التوزيع الحالي.`, `${totals[0].label} is the most used task type in the current distribution.`),
    tr(`المعلم الأكثر تكليفاً حالياً هو ${topTeacher.teacher} بعدد ${totalTasksForTeacher(topTeacher)} مهمة.`, `The most assigned teacher right now is ${topTeacher.teacher} with ${totalTasksForTeacher(topTeacher)} tasks.`),
  ];

  if (balancedCount > 0) {
    notes.push(
      tr(
        `يوجد تقارب جيد في توزيع المهام لدى ${balancedCount} من المعلمين مع قابلية لتحسين التوازن بشكل أكبر.`,
        `${balancedCount} teachers already have a fairly balanced workload, with room for even better balancing.`
      )
    );
  }

  if (missingReserveCount > 0) {
    notes.push(tr(`يوجد ${missingReserveCount} من المعلمين بدون مهام احتياط في هذا التشغيل.`, `${missingReserveCount} teachers have no reserve assignments in this run.`));
  }

  if (missingReviewCount > 0) {
    notes.push(tr(`يوجد ${missingReviewCount} من المعلمين بدون مهام مراجعة في هذا التشغيل.`, `${missingReviewCount} teachers have no review assignments in this run.`));
  }

  return notes.slice(0, 4);
}

export default function AnalyticsPage() {
  const auth = useAuth();
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const tenantId = useMemo(() => getTenantIdFromAuth(auth), [auth]);
  const [source, setSource] = useState<AnalyticsSource | null>(() => loadAnalyticsSource(tenantId));

  useEffect(() => {
    const refresh = () => setSource(loadAnalyticsSource(tenantId));
    refresh();

    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.includes("exam-manager:task-distribution")) refresh();
    };

    window.addEventListener("focus", refresh);
    window.addEventListener("storage", onStorage);
    window.addEventListener(RUN_UPDATED_EVENT, refresh as EventListener);

    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(RUN_UPDATED_EVENT, refresh as EventListener);
    };
  }, [tenantId]);

  const rows = useMemo(() => buildTeacherAnalytics(source?.assignments || []), [source]);

  const stats = useMemo(() => {
    const monitoring = rows.reduce((sum, row) => sum + row.monitoring, 0);
    const reserve = rows.reduce((sum, row) => sum + row.reserve, 0);
    const review = rows.reduce((sum, row) => sum + row.review, 0);
    const correction = rows.reduce((sum, row) => sum + row.correction, 0);
    return { teacherCount: rows.length, monitoring, reserve, review, correction };
  }, [rows]);

  const maxValues = useMemo(() => {
    const monitoring = Math.max(0, ...rows.map((row) => row.monitoring));
    const reserve = Math.max(0, ...rows.map((row) => row.reserve));
    const review = Math.max(0, ...rows.map((row) => row.review));
    const correction = Math.max(0, ...rows.map((row) => row.correction));
    return { monitoring, reserve, review, correction };
  }, [rows]);

  const insights = useMemo(() => buildInsights(rows, lang), [rows, lang]);

  const panelStyle: React.CSSProperties = {
    background: "linear-gradient(90deg, rgba(30,22,0,0.96), rgba(0,0,0,0.98) 20%, rgba(16,12,0,0.96) 100%)",
    border: "1px solid rgba(201, 154, 0, 0.55)",
    borderRadius: 30,
    boxShadow: "0 22px 54px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,208,0,0.04)",
  };

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at top, rgba(120,84,0,0.26), rgba(0,0,0,0.96) 28%), #000",
        padding: "18px",
        color: "#f4d44d",
      }}
    >
      <div style={{ maxWidth: 1600, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18 }}>
          <StatCard value={stats.teacherCount} label={tr("عدد المعلمين المشاركين", "Participating teachers")} />
          <StatCard value={stats.monitoring} label={tr("إجمالي مهام المراقبة", "Total invigilation tasks")} />
          <StatCard value={stats.reserve} label={tr("إجمالي مهام الاحتياط", "Total reserve tasks")} accent="#ff8f1f" />
          <StatCard value={stats.review} label={tr("إجمالي مهام المراجعة", "Total review tasks")} />
          <StatCard value={stats.correction} label={tr("إجمالي مهام التصحيح", "Total correction tasks")} />
        </section>

        <section style={{ ...panelStyle, padding: "22px 18px 20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 20,
              padding: "0 8px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 900, color: "#ffd400" }}>
              {rows.length ? tr(`عدد السجلات المعروضة ${rows.length}`, `Displayed records ${rows.length}`) : tr("بانتظار تحميل البيانات", "Waiting for data")}
            </div>
            <h2 style={{ margin: 0, fontSize: "clamp(26px, 2vw, 48px)", color: "#ffd400", fontWeight: 900 }}>
              {tr("تحليل المعلمين", "Teacher analysis")}
            </h2>
          </div>

          <div style={{ overflowX: "auto", padding: "0 2px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1160 }}>
              <thead>
                <tr>
                  <th style={{ ...headerCellStyle, textAlign: isRTL ? "right" : "left" }}>{tr("المعلم", "Teacher")}</th>
                  <th style={headerCellStyle}>{tr("مراقبة", "Invigilation")}</th>
                  <th style={headerCellStyle}>{tr("احتياط", "Reserve")}</th>
                  <th style={headerCellStyle}>{tr("مراجعة", "Review")}</th>
                  <th style={headerCellStyle}>{tr("تصحيح", "Correction")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((row) => (
                    <tr key={row.teacher}>
                      <td style={{ ...teacherCellStyle, textAlign: isRTL ? "right" : "left" }}>{row.teacher}</td>
                      <td style={metricCellStyle}>
                        <ProgressMetric value={row.monitoring} max={maxValues.monitoring} color="#f8d809" alignRight={isRTL} />
                      </td>
                      <td style={metricCellStyle}>
                        <ProgressMetric value={row.reserve} max={maxValues.reserve} color="#ff8f1f" alignRight={isRTL} />
                      </td>
                      <td style={metricCellStyle}>
                        <ProgressMetric value={row.review} max={maxValues.review} color="#35d06f" alignRight={isRTL} />
                      </td>
                      <td style={metricCellStyle}>
                        <ProgressMetric value={row.correction} max={maxValues.correction} color="#f1f1f1" alignRight={isRTL} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ ...teacherCellStyle, textAlign: "center", padding: "40px 16px" }}>
                      {tr("لا توجد بيانات حالياً. يرجى تنفيذ توزيع المهام أولاً ثم العودة لهذه الصفحة.", "No data yet. Run task distribution first, then return to this page.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ ...panelStyle, padding: "22px 26px 24px" }}>
          <h2 style={{ margin: "0 0 18px", fontSize: "clamp(26px, 2vw, 48px)", color: "#ffd400", fontWeight: 900 }}>
            {tr("ملاحظات تحليلية", "Analytical notes")}
          </h2>
          <ul style={{ margin: 0, paddingInlineStart: isRTL ? 0 : 28, paddingInlineEnd: isRTL ? 28 : 0, display: "grid", gap: 14, color: "#f4d44d", fontSize: 18, lineHeight: 1.9 }}>
            {insights.map((note, index) => (
              <li key={`${note}-${index}`}>{note}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

const headerCellStyle: React.CSSProperties = {
  color: "#ffd400",
  fontSize: 18,
  fontWeight: 900,
  padding: "12px 16px 16px",
  borderBottom: "1px solid rgba(201, 154, 0, 0.28)",
  textAlign: "center",
};

const teacherCellStyle: React.CSSProperties = {
  color: "#ffd400",
  fontSize: 18,
  fontWeight: 700,
  padding: "14px 16px",
  borderBottom: "1px solid rgba(201, 154, 0, 0.18)",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};

const metricCellStyle: React.CSSProperties = {
  padding: "12px 14px 14px",
  borderBottom: "1px solid rgba(201, 154, 0, 0.18)",
  verticalAlign: "middle",
  minWidth: 210,
};
