import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth as firebaseAuth, db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import { buildAuthzSnapshot, canAccessCapability, resolvePrimaryRoleLabel } from "../features/authz";
import SupportModeBar from "../components/SupportModeBar";
import BrandedHeader from "../components/BrandedHeader";
import { useI18n } from "../i18n/I18nProvider";

const APP_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const GOLD_DARK = "#d4af37";
const GOLD_GLOW = "rgba(212, 175, 55, 0.45)";
const SIDEBAR_NAV_BG = "linear-gradient(180deg, #081225 0%, #091426 100%)";
const SIDEBAR_GOLD_SOFT = "rgba(212, 175, 55, 0.22)";

function translateRoleLabel(label: string, lang: "ar" | "en") {
  const map: Record<string, { ar: string; en: string }> = {
    "مالك المنصة": { ar: "مالك المنصة", en: "Platform Owner" },
    "مشرف نطاق": { ar: "مشرف نطاق", en: "Domain Supervisor" },
    "مدير جهة": { ar: "مدير جهة", en: "Tenant Admin" },
    "مدير": { ar: "مدير", en: "Manager" },
    "مستخدم تشغيلي": { ar: "مستخدم تشغيلي", en: "Operational User" },
    "سوبر الامتحانات": { ar: "سوبر الامتحانات", en: "Exam Super" },
    "مستخدم": { ar: "مستخدم", en: "User" },
  };
  const entry = map[label];
  return entry ? entry[lang] : label;
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { tenantId: routeTenantId } = useParams();
  const authState = useAuth() as any;
  const { lang, isRTL, setLang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const authzSnapshot = useMemo(() => buildAuthzSnapshot(authState), [authState]);
  const isAdmin = canAccessCapability(authzSnapshot, "SETTINGS_MANAGE");
  const canSeeSystemArea = canAccessCapability(authzSnapshot, "SYSTEM_ADMIN");
  const canSeeOwnerTools = canAccessCapability(authzSnapshot, "PLATFORM_OWNER");

  const currentRole = String(
    authState?.effectiveRole ||
    authState?.allow?.role ||
    authState?.profile?.role ||
    authState?.userProfile?.role ||
    ""
  ).trim().toLowerCase();

  const canBackToProgramsGateway = currentRole === "super_admin" || currentRole === "super";

  const currentTenantId = String(
    authState?.effectiveTenantId ||
    authState?.allow?.tenantId ||
    authState?.profile?.tenantId ||
    authState?.userProfile?.tenantId ||
    ""
  ).trim();

  const [tenantType, setTenantType] = useState("");
  const [tenantTypeLoading, setTenantTypeLoading] = useState(true);

  const roleLabel =
    currentRole === "exam_super"
      ? translateRoleLabel("سوبر الامتحانات", lang)
      : translateRoleLabel(resolvePrimaryRoleLabel(authzSnapshot), lang);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadTenantType() {
      const id = String(routeTenantId || "").trim();
      if (!id) {
        if (mounted) {
          setTenantType("");
          setTenantTypeLoading(false);
        }
        return;
      }

      try {
        const rootSnap = await getDoc(doc(db, "tenants", id));
        const rootType = String(rootSnap.data()?.type || "").trim();

        if (rootType) {
          if (mounted) {
            setTenantType(rootType);
            setTenantTypeLoading(false);
          }
          return;
        }

        const configSnap = await getDoc(doc(db, "tenants", id, "meta", "config"));
        const configType = String(configSnap.data()?.type || "").trim();

        if (mounted) {
          setTenantType(configType);
          setTenantTypeLoading(false);
        }
      } catch {
        if (mounted) {
          setTenantType("");
          setTenantTypeLoading(false);
        }
      }
    }

    void loadTenantType();

    return () => {
      mounted = false;
    };
  }, [routeTenantId]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 820) setSidebarCollapsed(true);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const SIDEBAR_WIDTH = sidebarCollapsed ? 84 : 300;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  useEffect(() => {
    const isTaskDistributionPage = location.pathname.includes("/task-distribution");
    document.body.classList.toggle("task-distribution-active", isTaskDistributionPage);
    return () => document.body.classList.remove("task-distribution-active");
  }, [location.pathname]);

  const tenantBase = routeTenantId ? `/t/${routeTenantId}` : "";
  const isExamCenterTenant = String(tenantType || "").trim().toLowerCase() === "exam_center";
  const isExamSuper =
    !tenantTypeLoading &&
    currentRole === "exam_super" &&
    !!routeTenantId &&
    currentTenantId === String(routeTenantId).trim() &&
    isExamCenterTenant;

  const isDiploma12Area = useMemo(() => {
    const path = String(location.pathname || "").toLowerCase();
    return (
      path.includes("/dashboard12") ||
      path.includes("/settings12") ||
      path.includes("/teachers12") ||
      path.includes("/rooms12") ||
      path.includes("/exams12") ||
      path.includes("/unavailability12") ||
      path.includes("/task-distribution-run12") ||
      path.includes("/task-distribution-results12") ||
      path.includes("/task-distribution-print12") ||
      path.includes("/setting12") ||
      path.includes("/analytics12") ||
      path.includes("/control12") ||
      path.includes("/suggestions12page") ||
      path.includes("/about12")
    );
  }, [location.pathname]);

  const sidebarItems = useMemo(() => {
    const tp = (path: string) => {
      const clean = String(path ?? "");
      if (!clean) return tenantBase;
      return `${tenantBase}${clean.startsWith("/") ? clean : `/${clean}`}`;
    };

    const schoolItems = [
      { to: tp(""), label: tr("لوحة التحكم", "Dashboard"), icon: "📊" },
      { to: tp("settings1"), label: tr("مركز بيانات المدرسة", "School Profile"), icon: "🏷️" },
      { to: tp("teachers"), label: tr("مركز إدارة الكادر التعليمي", "Teachers"), icon: "👥" },
      { to: tp("rooms"), label: tr("مركز إدارة القاعات", "Rooms"), icon: "🏫" },
      { to: tp("room-blocks"), label: tr("مركز حظر القاعات", "Room Blocks"), icon: "⛔" },
      { to: tp("exams"), label: tr("مركز إدارة  الامتحانات", "Exam Schedule"), icon: "📅" },
      { to: tp("unavailability"), label: tr("غياب الكادر التعليمي", "Unavailability"), icon: "🕒" },
      { to: tp("task-distribution/run"), label: tr("منصة تشغيل توزيع المهام", "Task Distribution"), icon: "🔀" },
      { to: tp("task-distribution/results"), label: tr("الجدول الشامل", "Master Table"), icon: "🧾" },
      { to: tp("settings"), label: tr("مركز رقابة التوزيع", "Distribution Statistics"), icon: "⚙️" },
      { to: tp("task-distribution/print"), label: tr("بوابة التقارير الرسمية  لتوزيع المهام", "Reports & Sheets"), icon: "📑" },
      { to: tp("archive"), label: tr("الإرشيف الذكي لنسخ التوزيع", "Archive"), icon: "📦", adminOnly: true },
      { to: tp("sync"), label: tr("قاعدة البيانات و النسخ الإحتياطي و السحابي", "Database"), icon: "💾", adminOnly: true },
      { to: tp("analytics1"), label: tr("لوحة التحليل الذكي", "Analytics1 & Charts"), icon: "📈" },
      { to: tp("analytics"), label: tr("مركز التحكم التحليلي لمنظومة الامتحانات", "Analytics & Charts"), icon: "📈" },
      { to: tp("versioning"), label: tr("مركز إدارة النسخ والتوثيق التشغيلي", "Versioning"), icon: "🗂️", adminOnly: true },
      { to: tp("multi-role"), label: tr("منصة إدارة المستخدمين ", "Multi-Role Permissions"), icon: "🔐", adminOnly: true },
      { to: tp("gallery"), label: tr("مكتبة الشعار و الهوية البصرية", "Gallery"), icon: "🖼️" },
      { to: tp("about"), label: tr("مصمم البرنامج", "About Developer"), icon: "🛠️" },
      { to: tp("suggestions"), label: tr("تطوير البرنامج", "Suggestions"), icon: "💡" },
      { to: "/system/migrate", label: tr("ترحيل البيانات", "Data Migration"), icon: "🚚", superOnly: true },
      { to: "/system", label: tr("مدير النظام", "System Admin"), icon: "🧠", systemOnly: true },
    ];

    const diplomaItems = [
      { to: tp("dashboard12"), label: tr("لوحة التحكم", "Dashboard"), icon: "📊" },
      { to: tp("settings12"), label: tr("بيانات مركز الامتحانات", "Exam Center Data"), icon: "🏷️" },
      { to: tp("teachers12"), label: tr("مركز إدارة الكادر التعليمي", "Teachers"), icon: "👥" },
      { to: tp("rooms12"), label: tr("مركز إدارة القاعات", "Rooms"), icon: "🏫" },
      { to: tp("exams12"), label: tr("مركز إدارة الامتحانات", "Exams"), icon: "📅" },
      { to: tp("unavailability12"), label: tr("غياب الكادر التعليمي", "Unavailability"), icon: "🕒" },
      { to: tp("task-distribution-run12"), label: tr("منصة تشغيل توزيع المهام", "Task Distribution Run"), icon: "🔀" },
      { to: tp("task-distribution-results12"), label: tr("الجدول الشامل", "Master Table"), icon: "🧾" },
      { to: tp("setting12"), label: tr("مركز رقابة التوزيع", "Distribution Control"), icon: "⚙️" },
      { to: tp("task-distribution-print12"), label: tr("بوابة التقارير الرسمية للتوزيع", "Official Distribution Reports"), icon: "📑" },
      { to: tp("analytics12"), label: tr("لوحة التحليل", "Analytics"), icon: "📈" },
      { to: tp("control12"), label: tr("ملفات الكنترول", "Control Files"), icon: "🗂️" },
      { to: tp("suggestions12page"), label: tr("تطوير البرنامج", "Suggestions"), icon: "💡" },
      { to: tp("about12"), label: tr("مصمم البرنامج", "About Developer"), icon: "🛠️" },
    ];

    const items = isDiploma12Area ? diplomaItems : schoolItems;

    return items
      .filter((it: any) => !it.superOnly || canSeeOwnerTools)
      .filter((it: any) => !it.systemOnly || canSeeSystemArea)
      .filter((it: any) => !it.adminOnly || isAdmin || canSeeOwnerTools);
  }, [isAdmin, canSeeOwnerTools, canSeeSystemArea, tenantBase, lang, location.pathname, isDiploma12Area]);
  const pageTitle = useMemo(() => {
    const path = location.pathname.toLowerCase();
    const exact = sidebarItems.find((it: any) => String(it.to).toLowerCase() === path);
    if (exact?.label) return String(exact.label);

    if (path.includes("/task-distribution")) {
      if (path.includes("/run")) return tr("توزيع المهام", "Task Distribution");
      if (path.includes("/results")) return tr("الجدول الشامل", "Master Table");
      if (path.includes("/print")) return tr("التقارير والكشوفات", "Reports & Sheets");
      if (path.includes("/suggestions")) return tr("اقتراحات", "Suggestions");
      return tr("توزيع المهام", "Task Distribution");
    }

    const prefix = sidebarItems.find((it: any) => path.startsWith(String(it.to).toLowerCase()));
    return prefix?.label ? String(prefix.label) : "";
  }, [location.pathname, sidebarItems, lang]);

  const doLogout = async () => {
    try {
      await signOut(firebaseAuth);
    } catch {}
    try {
      await authState?.logout?.();
    } catch {}
    setShowLogoutConfirm(false);
    navigate("/login", { replace: true });
  };

  const sideProp = isRTL ? "right" : "left";
  const oppositeMarginProp = isRTL ? "marginRight" : "marginLeft";

  return (
    <div style={{ direction: isRTL ? "rtl" : "ltr", display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: SIDEBAR_WIDTH,
          height: "100vh",
          position: "fixed",
          top: 0,
          [sideProp]: 0,
          background: SIDEBAR_NAV_BG,
          backdropFilter: "blur(18px)",
          borderLeft: isRTL ? `2px solid ${SIDEBAR_GOLD_SOFT}` : undefined,
          borderRight: !isRTL ? `2px solid ${SIDEBAR_GOLD_SOFT}` : undefined,
          boxShadow: isRTL ? `-18px 0 50px rgba(0,0,0,0.30), 0 0 24px ${SIDEBAR_GOLD_SOFT}` : `18px 0 50px rgba(0,0,0,0.30), 0 0 24px ${SIDEBAR_GOLD_SOFT}`,
          zIndex: 999,
          display: "flex",
          flexDirection: "column",
          padding: 16,
          gap: 14,
          transition: "width 280ms ease, transform 280ms ease",
          overflowY: "auto",
          boxSizing: "border-box",
        } as React.CSSProperties}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            justifyContent: sidebarCollapsed ? "center" : "flex-start",
            padding: 10,
            borderRadius: 16,
            border: "1px solid rgba(212,175,55,0.22)",
            background: "rgba(212,175,55,0.07)",
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: `0 0 16px ${GOLD_GLOW}`,
              background: "rgba(0,0,0,0.25)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <img
              src={APP_LOGO_URL}
              alt="logo"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
            />
            <span style={{ color: GOLD_DARK, fontWeight: 900 }}>★</span>
          </div>

          {!sidebarCollapsed && (
            <div>
              <div style={{ color: GOLD_DARK, fontWeight: 900, fontSize: 20 }}>
                {tr("نظام إدارة الامتحانات المطور", "Advanced Exam Management System")}
              </div>
              <div style={{ fontSize: 16, opacity: 0.8 }}>{roleLabel}</div>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: sidebarCollapsed ? "center" : "space-between",
            gap: 8,
          }}
        >
          {!sidebarCollapsed && (
            <div
              style={{
                display: "inline-flex",
                borderRadius: 14,
                overflow: "hidden",
                border: "1px solid rgba(212,175,55,0.22)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <button
                onClick={() => setLang("ar")}
                style={{
                  padding: "8px 12px",
                  border: 0,
                  cursor: "pointer",
                  background: lang === "ar" ? "rgba(212,175,55,0.18)" : "transparent",
                  color: lang === "ar" ? GOLD_DARK : "#e5e7eb",
                  fontWeight: 900,
                }}
              >
                العربية
              </button>
              <button
                onClick={() => setLang("en")}
                style={{
                  padding: "8px 12px",
                  border: 0,
                  cursor: "pointer",
                  background: lang === "en" ? "rgba(212,175,55,0.18)" : "transparent",
                  color: lang === "en" ? GOLD_DARK : "#e5e7eb",
                  fontWeight: 900,
                }}
              >
                English
              </button>
            </div>
          )}

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              alignSelf: sidebarCollapsed ? "center" : "flex-end",
              width: 42,
              height: 42,
              borderRadius: 14,
              background: "rgba(212,175,55,0.12)",
              border: "1px solid rgba(212,175,55,0.35)",
              color: GOLD_DARK,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              fontSize: 18,
            }}
            title={sidebarCollapsed ? tr("فتح القائمة", "Expand menu") : tr("طي القائمة", "Collapse menu")}
          >
            {sidebarCollapsed ? (isRTL ? "▶" : "◀") : isRTL ? "◀" : "▶"}
          </button>
        </div>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {sidebarItems.map((item: any) => {
            const active = location.pathname.toLowerCase() === String(item.to).toLowerCase();
            return (
              <NavLink
                key={item.to}
                to={item.to}
                style={{
                  padding: sidebarCollapsed ? 14 : "12px 16px",
                  borderRadius: 14,
                  background: active ? "rgba(212,175,55,0.18)" : "rgba(255,255,255,0.05)",
                  border: active ? "1px solid rgba(212,175,55,0.45)" : "1px solid rgba(255,255,255,0.08)",
                  color: active ? GOLD_DARK : "#e5e7eb",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  textDecoration: "none",
                  fontWeight: active ? 800 : 600,
                  transition: "all 0.22s ease",
                  textAlign: isRTL ? "right" : "left",
                }}
              >
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {canBackToProgramsGateway ? (
          <button
            onClick={() => navigate("/programs-gateway")}
            style={{
              padding: sidebarCollapsed ? 14 : "12px 16px",
              borderRadius: 14,
              background: "rgba(212,175,55,0.15)",
              border: "1px solid rgba(212,175,55,0.35)",
              color: GOLD_DARK,
              display: "flex",
              alignItems: "center",
              gap: 12,
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              cursor: "pointer",
              fontWeight: 800,
              boxShadow: `0 10px 24px rgba(0,0,0,0.18), 0 0 16px ${GOLD_GLOW}`,
            }}
          >
            <span style={{ fontSize: 20 }}>↩️</span>
            {!sidebarCollapsed && <span>{tr("العودة إلى البوابة التشغيلية", "Back to Programs Gateway")}</span>}
          </button>
        ) : null}

        <button
          onClick={() => setShowLogoutConfirm(true)}
          style={{
            padding: sidebarCollapsed ? 14 : "12px 16px",
            borderRadius: 14,
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.35)",
            color: "#fecaca",
            display: "flex",
            alignItems: "center",
            gap: 12,
            justifyContent: sidebarCollapsed ? "center" : "flex-start",
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
          <span style={{ fontSize: 20 }}>🚪</span>
          {!sidebarCollapsed && <span>{tr("تسجيل خروج", "Sign out")}</span>}
        </button>
      </aside>

      <div
        style={{
          position: "fixed",
          top: 0,
          [sideProp]: SIDEBAR_WIDTH,
          height: "100vh",
          width: 14,
          pointerEvents: "none",
          background: isRTL
            ? "linear-gradient(90deg, rgba(0,0,0,0.35), transparent)"
            : "linear-gradient(270deg, rgba(0,0,0,0.35), transparent)",
          zIndex: 998,
          transition: `${sideProp} 280ms ease`,
        } as React.CSSProperties}
      />

      <main
        style={{
          [oppositeMarginProp]: SIDEBAR_WIDTH,
          width: `calc(100% - ${SIDEBAR_WIDTH}px)`,
          transition: "all 280ms ease",
          minHeight: "100vh",
          background: "linear-gradient(135deg, #0f172a 0%, #020617 100%)",
          padding: window.innerWidth < 768 ? 16 : 28,
          boxSizing: "border-box",
        } as React.CSSProperties}
      >
        <SupportModeBar />
        <BrandedHeader pageTitle={pageTitle || ""} />
        <Outlet />
      </main>

      {showLogoutConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "grid",
            placeItems: "center",
            zIndex: 2000,
            padding: 16,
          }}
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(8,12,24,0.95)",
              borderRadius: 18,
              padding: 18,
              width: "min(420px, 95vw)",
              border: "1px solid rgba(212,175,55,0.28)",
              color: "#e5e7eb",
              direction: isRTL ? "rtl" : "ltr",
            }}
          >
            <div style={{ fontWeight: 900, color: GOLD_DARK, marginBottom: 10 }}>
              {tr("تأكيد تسجيل الخروج", "Confirm sign out")}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={doLogout}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid rgba(239,68,68,0.35)",
                  background: "rgba(239,68,68,0.15)",
                  color: "#fecaca",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {tr("خروج", "Sign out")}
              </button>

              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#e5e7eb",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {tr("إلغاء", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}