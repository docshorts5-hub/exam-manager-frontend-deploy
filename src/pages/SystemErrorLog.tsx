// src/pages/SystemErrorLog.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  clearLocalSystemErrors,
  getCloudSystemErrors,
  isCloudErrorLogEnabled,
  readLocalSystemErrors,
  recordSystemError,
  setCloudErrorLogEnabled,
  type SystemErrorLogEntry,
} from "../features/diagnostics/errorDiagnostics";

const MINISTRY_LOGO_URL = "https://i.postimg.cc/j5G4NQvZ/sh%CA%BFar-1.png";
const GOLD = "#16835b";


function uniqMerge(rows: SystemErrorLogEntry[]) {
  const map = new Map<string, SystemErrorLogEntry>();
  for (const row of rows) {
    const key = row.id || `${row.at}|${row.message}|${row.path}`;
    if (!map.has(key)) map.set(key, row);
  }
  return Array.from(map.values()).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export default function SystemErrorLog() {
  const auth = useAuth();
  const profile = auth.profile;

  if (auth.loading) return null;

  if (!auth.user) {
    return <Navigate to="/login" replace />;
  }

  if (
    !profile ||
    profile.enabled !== true ||
    auth.isPlatformOwner !== true
  ) {
    return <Navigate to="/" replace />;
  }

  return <SystemErrorLogOwner auth={auth} />;
}

function SystemErrorLogOwner({
  auth,
}: {
  auth: ReturnType<typeof useAuth>;
}) {
  const navigate = useNavigate();
  const userEmail = String(auth.user?.email || "").trim();
  const role = "super_admin";
  const governorate = "";
  const tenantId = String(auth.effectiveTenantId || "system").trim();

  const [localRows, setLocalRows] = useState<SystemErrorLogEntry[]>(() => readLocalSystemErrors(auth.authzSnapshot));
  const [cloudRows, setCloudRows] = useState<SystemErrorLogEntry[]>([]);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("");
  const [cloudEnabled, setCloudEnabled] = useState(() => isCloudErrorLogEnabled(auth.authzSnapshot));

  const rows = useMemo(() => uniqMerge([...localRows, ...cloudRows]), [localRows, cloudRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (level && row.level !== level) return false;
      if (!q) return true;
      return [row.message, row.source, row.path, row.userEmail, row.role, row.governorate, row.tenantId]
        .map((x) => String(x || "").toLowerCase())
        .some((x) => x.includes(q));
    });
  }, [rows, search, level]);

  async function loadCloud() {
    setLoadingCloud(true);
    setCloudError("");
    try {
      const next = await getCloudSystemErrors(auth.authzSnapshot);
      setCloudRows(next);
    } catch (e: any) {
      setCloudError(e?.message || "تعذر قراءة سجل الأخطاء السحابي.");
    } finally {
      setLoadingCloud(false);
    }
  }

  useEffect(() => {
    setLocalRows(readLocalSystemErrors(auth.authzSnapshot));
    void loadCloud();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, governorate]);

  async function addTestError() {
    await recordSystemError({
      level: "warning",
      source: "manual-test",
      message: "اختبار يدوي لسجل الأخطاء من صفحة سجل الأخطاء.",
      userEmail,
      role,
      governorate,
      tenantId,
      readOnly: false,
    });
    setLocalRows(readLocalSystemErrors(auth.authzSnapshot));
    await loadCloud();
  }

  function toggleCloud() {
    const next = !cloudEnabled;
    setCloudEnabled(next);
    setCloudError(next ? "تم تفعيل السجل السحابي." : "تم إيقاف السجل السحابي.");
    try {
      setCloudErrorLogEnabled(auth.authzSnapshot, next);
    } catch {
      // تجاهل أي مشكلة في التخزين المحلي.
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system-error-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // YR_ERROR_LOG_CSV_EXPORT_V1
  function exportCsv() {
    const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, `""`)}"`;
    const headers = ["الوقت","النوع","المصدر","الرسالة","المستخدم","المسار"];
    const data = filtered.map((row) => [row.at ? new Date(row.at).toLocaleString("ar") : "", row.level, row.source, row.message, row.userEmail, row.path]);
    const csv = "\uFEFF" + [headers, ...data].map((r) => r.map(quote).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system-error-log-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function clearLocal() {
    if (!window.confirm("سيتم تنظيف سجل الأخطاء المحلي فقط. السجل السحابي لن يتم حذفه. هل تريد المتابعة؟")) return;
    clearLocalSystemErrors(auth.authzSnapshot);
    setLocalRows([]);
  }

  const summary = {
    total: rows.length,
    shown: filtered.length,
    errors: rows.filter((r) => r.level === "error").length,
    warnings: rows.filter((r) => r.level === "warning").length,
  };

  const styles: Record<string, React.CSSProperties> = {
    page: { minHeight: "100vh", background: "linear-gradient(135deg,#f7fbf9 0%,#eef7fb 58%,#fffaf0 100%)", color: "#1f2937", padding: 24, direction: "rtl" },
    hero: { background: "transparent", border: "none", borderRadius: 0, padding: "0 4px 10px", textAlign: "center", boxShadow: "none", marginBottom: 6 },
    logo: { width: 82, height: 82, objectFit: "contain", border: "none", borderRadius: 0, padding: 0, background: "transparent", mixBlendMode: "multiply" },
    cards: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14, marginTop: 4 },
    card: { background: "#ffffff", border: "1px solid #d7e6df", borderRadius: 20, padding: 18, fontWeight: 1000, boxShadow: "0 12px 28px rgba(15,23,42,.08)", minHeight: 94 },
    panel: { background: "rgba(255,255,255,.96)", border: "1px solid #d7e6df", borderRadius: 22, padding: "14px 18px 16px", marginTop: 8, boxShadow: "0 12px 28px rgba(15,23,42,.06)" },
    input: { width: "100%", border: "1px solid #cfe1d8", borderRadius: 12, padding: 12, color: "#1f2937", fontWeight: 800, background: "#fff", boxShadow: "inset 0 1px 2px rgba(15,23,42,.03)" },
    button: { border: "1px solid #16835b", borderRadius: 12, padding: "10px 15px", background: "linear-gradient(135deg,#15935f,#0f7447)", color: "#ffffff", fontWeight: 1000, cursor: "pointer", boxShadow: "0 7px 18px rgba(15,116,71,.15)" },
    danger: { border: "1px solid #dc2626", borderRadius: 12, padding: "10px 15px", background: "linear-gradient(135deg,#ef4444,#c91f1f)", color: "#ffffff", fontWeight: 1000, cursor: "pointer", boxShadow: "0 7px 18px rgba(220,38,38,.15)" },
    table: { width: "100%", borderCollapse: "separate", borderSpacing: 0, marginTop: 10, fontSize: 14, background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 10px 26px rgba(15,23,42,.06)" },
    th: { background: "linear-gradient(135deg,#15935f,#0f7447)", padding: 13, border: "1px solid #0f7d50", color: "#ffffff", fontWeight: 1000 },
    td: { padding: 12, borderBottom: "1px solid #e5eee9", verticalAlign: "top", color: "#263b33", fontWeight: 700, background: "#ffffff" },
  };

  return (
    <div style={styles.page}>
            <section style={{ ...styles.hero, display: "grid", gridTemplateColumns: "1fr 1.55fr 1fr", alignItems: "center", gap: 18, padding: "4px 2px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifySelf: "start", marginRight: 0, transform: "none" }}>
          <img src={MINISTRY_LOGO_URL} alt="شعار وزارة التعليم" style={{ ...styles.logo, width: 72, height: 72 }} />
          <div style={{ textAlign: "right", fontWeight: 1000, lineHeight: 1.45, color: "#123c2d" }}>
            <div style={{ fontSize: 25 }}>سلطنة عُمان</div>
            <div style={{ fontSize: 20 }}>وزارة التعليم</div>
          </div>
        </div>
        <div style={{ textAlign: "center", justifySelf: "center", transform: "translateX(28px)" }}>
          <h1 style={{ fontSize: 38, margin: "0 0 4px", color: "#123c2d", fontWeight: 1000, textShadow: "0 2px 10px rgba(18,60,45,.10)" }}>سجل الأخطاء الأمنية</h1>
          <p style={{ fontWeight: 800, margin: 0, color: "#475569", lineHeight: 1.6 }}>متابعة أخطاء المتصفح والسحابة والتجمّد لتسهيل الوصول إلى نسخة تجارية مستقرة.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifySelf: "start" }}>
          <button style={styles.button} onClick={() => navigate("/system/security")}>العودة إلى الأمن والرقابة</button>
          <button style={styles.button} onClick={() => navigate("/system")}>العودة إلى لوحة مالك المنصة</button>
        </div>
      </section>

      <section style={styles.cards}>
        <div style={{ ...styles.card, borderTop: "5px solid #16835b" }}><div style={{ fontSize: 30, color: "#0f7447" }}>{summary.total}</div><div>إجمالي الأخطاء</div></div>
        <div style={{ ...styles.card, borderTop: "5px solid #dc2626" }}><div style={{ fontSize: 30, color: "#b91c1c" }}>{summary.errors}</div><div>أخطاء حرجة</div></div>
        <div style={{ ...styles.card, borderTop: "5px solid #d97706" }}><div style={{ fontSize: 30, color: "#b45309" }}>{summary.warnings}</div><div>تحذيرات</div></div>
        <div style={{ ...styles.card, borderTop: "5px solid #2563eb" }}><div style={{ fontSize: 30, color: "#1d4ed8" }}>{summary.shown}</div><div>نتائج العرض</div></div>
      </section>

      <section style={styles.panel}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 190px", gap: 12, alignItems: "end" }}>
          <label style={{ fontWeight: 1000 }}>بحث
            <input style={styles.input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث في الرسالة أو المسار أو المستخدم..." />
          </label>
          <label style={{ fontWeight: 1000 }}>النوع
            <select style={styles.input} value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">الكل</option>
              <option value="error">أخطاء</option>
              <option value="warning">تحذيرات</option>
              <option value="info">معلومات</option>
            </select>
          </label>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
          <button style={styles.button} onClick={loadCloud} disabled={loadingCloud}>{loadingCloud ? "جار التحميل..." : "تحديث السجل"}</button>
          <button style={styles.button} onClick={addTestError}>تسجيل فحص</button>
          <button style={styles.button} onClick={exportJson}>تصدير JSON</button><button style={{ ...styles.button, background: "linear-gradient(135deg,#2563eb,#1d4ed8)", borderColor: "#1d4ed8" }} onClick={exportCsv}>تصدير CSV</button>
          <button style={styles.button} onClick={toggleCloud}>{cloudEnabled ? "إيقاف السجل السحابي" : "تفعيل السجل السحابي"}</button>
          <button style={styles.danger} onClick={clearLocal}>تنظيف السجل المحلي</button>
        </div>
        {cloudError ? <div style={{ marginTop: 12, color: cloudError.includes("تعذر") ? "#991b1b" : "#166534", fontWeight: 1000 }}>{cloudError}</div> : null}

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>الوقت</th>
              <th style={styles.th}>النوع</th>
              <th style={styles.th}>المصدر</th>
              <th style={styles.th}>الرسالة</th>
              <th style={styles.th}>المستخدم</th>
              <th style={styles.th}>المسار</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ ...styles.td, textAlign: "center", padding: 26 }}>لا توجد أخطاء مطابقة للعرض الحالي.</td></tr>
            ) : filtered.map((row) => (
              <tr data-error-severity="v1" key={row.id || `${row.at}-${row.message}`} style={{ background: row.level === "error" ? "#fff7f7" : row.level === "warning" ? "#fffbeb" : "#ffffff", boxShadow: row.level === "error" ? "inset -5px 0 0 #dc2626" : row.level === "warning" ? "inset -5px 0 0 #d97706" : "inset -5px 0 0 #16835b" }}>
                <td style={styles.td}>{row.at ? new Date(row.at).toLocaleString("ar") : "—"}</td>
                <td style={{ ...styles.td, color: row.level === "error" ? "#991b1b" : "#92400e" }}>{row.level}</td>
                <td style={styles.td}>{row.source || "—"}</td>
                <td style={{ ...styles.td, maxWidth: 520, whiteSpace: "pre-wrap" }}>{row.message}</td>
                <td style={styles.td}>{row.userEmail || "—"}<br />{row.role || ""}</td>
                <td style={styles.td}>{row.path || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
