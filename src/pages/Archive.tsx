import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { formatArchiveTitle, type ArchivedDistributionRun } from "../utils/taskDistributionStorage";
import { useArchiveItems } from "../features/archive/hooks/useArchiveItems";
import { removeArchivedItem, restoreArchivedRun } from "../features/archive/services/archiveService";
import type { ArchiveItem } from "../features/archive/types";
import { useTenant } from "../tenant/TenantContext";
import { useI18n } from "../i18n/I18nProvider";

const GOLD = "#f5c84c";
const BG = "#060b16";
const PANEL = "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))";
const PANEL_SOFT = "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))";
const STROKE = "rgba(245,200,76,0.18)";
const GREEN = "#34d399";
const BLUE = "#60a5fa";
const RED = "#f87171";

function sourceLabel(src: ArchiveItem["__source"] | undefined, lang: "ar" | "en") {
  if (src === "both") return lang === "ar" ? "محلي + سحابي" : "Local + Cloud";
  if (src === "cloud") return lang === "ar" ? "سحابي" : "Cloud";
  return lang === "ar" ? "محلي" : "Local";
}

function sourceTone(src?: ArchiveItem["__source"]) {
  if (src === "cloud") return { color: BLUE, bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.32)" };
  if (src === "both") return { color: GREEN, bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.32)" };
  return { color: GOLD, bg: "rgba(245,200,76,0.12)", border: "rgba(245,200,76,0.28)" };
}

function surface(borderColor = STROKE, background = PANEL): React.CSSProperties {
  return {
    border: `1px solid ${borderColor}`,
    borderRadius: 24,
    background,
    boxShadow: "0 18px 44px rgba(0,0,0,0.34)",
    backdropFilter: "blur(12px)",
  };
}

function actionButton(kind: "soft" | "danger" | "brand" = "soft"): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 14,
    padding: "11px 14px",
    border: `1px solid ${STROKE}`,
    fontWeight: 900,
    cursor: "pointer",
    color: "#f8e7b2",
    background: "rgba(255,255,255,0.04)",
  };
  if (kind === "brand") return { ...base, background: "rgba(245,200,76,0.14)", borderColor: "rgba(245,200,76,0.40)", color: GOLD };
  if (kind === "danger") return { ...base, background: "rgba(248,113,113,0.12)", borderColor: "rgba(248,113,113,0.34)", color: "#fecaca" };
  return base;
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
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, boxShadow: `0 0 14px ${color}` }} />
      {label}
    </span>
  );
}

function StatCard({ title, value, note, accent = GOLD }: { title: string; value: React.ReactNode; note: string; accent?: string }) {
  return (
    <div style={{ ...surface(), padding: 18, minHeight: 126, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", insetInlineEnd: -24, top: -26, width: 100, height: 100, borderRadius: "50%", background: `${accent}14` }} />
      <div style={{ fontSize: 13, color: "rgba(248,231,178,0.72)", fontWeight: 800, position: "relative" }}>{title}</div>
      <div style={{ fontSize: 34, fontWeight: 950, color: accent, marginTop: 8, position: "relative" }}>{value}</div>
      <div style={{ fontSize: 12, lineHeight: 1.8, color: "rgba(248,231,178,0.62)", marginTop: 8, position: "relative" }}>{note}</div>
    </div>
  );
}

function ArchiveMetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ fontSize: 12, color: "rgba(248,231,178,0.66)", fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#fff5cf", fontWeight: 800, lineHeight: 1.7 }}>{value}</div>
    </div>
  );
}

export default function Archive() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { lang } = useI18n();
  const tr = React.useCallback((ar: string, en: string) => (lang === "ar" ? ar : en), [lang]);
  const { tenantId: tenantFromContext } = useTenant() as any;
  const tenantId = String(tenantFromContext || user?.tenantId || "default").trim() || "default";

  const [tick, setTick] = useState(0);
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
  }, [items]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(circle at top, rgba(245,200,76,0.14), transparent 18%), radial-gradient(circle at 85% 20%, rgba(96,165,250,0.10), transparent 20%), linear-gradient(180deg, ${BG} 0%, #091124 100%)`,
        color: "#f5e7b2",
        direction: lang === "ar" ? "rtl" : "ltr",
        padding: 20,
      }}
    >
      <div style={{ maxWidth: 1440, margin: "0 auto", display: "grid", gap: 20, position: "relative" }}>
        <div
          style={{
            ...surface("rgba(245,200,76,0.22)", "linear-gradient(120deg, rgba(45,31,4,0.96), rgba(7,12,24,0.96) 45%, rgba(8,20,36,0.98))"),
            padding: 28,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", insetInlineEnd: -90, top: -80, width: 260, height: 260, borderRadius: "50%", background: "rgba(245,200,76,0.12)", filter: "blur(8px)" }} />
          <div style={{ position: "absolute", insetInlineStart: -60, bottom: -90, width: 220, height: 220, borderRadius: "50%", background: "rgba(96,165,250,0.09)", filter: "blur(8px)" }} />

          <div style={{ position: "relative", display: "grid", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <StatusPill label={tr("الأرشيف الموحد", "Unified Archive")} color={GOLD} bg="rgba(245,200,76,0.12)" border="rgba(245,200,76,0.26)" />
                <StatusPill label={cloudOk ? tr("السحابة متصلة", "Cloud Connected") : tr("السحابة غير متاحة", "Cloud Unavailable")} color={cloudOk ? GREEN : RED} bg={cloudOk ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)"} border={cloudOk ? "rgba(52,211,153,0.28)" : "rgba(248,113,113,0.28)"} />
                <StatusPill label={tr("جاهز للاستعادة", "Ready to Restore")} color={BLUE} bg="rgba(96,165,250,0.12)" border="rgba(96,165,250,0.28)" />
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={actionButton("soft")} onClick={() => nav("/task-distribution/results")}>{tr("العودة للجدول الشامل", "Back to Master Table")}</button>
                <button style={actionButton("soft")} onClick={() => setTick((x) => x + 1)}>{tr("تحديث", "Refresh")}</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(320px,0.85fr)", gap: 18, alignItems: "stretch" }}>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ color: "#fff0b0", fontWeight: 900, fontSize: 14, letterSpacing: 0.3 }}>{tr("مركز قيادة الأرشيف", "ARCHIVE COMMAND CENTER")}</div>
                <div style={{ fontSize: "clamp(32px, 5vw, 60px)", lineHeight: 1.05, fontWeight: 950, color: "#fff5cf" }}>{tr("واجهة الأرشيف الذكي لنسخ التوزيع", "Smart Archive Interface for Distribution Copies")}</div>
                <div style={{ color: "rgba(248,231,178,0.82)", lineHeight: 1.95, fontSize: 15, maxWidth: 920 }}>
                  {tr("مركز تنفيذي فاخر يجمع النسخ المحلية والسحابية في تجربة واحدة، ويمنح المسؤول قراءة بصرية واضحة لحالة الأرشيف مع إمكانات الاستعادة والحذف والمتابعة التشغيلية الفورية.", "A premium executive hub that combines local and cloud copies in one experience, giving the administrator a clear visual view of archive status with immediate restore, delete, and operational follow-up capabilities.")}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <StatusPill label={`${tr("إجمالي النسخ", "Total Copies")}: ${stats.total}`} color={GOLD} bg="rgba(245,200,76,0.10)" border="rgba(245,200,76,0.24)" />
                  <StatusPill label={`${tr("الجهة الحالية", "Current Tenant")}: ${tenantId}`} color="#e5e7eb" bg="rgba(255,255,255,0.07)" border="rgba(255,255,255,0.14)" />
                </div>
              </div>

              <div style={{ ...surface("rgba(255,255,255,0.08)", PANEL_SOFT), padding: 18, display: "grid", gap: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#fff5cf" }}>{tr("لوحة الحالة التنفيذية", "Executive Status Panel")}</div>
                <div style={{ color: "rgba(248,231,178,0.72)", lineHeight: 1.8, fontSize: 13 }}>
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

        <div style={{ ...surface(), padding: 18, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 950, color: "#fff5cf" }}>{tr("حالة الربط والتخزين", "Connection and Storage Status")}</div>
              <div style={{ marginTop: 6, color: "rgba(248,231,178,0.72)", lineHeight: 1.8, fontSize: 13 }}>
                {tr("الصفحة تعرض المحلي والسحابي معًا، وتتيح التحقق من الاتصال السحابي في أي لحظة لمعرفة جاهزية المزامنة والاستعادة.", "This page shows local and cloud copies together, and lets you verify cloud connectivity at any time to check synchronization and restore readiness.")}
              </div>
            </div>
            <button style={actionButton("soft")} onClick={checkCloud}>{tr("فحص الاتصال السحابي", "Check Cloud Connection")}</button>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <StatusPill label={`${tr("السحابة", "Cloud")}: ${cloudOk ? tr("متصلة", "Connected") : tr("غير متاحة", "Unavailable")}`} color={cloudOk ? GREEN : RED} bg={cloudOk ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)"} border={cloudOk ? "rgba(52,211,153,0.28)" : "rgba(248,113,113,0.28)"} />
            <StatusPill label={tr("المحلي: متاح", "Local: Available")} color={GOLD} bg="rgba(245,200,76,0.12)" border="rgba(245,200,76,0.28)" />
            <StatusPill label={`${tr("الفحص", "Check")}: ${cloudStatus.ok ? "OK" : "X"}`} color={cloudStatus.ok ? GREEN : RED} bg={cloudStatus.ok ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)"} border={cloudStatus.ok ? "rgba(52,211,153,0.28)" : "rgba(248,113,113,0.28)"} />
          </div>
        </div>

        {items.length === 0 ? (
          <div style={{ ...surface("rgba(245,200,76,0.18)", "linear-gradient(180deg, rgba(245,200,76,0.05), rgba(255,255,255,0.02))"), padding: 34, textAlign: "center", display: "grid", gap: 12 }}>
            <div style={{ width: 78, height: 78, borderRadius: "50%", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, background: "rgba(245,200,76,0.10)", border: "1px solid rgba(245,200,76,0.20)", color: GOLD }}>✦</div>
            <div style={{ fontSize: 24, fontWeight: 950, color: "#fff5cf" }}>{tr("لا توجد نسخ محفوظة بعد", "No saved copies yet")}</div>
            <div style={{ maxWidth: 760, margin: "0 auto", color: "rgba(248,231,178,0.76)", lineHeight: 1.9 }}>
              {tr("بمجرد حفظ نسخ من التوزيع سيظهر الأرشيف هنا تلقائيًا، مع توضيح مصدر كل نسخة وإمكانية استعادتها أو حذفها من نفس الصفحة.", "As soon as distribution copies are saved, the archive will appear here automatically, showing the source of each copy with options to restore or delete it from the same page.")}
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 16 }}>
            {items.map((it, index) => {
              const title = formatArchiveTitle(it as ArchivedDistributionRun);
              const created = it?.createdAtISO ? new Date(it.createdAtISO).toLocaleString("ar", { hour12: true }) : "—";
              const count = (it?.run?.assignments || []).length;
              const tone = sourceTone(it.__source);
              const isLatest = index === 0;
              return (
                <div key={it.archiveId} style={{ ...surface(tone.border, "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))"), padding: 18, display: "grid", gap: 14, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", insetInlineEnd: -30, top: -28, width: 96, height: 96, borderRadius: "50%", background: `${tone.color}12` }} />
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", position: "relative" }}>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {isLatest ? <StatusPill label={tr("أحدث نسخة", "Latest Copy")} color={GREEN} bg="rgba(52,211,153,0.12)" border="rgba(52,211,153,0.28)" /> : null}
                        <StatusPill label={sourceLabel(it.__source, lang)} color={tone.color} bg={tone.bg} border={tone.border} />
                      </div>
                      <div style={{ fontWeight: 950, fontSize: 18, lineHeight: 1.4, color: "#fff5cf" }}>{title}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
                    <ArchiveMetaItem label={tr("تاريخ الإنشاء", "Created At")} value={created} />
                    <ArchiveMetaItem label={tr("عدد العناصر", "Items Count")} value={count} />
                    <ArchiveMetaItem label="Run ID" value={String(it?.run?.runId || "—").slice(0, 18)} />
                    <ArchiveMetaItem label={tr("المصدر", "Source")} value={sourceLabel(it.__source, lang)} />
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button style={actionButton("brand")} onClick={() => restore(it)}>{tr("استعادة للجدول الشامل", "Restore to Master Table")}</button>
                    <button style={actionButton("danger")} onClick={() => remove(it)}>{tr("حذف", "Delete")}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
