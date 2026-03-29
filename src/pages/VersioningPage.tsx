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
const BG = "#000";
const LINE = "rgba(255,215,0,0.18)";
const CARD_BG = "linear-gradient(180deg, rgba(255,215,0,0.05), rgba(255,215,0,0.02))";

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

function VersionStatCard(props: { title: string; value: React.ReactNode; note?: string; accent?: string }) {
  return (
    <div style={{
      background: CARD_BG,
      border: `1px solid ${LINE}`,
      borderRadius: 18,
      padding: 18,
      boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
    }}>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>{props.title}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: props.accent || GOLD }}>{props.value}</div>
      {props.note ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8, lineHeight: 1.8 }}>{props.note}</div> : null}
    </div>
  );
}

export default function VersioningPage() {
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
    background: BG,
    color: GOLD,
    minHeight: "100vh",
    direction: isRTL ? "rtl" : "ltr",
  };

  const cardStyle: React.CSSProperties = {
    background: CARD_BG,
    border: `1px solid ${LINE}`,
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 18px 40px rgba(0,0,0,0.30)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    color: "#fff3bf",
    border: `1px solid ${LINE}`,
    borderRadius: 12,
    padding: "10px 12px",
    outline: "none",
    boxSizing: "border-box",
  };

  const buttonStyle = (variant: "brand" | "ghost" | "danger" = "brand"): React.CSSProperties => ({
    background:
      variant === "brand"
        ? "rgba(255,215,0,0.16)"
        : variant === "danger"
        ? "rgba(239,68,68,0.16)"
        : "rgba(255,255,255,0.05)",
    color: variant === "danger" ? "#fecaca" : GOLD,
    border: `1px solid ${variant === "danger" ? "rgba(239,68,68,0.35)" : LINE}`,
    borderRadius: 12,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 800,
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

  const createVersion = async () => {
    if (!currentRun) {
      setMessage(tr("لا يوجد تشغيل حالي محفوظ لإنشاء إصدار منه.", "There is no saved current run to version."));
      return;
    }
    setBusy(true);
    try {
      await saveDistributionVersion({
        tenantId,
        title,
        note,
        run: currentRun,
        actorEmail: currentEmail,
      });
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
      <div style={{ maxWidth: 1380, margin: "0 auto", display: "grid", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900 }}>{tr("إدارة Versioning الحقيقية", "Real Versioning Management")}</h1>
            <div style={{ marginTop: 8, opacity: 0.82, lineHeight: 1.9, maxWidth: 960 }}>
              {tr(
                "هذه الصفحة أصبحت مرتبطة مباشرة ببيانات البرنامج الفعلية: التشغيل الحالي، الإصدارات المحفوظة، الاعتماد الرسمي، الأرشيف، وعدد بيانات المعلمين والاختبارات والقاعات والمستخدمين.",
                "This page is now connected directly to the program's real data: the current run, saved versions, official approval, archive, and the actual counts of teachers, exams, rooms, and users."
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={buttonStyle("ghost")} onClick={() => nav("/task-distribution/results")}>{tr("الجدول الشامل", "Master table")}</button>
            <button style={buttonStyle("ghost")} onClick={() => nav("/archive")}>{tr("الأرشيف", "Archive")}</button>
            <button style={buttonStyle("ghost")} onClick={refresh} disabled={loading || busy}>{tr("تحديث", "Refresh")}</button>
          </div>
        </div>

        {message ? (
          <div style={{ ...cardStyle, borderColor: "rgba(52,211,153,0.32)", color: "#fef3c7" }}>
            {message}
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <VersionStatCard
            title={tr("الإصدارات المحفوظة", "Saved versions")}
            value={versions.length}
            note={tr("من سجلات البرنامج الفعلية المحلية والسحابية", "From the actual local and cloud program records")}
          />
          <VersionStatCard
            title={tr("إسنادات التشغيل الحالي", "Current run assignments")}
            value={currentSummary.assignments}
            note={currentSummary.runId ? `${tr("معرف التشغيل", "Run ID")}: ${currentSummary.runId}` : tr("لا يوجد تشغيل حالي", "No current run")}
          />
          <VersionStatCard
            title={tr("نسبة تغطية التشغيل", "Run coverage")}
            value={currentSummary.coverage !== null ? `${currentSummary.coverage}%` : "—"}
            note={currentSummary.totalRequired ? `${tr("مغطى", "Covered")}: ${currentSummary.totalAssigned} / ${currentSummary.totalRequired}` : tr("لا توجد بيانات debug كافية لحساب التغطية", "No sufficient debug data to calculate coverage")}
            accent="#34d399"
          />
          <VersionStatCard
            title={tr("الأرشيف المحلي / السحابي", "Local / cloud archive")}
            value={`${programStats.archiveLocal} / ${programStats.archiveCloud}`}
            note={tr("مرتبط مباشرة بسجلات الأرشيف في البرنامج", "Directly linked to archive records in the program")}
            accent="#60a5fa"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 430px) 1fr", gap: 18, alignItems: "start" }}>
          <div style={{ display: "grid", gap: 18 }}>
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{tr("ملخص التشغيل الحالي", "Current run summary")}</div>
                {currentSummary.runId ? <span style={badgeStyle("#111", "rgba(255,215,0,0.22)")}>{currentSummary.runId}</span> : null}
              </div>

              {!currentSummary.runId ? (
                <div style={{ marginTop: 12, opacity: 0.8 }}>{tr("لا يوجد تشغيل حالي محفوظ حتى الآن.", "There is no saved current run yet.")}</div>
              ) : (
                <div style={{ marginTop: 14, display: "grid", gap: 10, fontWeight: 700, lineHeight: 1.9 }}>
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
              <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 12 }}>{tr("بيانات البرنامج المرتبطة", "Linked program data")}</div>
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
              <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 12 }}>{tr("إجراءات الإصدار الرسمي", "Official version actions")}</div>
              <input
                style={inputStyle}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={tr("اسم الإصدار أو النسخة", "Version title or label")}
              />
              <div style={{ height: 10 }} />
              <textarea
                style={{ ...inputStyle, minHeight: 96, resize: "vertical" }}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={tr("ملاحظات الاعتماد أو سبب إنشاء الإصدار", "Approval notes or reason for creating this version")}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <button style={buttonStyle("brand")} disabled={!canManageArchive || busy} onClick={createVersion}>{tr("حفظ إصدار حقيقي", "Save real version")}</button>
                <button style={buttonStyle("ghost")} disabled={!canManageArchive || busy} onClick={approveCurrent}>{tr("اعتماد التشغيل الحالي", "Approve current run")}</button>
                <button style={buttonStyle("ghost")} disabled={busy} onClick={syncNow}>{tr("مزامنة سحابية", "Cloud sync")}</button>
              </div>
              {!canManageArchive ? (
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.78 }}>
                  {tr("حسابك لا يملك صلاحية إدارة الإصدارات أو تشغيل التوزيع.", "Your account does not have permission to manage versions or run distribution.")}
                </div>
              ) : null}
              {approval ? (
                <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: "rgba(96,165,250,0.10)", border: "1px solid rgba(96,165,250,0.22)", lineHeight: 1.9 }}>
                  <div style={{ fontWeight: 900 }}>{tr("آخر اعتماد رسمي", "Latest official approval")}</div>
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
                <div style={{ fontSize: 20, fontWeight: 900 }}>{tr("سجل الإصدارات الحقيقي", "Real version history")}</div>
                <div style={{ marginTop: 6, opacity: 0.78, fontSize: 13 }}>
                  {tr(
                    "الإصدارات المعروضة هنا مأخوذة من سجلات البرنامج الفعلية وليست بيانات تجريبية.",
                    "The versions shown here are pulled from the actual program records, not sample data."
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  style={{ ...inputStyle, width: 260 }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tr("بحث في اسم الإصدار أو الملاحظات", "Search by title or notes")}
                />
                <span style={badgeStyle("#111", "rgba(255,215,0,0.22)")}>{tr("المعروض", "Shown")}: {filteredVersions.length}</span>
              </div>
            </div>

            {loading ? (
              <div style={{ marginTop: 16, opacity: 0.82 }}>{tr("جاري تحميل البيانات الحقيقية...", "Loading the real data...")}</div>
            ) : !filteredVersions.length ? (
              <div style={{ marginTop: 16, opacity: 0.82 }}>{tr("لا توجد إصدارات محفوظة حتى الآن.", "There are no saved versions yet.")}</div>
            ) : (
              <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
                {latestVersion ? (
                  <div style={{ border: "1px solid rgba(52,211,153,0.26)", background: "rgba(52,211,153,0.07)", borderRadius: 16, padding: 16 }}>
                    <div style={{ fontSize: 17, fontWeight: 900 }}>{tr("أحدث إصدار محفوظ", "Latest saved version")}: {latestVersion.title}</div>
                    <div style={{ marginTop: 8, opacity: 0.84, lineHeight: 1.9 }}>
                      {tr("الإسنادات", "Assignments")}: {latestVersionSummary.assignments} • {tr("التحذيرات", "Warnings")}: {latestVersionSummary.warnings} • {tr("المراقبة", "Invigilation")}: {latestVersionSummary.invigilation} • {tr("الاحتياط", "Reserve")}: {latestVersionSummary.reserve}
                    </div>
                    {versionBadge(latestVersion)}
                  </div>
                ) : null}

                {filteredVersions.map((version) => {
                  const summary = summarizeRun(version.run || null);
                  const isApproved = approval?.runId && version.run?.runId === approval.runId;
                  return (
                    <div key={version.versionId} style={{ border: `1px solid ${LINE}`, borderRadius: 16, padding: 16, background: "rgba(255,255,255,0.03)" }}>
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

                      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                        <div style={{ ...cardStyle, padding: 12 }}>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>{tr("الإسنادات", "Assignments")}</div>
                          <div style={{ fontWeight: 900, fontSize: 20 }}>{summary.assignments}</div>
                        </div>
                        <div style={{ ...cardStyle, padding: 12 }}>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>{tr("المعلمين", "Teachers")}</div>
                          <div style={{ fontWeight: 900, fontSize: 20 }}>{summary.teachersCount}</div>
                        </div>
                        <div style={{ ...cardStyle, padding: 12 }}>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>{tr("الاختبارات", "Exams")}</div>
                          <div style={{ fontWeight: 900, fontSize: 20 }}>{summary.examsCount}</div>
                        </div>
                        <div style={{ ...cardStyle, padding: 12 }}>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>{tr("نسبة التغطية", "Coverage")}</div>
                          <div style={{ fontWeight: 900, fontSize: 20 }}>{summary.coverage !== null ? `${summary.coverage}%` : "—"}</div>
                        </div>
                      </div>

                      <div style={{ marginTop: 12, lineHeight: 1.9, fontSize: 13, opacity: 0.9 }}>
                        {tr("المراقبة", "Invigilation")}: {summary.invigilation} • {tr("الاحتياط", "Reserve")}: {summary.reserve} • {tr("المراجعة", "Review")}: {summary.review} • {tr("التصحيح", "Correction")}: {summary.correction} • {tr("التحذيرات", "Warnings")}: {summary.warnings}
                        {isApproved ? ` • ${tr("هذه هي النسخة الرسمية المعتمدة حاليًا", "This is the current official approved version")}` : ""}
                        {version.note ? <><br />{tr("الملاحظة", "Note")}: {version.note}</> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ ...cardStyle, display: "grid", gap: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{tr("حالة الربط مع البرنامج", "Program linkage status")}</div>
          <div style={{ lineHeight: 1.9, opacity: 0.9 }}>
            {tr(
              "الصفحة تقرأ الآن من التشغيل الحالي الفعلي، ومن وثائق الإصدارات المحفوظة، ومن الاعتماد الرسمي، ومن أعضاء الجهة، ومن بيانات المعلمين والاختبارات والقاعات، ومن الأرشيف المحلي والسحابي. أي تغيير في هذه الأجزاء ينعكس هنا مباشرة بعد التحديث.",
              "This page now reads from the actual current run, saved version documents, official approval, tenant members, teachers, exams, rooms, and both local and cloud archives. Any changes in those areas are reflected here after refresh."
            )}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={badgeStyle("#111", "rgba(255,215,0,0.22)")}>{tr("الإصدارات", "Versions")}: {versions.length}</span>
            <span style={badgeStyle("#111", "rgba(96,165,250,0.18)")}>{tr("الأرشيف السحابي", "Cloud archive")}: {cloudArchiveItems.length}</span>
            <span style={badgeStyle("#111", "rgba(52,211,153,0.18)")}>{tr("المستخدمون", "Users")}: {programStats.members}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
