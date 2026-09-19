import "./systemAuditLogInputs.css";
// src/pages/SystemAuditLog.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  appendAuditEntry,
  clearAuditEntries,
  exportAuditEntriesFile,
  getAuditEntries,
  getCloudAuditEntries,
  mergeAuditEntries,
  isCloudAuditEnabled,
  setCloudAuditEnabled,
  AUDIT_CLOUD_LAST_OK_KEY,
  AUDIT_CLOUD_LAST_ERROR_KEY,
  type AuditEntry,
} from "../features/audit/auditTrail";

const MINISTRY_LOGO_URL = "https://i.postimg.cc/j5G4NQvZ/sh%CA%BFar-1.png";

function fmt(iso: string) {
  try {
    return new Intl.DateTimeFormat("ar", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function levelLabel(level: AuditEntry["level"]) {
  if (level === "danger") return "إجراء حساس";
  if (level === "warning") return "إجراء تشغيلي";
  return "إجراء عام";
}

function actionLabel(action: string) {
  if (action === "page_view") return "فتح صفحة";
  if (action === "click") return "ضغط زر";
  return action || "عملية";
}

function levelStyle(level: AuditEntry["level"]): React.CSSProperties {
  if (level === "danger") return { background: "#fee2e2", color: "#991b1b", borderColor: "#ef4444" };
  if (level === "warning") return { background: "#fef3c7", color: "#92400e", borderColor: "#f59e0b" };
  return { background: "#dcfce7", color: "#166534", borderColor: "#22c55e" };
}

function storageValue(keys: string[]) {
  if (typeof window === "undefined") return "";
  for (const key of keys) {
    try {
      const value = window.sessionStorage.getItem(key) || window.localStorage.getItem(key);
      if (value) return String(value).trim();
    } catch {
      // ignore
    }
  }
  return "";
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  direction: "rtl",
  background: "linear-gradient(180deg, #edf6ff 0%, #f8f4e9 48%, #f5f8f6 100%)",
  padding: "28px clamp(14px, 3vw, 42px)",
  color: "#17231d",
  fontFamily: "Tajawal, system-ui, Arial, sans-serif",
};

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #d9e5df",
  borderRadius: 22,
  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.07)",
  padding: 22,
  marginBottom: 22,
  color: "#17231d",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 12,
  padding: "12px 14px",
  outline: "none",
  color: "#1f2937",
  background: "#ffffff",
  fontWeight: 800,
  fontSize: 15,
  caretColor: "#0f7447",
  border: "1px solid #e4c96f",
  boxShadow: "inset 0 1px 2px rgba(15,23,42,0.03)",
};

const buttonStyle: React.CSSProperties = {
  border: "1px solid #0f7447",
  borderRadius: 12,
  padding: "11px 16px",
  background: "linear-gradient(135deg, #159557 0%, #0d7445 100%)",
  color: "#ffffff",
  fontWeight: 1000,
  cursor: "pointer",
  boxShadow: "0 7px 18px rgba(15,116,71,0.16)",
};

const thStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #087044 0%, #159557 55%, #0b6b44 100%)",
  color: "#ffffff",
  padding: "16px 14px",
  borderBottom: "none",
  fontWeight: 1000,
  whiteSpace: "normal",
  textAlign: "right",
  textShadow: "0 2px 5px rgba(0,0,0,0.18)",
  boxShadow: "inset 0 -2px 0 rgba(255,255,255,0.12)",
};

const tdStyle: React.CSSProperties = {
  padding: "15px 14px",
  borderBottom: "1px solid #e4eee9",
  color: "#263a31",
  fontWeight: 800,
  verticalAlign: "middle",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  lineHeight: 1.55,
};

// YR_AUDIT_CSV_EXPORT_V1
function exportAuditCsv(entries: AuditEntry[]) {
  const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, `""`)}"`;
  const headers = ["الوقت","النوع","الإجراء","المستخدم","الدور","النطاق","المسار","المصدر","وضع المشاهدة"];
  const rows = entries.map((entry) => [fmt(entry.at), entry.level, entry.label || entry.action, entry.userEmail, entry.role, entry.tenantId || entry.governorate, entry.path, entry.source, entry.readOnly ? "مشاهدة فقط" : "عادي"]);
  const csv = "\uFEFF" + [headers, ...rows].map((row) => row.map(quote).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function SystemAuditLog() {
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

  return <SystemAuditLogOwner auth={auth} />;
}

function SystemAuditLogOwner({
  auth,
}: {
  auth: ReturnType<typeof useAuth>;
}) {
  const navigate = useNavigate();

  const currentUserEmail = String(auth.user?.email || "").trim();
  const currentRole = "super_admin";
  const currentGovernorate = "";
  const currentTenantId = String(
    auth.effectiveTenantId || "system"
  ).trim();
  const [entries, setEntries] = useState<AuditEntry[]>(() => getAuditEntries(auth.authzSnapshot));
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  // YR_AUDIT_ROLE_FILTER_V1
  const [roleFilter, setRoleFilter] = useState("all");
  // YR_AUDIT_USER_FILTER_V1
  const [userFilter, setUserFilter] = useState("all");
  // YR_AUDIT_SCOPE_FILTER_V1
  const [scopeFilter, setScopeFilter] = useState("all");
  // YR_AUDIT_SORT_V1
  const [sortMode, setSortMode] = useState("newest");
  // YR_AUDIT_DATE_FILTERS_V1
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pageNo, setPageNo] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const pageSize = 25;
  const [cloudStatus, setCloudStatus] = useState("السجل السحابي يعمل بنظام الإضافة فقط");
  const [cloudEnabled, setCloudEnabledState] = useState(() => isCloudAuditEnabled(auth.authzSnapshot));

  const refreshLocal = () => setEntries(getAuditEntries(auth.authzSnapshot));

  const loadCloud = async () => {

    setCloudStatus("جاري قراءة السجل السحابي...");
    try {
      const cloud = await getCloudAuditEntries(auth.authzSnapshot, {
        role: "super_admin",
        governorate: "",
        max: 500,
      });
      const local = getAuditEntries(auth.authzSnapshot);
      setEntries(mergeAuditEntries(cloud, local));
      setCloudStatus(`تم تحميل ${cloud.length} عملية من السحابة - سجل غير قابل للتعديل`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "خطأ غير معروف");
      setEntries(getAuditEntries(auth.authzSnapshot));
      setCloudStatus(`تعذر قراءة السجل السحابي: ${message}`);
    }
  };

  const refresh = () => {
    refreshLocal();
    void loadCloud();
  };

  const lastCloudOk = storageValue([AUDIT_CLOUD_LAST_OK_KEY]);
  const lastCloudError = storageValue([AUDIT_CLOUD_LAST_ERROR_KEY]);

  useEffect(() => {
    appendAuditEntry({
      level: "info",
      action: "page_view",
      label: "فتح صفحة سجل العمليات",
      path: window.location.pathname || "/system/audit-log",
      tenantId: currentTenantId,
      userEmail: currentUserEmail,
      role: currentRole,
      governorate: currentGovernorate,
      readOnly: false,
      source: "audit-log-page",
    });
    refresh();

    const onChange = () => refresh();
    window.addEventListener("exam-manager:audit-log-changed", onChange as EventListener);
    return () => window.removeEventListener("exam-manager:audit-log-changed", onChange as EventListener);
  }, []);

  const roleOptions = useMemo(() => Array.from(new Set(entries.map((entry) => String(entry.role || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar")), [entries]);
  const userOptions = useMemo(() => Array.from(new Set(entries.map((entry) => String(entry.userEmail || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [entries]);
  const scopeOptions = useMemo(() => Array.from(new Set(entries.map((entry) => String(entry.tenantId || entry.governorate || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar")), [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchesLevel = level === "all" || entry.level === level;
      const matchesRole = roleFilter === "all" || String(entry.role || "") === roleFilter;
      const matchesUser = userFilter === "all" || String(entry.userEmail || "") === userFilter;
      const entryScope = String(entry.tenantId || entry.governorate || "");
      const matchesScope = scopeFilter === "all" || entryScope === scopeFilter;
      const entryDay = String(entry.at || "").slice(0, 10);
      const matchesFrom = !fromDate || entryDay >= fromDate;
      const matchesTo = !toDate || entryDay <= toDate;
      const haystack = [
        entry.label,
        entry.path,
        entry.tenantId,
        entry.userEmail,
        entry.role,
        entry.governorate,
        entry.action,
        entry.source,
      ]
        .join(" ")
        .toLowerCase();
      return matchesLevel && matchesRole && matchesUser && matchesScope && matchesFrom && matchesTo && (!q || haystack.includes(q));
    });
  }, [entries, level, roleFilter, userFilter, scopeFilter, search, fromDate, toDate]);

  const sortedEntries = useMemo(() => {
    const rows = [...filtered];
    if (sortMode === "oldest") return rows.sort((a, b) => String(a.at).localeCompare(String(b.at)));
    if (sortMode === "danger") return rows.sort((a, b) => Number(b.level === "danger") - Number(a.level === "danger") || String(b.at).localeCompare(String(a.at)));
    if (sortMode === "warning") return rows.sort((a, b) => Number(b.level === "warning") - Number(a.level === "warning") || String(b.at).localeCompare(String(a.at)));
    return rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }, [filtered, sortMode]);

  const totalPages = Math.max(1, Math.ceil(sortedEntries.length / pageSize));
  const safePage = Math.min(pageNo, totalPages);
  const pagedEntries = sortedEntries.slice((safePage - 1) * pageSize, safePage * pageSize);

  const dangerCount = entries.filter((entry) => entry.level === "danger").length;
  const warningCount = entries.filter((entry) => entry.level === "warning").length;

  const addTestEntry = () => {
    appendAuditEntry({
      level: "info",
      action: "test",
      label: "فحص تسجيل سجل العمليات",
      path: window.location.pathname || "/system/audit-log",
      userEmail: currentUserEmail,
      role: currentRole,
      governorate: currentGovernorate,
      source: "manual-test",
    });
    refresh();
  };

  return (
    <main data-audit-page="true" style={page}>
      <section style={{ ...card, display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", gap: 12, padding: "8px 0 16px", background: "transparent", border: "none", boxShadow: "none" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 12, background: "transparent" }}><img src={MINISTRY_LOGO_URL} alt="شعار وزارة التعليم" style={{ width: 82, height: 82, objectFit: "contain", borderRadius: 0, background: "transparent", mixBlendMode: "multiply" }} /><div style={{ textAlign: "right", lineHeight: 1.55 }}><div style={{ fontSize: 20, fontWeight: 1000, color: "#111827" }}>سلطنة عمان</div><div style={{ fontSize: 20, fontWeight: 1000, color: "#111827" }}>وزارة التعليم</div></div></div>
        <div style={{ textAlign: "left" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button style={buttonStyle} onClick={() => navigate("/system/security")}>العودة إلى الأمن والرقابة</button>
            <button style={buttonStyle} onClick={() => navigate("/system")}>لوحة مالك المنصة</button>
          </div>
        </div>
        <div style={{ gridColumn: "1 / -1", textAlign: "center" }}>
          <h1 style={{ margin: "6px 0 8px", fontSize: 42, fontWeight: 1000, color: "#123c2d", textShadow: "0 3px 10px rgba(18,60,45,0.18)", letterSpacing: "-0.5px" }}>سجل العمليات الأمنية</h1>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#374151" }}>
            متابعة الإجراءات الحساسة داخل النظام مثل الحفظ والحذف والاستيراد والتوزيع والاستعادة.
          </p>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, marginBottom: 22 }}>
        <div style={{ ...card, background: "linear-gradient(145deg,#dff7e9,#ffffff)", border: "1px solid #9fd8b8", boxShadow: "10px 12px 24px rgba(15,116,71,0.16), inset -6px -6px 14px rgba(255,255,255,0.8), inset 4px 4px 12px rgba(15,116,71,0.06)", transform: "translateY(-2px)" }}><div style={{ fontSize: 38, fontWeight: 1000, color: "#0f7447", textShadow: "0 2px 5px rgba(15,116,71,0.15)" }}>{entries.length}</div><div style={{ fontWeight: 1000, color: "#185c3d" }}>إجمالي العمليات</div></div>
        <div style={{ ...card, background: "linear-gradient(145deg,#ffe8e8,#ffffff)", border: "1px solid #f3b2b2", boxShadow: "10px 12px 24px rgba(185,28,28,0.14), inset -6px -6px 14px rgba(255,255,255,0.8), inset 4px 4px 12px rgba(185,28,28,0.05)", transform: "translateY(-2px)" }}><div style={{ fontSize: 38, fontWeight: 1000, color: "#b91c1c", textShadow: "0 2px 5px rgba(185,28,28,0.14)" }}>{dangerCount}</div><div style={{ fontWeight: 1000, color: "#8f1d1d" }}>عمليات حساسة</div></div>
        <div style={{ ...card, background: "linear-gradient(145deg,#fff1cf,#ffffff)", border: "1px solid #eacb7a", boxShadow: "10px 12px 24px rgba(180,120,20,0.14), inset -6px -6px 14px rgba(255,255,255,0.8), inset 4px 4px 12px rgba(180,120,20,0.05)", transform: "translateY(-2px)" }}><div style={{ fontSize: 38, fontWeight: 1000, color: "#a16207", textShadow: "0 2px 5px rgba(161,98,7,0.14)" }}>{warningCount}</div><div style={{ fontWeight: 1000, color: "#8a5a0a" }}>عمليات تشغيلية</div></div>
        <div style={{ ...card, background: "linear-gradient(145deg,#e1efff,#ffffff)", border: "1px solid #abc8ee", boxShadow: "10px 12px 24px rgba(37,99,235,0.14), inset -6px -6px 14px rgba(255,255,255,0.8), inset 4px 4px 12px rgba(37,99,235,0.05)", transform: "translateY(-2px)" }}><div style={{ fontSize: 38, fontWeight: 1000, color: "#1d4ed8", textShadow: "0 2px 5px rgba(37,99,235,0.14)" }}>{filtered.length}</div><div style={{ fontWeight: 1000, color: "#1e4f9a" }}>نتائج العرض الحالية</div></div>
      </section>

      <section style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, alignItems: "end", marginBottom: 18 }}>
          <label style={{ fontWeight: 1000, color: "#111827" }}>
            بحث
            <input style={{ ...inputStyle, marginTop: 8 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالبريد أو الدور أو المسار أو نوع العملية..." />
          </label>
          <label style={{ fontWeight: 1000, color: "#111827" }}>
            نوع العملية
            <select style={{ ...inputStyle, marginTop: 8, color: "#172033", WebkitTextFillColor: "#172033", background: "#ffffff" }} value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="all">الكل</option>
              <option value="danger">حساسة</option>
              <option value="warning">تشغيلية</option>
              <option value="info">عامة</option>
            </select>
          </label>
          <label style={{ fontWeight: 1000, color: "#111827" }}>ترتيب السجل<select style={{ ...inputStyle, marginTop: 8 }} value={sortMode} onChange={(e) => { setSortMode(e.target.value); setPageNo(1); }}><option value="newest">الأحدث أولًا</option><option value="oldest">الأقدم أولًا</option><option value="danger">الحساسة أولًا</option><option value="warning">التشغيلية أولًا</option></select></label><label style={{ fontWeight: 1000, color: "#111827" }}>النطاق / المدرسة<select style={{ ...inputStyle, marginTop: 8 }} value={scopeFilter} onChange={(e) => { setScopeFilter(e.target.value); setPageNo(1); }}><option value="all">كل النطاقات</option>{scopeOptions.map((scope) => <option key={scope} value={scope}>{scope}</option>)}</select></label><label style={{ fontWeight: 1000, color: "#111827" }}>المستخدم<select style={{ ...inputStyle, marginTop: 8 }} value={userFilter} onChange={(e) => { setUserFilter(e.target.value); setPageNo(1); }}><option value="all">كل المستخدمين</option>{userOptions.map((email) => <option key={email} value={email}>{email}</option>)}</select></label><label style={{ fontWeight: 1000, color: "#111827" }}>الدور<select style={{ ...inputStyle, marginTop: 8 }} value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPageNo(1); }}><option value="all">كل الأدوار</option>{roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}</select></label><label style={{ fontWeight: 1000, color: "#111827" }}>من تاريخ<input type="date" style={{ ...inputStyle, marginTop: 8 }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></label><label style={{ fontWeight: 1000, color: "#111827" }}>إلى تاريخ<input type="date" style={{ ...inputStyle, marginTop: 8 }} value={toDate} onChange={(e) => setToDate(e.target.value)} /></label><button style={buttonStyle} onClick={refresh}>تحديث السجل</button><button style={{ ...buttonStyle, background: "#ffffff", color: "#0f7447" }} onClick={() => { setSearch(""); setLevel("all"); setRoleFilter("all"); setUserFilter("all"); setScopeFilter("all"); setSortMode("newest"); setFromDate(""); setToDate(""); setPageNo(1); }}>مسح الفلاتر</button>
          <button
            disabled title="السجل السحابي يسمح بالإضافة فقط ولا يسمح بالتعديل أو الحذف" style={{ ...buttonStyle, background: "#dcfce7", color: "#166534", cursor: "default", opacity: 1 }}
            onClick={() => {
              const next = !cloudEnabled;
              setCloudAuditEnabled(auth.authzSnapshot, next);
              setCloudEnabledState(next);
              setCloudStatus(next ? "تم تفعيل التسجيل السحابي" : "تم إيقاف التسجيل السحابي مؤقتًا");
            }}
          >
            السجل السحابي: إضافة فقط
          </button>
          <button style={buttonStyle} onClick={addTestEntry}>تسجيل فحص</button>
          <button style={buttonStyle} onClick={() => exportAuditEntriesFile(auth.authzSnapshot, filtered)}>تصدير JSON</button><button style={{ ...buttonStyle, background: "linear-gradient(135deg,#2563eb,#1d4ed8)", borderColor: "#1d4ed8" }} onClick={() => exportAuditCsv(filtered)}>تصدير CSV</button>
          <button
            style={{ ...buttonStyle, borderColor: "#b91c1c", background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)", color: "#ffffff", boxShadow: "0 7px 18px rgba(185,28,28,0.18)" }}
            onClick={() => {
              if (window.confirm("هل تريد مسح النسخة المحلية فقط من هذا الجهاز؟")) {
                clearAuditEntries(auth.authzSnapshot);
                refresh();
              }
            }}
          >
            مسح النسخة المحلية فقط
          </button>
        </div>

        <div style={{ border: "1px solid #d9e5df", background: "#ffffff", color: "#111827", borderRadius: 18, padding: 14, fontWeight: 1000, marginBottom: 16 }}>
          حالة السجل السحابي: {cloudStatus}
          {lastCloudOk ? <span style={{ marginInlineStart: 14, color: "#166534" }}>آخر حفظ سحابي ناجح: {fmt(lastCloudOk)}</span> : null}
          {lastCloudError ? <span style={{ marginInlineStart: 14, color: "#991b1b" }}>آخر خطأ: {lastCloudError}</span> : null}
        </div>

        {entries.length === 0 ? (
          <div style={{ border: "2px solid #f59e0b", background: "#fffbeb", color: "#92400e", borderRadius: 18, padding: 18, fontWeight: 1000, textAlign: "center" }}>
            لا توجد عمليات مسجلة بعد. بعد هذا التعديل سيتم تسجيل فتح الصفحات والضغط على الأزرار المهمة تلقائيًا. اضغط "تسجيل فحص" للتأكد من عمل السجل.
          </div>
        ) : null}

        <div style={{ overflowX: "auto", border: "1px solid rgba(15,116,71,0.18)", borderRadius: 24, background: "linear-gradient(145deg, #ffffff 0%, #eef8f3 100%)", boxShadow: "0 18px 42px rgba(15,23,42,0.10), 0 5px 15px rgba(15,116,71,0.08)" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed", background: "#ffffff", borderRadius: 22, overflow: "hidden" }}><colgroup><col style={{ width: "10%" }} /><col style={{ width: "7%" }} /><col style={{ width: "24%" }} /><col style={{ width: "17%" }} /><col style={{ width: "11%" }} /><col style={{ width: "9%" }} /><col style={{ width: "15%" }} /><col style={{ width: "7%" }} /></colgroup>
            <thead>
              <tr>
                <th style={thStyle}>الوقت</th>
                <th style={thStyle}>النوع</th>
                <th style={thStyle}>الإجراء</th>
                <th style={thStyle}>المستخدم</th>
                <th style={thStyle}>الدور</th>
                <th style={thStyle}>النطاق</th>
                <th style={thStyle}>المسار</th>
                <th style={thStyle}>وضع المشاهدة</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ ...tdStyle, textAlign: "center", padding: 28 }}>
                    لا توجد عمليات مطابقة للعرض الحالي.
                  </td>
                </tr>
              ) : (
                pagedEntries.map((entry, index) => (
                  <tr data-audit-severity="v1" key={entry.id} onClick={() => setSelectedEntry(entry)} title="اضغط لعرض تفاصيل العملية" style={{ background: entry.level === "danger" ? "#fff7f7" : entry.level === "warning" ? "#fffbeb" : index % 2 === 0 ? "#ffffff" : "#f4faf7", cursor: "pointer", boxShadow: entry.level === "danger" ? "inset -5px 0 0 #dc2626" : entry.level === "warning" ? "inset -5px 0 0 #d97706" : "inset -5px 0 0 #16835b" }}>
                    <td style={tdStyle}>{fmt(entry.at)}</td>
                    <td style={tdStyle}>
                      <span style={{ ...levelStyle(entry.level), border: "1px solid", borderRadius: 999, padding: "6px 10px", fontWeight: 1000 }}>
                        {levelLabel(entry.level)}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 1000 }}>{entry.label}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{actionLabel(entry.action)} · {entry.source || "local"}</div>
                    </td>
                    <td style={tdStyle}>{entry.userEmail || "-"}</td>
                    <td style={tdStyle}>{entry.role || "-"}</td>
                    <td style={tdStyle}>{entry.governorate || entry.tenantId || "-"}</td>
                    <td style={{ ...tdStyle, direction: "ltr", textAlign: "left" }}>{entry.path || "-"}</td>
                    <td style={tdStyle}>{entry.readOnly ? "مشاهدة فقط" : "تشغيل عادي"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
        {/* YR_AUDIT_ENTRY_DETAILS_V1 */}{selectedEntry ? <div onClick={() => setSelectedEntry(null)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,0.42)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}><div onClick={(e) => e.stopPropagation()} style={{ width: "min(760px, 96vw)", maxHeight: "88vh", overflowY: "auto", background: "linear-gradient(145deg,#ffffff 0%,#f0faf5 100%)", border: "1px solid #b7d8c7", borderRadius: 26, boxShadow: "0 28px 70px rgba(15,23,42,0.24)", padding: 26 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 20 }}><div><div style={{ fontSize: 26, fontWeight: 1000, color: "#0f7447" }}>تفاصيل العملية</div><div style={{ marginTop: 4, color: "#64748b", fontWeight: 800 }}>السجل الأمني التفصيلي للعملية المحددة</div></div><button style={{ ...buttonStyle, padding: "9px 15px" }} onClick={() => setSelectedEntry(null)}>إغلاق</button></div><div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}><div style={card}><b>الوقت</b><div>{fmt(selectedEntry.at)}</div></div><div style={card}><b>النوع</b><div>{selectedEntry.level || "-"}</div></div><div style={card}><b>الإجراء</b><div>{selectedEntry.label || selectedEntry.action || "-"}</div></div><div style={card}><b>المستخدم</b><div style={{ direction: "ltr", textAlign: "right" }}>{selectedEntry.userEmail || "-"}</div></div><div style={card}><b>الدور</b><div>{selectedEntry.role || "-"}</div></div><div style={card}><b>Tenant / النطاق</b><div>{selectedEntry.tenantId || selectedEntry.governorate || "-"}</div></div><div style={{ ...card, gridColumn: "1 / -1" }}><b>المسار</b><div style={{ direction: "ltr", textAlign: "right", overflowWrap: "anywhere" }}>{selectedEntry.path || "-"}</div></div><div style={card}><b>المصدر</b><div>{selectedEntry.source || "-"}</div></div><div style={card}><b>وضع المشاهدة</b><div>{selectedEntry.readOnly ? "مشاهدة فقط" : "عادي"}</div></div></div></div></div> : null}
    </main>
  );
}
