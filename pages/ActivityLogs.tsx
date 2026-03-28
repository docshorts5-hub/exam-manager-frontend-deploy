// src/pages/ActivityLogs.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { listenActivityLogs, ActivityLogEntry } from "../services/activityLog.service";
import { useI18n } from "../i18n/I18nProvider";

export default function ActivityLogsPage() {
  const { tenantId, userProfile } = useAuth();
  const { t } = useI18n();
  const [rows, setRows] = useState<ActivityLogEntry[]>([]);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<string>("");
  const [action, setAction] = useState<string>("");

  const dropdownStyle: React.CSSProperties = {
    padding: 10,
    borderRadius: 10,
    border: "1px solid rgba(255,215,0,.45)",
    background: "#000000",
    color: "#FFD700",
    fontWeight: 800,
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
  };

  const dropdownOptionStyle: React.CSSProperties = {
    background: "#000000",
    color: "#FFD700",
  };

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
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>{t("activity.title")}</h2>
        <div style={{ opacity: 0.8, fontSize: 13 }}>
          {t("activity.viewer")} {userProfile?.displayName || userProfile?.email || ""}
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "1fr 160px 180px",
          gap: 10,
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("activity.search")}
          style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,.15)" }}
        />

        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          style={dropdownStyle}
        >
          <option value="" style={dropdownOptionStyle}>{t("activity.allLevels")}</option>
          <option value="info" style={dropdownOptionStyle}>info</option>
          <option value="warning" style={dropdownOptionStyle}>warning</option>
          <option value="critical" style={dropdownOptionStyle}>critical</option>
        </select>

        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          style={dropdownStyle}
        >
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

      <div style={{ marginTop: 14, opacity: 0.85, fontSize: 13 }}>
        {t("activity.count", { n: filtered.length })}
      </div>

      <div style={{ marginTop: 12, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "start" }}>
              <th style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                {t("activity.time")}
              </th>
              <th style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                {t("activity.level")}
              </th>
              <th style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                {t("activity.action")}
              </th>
              <th style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                {t("activity.actor")}
              </th>
              <th style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                {t("activity.entity")}
              </th>
              <th style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                {t("activity.message")}
              </th>
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
                  <td style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,.08)", whiteSpace: "nowrap" }}>
                    {time}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,.08)", whiteSpace: "nowrap" }}>
                    {r.level}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,.08)", whiteSpace: "nowrap" }}>
                    {r.action}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,.08)" }}>{actor}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,.08)" }}>{entity}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,.08)" }}>{r.message || ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
