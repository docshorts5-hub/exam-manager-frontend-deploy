import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTenant } from "../tenant/TenantContext";
import { useCan } from "../auth/permissions";
import {
  approveCurrentDistribution,
  listDistributionVersions,
  loadDistributionApproval,
  restoreDistributionVersion,
  saveDistributionVersion,
  syncCurrentRunToCloud,
  type DistributionApprovalRecord,
  type DistributionVersionRecord,
} from "../services/distributionCollaboration.service";
import { loadRun } from "../utils/taskDistributionStorage";

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#071225",
  color: "#f5e7b2",
  direction: "rtl",
  padding: 18,
};
const card: React.CSSProperties = {
  border: "1px solid rgba(212,175,55,0.22)",
  borderRadius: 18,
  background: "rgba(255,255,255,0.03)",
  padding: 16,
  boxShadow: "0 16px 40px rgba(0,0,0,0.28)",
};
const input: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  background: "rgba(2,6,23,.58)",
  border: "1px solid rgba(255,255,255,.12)",
  color: "#f8fafc",
  outline: "none",
};
const btn = (kind: "brand" | "soft" | "danger"): React.CSSProperties => ({
  borderRadius: 12,
  border: "1px solid rgba(212,175,55,0.30)",
  cursor: "pointer",
  padding: "10px 14px",
  fontWeight: 900,
  color: kind === "danger" ? "#fecaca" : "#f5e7b2",
  background:
    kind === "brand"
      ? "rgba(212,175,55,0.18)"
      : kind === "danger"
      ? "rgba(239,68,68,0.12)"
      : "rgba(255,255,255,0.05)",
});

export default function DistributionVersions() {
  const nav = useNavigate();
  const auth = useAuth() as any;
  const { can } = useCan();
  const { tenantId: tenantFromContext } = useTenant() as any;
  const tenantId = String(tenantFromContext || auth?.effectiveTenantId || auth?.userProfile?.tenantId || "default").trim() || "default";
  const currentRun = useMemo(() => loadRun(tenantId), [tenantId]);

  const [versions, setVersions] = useState<DistributionVersionRecord[]>([]);
  const [approval, setApproval] = useState<DistributionApprovalRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  const canManageArchive = can("ARCHIVE_MANAGE") || can("DISTRIBUTION_RUN");

  async function refresh() {
    const [versionsRows, approvalRow] = await Promise.all([
      listDistributionVersions(tenantId),
      loadDistributionApproval(tenantId),
    ]);
    setVersions(versionsRows);
    setApproval(approvalRow);
  }

  useEffect(() => {
    refresh();
  }, [tenantId]);

  const currentSummary = currentRun
    ? {
        assignments: Array.isArray(currentRun.assignments) ? currentRun.assignments.length : 0,
        warnings: Array.isArray(currentRun.warnings) ? currentRun.warnings.length : 0,
        runId: currentRun.runId,
      }
    : null;

  const createVersion = async () => {
    if (!currentRun) {
      setMessage("لا يوجد تشغيل حالي لحفظه.");
      return;
    }
    setSaving(true);
    try {
      await saveDistributionVersion({
        tenantId,
        title,
        note,
        run: currentRun,
        actorEmail: auth?.user?.email || "",
      });
      await syncCurrentRunToCloud(tenantId, auth?.user?.email || "");
      setTitle("");
      setNote("");
      setMessage("تم إنشاء إصدار جديد للتوزيع.");
      await refresh();
    } catch (e: any) {
      setMessage(e?.message || "تعذر إنشاء الإصدار.");
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    setSaving(true);
    try {
      await approveCurrentDistribution({ tenantId, note, actorEmail: auth?.user?.email || "" });
      setMessage("تم اعتماد التوزيع الحالي وقفله كنسخة رسمية.");
      await refresh();
    } catch (e: any) {
      setMessage(e?.message || "تعذر اعتماد التوزيع.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={page}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 950 }}>إصدارات التوزيع والاعتماد</h1>
            <div style={{ marginTop: 8, opacity: 0.8, fontWeight: 700 }}>
              دعم النظام الكامل متعدد المستخدمين: حفظ نسخ تشغيل، اعتماد النسخة النهائية، ومزامنة آخر تشغيل سحابيًا.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={btn("soft")} onClick={() => nav("/task-distribution/results")}>العودة للجدول الشامل</button>
            <button style={btn("soft")} onClick={refresh}>تحديث</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: 16, alignItems: "start" }}>
          <div style={card}>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>الحالة الحالية</div>
            {currentSummary ? (
              <div style={{ display: "grid", gap: 10, fontWeight: 800 }}>
                <div>Run ID: <span style={{ opacity: 0.9 }}>{currentSummary.runId}</span></div>
                <div>عدد الإسنادات: {currentSummary.assignments}</div>
                <div>عدد التحذيرات: {currentSummary.warnings}</div>
              </div>
            ) : <div style={{ opacity: 0.85 }}>لا يوجد تشغيل حالي محفوظ بعد.</div>}
            <div style={{ height: 12 }} />
            <input style={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="اسم الإصدار" />
            <div style={{ height: 10 }} />
            <textarea style={{ ...input, minHeight: 96, resize: "vertical" }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظات الاعتماد / الإصدار" />
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button style={btn("brand")} disabled={!canManageArchive || saving} onClick={createVersion}>حفظ إصدار</button>
              <button style={btn("soft")} disabled={!canManageArchive || saving} onClick={approve}>اعتماد التوزيع</button>
            </div>
            {approval ? (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.25)" }}>
                <div style={{ fontWeight: 900 }}>آخر اعتماد</div>
                <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.8 }}>
                  {new Date(approval.approvedAtISO).toLocaleString("ar", { hour12: true })}
                  <br />
                  بواسطة: {approval.approvedBy || "—"}
                  <br />
                  عدد الإسنادات: {approval.assignmentsCount}
                  {approval.note ? <><br />ملاحظة: {approval.note}</> : null}
                </div>
              </div>
            ) : null}
            {message ? <div style={{ marginTop: 10, fontWeight: 800 }}>{message}</div> : null}
          </div>

          <div style={card}>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>الإصدارات المحفوظة</div>
            {!versions.length ? <div style={{ opacity: 0.85 }}>لا توجد إصدارات بعد.</div> : (
              <div style={{ display: "grid", gap: 12 }}>
                {versions.map((version) => (
                  <div key={version.versionId} style={{ border: "1px solid rgba(255,255,255,.10)", borderRadius: 14, padding: 14, background: "rgba(255,255,255,.03)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 16 }}>{version.title}</div>
                        <div style={{ opacity: 0.78, fontSize: 13, marginTop: 4 }}>
                          {new Date(version.createdAtISO).toLocaleString("ar", { hour12: true })}
                          {version.createdBy ? ` • ${version.createdBy}` : ""}
                          {version.source ? ` • ${version.source === "both" ? "محلي + سحابي" : version.source === "cloud" ? "سحابي" : "محلي"}` : ""}
                        </div>
                      </div>
                      <button style={btn("soft")} onClick={async () => {
                        await restoreDistributionVersion(tenantId, version.versionId);
                        nav("/task-distribution/results");
                      }}>استعادة</button>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.8 }}>
                      الإسنادات: {Array.isArray(version.run?.assignments) ? version.run.assignments.length : 0}
                      {version.note ? <><br />ملاحظة: {version.note}</> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
