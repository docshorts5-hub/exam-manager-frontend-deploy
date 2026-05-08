import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useCan } from "../auth/permissions";
import { useTenant } from "../tenant/TenantContext";
import { useI18n } from "../i18n/I18nProvider";
import { loadTenantArray } from "../services/tenantData";
import {
  approveCurrentDistribution,
  listDistributionVersions,
  listTenantMembers,
  loadDistributionApproval,
  restoreDistributionVersion,
  saveDistributionVersion,
  syncCurrentRunToCloud,
  type DistributionApprovalRecord,
  type DistributionVersionRecord,
} from "../services/distributionCollaboration.service";
import { listCloudArchive } from "../services/cloudArchive.service";
import { loadRun, listArchivedRuns, type ArchivedDistributionRun } from "../utils/taskDistributionStorage";
import type { DistributionRun } from "../contracts/taskDistributionContract";

const GOLD = "#ffd700";
const GOLD_SOFT = "#f7d76a";
const BG = "#000";
const LINE = "rgba(255,215,0,0.18)";
const CARD_BG = "linear-gradient(180deg, rgba(255,215,0,0.05), rgba(255,215,0,0.02))";
const PANEL_BG = "linear-gradient(180deg, rgba(20,16,3,0.78), rgba(8,8,8,0.96))";
const GREEN = "#34d399";
const BLUE = "#60a5fa";
const RED = "#f87171";
const AMBER = "#f59e0b";

type ProgramStats = {
  teachers: number;
  exams: number;
  rooms: number;
  members: number;
  archiveLocal: number;
  archiveCloud: number;
};

function badgeStyle(color: string, bg: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    background: bg,
    color,
    border: `1px solid ${bg.replace("0.12", "0.30").replace("0.14", "0.30").replace("0.08", "0.18")}`,
    fontWeight: 800,
    fontSize: 12,
    whiteSpace: "nowrap",
  };
}

function summarizeRun(run: DistributionRun | null) {
  const assignments = Array.isArray(run?.assignments) ? run!.assignments : [];
  const warnings = Array.isArray(run?.warnings) ? run!.warnings : [];
  const invigilation = assignments.filter((item) => String(item.taskType) === "INVIGILATION").length;
  const reserve = assignments.filter((item) => String(item.taskType) === "RESERVE").length;
  const review = assignments.filter((item) => String(item.taskType) === "REVIEW_FREE").length;
  const correction = assignments.filter((item) => String(item.taskType) === "CORRECTION_FREE").length;
  const requiredInv = Number(run?.debug?.summary?.invRequired || 0) || 0;
  const requiredReserve = Number(run?.debug?.summary?.reserveRequired || 0) || 0;
  const assignedInv = Number(run?.debug?.summary?.invAssigned || invigilation) || 0;
  const assignedReserve = Number(run?.debug?.summary?.reserveAssigned || reserve) || 0;
  const totalRequired = requiredInv + requiredReserve;
  const totalAssigned = assignedInv + assignedReserve;
  const coverage = totalRequired > 0 ? Math.min(100, Math.round((totalAssigned / totalRequired) * 100)) : null;

  return {
    assignments: assignments.length,
    warnings: warnings.length,
    invigilation,
    reserve,
    review,
    correction,
    requiredInv,
    requiredReserve,
    totalRequired,
    totalAssigned,
    coverage,
    runId: String(run?.runId || "").trim(),
    createdAtISO: String(run?.createdAtISO || "").trim(),
    teachersCount: Number(run?.teachersCount || 0) || 0,
    examsCount: Number(run?.examsCount || 0) || 0,
  };
}

function getSourceLabel(source: DistributionVersionRecord["source"] | DistributionApprovalRecord["source"] | undefined, tr: (ar: string, en: string) => string) {
  if (source === "both") return tr("محلي + سحابي", "Local + cloud");
  if (source === "cloud") return tr("سحابي", "Cloud");
  if (source === "local") return tr("محلي", "Local");
  return tr("غير محدد", "Unspecified");
}

function formatDateTime(value: string | undefined, lang: "ar" | "en") {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(lang === "ar" ? "ar" : "en", { hour12: true });
}

function surface(border = LINE, background = PANEL_BG): React.CSSProperties {
  return {
    background,
    border: `1px solid ${border}`,
    borderRadius: 24,
    boxShadow: "0 22px 60px rgba(0,0,0,0.34)",
    backdropFilter: "blur(16px)",
  };
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 14px",
        borderRadius: 999,
        background: `${color}18`,
        border: `1px solid ${color}40`,
        color,
        fontWeight: 800,
        fontSize: 12,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, boxShadow: `0 0 16px ${color}` }} />
      {label}
    </span>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>
      <div style={{ color: "#fff2b6", fontSize: 22, fontWeight: 900, lineHeight: 1.3 }}>{title}</div>
      {subtitle ? <div style={{ color: "rgba(255,243,191,0.68)", lineHeight: 1.85, fontSize: 13 }}>{subtitle}</div> : null}
    </div>
  );
}

function VersionStatCard(props: { title: string; value: React.ReactNode; note?: string; accent?: string }) {
  return (
    <div
      style={{
        ...surface(),
        padding: 20,
        minHeight: 130,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", insetInlineEnd: -14, top: -18, width: 96, height: 96, borderRadius: "50%", background: `${props.accent || GOLD}12` }} />
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 10, position: "relative" }}>{props.title}</div>
      <div style={{ fontSize: 30, fontWeight: 900, color: props.accent || GOLD, position: "relative" }}>{props.value}</div>
      {props.note ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8, lineHeight: 1.8, position: "relative" }}>{props.note}</div> : null}
    </div>
  );
}

function MetricTile({ label, value, note }: { label: string; value: React.ReactNode; note: string }) {
  return (
    <div style={{ ...surface("rgba(255,255,255,0.08)", "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))"), padding: 16 }}>
      <div style={{ fontSize: 12, color: "rgba(255,243,191,0.65)", fontWeight: 800, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: "#fff7cc", lineHeight: 1.2 }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,243,191,0.58)", lineHeight: 1.75 }}>{note}</div>
    </div>
  );
}

function TimelineDot({ color }: { color: string }) {
  return <span style={{ width: 12, height: 12, borderRadius: 999, background: color, boxShadow: `0 0 16px ${color}` }} />;
}

export default function VersioningPageMasterpiece() {
  const nav = useNavigate();
  const auth = useAuth() as any;
  const { tenantId: tenantFromContext } = useTenant() as any;
  const { can } = useCan();
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const tenantId = String(tenantFromContext || auth?.effectiveTenantId || auth?.userProfile?.tenantId || "default").trim() || "default";
  const canManageArchive = can("ARCHIVE_MANAGE") || can("DISTRIBUTION_RUN");
  const currentEmail = String(auth?.user?.email || "").trim();

  const [versions, setVersions] = useState<DistributionVersionRecord[]>([]);
  const [approval, setApproval] = useState<DistributionApprovalRecord | null>(null);
  const [programStats, setProgramStats] = useState<ProgramStats>({ teachers: 0, exams: 0, rooms: 0, members: 0, archiveLocal: 0, archiveCloud: 0 });
  const [cloudArchiveItems, setCloudArchiveItems] = useState<ArchivedDistributionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const currentRun = loadRun(tenantId);
  const currentSummary = useMemo(() => summarizeRun(currentRun), [currentRun]);

  const pageStyle: React.CSSProperties = {
    padding: 24,
    background: "radial-gradient(circle at top, rgba(255,215,0,0.14), transparent 22%), radial-gradient(circle at 18% 18%, rgba(96,165,250,0.10), transparent 28%), linear-gradient(180deg, #070707 0%, #000 100%)",
    color: GOLD,
    minHeight: "100vh",
    direction: isRTL ? "rtl" : "ltr",
  };

  const cardStyle: React.CSSProperties = {
    ...surface(),
    padding: 20,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    color: "#fff3bf",
    border: `1px solid ${LINE}`,
    borderRadius: 14,
    padding: "12px 14px",
    outline: "none",
    boxSizing: "border-box",
  };

  const buttonStyle = (variant: "brand" | "ghost" | "danger" = "brand"): React.CSSProperties => ({
    background:
      variant === "brand"
        ? "linear-gradient(135deg, rgba(255,215,0,0.24), rgba(255,215,0,0.12))"
        : variant === "danger"
        ? "rgba(239,68,68,0.16)"
        : "rgba(255,255,255,0.05)",
    color: variant === "danger" ? "#fecaca" : GOLD,
    border: `1px solid ${variant === "danger" ? "rgba(239,68,68,0.35)" : LINE}`,
    borderRadius: 14,
    padding: "11px 15px",
    cursor: "pointer",
    fontWeight: 800,
    boxShadow: variant === "brand" ? "0 10px 24px rgba(255,215,0,0.12)" : undefined,
  });

  const refresh = async () => {
    setLoading(true);
    try {
      const [versionsRows, approvalRow, teacherRows, examRows, roomRows, memberRows, cloudArchive] = await Promise.all([
        listDistributionVersions(tenantId).catch(() => []),
        loadDistributionApproval(tenantId).catch(() => null),
        loadTenantArray<any>(tenantId, "teachers").catch(() => []),
        loadTenantArray<any>(tenantId, "exams").catch(() => []),
        loadTenantArray<any>(tenantId, "rooms").catch(() => []),
        listTenantMembers(tenantId).catch(() => []),
        listCloudArchive(tenantId, 100).catch(() => []),
      ]);

      const localArchive = listArchivedRuns(tenantId);
      setVersions(versionsRows);
      setApproval(approvalRow);
      setCloudArchiveItems(cloudArchive);
      setProgramStats({
        teachers: teacherRows.length,
        exams: examRows.length,
        rooms: roomRows.length,
        members: memberRows.length,
        archiveLocal: localArchive.length,
        archiveCloud: cloudArchive.length,
      });
    } catch (e: any) {
      setMessage(e?.message || tr("تعذر تحميل بيانات إدارة الإصدارات.", "Unable to load versioning data."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [tenantId, lang]);

  const filteredVersions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return versions;
    return versions.filter((item) =>
      [item.title, item.note, item.createdBy, item.versionId, item.run?.runId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [versions, search]);

  const latestVersion = filteredVersions[0] || null;
  const latestVersionSummary = useMemo(() => summarizeRun(latestVersion?.run || null), [latestVersion]);

  const healthScore = useMemo(() => {
    let score = 0;
    if (currentSummary.runId) score += 25;
    if (versions.length) score += 25;
    if (approval?.runId) score += 25;
    if (programStats.archiveCloud || programStats.archiveLocal) score += 25;
    return score;
  }, [currentSummary.runId, versions.length, approval?.runId, programStats.archiveCloud, programStats.archiveLocal]);

  const healthTone = healthScore >= 75 ? GREEN : healthScore >= 50 ? AMBER : RED;

  const createVersion = async () => {
    if (!currentRun) {
      setMessage(tr("لا يوجد تشغيل حالي محفوظ لإنشاء إصدار منه.", "There is no saved current run to version."));
      return;
    }
    setBusy(true);
    try {
      await saveDistributionVersion({ tenantId, title, note, run: currentRun, actorEmail: currentEmail });
      await syncCurrentRunToCloud(tenantId, currentEmail);
      setTitle("");
      setNote("");
      setMessage(tr("تم حفظ إصدار جديد مرتبط بالتشغيل الحالي للبرنامج.", "A new version linked to the current program run was saved."));
      await refresh();
    } catch (e: any) {
      setMessage(e?.message || tr("تعذر حفظ الإصدار الجديد.", "Unable to save the new version."));
    } finally {
      setBusy(false);
    }
  };

  const approveCurrent = async () => {
    if (!currentRun) {
      setMessage(tr("لا يوجد تشغيل حالي لاعتماده.", "There is no current run to approve."));
      return;
    }
    setBusy(true);
    try {
      await approveCurrentDistribution({ tenantId, note, actorEmail: currentEmail });
      setMessage(tr("تم اعتماد التشغيل الحالي وربطه كنسخة رسمية للنظام.", "The current run was approved and linked as the official system version."));
      await refresh();
    } catch (e: any) {
      setMessage(e?.message || tr("تعذر اعتماد التشغيل الحالي.", "Unable to approve the current run."));
    } finally {
      setBusy(false);
    }
  };

  const restoreVersion = async (version: DistributionVersionRecord) => {
    const ok = window.confirm(
      tr(
        `هل تريد استعادة الإصدار \"${version.title}\" وربطه مجددًا بالتشغيل الحالي؟`,
        `Do you want to restore the version \"${version.title}\" and relink it as the current run?`
      )
    );
    if (!ok) return;

    setBusy(true);
    try {
      const restored = await restoreDistributionVersion(tenantId, version.versionId);
      if (!restored) throw new Error(tr("تعذر استعادة بيانات هذا الإصدار.", "Unable to restore this version data."));
      await syncCurrentRunToCloud(tenantId, currentEmail);
      setMessage(tr(`تمت استعادة الإصدار ${version.title} وربطه بالبرنامج الحالي.`, `The version ${version.title} was restored and linked to the current program.`));
      await refresh();
    } catch (e: any) {
      setMessage(e?.message || tr("تعذر استعادة الإصدار المحدد.", "Unable to restore the selected version."));
    } finally {
      setBusy(false);
    }
  };

  const syncNow = async () => {
    setBusy(true);
    try {
      const synced = await syncCurrentRunToCloud(tenantId, currentEmail);
      setMessage(
        synced
          ? tr("تمت مزامنة التشغيل الحالي مع السحابة بنجاح.", "The current run was synced to the cloud successfully.")
          : tr("لا يوجد تشغيل حالي لمزامنته أو تعذر الوصول إلى السحابة.", "There is no current run to sync or the cloud is unavailable.")
      );
      await refresh();
    } catch (e: any) {
      setMessage(e?.message || tr("تعذر تنفيذ المزامنة الآن.", "Unable to sync right now."));
    } finally {
      setBusy(false);
    }
  };

  const versionBadge = (version: DistributionVersionRecord) => {
    const isCurrent = currentSummary.runId && version.run?.runId === currentSummary.runId;
    const isApproved = approval?.runId && version.run?.runId === approval.runId;
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <span style={badgeStyle("#111", "rgba(255,215,0,0.22)")}>{getSourceLabel(version.source, tr)}</span>
        {isCurrent ? <span style={badgeStyle("#34d399", "rgba(52,211,153,0.18)")}>{tr("التشغيل الحالي", "Current run")}</span> : null}
        {isApproved ? <span style={badgeStyle("#60a5fa", "rgba(96,165,250,0.18)")}>{tr("النسخة الرسمية", "Official version")}</span> : null}
      </div>
    );
  };

  return (
    <div style={pageStyle}>
      <div style={{ position: "fixed", top: -140, left: -80, width: 340, height: 340, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,215,0,0.18), transparent 72%)", filter: "blur(10px)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -180, right: -110, width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(96,165,250,0.12), transparent 70%)", filter: "blur(14px)", pointerEvents: "none" }} />
      <div style={{ maxWidth: 1440, margin: "0 auto", display: "grid", gap: 20, position: "relative", zIndex: 1 }}>
        <div style={{ ...surface("rgba(255,215,0,0.26)", "linear-gradient(115deg, rgba(42,31,2,0.94), rgba(7,7,7,0.96) 48%, rgba(17,13,2,0.94) 100%)"), padding: 26, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", insetInlineEnd: -60, top: -70, width: 230, height: 230, borderRadius: "50%", background: "rgba(255,215,0,0.12)", filter: "blur(8px)" }} />
          <div style={{ position: "relative", display: "grid", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <StatusPill label={tr("بيانات حقيقية فقط", "Real data only")} color={GREEN} />
                <StatusPill label={tr("إدارة نسخ مؤسسية", "Enterprise version governance")} color={GOLD} />
                <StatusPill label={tr(loading ? "جاري التحديث" : "جاهز للإدارة", loading ? "Refreshing" : "Ready to manage")} color={loading ? AMBER : BLUE} />
              </div>
              <div style={{ color: "rgba(255,243,191,0.72)", fontSize: 13, fontWeight: 700 }}>{tr("الجهة الحالية", "Current tenant")}: {tenantId}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(300px, 0.9fr)", gap: 20 }}>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ color: GOLD_SOFT, fontWeight: 900, fontSize: 14, letterSpacing: 0.4 }}>VERSION GOVERNANCE CENTER</div>
                <div style={{ fontSize: "clamp(30px, 4.6vw, 56px)", lineHeight: 1.05, fontWeight: 900, color: "#fff3bf" }}>
                  {tr("مركز إدارة النسخ والتوثيق التشغيلي", "Operational versioning and approval command center")}
                </div>
                <div style={{ color: "rgba(255,243,191,0.82)", lineHeight: 1.95, fontSize: 15, maxWidth: 920 }}>
                  {tr(
                    "واجهة تنفيذية فاخرة لإدارة النسخ الحقيقية للتوزيع، والاعتماد الرسمي، والاسترجاع، والمزامنة السحابية، مع ربط مباشر ببيانات البرنامج الفعلية والأرشيف المحلي والسحابي.",
                    "A premium executive interface for managing real distribution versions, official approvals, restores, and cloud sync, directly linked to live program data and both local and cloud archives."
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
                  <MetricTile label={tr("سلامة المنظومة", "System health")} value={`${healthScore}%`} note={tr("تعتمد على التشغيل، الإصدارات، الاعتماد، والأرشيف", "Based on current run, versions, approval, and archive")} />
                  <MetricTile label={tr("الإصدارات الحقيقية", "Real versions")} value={versions.length} note={tr("نسخ محفوظة قابلة للاسترجاع", "Saved restorable versions")} />
                  <MetricTile label={tr("الأرشيف السحابي", "Cloud archive")} value={programStats.archiveCloud} note={tr("مرآة تخزين سحابي للتشغيل", "Cloud-backed run storage")} />
                </div>
              </div>

              <div style={{ ...surface("rgba(255,255,255,0.08)", "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))"), padding: 18, display: "grid", gap: 12, alignContent: "start" }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: "#fff2b6" }}>{tr("الحالة التنفيذية السريعة", "Executive quick status")}</div>
                <div style={{ color: "rgba(255,243,191,0.7)", lineHeight: 1.85, fontSize: 13 }}>{tr("قراءة مركزة للحالة الحالية تساعد المسؤول على اتخاذ القرار بسرعة وثقة.", "A focused snapshot that helps administrators take decisions quickly and confidently.")}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  <MetricTile label={tr("التشغيل الحالي", "Current run")} value={currentSummary.runId ? tr("موجود", "Available") : tr("غير موجود", "Unavailable")} note={currentSummary.runId || tr("يلزم تنفيذ تشغيل جديد", "A new run is needed")} />
                  <MetricTile label={tr("النسخة الرسمية", "Official version")} value={approval?.runId ? tr("معتمدة", "Approved") : tr("غير معتمدة", "Not approved")} note={approval?.approvedBy || tr("بانتظار الاعتماد", "Awaiting approval")} />
                  <MetricTile label={tr("التغطية", "Coverage")} value={currentSummary.coverage !== null ? `${currentSummary.coverage}%` : "—"} note={tr("نسبة التغطية من بيانات التشغيل", "Run-derived coverage ratio")} />
                  <MetricTile label={tr("الأرشيف", "Archive")} value={`${programStats.archiveLocal}/${programStats.archiveCloud}`} note={tr("محلي / سحابي", "Local / cloud")} />
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <StatusPill label={tr(canManageArchive ? "صلاحية إدارة متاحة" : "صلاحية الإدارة غير متاحة", canManageArchive ? "Management permission available" : "Management permission unavailable")} color={canManageArchive ? GREEN : RED} />
                  <StatusPill label={tr(`سلامة الحالة ${healthScore}%`, `Health ${healthScore}%`)} color={healthTone} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={buttonStyle("ghost")} onClick={() => nav("/task-distribution/results")}>{tr("الجدول الشامل", "Master table")}</button>
            <button style={buttonStyle("ghost")} onClick={() => nav("/archive")}>{tr("الأرشيف", "Archive")}</button>
            <button style={buttonStyle("ghost")} onClick={refresh} disabled={loading || busy}>{tr("تحديث", "Refresh")}</button>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <StatusPill label={tr(`المستخدم: ${currentEmail || "—"}`, `User: ${currentEmail || "—"}`)} color={BLUE} />
          </div>
        </div>

        {message ? (
          <div style={{ ...surface("rgba(52,211,153,0.32)", "linear-gradient(180deg, rgba(52,211,153,0.10), rgba(255,255,255,0.02))"), padding: 16, color: "#fef3c7" }}>
            {message}
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
          <VersionStatCard title={tr("الإصدارات المحفوظة", "Saved versions")} value={versions.length} note={tr("من سجلات البرنامج الفعلية المحلية والسحابية", "From the actual local and cloud program records")} />
          <VersionStatCard title={tr("إسنادات التشغيل الحالي", "Current run assignments")} value={currentSummary.assignments} note={currentSummary.runId ? `${tr("معرف التشغيل", "Run ID")}: ${currentSummary.runId}` : tr("لا يوجد تشغيل حالي", "No current run")} accent={GOLD_SOFT} />
          <VersionStatCard title={tr("نسبة تغطية التشغيل", "Run coverage")} value={currentSummary.coverage !== null ? `${currentSummary.coverage}%` : "—"} note={currentSummary.totalRequired ? `${tr("مغطى", "Covered")}: ${currentSummary.totalAssigned} / ${currentSummary.totalRequired}` : tr("لا توجد بيانات debug كافية لحساب التغطية", "No sufficient debug data to calculate coverage")} accent={GREEN} />
          <VersionStatCard title={tr("الأرشيف المحلي / السحابي", "Local / cloud archive")} value={`${programStats.archiveLocal} / ${programStats.archiveCloud}`} note={tr("مرتبط مباشرة بسجلات الأرشيف في البرنامج", "Directly linked to archive records in the program")} accent={BLUE} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 450px) 1fr", gap: 18, alignItems: "start" }}>
          <div style={{ display: "grid", gap: 18 }}>
            <div style={cardStyle}>
              <SectionHeader title={tr("ملخص التشغيل الحالي", "Current run summary")} subtitle={tr("قراءة تنفيذية مباشرة لأحدث تشغيل محفوظ داخل البرنامج.", "A direct executive readout of the latest saved run inside the program.")} />
              {!currentSummary.runId ? (
                <div style={{ opacity: 0.8, lineHeight: 1.85 }}>{tr("لا يوجد تشغيل حالي محفوظ حتى الآن.", "There is no saved current run yet.")}</div>
              ) : (
                <div style={{ display: "grid", gap: 10, fontWeight: 700, lineHeight: 1.9 }}>
                  <div>{tr("تاريخ التشغيل", "Run date")}: <span style={{ opacity: 0.88 }}>{formatDateTime(currentSummary.createdAtISO, lang)}</span></div>
                  <div>{tr("عدد المعلمين داخل التشغيل", "Teachers in run")}: {currentSummary.teachersCount}</div>
                  <div>{tr("عدد الاختبارات داخل التشغيل", "Exams in run")}: {currentSummary.examsCount}</div>
                  <div>{tr("المراقبة", "Invigilation")}: {currentSummary.invigilation}</div>
                  <div>{tr("الاحتياط", "Reserve")}: {currentSummary.reserve}</div>
                  <div>{tr("المراجعة", "Review")}: {currentSummary.review}</div>
                  <div>{tr("التصحيح", "Correction")}: {currentSummary.correction}</div>
                  <div>{tr("التحذيرات", "Warnings")}: {currentSummary.warnings}</div>
                </div>
              )}
            </div>

            <div style={cardStyle}>
              <SectionHeader title={tr("بيانات البرنامج المرتبطة", "Linked program data")} subtitle={tr("مؤشرات مباشرة من عناصر النظام الأساسية المرتبطة بعملية التوزيع.", "Direct indicators from the core system entities tied to distribution." )} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <VersionStatCard title={tr("المعلمين", "Teachers")} value={programStats.teachers} />
                <VersionStatCard title={tr("الاختبارات", "Exams")} value={programStats.exams} />
                <VersionStatCard title={tr("القاعات", "Rooms")} value={programStats.rooms} />
                <VersionStatCard title={tr("المستخدمين والصلاحيات", "Users and permissions")} value={programStats.members} />
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <button style={buttonStyle("ghost")} onClick={() => nav("/teachers")}>{tr("المعلمين", "Teachers")}</button>
                <button style={buttonStyle("ghost")} onClick={() => nav("/exams")}>{tr("الاختبارات", "Exams")}</button>
                <button style={buttonStyle("ghost")} onClick={() => nav("/rooms")}>{tr("القاعات", "Rooms")}</button>
                <button style={buttonStyle("ghost")} onClick={() => nav("/multi-role")}>{tr("الصلاحيات", "Permissions")}</button>
              </div>
            </div>

            <div style={cardStyle}>
              <SectionHeader title={tr("إجراءات الإصدار الرسمي", "Official version actions")} subtitle={tr("من هنا يتم حفظ إصدار حقيقي، أو اعتماد التشغيل الحالي، أو تنفيذ المزامنة السحابية.", "From here you can save a real version, approve the current run, or trigger cloud sync.")} />
              <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr("اسم الإصدار أو النسخة", "Version title or label")} />
              <div style={{ height: 10 }} />
              <textarea style={{ ...inputStyle, minHeight: 96, resize: "vertical" }} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("ملاحظات الاعتماد أو سبب إنشاء الإصدار", "Approval notes or reason for creating this version")} />
              <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                <button style={buttonStyle("brand")} disabled={!canManageArchive || busy} onClick={createVersion}>{tr("حفظ إصدار حقيقي", "Save real version")}</button>
                <button style={buttonStyle("ghost")} disabled={!canManageArchive || busy} onClick={approveCurrent}>{tr("اعتماد التشغيل الحالي", "Approve current run")}</button>
                <button style={buttonStyle("ghost")} disabled={busy} onClick={syncNow}>{tr("مزامنة سحابية", "Cloud sync")}</button>
              </div>
              {!canManageArchive ? <div style={{ marginTop: 10, fontSize: 12, opacity: 0.78 }}>{tr("حسابك لا يملك صلاحية إدارة الإصدارات أو تشغيل التوزيع.", "Your account does not have permission to manage versions or run distribution.")}</div> : null}
              {approval ? (
                <div style={{ marginTop: 14, padding: 14, borderRadius: 16, background: "rgba(96,165,250,0.10)", border: "1px solid rgba(96,165,250,0.22)", lineHeight: 1.9 }}>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>{tr("آخر اعتماد رسمي", "Latest official approval")}</div>
                  <div>{tr("التاريخ", "Date")}: {formatDateTime(approval.approvedAtISO, lang)}</div>
                  <div>{tr("بواسطة", "By")}: {approval.approvedBy || "—"}</div>
                  <div>{tr("عدد الإسنادات", "Assignments")}: {approval.assignmentsCount}</div>
                  <div>{tr("المصدر", "Source")}: {getSourceLabel(approval.source, tr)}</div>
                  {approval.note ? <div>{tr("الملاحظة", "Note")}: {approval.note}</div> : null}
                </div>
              ) : null}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <SectionHeader title={tr("سجل الإصدارات الحقيقي", "Real version history")} subtitle={tr("الإصدارات المعروضة هنا مأخوذة من سجلات البرنامج الفعلية وليست بيانات تجريبية.", "The versions shown here are pulled from the actual program records, not sample data.")} />
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input style={{ ...inputStyle, width: 280 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("بحث في اسم الإصدار أو الملاحظات", "Search by title or notes")} />
                <span style={badgeStyle("#111", "rgba(255,215,0,0.22)")}>{tr("المعروض", "Shown")}: {filteredVersions.length}</span>
              </div>
            </div>

            {loading ? (
              <div style={{ marginTop: 12, opacity: 0.82 }}>{tr("جاري تحميل البيانات الحقيقية...", "Loading the real data...")}</div>
            ) : !filteredVersions.length ? (
              <div style={{ marginTop: 12, opacity: 0.82 }}>{tr("لا توجد إصدارات محفوظة حتى الآن.", "There are no saved versions yet.")}</div>
            ) : (
              <div style={{ marginTop: 8, display: "grid", gap: 14 }}>
                {latestVersion ? (
                  <div style={{ ...surface("rgba(52,211,153,0.26)", "linear-gradient(180deg, rgba(52,211,153,0.08), rgba(255,255,255,0.02))"), padding: 18 }}>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{tr("أحدث إصدار محفوظ", "Latest saved version")}: {latestVersion.title}</div>
                    <div style={{ marginTop: 8, opacity: 0.84, lineHeight: 1.9 }}>
                      {tr("الإسنادات", "Assignments")}: {latestVersionSummary.assignments} • {tr("التحذيرات", "Warnings")}: {latestVersionSummary.warnings} • {tr("المراقبة", "Invigilation")}: {latestVersionSummary.invigilation} • {tr("الاحتياط", "Reserve")}: {latestVersionSummary.reserve}
                    </div>
                    {versionBadge(latestVersion)}
                  </div>
                ) : null}

                {filteredVersions.map((version, index) => {
                  const summary = summarizeRun(version.run || null);
                  const isApproved = approval?.runId && version.run?.runId === approval.runId;
                  const isCurrent = currentSummary.runId && version.run?.runId === currentSummary.runId;
                  const timelineColor = isApproved ? BLUE : isCurrent ? GREEN : GOLD;
                  return (
                    <div key={version.versionId} style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 12, alignItems: "start" }}>
                      <div style={{ display: "grid", justifyItems: "center", gap: 6 }}>
                        <TimelineDot color={timelineColor} />
                        {index !== filteredVersions.length - 1 ? <div style={{ width: 2, minHeight: 110, background: "linear-gradient(180deg, rgba(255,215,0,0.28), rgba(255,255,255,0.04))" }} /> : null}
                      </div>
                      <div style={{ ...surface(), padding: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
                          <div>
                            <div style={{ fontWeight: 900, fontSize: 18 }}>{version.title || tr("بدون عنوان", "Untitled")}</div>
                            <div style={{ marginTop: 6, opacity: 0.78, fontSize: 13, lineHeight: 1.8 }}>
                              {formatDateTime(version.createdAtISO, lang)}
                              {version.createdBy ? ` • ${version.createdBy}` : ""}
                              {version.run?.runId ? ` • ${tr("معرف التشغيل", "Run ID")}: ${version.run.runId}` : ""}
                            </div>
                            {versionBadge(version)}
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button style={buttonStyle("ghost")} disabled={busy} onClick={() => restoreVersion(version)}>{tr("استعادة وربط", "Restore & relink")}</button>
                            <button style={buttonStyle("ghost")} onClick={() => nav("/task-distribution/results")}>{tr("فتح النتائج", "Open results")}</button>
                          </div>
                        </div>

                        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                          <MetricTile label={tr("الإسنادات", "Assignments")} value={summary.assignments} note={tr("إجمالي المهام داخل النسخة", "Total tasks in version")} />
                          <MetricTile label={tr("المعلمين", "Teachers")} value={summary.teachersCount} note={tr("المعنيون داخل التشغيل", "Included in run")} />
                          <MetricTile label={tr("الاختبارات", "Exams")} value={summary.examsCount} note={tr("الاختبارات المرتبطة", "Linked exams")} />
                          <MetricTile label={tr("نسبة التغطية", "Coverage")} value={summary.coverage !== null ? `${summary.coverage}%` : "—"} note={tr("من بيانات debug أو الملخص", "From debug summary")} />
                        </div>

                        <div style={{ marginTop: 12, lineHeight: 1.9, fontSize: 13, opacity: 0.9 }}>
                          {tr("المراقبة", "Invigilation")}: {summary.invigilation} • {tr("الاحتياط", "Reserve")}: {summary.reserve} • {tr("المراجعة", "Review")}: {summary.review} • {tr("التصحيح", "Correction")}: {summary.correction} • {tr("التحذيرات", "Warnings")}: {summary.warnings}
                          {isApproved ? ` • ${tr("هذه هي النسخة الرسمية المعتمدة حاليًا", "This is the current official approved version")}` : ""}
                          {version.note ? <><br />{tr("الملاحظة", "Note")}: {version.note}</> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ ...cardStyle, display: "grid", gap: 12 }}>
          <SectionHeader title={tr("حالة الربط مع البرنامج", "Program linkage status")} subtitle={tr("هذه الصفحة مرتبطة مباشرة بالتشغيل الحالي، والإصدارات، والاعتماد الرسمي، وأعضاء الجهة، والمعلمين، والاختبارات، والقاعات، والأرشيف المحلي والسحابي.", "This page is connected directly to the current run, versions, official approval, tenant members, teachers, exams, rooms, and both local and cloud archives.")} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={badgeStyle("#111", "rgba(255,215,0,0.22)")}>{tr("الإصدارات", "Versions")}: {versions.length}</span>
            <span style={badgeStyle("#111", "rgba(96,165,250,0.18)")}>{tr("الأرشيف السحابي", "Cloud archive")}: {cloudArchiveItems.length}</span>
            <span style={badgeStyle("#111", "rgba(52,211,153,0.18)")}>{tr("المستخدمون", "Users")}: {programStats.members}</span>
            <span style={badgeStyle("#111", "rgba(245,158,11,0.18)")}>{tr("المعلمين", "Teachers")}: {programStats.teachers}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
