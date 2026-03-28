import React from "react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "../auth/AuthContext";
import { useTenant } from "../tenant/TenantContext";
import { useI18n } from "../i18n/I18nProvider";
import { useTenantAuditFeed } from "../features/audit/hooks/useTenantAuditFeed";


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
  const { userProfile } = useAuth();

  // ✅ FIX: TenantContext has tenantId (not currentTenantId)
  const { tenantId: tenantCtxId } = useTenant();

  // prefer profile tenant (effective) then tenant context
  const tenantId = userProfile?.tenantId || tenantCtxId || "";

  const { rows, err, canRead } = useTenantAuditFeed(tenantId);

  const COLORS = {
    bg: "#000000",
    panel: "rgba(255, 215, 0, 0.04)",
    gold: "#b8860b",   // ذهبي غامق
    gold2: "#d4af37",  // ذهبي أوضح للعناوين
    border: "rgba(184, 134, 11, 0.35)",
    borderSoft: "rgba(184, 134, 11, 0.22)",
    textSoft: "rgba(184, 134, 11, 0.85)",
    danger: "#ff5d5d",
  };

  return (
    <div
      style={{
        padding: 16,
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.gold,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          padding: "12px 14px",
          borderRadius: 14,
          border: `1px solid ${COLORS.border}`,
          background: COLORS.panel,
        }}
      >
        <h2 style={{ margin: 0, color: COLORS.gold2 }}>
          {t("audit.title")}
        </h2>
        <div style={{ opacity: 0.9, color: COLORS.textSoft }}>
          {tenantId ? `Tenant: ${tenantId}` : ""}
        </div>
      </div>

      {!canRead ? (
        <div style={{ marginTop: 16, opacity: 0.85, color: COLORS.textSoft }}>
          {t("audit.empty")}
        </div>
      ) : null}

      {err ? (
        <div style={{ marginTop: 12, color: COLORS.danger }}>{err}</div>
      ) : null}

      <div
        style={{
          marginTop: 12,
          overflowX: "auto",
          borderRadius: 14,
          border: `1px solid ${COLORS.border}`,
          background: COLORS.panel,
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
          <thead>
            <tr>
              {["Time", "Type", "Actor", "Target", "Details"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "start",
                    padding: 12,
                    borderBottom: `1px solid ${COLORS.border}`,
                    color: COLORS.gold2,
                    fontWeight: 900,
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 12, color: COLORS.textSoft }}>
                  {t("audit.empty")}
                </td>
              </tr>
            ) : null}

            {rows.map((r, idx) => {
              const isAlt = idx % 2 === 1;
              return (
                <tr
                  key={r.id}
                  style={{ background: isAlt ? "rgba(255, 215, 0, 0.02)" : "transparent" }}
                >
                  <td
                    style={{
                      padding: 12,
                      borderBottom: `1px solid ${COLORS.borderSoft}`,
                      whiteSpace: "nowrap",
                      color: COLORS.gold2,
                    }}
                  >
                    {fmt(r.createdAt)}
                  </td>

                  <td style={{ padding: 12, borderBottom: `1px solid ${COLORS.borderSoft}`, color: COLORS.gold }}>
                    {r.type}
                  </td>

                  <td
                    style={{
                      padding: 12,
                      borderBottom: `1px solid ${COLORS.borderSoft}`,
                      whiteSpace: "nowrap",
                      color: COLORS.gold,
                    }}
                  >
                    {r.actorEmail || ""}
                  </td>

                  <td
                    style={{
                      padding: 12,
                      borderBottom: `1px solid ${COLORS.borderSoft}`,
                      whiteSpace: "nowrap",
                      color: COLORS.gold,
                    }}
                  >
                    {r.targetEmail || ""}
                  </td>

                  <td style={{ padding: 12, borderBottom: `1px solid ${COLORS.borderSoft}` }}>
                    <pre
                      style={{
                        margin: 0,
                        whiteSpace: "pre-wrap",
                        color: COLORS.gold,
                        background: "rgba(255,255,255,0.02)",
                        border: `1px solid ${COLORS.borderSoft}`,
                        borderRadius: 10,
                        padding: 10,
                        overflowX: "auto",
                      }}
                    >
                      {JSON.stringify(r.details || {}, null, 2)}
                    </pre>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style>{`
        ::selection { background: rgba(184,134,11,0.35); }
      `}</style>
    </div>
  );
}