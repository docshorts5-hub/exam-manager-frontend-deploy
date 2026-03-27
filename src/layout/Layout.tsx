import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth as firebaseAuth } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import { buildAuthzSnapshot, canAccessCapability, resolvePrimaryRoleLabel } from "../features/authz";
import SupportModeBar from "../components/SupportModeBar";
import BrandedHeader from "../components/BrandedHeader";
import { useI18n } from "../i18n/I18nProvider";

const APP_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const GOLD_DARK = "#d4af37";
const GOLD_GLOW = "rgba(212, 175, 55, 0.45)";

function translateRoleLabel(label: string, lang: "ar" | "en") {
  const map: Record<string, { ar: string; en: string }> = {
    "مالك المنصة": { ar: "مالك المنصة", en: "Platform Owner" },
    "مشرف نطاق": { ar: "مشرف نطاق", en: "Domain Supervisor" },
    "مدير جهة": { ar: "مدير جهة", en: "Tenant Admin" },
    "مدير": { ar: "مدير", en: "Manager" },
    "مستخدم تشغيلي": { ar: "مستخدم تشغيلي", en: "Operational User" },
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
  const roleLabel = translateRoleLabel(resolvePrimaryRoleLabel(authzSnapshot), lang);
  const canSeeSystemArea = canAccessCapability(authzSnapshot, "SYSTEM_ADMIN");
  const canSeeOwnerTools = canAccessCapability(authzSnapshot, "PLATFORM_OWNER");

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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

  const sidebarItems = useMemo(() => {
    const tp = (path: string) => {
      const clean = String(path ?? "");
      if (!clean) return tenantBase;
      return `${tenantBase}${clean.startsWith("/") ? clean : `/${clean}`}`;
    };

    const items = [
      { to: tp(""), label: tr("لوحة التحكم", "Dashboard"), icon: "📊" },
       { to: tp("settings1"), label: tr("بيانات المدرسة", "School Profile"), icon: "🏷️" },
      { to: tp("teachers"), label: tr("الكادر التعليمي", "Teachers"), icon: "👥" },
      { to: tp("exams"), label: tr("جدول الامتحانات", "Exam Schedule"), icon: "📅" },
      { to: tp("rooms"), label: tr("القاعات", "Rooms"), icon: "🏫" },
      { to: tp("room-blocks"), label: tr("حظر القاعات", "Room Blocks"), icon: "⛔" },
     
      { to: tp("unavailability"), label: tr("الغياب", "Unavailability"), icon: "🕒" },
      { to: tp("task-distribution/run"), label: tr("توزيع المهام", "Task Distribution"), icon: "🔀" },
      { to: tp("task-distribution/results"), label: tr("الجدول الشامل", "Master Table"), icon: "🧾" },
      { to: tp("settings"), label: tr("تقرير إحصائية التوزيع", "Distribution Statistics"), icon: "⚙️" },
      { to: tp("task-distribution/print"), label: tr("التقارير والكشوفات", "Reports & Sheets"), icon: "📑" },
          
      
      { to: tp("archive"), label: tr("الأرشيف", "Archive"), icon: "📦", adminOnly: true },
      { to: tp("audit"), label: tr("السجلات", "Audit"), icon: "🧩", adminOnly: true },
      { to: tp("activity-logs"), label: tr("سجل النشاط", "Activity Logs"), icon: "🧾", adminOnly: true },
      { to: tp("sync"), label: tr("قاعدة البيانات", "Database"), icon: "💾", adminOnly: true },
      { to: tp("analytics"), label: tr("الإحصائيات والرسوم البيانية", "Analytics & Charts"), icon: "📈" },
      { to: tp("versioning"), label: tr("إدارة الإصدارات", "Versioning"), icon: "🗂️", adminOnly: true },
      { to: tp("multi-role"), label: tr("صلاحيات Multi-Role", "Multi-Role Permissions"), icon: "🔐", adminOnly: true },
      
      { to: tp("gallery"), label: tr("مكتبة الصور", "Gallery"), icon: "🖼️" },
      { to: tp("about"), label: tr("مصمم البرنامج", "About Developer"), icon: "🛠️" },
      { to: "/system/migrate", label: tr("ترحيل البيانات", "Data Migration"), icon: "🚚", superOnly: true },
      { to: "/system", label: tr("مدير النظام", "System Admin"), icon: "🧠", systemOnly: true },
    ];

    return items
      .filter((it: any) => !it.superOnly || canSeeOwnerTools)
      .filter((it: any) => !it.systemOnly || canSeeSystemArea)
      .filter((it: any) => !it.adminOnly || isAdmin || canSeeOwnerTools);
  }, [isAdmin, canSeeOwnerTools, canSeeSystemArea, tenantBase, lang]);

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
  const asideJustify = sidebarCollapsed ? "center" : isRTL ? "flex-start" : "flex-start";

  return (
    <div style={{ direction: isRTL ? "rtl" : "ltr", display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: SIDEBAR_WIDTH,
          height: "100vh",
          position: "fixed",
          top: 0,
          [sideProp]: 0,
          background: "rgba(8, 12, 24, 0.88)",
          backdropFilter: "blur(18px)",
          borderLeft: isRTL ? "1px solid rgba(212,175,55,0.18)" : undefined,
          borderRight: !isRTL ? "1px solid rgba(212,175,55,0.18)" : undefined,
          boxShadow: isRTL ? "-8px 0 26px rgba(0,0,0,0.55)" : "8px 0 26px rgba(0,0,0,0.55)",
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
          background: isRTL ? "linear-gradient(90deg, rgba(0,0,0,0.35), transparent)" : "linear-gradient(270deg, rgba(0,0,0,0.35), transparent)",
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