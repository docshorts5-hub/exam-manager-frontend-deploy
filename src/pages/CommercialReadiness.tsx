// YR_COMMERCIAL_CARDS_PREMIUM_V2
// YR_COMMERCIAL_READINESS_MODERN_V1
// src/pages/CommercialReadiness.tsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const MINISTRY_LOGO_URL = "https://i.postimg.cc/j5G4NQvZ/sh%CA%BFar-1.png";

const clean = (value: unknown) => String(value || "").trim();
const roleOf = (auth: any) =>
  clean(
    auth?.effectiveRole ||
      auth?.allow?.role ||
      auth?.profile?.role ||
      auth?.userProfile?.role ||
      auth?.role ||
      "",
  );

const tenantOf = (auth: any) =>
  clean(
    auth?.effectiveTenantId ||
      auth?.allow?.tenantId ||
      auth?.profile?.tenantId ||
      auth?.userProfile?.tenantId ||
      auth?.tenantId ||
      "",
  );

const governorateOf = (auth: any) =>
  clean(
    auth?.effectiveGovernorate ||
      auth?.allow?.governorate ||
      auth?.profile?.governorate ||
      auth?.userProfile?.governorate ||
      auth?.governorate ||
      "",
  );

const emailOf = (auth: any) =>
  clean(
    auth?.user?.email ||
      auth?.email ||
      auth?.allow?.email ||
      auth?.profile?.email ||
      auth?.userProfile?.email ||
      "",
  );

const getLocalStats = () => {
  if (typeof window === "undefined") {
    return { total: 0, cloudCache: 0, cloudStatus: 0, tenantKeys: 0 };
  }

  const keys = Object.keys(window.localStorage || {});
  return {
    total: keys.length,
    cloudCache: keys.filter((k) => k.includes("cloud-cache")).length,
    cloudStatus: keys.filter((k) => k.includes("cloud-storage")).length,
    tenantKeys: keys.filter((k) => k.includes("exam-manager") || k.includes("tenant")).length,
  };
};

const getReadonlyFlag = () => {
  if (typeof window === "undefined") return false;
  const value =
    window.sessionStorage.getItem("exam-manager:view-as-readonly") ||
    window.sessionStorage.getItem("exam-manager:viewAsReadOnly") ||
    window.localStorage.getItem("exam-manager:view-as-readonly") ||
    "";
  return ["1", "true", "yes", "readonly"].includes(value.toLowerCase());
};

type CheckStatus = "ok" | "warn" | "info";

function StatusBadge({ status }: { status: CheckStatus }) {
  const map: Record<CheckStatus, { label: string; bg: string; color: string; border: string }> = {
    ok: { label: "جاهز", bg: "#ecfdf5", color: "#065f46", border: "#16a34a" },
    warn: { label: "يحتاج مراجعة", bg: "#fff7ed", color: "#9a3412", border: "#f59e0b" },
    info: { label: "معلومة", bg: "#eff6ff", color: "#1d4ed8", border: "#3b82f6" },
  };
  const item = map[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "7px 14px",
        borderRadius: 999,
        border: `1px solid ${item.border}`,
        background: item.bg,
        color: item.color,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {item.label}
    </span>
  );
}

function OfficialButton({ children, onClick, variant = "gold" }: { children: React.ReactNode; onClick: () => void; variant?: "gold" | "white" | "dark" }) {
  const styles = {
    gold: { background: "#2563eb", color: "#ffffff", border: "#1d4ed8" },
    white: { background: "#ffffff", color: "#1d4ed8", border: "#bfdbfe" },
    dark: { background: "#111827", color: "#ffffff", border: "#111827" },
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${styles.border}`,
        background: styles.background,
        color: styles.color,
        borderRadius: 14,
        padding: "12px 18px",
        fontWeight: 900,
        cursor: "pointer",
        boxShadow: "0 10px 18px rgba(0,0,0,0.08)",
      }}
    >
      {children}
    </button>
  );
}

function CheckCard({ title, desc, status }: { title: string; desc: string; status: CheckStatus }) {
  return (
    <div
      style={{
        border: `1px solid ${status === "ok" ? "#86efac" : status === "warn" ? "#fdba74" : "#93c5fd"}`, borderRight: `6px solid ${status === "ok" ? "#22c55e" : status === "warn" ? "#f59e0b" : "#3b82f6"}`, borderRadius: 20, background: status === "ok" ? "linear-gradient(135deg,#ffffff,#f0fdf4)" : status === "warn" ? "linear-gradient(135deg,#ffffff,#fff7ed)" : "linear-gradient(135deg,#ffffff,#eff6ff)", padding: 18, minHeight: 130, boxShadow: status === "ok" ? "0 12px 28px rgba(34,197,94,0.12)" : status === "warn" ? "0 12px 28px rgba(245,158,11,0.12)" : "0 12px 28px rgba(59,130,246,0.12)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h3 style={{ margin: 0, color: "#111827", fontSize: 19, fontWeight: 950 }}>{title}</h3>
        <StatusBadge status={status} />
      </div>
      <p style={{ margin: "14px 0 0", color: "#111827", fontSize: 15, fontWeight: 800, lineHeight: 1.9 }}>
        {desc}
      </p>
    </div>
  );
}

export default function CommercialReadiness() {
  const navigate = useNavigate();
  const auth = useAuth() as any;

  const role = roleOf(auth);
  const email = emailOf(auth);
  const tenantId = tenantOf(auth);
  const governorate = governorateOf(auth);
  const isReadonly = getReadonlyFlag();

  const stats = useMemo(() => getLocalStats(), []);
  const roleLower = role.toLowerCase();
  const isOwner = ["owner", "super_admin", "superadmin", "platform_owner", "مالك المنصة"].includes(roleLower);
  const isGovernorateSuper = ["super", "governorate_super", "governorate-super", "سوبر المحافظة", "مشرف المحافظة"].includes(roleLower);

  const checks = [
    {
      title: "هوية المستخدم",
      desc: email ? `تم التعرف على المستخدم الحالي: ${email}` : "لا يظهر بريد المستخدم الحالي بوضوح. راجع جلسة تسجيل الدخول.",
      status: email ? "ok" : "warn",
    },
    {
      title: "نوع الصلاحية",
      desc: role ? `الصلاحية الحالية: ${role}` : "لم يتم العثور على دور واضح للمستخدم الحالي.",
      status: role ? "ok" : "warn",
    },
    {
      title: "نطاق المحافظة",
      desc: governorate ? `النطاق الحالي مرتبط بـ: ${governorate}` : "لا يوجد نطاق محافظة واضح. هذا مهم لمشرف المحافظة.",
      status: governorate || isOwner ? "ok" : "warn",
    },
    {
      title: "وضع المشاهدة فقط",
      desc: isReadonly ? "الجلسة الحالية مفعّل عليها وضع المشاهدة فقط." : "لا يوجد وضع مشاهدة فقط مفعّل في هذه اللحظة.",
      status: isReadonly ? "ok" : "info",
    },
    {
      title: "مفاتيح التخزين المحلي",
      desc: `إجمالي المفاتيح المحلية: ${stats.total}، مفاتيح البرنامج: ${stats.tenantKeys}، كاش السحابة: ${stats.cloudCache}.`,
      status: stats.total >= 0 ? "ok" : "warn",
    },
    {
      title: "جاهزية الدور التجاري",
      desc: isOwner
        ? "مالك المنصة مؤهل لفحص كل المحافظات والصفحات الإدارية."
        : isGovernorateSuper
          ? "مشرف المحافظة يجب أن يرى محافظته فقط ويفتح المدارس ومراكز الدبلوم مشاهدة فقط."
          : "المستخدم الحالي ليس مالك منصة أو مشرف محافظة، لذلك استخدم صفحات الفحص من داخل النطاق فقط.",
      status: isOwner || isGovernorateSuper ? "ok" : "info",
    },
  ] as Array<{ title: string; desc: string; status: CheckStatus }>;

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "linear-gradient(135deg,#f4faf7 0%,#eef7fb 58%,#fffaf0 100%)", padding: 24, color: "#111827" }}>
      <section style={{ border: "1px solid #d8e6df", borderRadius: 24, background: "rgba(255,255,255,0.94)", padding: "10px 18px 14px", boxShadow: "0 18px 44px rgba(15,23,42,0.08)", marginBottom: 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.45fr 1fr", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, justifySelf: "start" }}>
            <img src={MINISTRY_LOGO_URL} alt="وزارة التعليم" style={{ width: 72, height: 72, objectFit: "contain", mixBlendMode: "multiply" }} />
            <div style={{ color: "#123c2d", fontWeight: 950, lineHeight: 1.45 }}><div style={{ fontSize: 23 }}>سلطنة عُمان</div><div style={{ fontSize: 19 }}>وزارة التعليم</div></div>
          </div>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ margin: 0, fontSize: 38, fontWeight: 950, color: "#1d4ed8" }}>لوحة الجاهزية التجارية</h1>
            <div style={{ marginTop: 6, color: "#64748b", fontWeight: 800 }}>مراجعة الجاهزية التشغيلية والصلاحيات وحالة البيئة قبل اعتماد الإصدار.</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifySelf: "end" }}>
            <OfficialButton onClick={() => navigate("/system/operations")}>العودة إلى النظام والتطوير</OfficialButton>
            <OfficialButton variant="white" onClick={() => navigate("/system")}>لوحة مالك المنصة</OfficialButton>
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          gap: 14,
          marginBottom: 24,
        }}
      >
        <div style={{ border: "1px solid #bfdbfe", borderTop: "4px solid #2563eb", borderRadius: 18, background: "linear-gradient(135deg,#ffffff,#eff6ff)", padding: 18, boxShadow: "0 12px 28px rgba(37,99,235,0.12)" }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>المستخدم</div>
          <div style={{ marginTop: 8, fontSize: 18, fontWeight: 950 }}>{email || "غير محدد"}</div>
        </div>
        <div style={{ border: "1px solid #ddd6fe", borderTop: "4px solid #7c3aed", borderRadius: 18, background: "linear-gradient(135deg,#ffffff,#f5f3ff)", padding: 18, boxShadow: "0 12px 28px rgba(124,58,237,0.10)" }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>الصلاحية</div>
          <div style={{ marginTop: 8, fontSize: 18, fontWeight: 950 }}>{role || "غير محدد"}</div>
        </div>
        <div style={{ border: "1px solid #bbf7d0", borderTop: "4px solid #16a34a", borderRadius: 18, background: "linear-gradient(135deg,#ffffff,#f0fdf4)", padding: 18, boxShadow: "0 12px 28px rgba(22,163,74,0.10)" }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>النطاق</div>
          <div style={{ marginTop: 8, fontSize: 18, fontWeight: 950 }}>{governorate || "غير محدد"}</div>
        </div>
        <div style={{ border: "1px solid #fde68a", borderTop: "4px solid #d97706", borderRadius: 18, background: "linear-gradient(135deg,#ffffff,#fffbeb)", padding: 18, boxShadow: "0 12px 28px rgba(217,119,6,0.10)" }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>Tenant الحالي</div>
          <div style={{ marginTop: 8, fontSize: 18, fontWeight: 950 }}>{tenantId || "غير محدد"}</div>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))", gap: 16, marginBottom: 24 }}>
        {checks.map((check) => (
          <CheckCard key={check.title} title={check.title} desc={check.desc} status={check.status} />
        ))}
      </section>

      <section style={{ border: "1px solid #dbe7f3", borderRadius: 22, background: "#ffffff", padding: 22, marginBottom: 22, boxShadow: "0 10px 26px rgba(15,23,42,0.06)" }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 26, fontWeight: 950, color: "#16372c" }}>روابط الفحص السريع</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <OfficialButton onClick={() => navigate("/system/permissions-audit")}>فحص الصلاحيات والربط</OfficialButton>
          <OfficialButton onClick={() => navigate("/system/audit-log")}>سجل العمليات</OfficialButton>
          <OfficialButton onClick={() => navigate("/system/error-log")}>سجل الأخطاء</OfficialButton>
          <OfficialButton onClick={() => navigate("/system/monitoring")}>مركز مراقبة النظام</OfficialButton>
          <OfficialButton onClick={() => navigate("/system/maintenance")}>مركز صيانة النظام</OfficialButton>
          <OfficialButton onClick={() => navigate("/system/release-center")}>مركز الإصدارات والتطوير</OfficialButton>
          <OfficialButton onClick={() => navigate("/system/commercial-test-suite")}>حزمة الاختبار التجاري</OfficialButton>
        </div>
      </section>

      <section style={{ border: "1px solid #dbe7f3", borderRight: "5px solid #2563eb", borderRadius: 22, background: "#f8fbff", padding: 22 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 25, fontWeight: 950, color: "#16372c" }}>توصية المرحلة التالية</h2>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 800, lineHeight: 1.9, color: "#475569" }}>استخدم مركز مراقبة النظام وحزمة الاختبار التجاري للتحقق من الجاهزية، ثم راجع مركز الإصدارات قبل تثبيت النسخة المعتمدة. سجل العمليات وسجل الأخطاء متاحان بالفعل ضمن الأمن والرقابة.</p>
      </section>
    </div>
  );
}
