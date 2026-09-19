import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { formatArchiveTitle, type ArchivedDistributionRun } from "../utils/taskDistributionStorage";
import { useArchiveItems } from "../features/archive/hooks/useArchiveItems";
import { removeArchivedItem, restoreArchivedRun } from "../features/archive/services/archiveService";
import type { ArchiveItem } from "../features/archive/types";
import { useTenant } from "../tenant/TenantContext";
import { useI18n } from "../i18n/I18nProvider";

const GOLD = "#b7791f";
const BG = "#fff7e6";
const PANEL = "linear-gradient(180deg, #ffffff, #fff7e6)";
const PANEL_SOFT = "linear-gradient(180deg, #fffdf7, #fef3c7)";
const STROKE = "rgba(180,83,9,0.22)";
const GREEN = "#15803d";
const BLUE = "#1d4ed8";
const RED = "#b91c1c";
const PURPLE = "#7c3aed";
const ORANGE = "#ea580c";
const TEXT = "#111827";
const MUTED = "#4b5563";
const TABLE_BEIGE = "#f5ead2";
const TABLE_BORDER_COLORS = ["#d97706", "#2563eb", "#16a34a", "#dc2626", "#7c3aed", "#0891b2", "#db2777"];

function sourceLabel(src: ArchiveItem["__source"] | undefined, lang: "ar" | "en") {
  if (src === "both") return lang === "ar" ? "محلي + سحابي" : "Local + Cloud";
  if (src === "cloud") return lang === "ar" ? "سحابي" : "Cloud";
  return lang === "ar" ? "محلي" : "Local";
}

function sourceTone(src?: ArchiveItem["__source"]) {
  if (src === "cloud") return { color: BLUE, bg: "rgba(37,99,235,0.10)", border: "rgba(37,99,235,0.38)" };
  if (src === "both") return { color: GREEN, bg: "rgba(22,163,74,0.10)", border: "rgba(22,163,74,0.38)" };
  return { color: GOLD, bg: "rgba(217,119,6,0.12)", border: "rgba(217,119,6,0.38)" };
}

function surface(borderColor = STROKE, background = PANEL): React.CSSProperties {
  return {
    border: `1px solid ${borderColor}`,
    borderRadius: 24,
    background,
    boxShadow: "0 16px 34px rgba(120,72,12,0.12)",
    backdropFilter: "blur(8px)",
  };
}

function actionButton(kind: "soft" | "danger" | "brand" | "success" | "info" | "purple" = "soft"): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 14,
    padding: "11px 14px",
    border: "1px solid rgba(17,24,39,0.14)",
    fontWeight: 900,
    cursor: "pointer",
    color: "#111827",
    background: "#ffffff",
    boxShadow: "0 8px 18px rgba(120,72,12,0.12)",
  };
  if (kind === "brand") return { ...base, background: "#f59e0b", borderColor: "#d97706", color: "#111827" };
  if (kind === "danger") return { ...base, background: "#fee2e2", borderColor: "#ef4444", color: "#991b1b" };
  if (kind === "success") return { ...base, background: "#dcfce7", borderColor: "#22c55e", color: "#14532d" };
  if (kind === "info") return { ...base, background: "#dbeafe", borderColor: "#3b82f6", color: "#1e3a8a" };
  if (kind === "purple") return { ...base, background: "#ede9fe", borderColor: "#8b5cf6", color: "#4c1d95" };
  return { ...base, background: "#fef3c7", borderColor: "#f59e0b", color: "#78350f" };
}

function archiveTh(borderColor: string): React.CSSProperties {
  return {
    background: "#ead7b7",
    color: TEXT,
    border: `2px solid ${borderColor}`,
    padding: "12px 10px",
    textAlign: "center",
    fontWeight: 950,
    whiteSpace: "nowrap",
  };
}

function archiveTd(borderColor: string): React.CSSProperties {
  return {
    background: TABLE_BEIGE,
    color: TEXT,
    border: `2px solid ${borderColor}`,
    padding: "11px 10px",
    textAlign: "center",
    fontWeight: 800,
    lineHeight: 1.7,
    verticalAlign: "middle",
  };
}

function StatusPill({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 999,
        color,
        background: bg,
        border: `1px solid ${border}`,
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, boxShadow: `0 0 10px ${color}` }} />
      {label}
    </span>
  );
}

function StatCard({ title, value, note, accent = GOLD }: { title: string; value: React.ReactNode; note: string; accent?: string }) {
  return (
    <div style={{ ...surface(), padding: 18, minHeight: 126, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", insetInlineEnd: -24, top: -26, width: 100, height: 100, borderRadius: "50%", background: `${accent}14` }} />
      <div style={{ fontSize: 13, color: MUTED, fontWeight: 800, position: "relative" }}>{title}</div>
      <div style={{ fontSize: 34, fontWeight: 950, color: accent, marginTop: 8, position: "relative" }}>{value}</div>
      <div style={{ fontSize: 12, lineHeight: 1.8, color: MUTED, marginTop: 8, position: "relative" }}>{note}</div>
    </div>
  );
}

export default function Archive() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { lang } = useI18n();
  const tr = React.useCallback((ar: string, en: string) => (lang === "ar" ? ar : en), [lang]);
  const { tenantId: tenantFromContext } = useTenant() as any;
  const routeParams = useParams() as any;
  const routeTenantId = String(
    routeParams?.tenantId || routeParams?.tenant || routeParams?.id || routeParams?.schoolId || routeParams?.centerId || ""
  ).trim();
  const tenantId = String(routeTenantId || tenantFromContext || user?.tenantId || "").trim();

  const [tick, setTick] = useState(0);
  const [isTableFull, setIsTableFull] = useState(false);
  const { items, cloudOk, cloudErr, cloudStatus, checkCloud } = useArchiveItems(tenantId, tick);

  const restore = (it: ArchiveItem) => {
    if (restoreArchivedRun(tenantId, it)) nav("/task-distribution/results");
  };

  const remove = async (it: ArchiveItem) => {
    if (!it?.archiveId) return;
    if (!window.confirm(tr("حذف هذه النسخة من الأرشيف؟", "Delete this archived copy?"))) return;
    await removeArchivedItem(tenantId, it);
    setTick((x) => x + 1);
  };

  const stats = useMemo(() => {
    const local = items.filter((it) => it.__source === "local").length;
    const cloud = items.filter((it) => it.__source === "cloud").length;
    const both = items.filter((it) => it.__source === "both").length;
    const latest = items[0] || null;
    const latestTitle = latest ? formatArchiveTitle(latest as ArchivedDistributionRun) : tr("لا توجد نسخة", "No copy");
    return {
      total: items.length,
      local,
      cloud,
      both,
      latestTitle,
    };
  }, [items, tr]);

  const tableShellStyle: React.CSSProperties = isTableFull
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        background: "#fffaf0",
        padding: 22,
        overflow: "auto",
        direction: lang === "ar" ? "rtl" : "ltr",
        display: "grid",
        gap: 12,
      }
    : { ...surface("rgba(217,119,6,0.30)", "linear-gradient(180deg, #fffaf0, #f5ead2)"), padding: 18, display: "grid", gap: 12 };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(circle at top, rgba(245,158,11,0.18), transparent 22%), radial-gradient(circle at 85% 20%, rgba(59,130,246,0.12), transparent 22%), linear-gradient(180deg, ${BG} 0%, #fffaf0 100%)`,
        color: TEXT,
        direction: lang === "ar" ? "rtl" : "ltr",
        padding: 20,
      }}
    >
      <div style={{ maxWidth: 1440, margin: "0 auto", display: "grid", gap: 20, position: "relative" }}>
        <div
          style={{
            ...surface("rgba(217,119,6,0.28)", "linear-gradient(120deg, #fffaf0, #fef3c7 46%, #e0f2fe)"),
            padding: 28,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", insetInlineEnd: -90, top: -80, width: 260, height: 260, borderRadius: "50%", background: "rgba(245,158,11,0.18)", filter: "blur(8px)" }} />
          <div style={{ position: "absolute", insetInlineStart: -60, bottom: -90, width: 220, height: 220, borderRadius: "50%", background: "rgba(59,130,246,0.14)", filter: "blur(8px)" }} />

          <div style={{ position: "relative", display: "grid", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <StatusPill label={tr("الأرشيف الموحد", "Unified Archive")} color={GOLD} bg="rgba(217,119,6,0.12)" border="rgba(217,119,6,0.32)" />
                <StatusPill label={cloudOk ? tr("السحابة متصلة", "Cloud Connected") : tr("السحابة غير متاحة", "Cloud Unavailable")} color={cloudOk ? GREEN : RED} bg={cloudOk ? "rgba(22,163,74,0.10)" : "rgba(220,38,38,0.10)"} border={cloudOk ? "rgba(22,163,74,0.30)" : "rgba(220,38,38,0.30)"} />
                <StatusPill label={tr("جاهز للاستعادة", "Ready to Restore")} color={BLUE} bg="rgba(37,99,235,0.10)" border="rgba(37,99,235,0.30)" />
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={actionButton("info")} onClick={() => nav("/task-distribution/results")}>{tr("العودة للجدول الشامل", "Back to Master Table")}</button>
                <button style={actionButton("success")} onClick={() => setTick((x) => x + 1)}>{tr("تحديث", "Refresh")}</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(320px,0.85fr)", gap: 18, alignItems: "stretch" }}>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ color: GOLD, fontWeight: 900, fontSize: 14, letterSpacing: 0.3 }}>{tr("مركز قيادة الأرشيف", "ARCHIVE COMMAND CENTER")}</div>
                <div style={{ fontSize: "clamp(32px, 5vw, 60px)", lineHeight: 1.05, fontWeight: 950, color: TEXT }}>{tr("واجهة الأرشيف الذكي لنسخ التوزيع", "Smart Archive Interface for Distribution Copies")}</div>
                <div style={{ color: MUTED, lineHeight: 1.95, fontSize: 15, maxWidth: 920 }}>
                  {tr("مركز تنفيذي فاتح يجمع النسخ المحلية والسحابية في تجربة واحدة، ويمنح المسؤول قراءة بصرية واضحة لحالة الأرشيف مع إمكانات الاستعادة والحذف والمتابعة التشغيلية الفورية.", "A light executive hub that combines local and cloud copies in one experience, giving the administrator a clear visual view of archive status with immediate restore, delete, and operational follow-up capabilities.")}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <StatusPill label={`${tr("إجمالي النسخ", "Total Copies")}: ${stats.total}`} color={GOLD} bg="rgba(217,119,6,0.10)" border="rgba(217,119,6,0.30)" />
                  <StatusPill label={`${tr("الجهة الحالية", "Current Tenant")}: ${tenantId}`} color={PURPLE} bg="rgba(124,58,237,0.09)" border="rgba(124,58,237,0.30)" />
                </div>
              </div>

              <div style={{ ...surface("rgba(59,130,246,0.24)", PANEL_SOFT), padding: 18, display: "grid", gap: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: TEXT }}>{tr("لوحة الحالة التنفيذية", "Executive Status Panel")}</div>
                <div style={{ color: MUTED, lineHeight: 1.8, fontSize: 13 }}>
                  {tr("ملخص سريع لحالة الأرشيف الحالي، ومصدر النسخ، واتصال السحابة، مع جاهزية فورية لاستعادة أي نسخة إلى الجدول الشامل.", "A quick summary of the current archive status, copy source, cloud connectivity, and immediate readiness to restore any copy to the master table.")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
                  <StatCard title={tr("المحلي", "Local")} value={stats.local} note={tr("نسخ محفوظة داخل الجهاز", "Copies stored on this device")} accent={GOLD} />
                  <StatCard title={tr("السحابي", "Cloud")} value={stats.cloud} note={tr("نسخ محفوظة في السحابة", "Copies stored in the cloud")} accent={BLUE} />
                  <StatCard title={tr("مشترك", "Shared")} value={stats.both} note={tr("نسخ موجودة محليًا وسحابيًا", "Copies available locally and in the cloud")} accent={GREEN} />
                  <StatCard title={tr("آخر حالة", "Latest Status")} value={cloudStatus.ok ? "OK" : "X"} note={cloudStatus.note || "—"} accent={cloudStatus.ok ? GREEN : RED} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <StatCard title={tr("إجمالي النسخ المؤرشفة", "Total Archived Copies")} value={stats.total} note={tr("كل النسخ المعروضة الآن داخل الصفحة", "All copies currently shown on this page")} />
          <StatCard title={tr("الحالة السحابية", "Cloud Status")} value={cloudOk ? tr("متصل", "Connected") : tr("غير متاح", "Unavailable")} note={cloudErr || cloudStatus.note || tr("فحص الاتصال السحابي", "Cloud connectivity check")} accent={cloudOk ? GREEN : RED} />
          <StatCard title={tr("آخر نسخة مرصودة", "Latest Detected Copy")} value={items[0]?.run?.runId ? String(items[0].run.runId).slice(0, 10) : "—"} note={stats.latestTitle} accent={BLUE} />
          <StatCard title={tr("جاهزية الاستعادة", "Restore Readiness")} value={items.length ? tr("جاهز", "Ready") : tr("بانتظار النسخ", "Waiting for copies")} note={tr("يمكن استعادة أي نسخة مباشرة إلى الجدول الشامل", "Any copy can be restored directly to the master table")} accent={items.length ? GREEN : GOLD} />
        </div>

        <div style={{ ...surface("rgba(34,197,94,0.22)", "linear-gradient(180deg, #ffffff, #f0fdf4)"), padding: 18, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 950, color: TEXT }}>{tr("حالة الربط والتخزين", "Connection and Storage Status")}</div>
              <div style={{ marginTop: 6, color: MUTED, lineHeight: 1.8, fontSize: 13 }}>
                {tr("الصفحة تعرض المحلي والسحابي معًا، وتتيح التحقق من الاتصال السحابي في أي لحظة لمعرفة جاهزية المزامنة والاستعادة.", "This page shows local and cloud copies together, and lets you verify cloud connectivity at any time to check synchronization and restore readiness.")}
              </div>
            </div>
            <button style={actionButton("purple")} onClick={checkCloud}>{tr("فحص الاتصال السحابي", "Check Cloud Connection")}</button>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <StatusPill label={`${tr("السحابة", "Cloud")}: ${cloudOk ? tr("متصلة", "Connected") : tr("غير متاحة", "Unavailable")}`} color={cloudOk ? GREEN : RED} bg={cloudOk ? "rgba(22,163,74,0.10)" : "rgba(220,38,38,0.10)"} border={cloudOk ? "rgba(22,163,74,0.30)" : "rgba(220,38,38,0.30)"} />
            <StatusPill label={tr("المحلي: متاح", "Local: Available")} color={ORANGE} bg="rgba(234,88,12,0.10)" border="rgba(234,88,12,0.30)" />
            <StatusPill label={`${tr("الفحص", "Check")}: ${cloudStatus.ok ? "OK" : "X"}`} color={cloudStatus.ok ? GREEN : RED} bg={cloudStatus.ok ? "rgba(22,163,74,0.10)" : "rgba(220,38,38,0.10)"} border={cloudStatus.ok ? "rgba(22,163,74,0.30)" : "rgba(220,38,38,0.30)"} />
          </div>
        </div>

        <div style={tableShellStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 950, color: TEXT }}>{tr("جدول الأرشيف", "Archive Table")}</div>
              <div style={{ marginTop: 4, color: MUTED, fontSize: 13, fontWeight: 700 }}>
                {tr("خلفية بيج، خط أسود، وحدود خلايا بألوان مختلفة.", "Beige background, black text, and different colored cell borders.")}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={actionButton("purple")} onClick={() => setIsTableFull((v) => !v)}>
                {isTableFull ? tr("تصغير الجدول", "Minimize Table") : tr("تكبير الجدول", "Enlarge Table")}
              </button>
              <button style={actionButton("success")} onClick={() => setTick((x) => x + 1)}>{tr("تحديث", "Refresh")}</button>
              {isTableFull ? <button style={actionButton("danger")} onClick={() => setIsTableFull(false)}>{tr("إغلاق", "Close")}</button> : null}
            </div>
          </div>

          {items.length === 0 ? (
            <div style={{ background: TABLE_BEIGE, color: TEXT, border: "2px solid #d97706", borderRadius: 18, padding: 28, textAlign: "center", fontWeight: 900 }}>
              {tr("لا توجد نسخ محفوظة بعد", "No saved copies yet")}
            </div>
          ) : (
            <div style={{ overflowX: "auto", borderRadius: 18, border: "2px solid #d97706", background: TABLE_BEIGE }}>
              <table style={{ width: "100%", minWidth: 1080, borderCollapse: "collapse", background: TABLE_BEIGE, color: TEXT }}>
                <thead>
                  <tr>
                    <th style={archiveTh(TABLE_BORDER_COLORS[0])}>{tr("الحالة", "Status")}</th>
                    <th style={archiveTh(TABLE_BORDER_COLORS[1])}>{tr("العنوان", "Title")}</th>
                    <th style={archiveTh(TABLE_BORDER_COLORS[2])}>{tr("تاريخ الإنشاء", "Created At")}</th>
                    <th style={archiveTh(TABLE_BORDER_COLORS[3])}>{tr("عدد العناصر", "Items Count")}</th>
                    <th style={archiveTh(TABLE_BORDER_COLORS[4])}>Run ID</th>
                    <th style={archiveTh(TABLE_BORDER_COLORS[5])}>{tr("المصدر", "Source")}</th>
                    <th style={archiveTh(TABLE_BORDER_COLORS[6])}>{tr("الإجراءات", "Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, index) => {
                    const title = formatArchiveTitle(it as ArchivedDistributionRun);
                    const created = it?.createdAtISO ? new Date(it.createdAtISO).toLocaleString(lang === "ar" ? "ar" : "en-GB", { hour12: true }) : "—";
                    const count = (it?.run?.assignments || []).length;
                    const tone = sourceTone(it.__source);
                    const isLatest = index === 0;
                    return (
                      <tr key={it.archiveId}>
                        <td style={archiveTd(TABLE_BORDER_COLORS[0])}>
                          {isLatest ? <StatusPill label={tr("أحدث نسخة", "Latest Copy")} color={GREEN} bg="rgba(22,163,74,0.10)" border="rgba(22,163,74,0.30)" /> : <StatusPill label={tr("نسخة محفوظة", "Saved Copy")} color={BLUE} bg="rgba(37,99,235,0.10)" border="rgba(37,99,235,0.30)" />}
                        </td>
                        <td style={{ ...archiveTd(TABLE_BORDER_COLORS[1]), textAlign: lang === "ar" ? "right" : "left", minWidth: 260 }}>{title}</td>
                        <td style={archiveTd(TABLE_BORDER_COLORS[2])}>{created}</td>
                        <td style={archiveTd(TABLE_BORDER_COLORS[3])}>{count}</td>
                        <td style={archiveTd(TABLE_BORDER_COLORS[4])}>{String(it?.run?.runId || "—").slice(0, 18)}</td>
                        <td style={archiveTd(TABLE_BORDER_COLORS[5])}>
                          <StatusPill label={sourceLabel(it.__source, lang)} color={tone.color} bg={tone.bg} border={tone.border} />
                        </td>
                        <td style={archiveTd(TABLE_BORDER_COLORS[6])}>
                          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                            <button style={actionButton("brand")} onClick={() => restore(it)}>{tr("استعادة", "Restore")}</button>
                            <button style={actionButton("danger")} onClick={() => remove(it)}>{tr("حذف", "Delete")}</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
