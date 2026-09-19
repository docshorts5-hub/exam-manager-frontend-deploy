// src/pages/ActivityLogs.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { listenActivityLogs, ActivityLogEntry } from "../services/activityLog.service";
import { useI18n } from "../i18n/I18nProvider";

const OFFICIAL_TEXT = "#111827";
const OFFICIAL_MUTED_TEXT = "#374151";
const OFFICIAL_BG = "linear-gradient(180deg, #f7efe2 0%, #efe1ca 48%, #e7d2b3 100%)";
const OFFICIAL_CARD_BG = "linear-gradient(180deg, #fffaf0 0%, #f3e5cd 100%)";
const OFFICIAL_PANEL_BG = "linear-gradient(180deg, #fdf3df 0%, #ead4b2 100%)";
const OFFICIAL_BORDER_COLORS = ["#b88a3b", "#2563eb", "#16a34a", "#dc2626", "#7c3aed", "#ea580c", "#0891b2", "#be123c"];

function officialCard(border = "#b88a3b", background = OFFICIAL_CARD_BG): React.CSSProperties {
  const borderGradient = `linear-gradient(135deg, ${border}, #2563eb, #16a34a, #dc2626, #7c3aed)`;
  return {
    background: `${background} padding-box, ${borderGradient} border-box`,
    color: OFFICIAL_TEXT,
    border: "2px solid transparent",
    borderRadius: 22,
    boxShadow: "0 18px 45px rgba(88, 62, 25, 0.16)",
  };
}

function getBorderColor(index: number) {
  return OFFICIAL_BORDER_COLORS[index % OFFICIAL_BORDER_COLORS.length];
}

export default function ActivityLogsPage() {
  const { tenantId, userProfile } = useAuth();
  const { t, isRTL } = useI18n() as any;
  const [rows, setRows] = useState<ActivityLogEntry[]>([]);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<string>("");
  const [action, setAction] = useState<string>("");

  const dropdownStyle: React.CSSProperties = {
    padding: 10,
    borderRadius: 12,
    border: "2px solid #2563eb",
    background: "#fffaf0",
    color: OFFICIAL_TEXT,
    fontWeight: 800,
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    boxShadow: "0 10px 22px rgba(88, 62, 25, 0.10)",
  };

  const dropdownOptionStyle: React.CSSProperties = {
    background: "#fffaf0",
    color: OFFICIAL_TEXT,
  };

  const inputStyle: React.CSSProperties = {
    padding: 10,
    borderRadius: 12,
    border: "2px solid #b88a3b",
    background: "#fffaf0",
    color: OFFICIAL_TEXT,
    fontWeight: 700,
    outline: "none",
    boxShadow: "0 10px 22px rgba(88, 62, 25, 0.10)",
  };

  const tableHeadCellStyle = (index: number): React.CSSProperties => ({
    padding: 12,
    borderBottom: `3px solid ${getBorderColor(index)}`,
    color: OFFICIAL_TEXT,
    background: "#f4dfbd",
    fontWeight: 900,
    whiteSpace: "nowrap",
  });

  const tableCellStyle = (index: number): React.CSSProperties => ({
    padding: 12,
    borderBottom: `2px solid ${getBorderColor(index)}55`,
    color: OFFICIAL_TEXT,
    background: index % 2 === 0 ? "#fffaf0" : "#f8edd9",
    verticalAlign: "top",
  });

  useEffect(() => {
    if (!tenantId) return;
    const unsub = listenActivityLogs(tenantId, setRows, { pageSize: 300 });
    return () => unsub();
  }, [tenantId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (level && r.level !== level) return false;
      if (action && r.action !== action) return false;
      if (!s) return true;
      const blob = [
        r.action,
        r.level,
        r.entityType,
        r.entityId,
        r.actorEmail,
        r.actorDisplayName,
        r.message,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(s);
    });
  }, [rows, q, level, action]);

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 20,
        direction: isRTL ? "rtl" : "ltr",
        background: `radial-gradient(circle at top, rgba(180,135,55,0.18), transparent 28%), radial-gradient(circle at 80% 20%, rgba(37,99,235,0.08), transparent 25%), ${OFFICIAL_BG}`,
        color: OFFICIAL_TEXT,
      }}
    >
      <div style={{ maxWidth: 1440, margin: "0 auto", display: "grid", gap: 16 }}>
        <div
          style={{
            ...officialCard("#b88a3b", OFFICIAL_PANEL_BG),
            padding: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: OFFICIAL_TEXT, fontSize: 28, fontWeight: 900 }}>{t("activity.title")}</h2>
            <div style={{ marginTop: 6, color: OFFICIAL_MUTED_TEXT, fontSize: 13, fontWeight: 700 }}>
              {t("activity.viewer")} {userProfile?.displayName || userProfile?.email || ""}
            </div>
          </div>

          <div
            style={{
              padding: "9px 14px",
              borderRadius: 999,
              border: "2px solid #16a34a",
              background: "#fff7e6",
              color: OFFICIAL_TEXT,
              fontWeight: 900,
              fontSize: 13,
            }}
          >
            {t("activity.count", { n: filtered.length })}
          </div>
        </div>

        <div
          style={{
            ...officialCard("#2563eb"),
            padding: 16,
            display: "grid",
            gridTemplateColumns: "minmax(220px, 1fr) 160px 180px",
            gap: 10,
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("activity.search")}
            style={inputStyle}
          />

          <select value={level} onChange={(e) => setLevel(e.target.value)} style={dropdownStyle}>
            <option value="" style={dropdownOptionStyle}>{t("activity.allLevels")}</option>
            <option value="info" style={dropdownOptionStyle}>info</option>
            <option value="warning" style={dropdownOptionStyle}>warning</option>
            <option value="critical" style={dropdownOptionStyle}>critical</option>
          </select>

          <select value={action} onChange={(e) => setAction(e.target.value)} style={{ ...dropdownStyle, borderColor: "#7c3aed" }}>
            <option value="" style={dropdownOptionStyle}>{t("activity.allActions")}</option>
            {[
              "LOGIN",
              "LOGOUT",
              "CREATE",
              "UPDATE",
              "DELETE",
              "IMPORT",
              "EXPORT",
              "PERMISSIONS_CHANGE",
              "SETTINGS_CHANGE",
              "SYSTEM",
            ].map((a) => (
              <option key={a} value={a} style={dropdownOptionStyle}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div style={{ ...officialCard("#16a34a"), padding: 16, overflow: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              overflow: "hidden",
              borderRadius: 16,
              color: OFFICIAL_TEXT,
            }}
          >
            <thead>
              <tr style={{ textAlign: "start" }}>
                <th style={tableHeadCellStyle(0)}>{t("activity.time")}</th>
                <th style={tableHeadCellStyle(1)}>{t("activity.level")}</th>
                <th style={tableHeadCellStyle(2)}>{t("activity.action")}</th>
                <th style={tableHeadCellStyle(3)}>{t("activity.actor")}</th>
                <th style={tableHeadCellStyle(4)}>{t("activity.entity")}</th>
                <th style={tableHeadCellStyle(5)}>{t("activity.message")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => {
                const ts = (r as any).ts?.toDate ? (r as any).ts.toDate() : null;
                const time = ts ? ts.toLocaleString() : "";
                const actor = r.actorDisplayName || r.actorEmail || "-";
                const entity = [r.entityType, r.entityId].filter(Boolean).join(": ") || "-";
                return (
                  <tr key={idx}>
                    <td style={{ ...tableCellStyle(0), whiteSpace: "nowrap" }}>{time}</td>
                    <td style={{ ...tableCellStyle(1), whiteSpace: "nowrap", fontWeight: 800 }}>{r.level}</td>
                    <td style={{ ...tableCellStyle(2), whiteSpace: "nowrap", fontWeight: 800 }}>{r.action}</td>
                    <td style={tableCellStyle(3)}>{actor}</td>
                    <td style={tableCellStyle(4)}>{entity}</td>
                    <td style={tableCellStyle(5)}>{r.message || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
