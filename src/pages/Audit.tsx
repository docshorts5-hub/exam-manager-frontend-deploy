import React, { useEffect, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "../auth/AuthContext";
import { useTenant } from "../tenant/TenantContext";
import { useI18n } from "../i18n/I18nProvider";
import { listenActivityLogs, type ActivityLogEntry } from "../services/activityLog.service";

function fmt(ts?: Timestamp) {
  if (!ts) return "";
  try {
    return ts.toDate().toLocaleString();
  } catch {
    return "";
  }
}

export default function Audit() {
  const { t } = useI18n();
  const { userProfile } = useAuth() as any;
  const { tenantId: tenantCtxId } = useTenant();
  const tenantId = userProfile?.tenantId || tenantCtxId || "";
  const [rows, setRows] = useState<ActivityLogEntry[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    setErr("");
    if (!tenantId) {
      setRows([]);
      return;
    }
    return listenActivityLogs(tenantId, setRows, { pageSize: 300 });
  }, [tenantId]);

  const COLORS = {
    bg: "#000000",
    panel: "rgba(255, 215, 0, 0.04)",
    gold: "#b8860b",
    gold2: "#d4af37",
    border: "rgba(184, 134, 11, 0.35)",
    borderSoft: "rgba(184, 134, 11, 0.22)",
    textSoft: "rgba(184, 134, 11, 0.85)",
    danger: "#ff5d5d",
  };

  return (
    <div style={{ padding: 16, minHeight: "100vh", background: COLORS.bg, color: COLORS.gold }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "12px 14px", borderRadius: 14, border: `1px solid ${COLORS.border}`, background: COLORS.panel }}>
        <h2 style={{ margin: 0, color: COLORS.gold2 }}>{t("audit.title") || "سجل العمليات"}</h2>
        <div style={{ opacity: 0.9, color: COLORS.textSoft }}>{tenantId ? `Tenant: ${tenantId}` : ""}</div>
      </div>

      {err ? <div style={{ marginTop: 12, color: COLORS.danger }}>{err}</div> : null}

      <div style={{ marginTop: 12, overflowX: "auto", borderRadius: 14, border: `1px solid ${COLORS.border}`, background: COLORS.panel }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr>
              {["Time", "Level", "Action", "Entity", "Actor", "Details"].map((h) => (
                <th key={h} style={{ textAlign: "start", padding: 12, borderBottom: `1px solid ${COLORS.border}`, color: COLORS.gold2, fontWeight: 900, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 12, color: COLORS.textSoft }}>{t("audit.empty") || "لا توجد سجلات بعد"}</td>
              </tr>
            ) : rows.map((r, idx) => (
              <tr key={`${String(r.ts?.seconds || "")}-${idx}`} style={{ background: idx % 2 ? "rgba(255, 215, 0, 0.02)" : "transparent" }}>
                <td style={{ padding: 12, borderBottom: `1px solid ${COLORS.borderSoft}`, whiteSpace: "nowrap", color: COLORS.gold2 }}>{fmt(r.ts)}</td>
                <td style={{ padding: 12, borderBottom: `1px solid ${COLORS.borderSoft}`, color: r.level === "critical" ? "#ff6b6b" : r.level === "warning" ? "#f59e0b" : COLORS.gold }}>{r.level}</td>
                <td style={{ padding: 12, borderBottom: `1px solid ${COLORS.borderSoft}`, color: COLORS.gold }}>{r.action}</td>
                <td style={{ padding: 12, borderBottom: `1px solid ${COLORS.borderSoft}`, color: COLORS.gold }}>{r.entityType || "—"} {r.entityId ? `#${r.entityId}` : ""}</td>
                <td style={{ padding: 12, borderBottom: `1px solid ${COLORS.borderSoft}`, color: COLORS.gold }}>{r.actorDisplayName || r.actorEmail || r.actorUid || "—"}</td>
                <td style={{ padding: 12, borderBottom: `1px solid ${COLORS.borderSoft}` }}>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: COLORS.gold, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, padding: 10, overflowX: "auto" }}>{JSON.stringify({ message: r.message, before: r.before, after: r.after }, null, 2)}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
