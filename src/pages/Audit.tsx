import React, { useEffect, useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "../auth/AuthContext";
import { useTenant } from "../tenant/TenantContext";
import { useI18n } from "../i18n/I18nProvider";
import { listenActivityLogs, type ActivityLogEntry } from "../services/activityLog.service";

function fmt(ts?: Timestamp) {
  if (!ts) return "";
  try {
    return ts.toDate().toLocaleString("ar");
  } catch {
    return "";
  }
}

function safeText(value: unknown) {
  return String(value ?? "").trim();
}

function actionLabel(value: unknown) {
  const raw = safeText(value).toUpperCase();
  const labels: Record<string, string> = {
    CREATE: "إضافة",
    UPDATE: "تعديل",
    DELETE: "حذف",
    IMPORT: "استيراد",
    EXPORT: "تصدير",
    SAVE: "حفظ",
    SAVE_SETTINGS: "حفظ الإعدادات",
    MANUAL_ADD_TASK: "إضافة مهمة يدويًا",
    MANUAL_DELETE_TASK: "حذف مهمة يدويًا",
    MANUAL_MOVE_TASK: "نقل مهمة يدويًا",
    MANUAL_SWAP_TASK: "تبديل مهمة يدويًا",
    MANUAL_EDIT_RESULTS: "تعديل جدول النتائج",
    MANUAL_EDIT_WITH_WARNING: "تعديل مع تحذير",
    PERMISSIONS_CHANGE: "تغيير صلاحيات",
    SETTINGS_CHANGE: "تغيير إعدادات",
    SYSTEM: "نظام",
  };
  return labels[raw] || raw || "—";
}

function compactJson(value: any) {
  if (value === undefined || value === null || value === "") return "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getTenantId(auth: any, tenantCtxId: string) {
  return String(
    auth?.effectiveTenantId ||
      auth?.userProfile?.tenantId ||
      auth?.profile?.tenantId ||
      auth?.allow?.tenantId ||
      tenantCtxId ||
      "",
  ).trim();
}

export default function Audit() {
  const { t } = useI18n();
  const auth = useAuth() as any;
  const { tenantId: tenantCtxId } = useTenant();
  const tenantId = getTenantId(auth, tenantCtxId || "");
  const [rows, setRows] = useState<ActivityLogEntry[]>([]);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setErr("");
    if (!tenantId) {
      setRows([]);
      return;
    }

    return listenActivityLogs(
      tenantId,
      (next) => setRows(Array.isArray(next) ? next : []),
      { pageSize: 300 },
    );
  }, [tenantId]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.action,
        row.level,
        row.entityType,
        row.entityId,
        row.message,
        row.actorEmail,
        row.actorDisplayName,
        row.actorUid,
        compactJson(row.after),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search]);

  const COLORS = {
    page: "linear-gradient(135deg, #f7f0df 0%, #efe2c3 48%, #fbf7ee 100%)",
    card: "#fffdf7",
    text: "#111827",
    muted: "#475569",
    border: "rgba(151, 116, 28, 0.42)",
    header: "linear-gradient(180deg, #f4e2ad 0%, #d5b45a 100%)",
    danger: "#b91c1c",
    warn: "#92400e",
    info: "#1d4ed8",
  };

  return (
    <div dir="rtl" style={{ padding: 16, minHeight: "100vh", background: COLORS.page, color: COLORS.text }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          padding: "14px 16px",
          borderRadius: 18,
          border: `1px solid ${COLORS.border}`,
          background: COLORS.card,
          boxShadow: "0 14px 30px rgba(78, 59, 16, 0.12)",
        }}
      >
        <div>
          <h2 style={{ margin: 0, color: COLORS.text }}>{t("audit.title") || "سجل العمليات"}</h2>
          <div style={{ marginTop: 4, color: COLORS.muted, fontWeight: 700 }}>
            {tenantId ? `الجهة: ${tenantId}` : "لم يتم تحديد الجهة"} — عدد السجلات: {filteredRows.length}
          </div>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث في السجل..."
          style={{
            minWidth: 260,
            maxWidth: "100%",
            padding: "10px 12px",
            borderRadius: 12,
            border: `1px solid ${COLORS.border}`,
            background: "#ffffff",
            color: COLORS.text,
            fontWeight: 800,
            outline: "none",
          }}
        />
      </div>

      {err ? <div style={{ marginTop: 12, color: COLORS.danger, fontWeight: 900 }}>{err}</div> : null}

      <div style={{ marginTop: 12, overflowX: "auto", borderRadius: 16, border: `1px solid ${COLORS.border}`, background: COLORS.card }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
          <thead>
            <tr>
              {["الوقت", "المستوى", "العملية", "الكيان", "المستخدم", "التفاصيل"].map((h) => (
                <th key={h} style={{ textAlign: "right", padding: 12, borderBottom: `1px solid ${COLORS.border}`, background: COLORS.header, color: COLORS.text, fontWeight: 1000, whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 14, color: COLORS.muted, fontWeight: 800 }}>{t("audit.empty") || "لا توجد سجلات بعد"}</td>
              </tr>
            ) : filteredRows.map((r, idx) => {
              const level = safeText(r.level || "info").toLowerCase();
              const levelColor = level === "critical" ? COLORS.danger : level === "warning" ? COLORS.warn : COLORS.info;
              const actor = safeText(r.actorDisplayName) || safeText(r.actorEmail) || safeText(r.actorUid) || "—";
              return (
                <tr key={`${String(r.createdAt?.seconds || r.ts?.seconds || "")}-${idx}`} style={{ background: idx % 2 ? "#fffaf0" : "#ffffff" }}>
                  <td style={{ padding: 12, borderBottom: `1px solid ${COLORS.border}`, whiteSpace: "nowrap", color: COLORS.text, fontWeight: 800 }}>{fmt(r.createdAt || r.ts)}</td>
                  <td style={{ padding: 12, borderBottom: `1px solid ${COLORS.border}`, color: levelColor, fontWeight: 1000 }}>{r.level || "info"}</td>
                  <td style={{ padding: 12, borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text, fontWeight: 900 }}>{actionLabel(r.action)}</td>
                  <td style={{ padding: 12, borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text, fontWeight: 800 }}>{r.entityType || "—"} {r.entityId ? `#${r.entityId}` : ""}</td>
                  <td style={{ padding: 12, borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text, fontWeight: 800 }}>{actor}</td>
                  <td style={{ padding: 12, borderBottom: `1px solid ${COLORS.border}` }}>
                    <div style={{ marginBottom: 6, color: COLORS.text, fontWeight: 900 }}>{r.message || "—"}</div>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: COLORS.text, background: "#f8fafc", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 10, overflowX: "auto", maxHeight: 220 }}>
                      {compactJson(r.after ?? r.before)}
                    </pre>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
