import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth as firebaseAuth } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import { buildAuthzSnapshot, canAccessCapability, resolvePrimaryRoleLabel } from "../features/authz";
import { resolveActualAdministrativeActor } from "../features/tenant-return/tenantReturnSecurity";
import SupportModeBar from "../components/SupportModeBar";
import BrandedHeader from "../components/BrandedHeader";
import { useI18n } from "../i18n/I18nProvider";
import CloudStorageStatusPill from "../features/cloud-storage/CloudStorageStatusPill";
import "../styles/officialUnifiedTheme.css";

const APP_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const GOLD_DARK = "#d4af37";
const GOLD_GLOW = "rgba(212, 175, 55, 0.45)";
const DIPLOMA_EXAM_SUPERS_MATCH_BG = "linear-gradient(180deg, #f6f1e3 0%, #eee6d2 100%)"; // LAYOUT12_BG_MATCH_EXAM_SUPERS

// STEP48J_GOV_READONLY_HELPERS
const STEP48J_GOV_READONLY_FLAG_KEYS = [
  "governorateSuperReadOnly",
  "viewAsReadOnly",
  "readOnly",
  "isReadOnlyView",
  "openedByGovernorateSuper",
];

const STEP48J_GOV_TENANT_KEYS = [
  "governorateSuperViewTenantId",
  "viewAsTenantId",
  "effectiveTenantId",
  "selectedTenantId",
  "currentTenantId",
  "tenantId",
  "exam-manager:effectiveTenantId",
  "exam-manager:tenantId",
];

const STEP48J_GOV_RETURN_KEYS = [
  "governorateSuperReturnTo",
  "readOnlyReturnTo",
];

const STEP48J_GOV_CLEAR_KEYS = [
  ...STEP48J_GOV_READONLY_FLAG_KEYS,
  ...STEP48J_GOV_TENANT_KEYS,
  ...STEP48J_GOV_RETURN_KEYS,
  "governorateSuperViewExpiresAt",
  "viewAsRole",
  "viewAsEmail",
  "effectiveViewAsEmail",
  "viewAsScope",
  "examSuperEmail",
  "selectedExamSuperEmail",
  "effectiveExamSuperEmail",
  "effectiveRole",
  "selectedRole",
  "exam-manager:effectiveRole",
];

function step48jReadStorageValue(key: string): string {
  if (typeof window === "undefined") return "";

  try {
    const value = window.localStorage.getItem(key);
    if (value) return value;
  } catch {
    // ignore storage errors
  }

  try {
    const value = window.sessionStorage.getItem(key);
    if (value) return value;
  } catch {
    // ignore storage errors
  }

  return "";
}

function step48jNormalizeReturnPath(value: string): string {
  // DIPLOMA_READONLY_RETURN_TO_EXAM_SUPERS
  const raw = String(value || "").trim();

  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/exam-supers";
  }

  if (
    raw.startsWith("/exam-supers") ||
    raw.startsWith("/exam-supers") ||
    raw.startsWith("/school-admins") ||
    raw.startsWith("/programs-gateway") ||
    raw.startsWith("/super-system")
  ) {
    return raw;
  }

  return "/exam-supers";
}

function step48jGovernorateReadonlyReturnPath(pathname: string): string {
  if (typeof window === "undefined") return "";

  const path = String(pathname || "");
  const isTenantPath = /^\/t\/[^/]+/.test(path);
  if (!isTenantPath) return "";

  const hasReadonlyFlag = STEP48J_GOV_READONLY_FLAG_KEYS.some((key) => step48jReadStorageValue(key) === "true");
  if (!hasReadonlyFlag) return "";

  const tenantId = STEP48J_GOV_TENANT_KEYS.map(step48jReadStorageValue).find(Boolean);
  if (!tenantId) return "";

  const expiresAt = Number(step48jReadStorageValue("governorateSuperViewExpiresAt") || "0");
  if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt < Date.now()) return "";

  const savedReturnPath = STEP48J_GOV_RETURN_KEYS.map(step48jReadStorageValue).find(Boolean) || "";
  return step48jNormalizeReturnPath(savedReturnPath);
}

function step48jClearGovernorateReadonlyView() {
  if (typeof window === "undefined") return;

  for (const key of STEP48J_GOV_CLEAR_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore storage errors
    }

    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore storage errors
    }
  }

  try {
    window.dispatchEvent(new Event("yr-authz-refresh"));
    window.dispatchEvent(new Event("auth-changed"));
    window.dispatchEvent(new Event("effective-tenant-changed"));
    window.dispatchEvent(new Event("effective-role-changed"));
  } catch {
    // ignore event errors
  }
}

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

  // ROLE_SEPARATED_TENANT_RETURN_SECURITY
  const actualAdministrativeActor =
    resolveActualAdministrativeActor(authState);

  const detectedGovernorateReadonlyReturnPath =
    step48jGovernorateReadonlyReturnPath(location.pathname);

  const governorateReadonlyReturnPath =
    actualAdministrativeActor === "governorate_super" &&
    !authState?.isSupportMode &&
    Boolean(detectedGovernorateReadonlyReturnPath)
      ? "/exam-supers"
      : "";

  const supportReturnPath = authState?.isSupportMode
    ? actualAdministrativeActor === "platform_owner"
      ? "/exam-supers"
      : actualAdministrativeActor === "governorate_super"
        ? "/super-system"
        : ""
    : governorateReadonlyReturnPath;

  const supportReturnLabel = governorateReadonlyReturnPath
    ? tr("العودة إلى دليل مشرفي امتحانات الدبلوم", "Back to Diploma Exam Supervisors Directory")
    : actualAdministrativeActor === "platform_owner"
      ? tr("العودة إلى دليل مشرفي امتحانات الدبلوم", "Back to Diploma Exam Supervisors Directory")
      : tr("العودة إلى صفحة مشرف المحافظة", "Back to Governorate Supervisor Page");

  const canShowSupportReturn = Boolean(supportReturnPath) && !governorateReadonlyReturnPath;

  const handleSupportReturn = async () => {
    const target = supportReturnPath;
    if (!target) return;

    if (governorateReadonlyReturnPath) {
      step48jClearGovernorateReadonlyView();
      navigate(target, { replace: true });
      return;
    }

    try {
      await authState?.endSupport?.();
    } catch {}

    navigate(target, { replace: true });
  };

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
      path.includes("/student-seat-register12") ||
      path.includes("/cloud-health12") ||
      path.includes("/cloud-backup12") ||
      path.includes("/sync12") ||
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
      { to: tp("cloud-health"), label: tr("فحص التخزين السحابي", "Cloud Health"), icon: "☁️" },
      { to: tp("cloud-backup"), label: tr("النسخ الاحتياطي السحابي", "Cloud Backup"), icon: "🛡️", adminOnly: true },
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
      { to: tp("student-seat-register12"), label: tr("سجل أرقام الجلوس", "Seat Numbers Register"), icon: "🔎" },
      { to: tp("cloud-health12"), label: tr("فحص التخزين السحابي", "Cloud Health"), icon: "☁️" },
      { to: tp("cloud-backup12"), label: tr("النسخ الاحتياطي السحابي", "Cloud Backup"), icon: "🛡️" },
      { to: tp("sync12"), label: tr("قاعدة البيانات و النسخ الاحتياطي و السحابي", "Database / Backup / Cloud Sync"), icon: "💾" },
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

  const sidebarNavItems = useMemo(() => {
    if (!governorateReadonlyReturnPath) return sidebarItems;

    const returnItem = {
      to: "__diploma_readonly_return__",
      label: tr("العودة إلى دليل مشرفي امتحانات الدبلوم", "Back to Diploma Exam Supervisors Directory"),
      icon: "↩️",
      isGovernorateReadonlyReturn: true,
    };

    const [firstItem, ...restItems] = sidebarItems;
    return firstItem ? [firstItem, returnItem, ...restItems] : [returnItem];
  }, [sidebarItems, governorateReadonlyReturnPath, lang]);

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
    <div className="moe-official-app-shell moe-diploma-shell" style={{ direction: isRTL ? "rtl" : "ltr", display: "flex", minHeight: "100vh" }}>
      <aside
        className="moe-official-sidebar"
        style={{
          width: SIDEBAR_WIDTH,
          height: "100vh",
          position: "fixed",
          top: 0,
          [sideProp]: 0,
          background: "linear-gradient(180deg, #f3e1a2 0%, #efd98a 48%, #f8edbf 100%)",
          backdropFilter: "blur(18px)",
          borderLeft: isRTL ? "3px solid rgba(212,175,55,0.55)" : undefined,
          borderRight: !isRTL ? "3px solid rgba(212,175,55,0.55)" : undefined,
          boxShadow: isRTL ? "-18px 0 40px rgba(150,120,20,0.22)" : "18px 0 40px rgba(150,120,20,0.22)",
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
            background: "linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,248,220,0.95) 100%)",
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
                background: "rgba(255,255,255,0.70)",
              }}
            >
              <button
                onClick={() => setLang("ar")}
                style={{
                  padding: "8px 12px",
                  border: 0,
                  cursor: "pointer",
                  background: lang === "ar" ? "rgba(212,175,55,0.18)" : "transparent",
                  color: "#111111",
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
                  color: "#111111",
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

        <div
          onClickCapture={(event) => {
            if (!isDiploma12Area) return;

            const target = event.target as HTMLElement | null;
            const clickable = target?.closest?.("a,button,[role='button']") as HTMLElement | null;
            if (!clickable) return;

            const text = `${clickable.textContent || ""} ${clickable.getAttribute("aria-label") || ""} ${clickable.getAttribute("title") || ""}`.toLowerCase();
            const looksLikeHealthAction =
              text.includes("فحص") ||
              text.includes("cloud") ||
              text.includes("health") ||
              text.includes("السحابي");

            if (!looksLikeHealthAction) return;

            event.preventDefault();
            event.stopPropagation();
            navigate(`${tenantBase}/cloud-health12`);
          }}
        >
          <CloudStorageStatusPill collapsed={sidebarCollapsed} lang={lang} />
        </div>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {sidebarNavItems.map((item: any) => {
            if (item.isGovernorateReadonlyReturn) {
              return (
                <button
                  // DIPLOMA_RETURN_BUTTON_AFTER_DASHBOARD_NAV_ITEM
                  key={item.to}
                  type="button"
                  onClick={() => void handleSupportReturn()}
                  style={{
                    padding: sidebarCollapsed ? 14 : "12px 16px",
                    borderRadius: 14,
                    background: "linear-gradient(180deg, #fff7d6 0%, #d4af37 100%)",
                    border: "2px solid rgba(184,134,11,0.70)",
                    color: "#111111",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    justifyContent: sidebarCollapsed ? "center" : "flex-start",
                    textDecoration: "none",
                    fontWeight: 1000,
                    transition: "all 0.22s ease",
                    textAlign: isRTL ? "right" : "left",
                    cursor: "pointer",
                    boxShadow: "0 10px 20px rgba(150,120,20,0.16), inset 0 1px 0 rgba(255,255,255,0.72)",
                    width: "100%",
                  }}
                >
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            }

            const active = location.pathname.toLowerCase() === String(item.to).toLowerCase();
            return (
              <NavLink
                key={item.to}
                to={item.to}
                style={{
                  padding: sidebarCollapsed ? 14 : "12px 16px",
                  borderRadius: 14,
                  background: active ? "linear-gradient(180deg, #fca5a5 0%, #fef08a 100%)" : "linear-gradient(180deg, #bfdbfe 0%, #d8b4fe 100%)",
                  border: active ? "3px solid rgba(212,175,55,0.80)" : "2px solid rgba(212,175,55,0.28)",
                  color: "#111111",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  textDecoration: "none",
                  fontWeight: active ? 800 : 600,
                  transition: "all 0.22s ease",
                  textAlign: isRTL ? "right" : "left",
                  boxShadow: active ? "0 18px 32px rgba(150,120,20,0.26), 0 0 0 6px rgba(245,232,170,0.30) inset" : "0 10px 20px rgba(120,90,20,0.14)",
                }}
              >
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {canShowSupportReturn ? (
          <button
            className="layout12SupportReturnButton"
            onClick={() => void handleSupportReturn()}
            style={{
              padding: sidebarCollapsed ? 14 : "12px 16px",
              borderRadius: 14,
              background: "linear-gradient(180deg, #fef3c7 0%, #fde68a 100%)",
              border: "2px solid rgba(184,134,11,0.55)",
              color: "#111111",
              fontWeight: 1000,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              gap: 10,
              width: "100%",
            }}
          >
            <span style={{ fontSize: 20 }}>↩️</span>
            {!sidebarCollapsed && <span>{supportReturnLabel}</span>}
          </button>
        ) : null}

        <button
          onClick={() => setShowLogoutConfirm(true)}
          style={{
            padding: sidebarCollapsed ? 14 : "12px 16px",
            borderRadius: 14,
            background: "linear-gradient(180deg, #fecaca 0%, #fca5a5 100%)",
            border: "1px solid rgba(239,68,68,0.35)",
            color: "#7f1d1d",
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
        className="moe-official-main"
        style={{
          [oppositeMarginProp]: SIDEBAR_WIDTH,
          width: `calc(100% - ${SIDEBAR_WIDTH}px)`,
          transition: "all 280ms ease",
          minHeight: "100vh",
          background: DIPLOMA_EXAM_SUPERS_MATCH_BG,
          padding: window.innerWidth < 768 ? 16 : 28,
          boxSizing: "border-box",
        } as React.CSSProperties}
      >
        {governorateReadonlyReturnPath ? null : <SupportModeBar />}
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
                  background: "linear-gradient(180deg, #fecaca 0%, #fca5a5 100%)",
                  color: "#7f1d1d",
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