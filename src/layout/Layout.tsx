import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth as firebaseAuth, db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import { buildAuthzSnapshot, canAccessCapability, resolvePrimaryRoleLabel } from "../features/authz";
import { resolveActualAdministrativeActor } from "../features/tenant-return/tenantReturnSecurity";
import SupportModeBar from "../components/SupportModeBar";
import { useI18n } from "../i18n/I18nProvider";
import CloudStorageStatusPill from "../features/cloud-storage/CloudStorageStatusPill";
import "../styles/officialUnifiedTheme.css";
import LOGO_LOCAL from "../assets/branding/ministry-logo.png";
const APP_LOGO_URL = LOGO_LOCAL;
const GOLD_DARK = "#d4af37";
const GOLD_GLOW = "rgba(212, 175, 55, 0.45)";
const SIDEBAR_NAV_BG = "linear-gradient(180deg, #081225 0%, #091426 100%)";
const SIDEBAR_GOLD_SOFT = "rgba(212, 175, 55, 0.22)";


type OfficialIdentity = {
  organizationName: string;
  governorate: string;
  semester: string;
  academicYear: string;
  logo: string;
  tenantId?: string;
};

const SCHOOL_DATA_KEY = "exam-manager:school-data:v1";
const SCHOOL_LOGO_KEY = "exam-manager:app-logo";

function readGovernorateReadOnlyStorageValue(keys: string[]): string {
  if (typeof window === "undefined") return "";

  for (const key of keys) {
    try {
      const sessionValue = window.sessionStorage.getItem(key);
      if (sessionValue) return String(sessionValue).trim();
    } catch {}

    try {
      const localValue = window.localStorage.getItem(key);
      if (localValue) return String(localValue).trim();
    } catch {}
  }

  return "";
}

function isGovernorateReadOnlySessionActive(): boolean {
  if (typeof window === "undefined") return false;

  const expiresAt = Number(readGovernorateReadOnlyStorageValue(["governorateSuperViewExpiresAt"]) || 0);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  const hasReadOnlyFlag = [
    readGovernorateReadOnlyStorageValue(["governorateSuperReadOnly"]),
    readGovernorateReadOnlyStorageValue(["viewAsReadOnly"]),
    readGovernorateReadOnlyStorageValue(["readOnly"]),
    readGovernorateReadOnlyStorageValue(["isReadOnlyView"]),
  ].some((value) => ["1", "true", "yes"].includes(String(value || "").toLowerCase()));

  const hasTargetTenant = Boolean(
    readGovernorateReadOnlyStorageValue([
      "governorateSuperViewTenantId",
      "viewAsTenantId",
      "effectiveTenantId",
      "selectedTenantId",
      "tenantId",
    ])
  );

  return hasReadOnlyFlag && hasTargetTenant;
}

function clearGovernorateReadOnlySession(): void {
  if (typeof window === "undefined") return;

  const keys = [
    "governorateSuperReadOnly",
    "viewAsReadOnly",
    "readOnly",
    "isReadOnlyView",
    "openedByGovernorateSuper",
    "governorateSuperViewTenantId",
    "viewAsTenantId",
    "governorateSuperViewExpiresAt",
    "governorateSuperReturnTo",
    "readOnlyReturnTo",
    "governorateSuperViewGovernorate",
  ];

  for (const key of keys) {
    try { window.sessionStorage.removeItem(key); } catch {}
    try { window.localStorage.removeItem(key); } catch {}
  }
}

function safeParseJson(raw: string | null): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function pickText(...values: any[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function getAcademicYearFromSystemDate(now = new Date()) {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const startYear = month >= 9 ? year : year - 1;
  const endYear = startYear + 1;
  return `${startYear} - ${endYear}`;
}

function readLocalSchoolIdentity(currentTenantId = ""): OfficialIdentity {
  if (typeof window === "undefined") {
    return {
      organizationName: "",
      governorate: "",
      semester: "",
      academicYear: getAcademicYearFromSystemDate(),
      logo: APP_LOGO_URL,
      tenantId: "",
    };
  }

  const schoolData = safeParseJson(window.localStorage.getItem(SCHOOL_DATA_KEY)) || {};
  const storedTenantId = pickText(
    schoolData.tenantId,
    schoolData.effectiveTenantId,
    schoolData.selectedTenantId
  );
  const expectedTenantId = String(currentTenantId || "").trim();

  // TENANT_IDENTITY_ISOLATION:
  // Legacy school-data is a single browser key and may contain identity from another tenant.
  // When rendering a tenant route, accept it only if it is explicitly scoped to that tenant.
  const canUseLocalIdentity =
    !expectedTenantId ||
    (storedTenantId && storedTenantId === expectedTenantId);

  const logo = pickText(
    window.localStorage.getItem(SCHOOL_LOGO_KEY),
    canUseLocalIdentity ? schoolData.logo : "",
    canUseLocalIdentity ? schoolData.logoUrl : "",
    APP_LOGO_URL
  );

  return {
    organizationName: canUseLocalIdentity
      ? pickText(schoolData.name, schoolData.schoolName, schoolData.schoolNameAr, schoolData.tenantName)
      : "",
    governorate: canUseLocalIdentity
      ? pickText(schoolData.governorate, schoolData.directorate, schoolData.directorateName, schoolData.scope)
      : "",
    semester: canUseLocalIdentity
      ? pickText(schoolData.semester, schoolData.term, schoolData.currentSemester)
      : "",
    academicYear: canUseLocalIdentity
      ? pickText(schoolData.academicYear, schoolData.schoolYear, getAcademicYearFromSystemDate())
      : getAcademicYearFromSystemDate(),
    logo,
    tenantId: storedTenantId,
  };
}

function resolveOfficialIdentity(rootData: any, configData: any, authState: any, currentTenantId = ""): OfficialIdentity {
  const local = readLocalSchoolIdentity(currentTenantId);
  const allow = authState?.allow || {};
  const profile = authState?.profile || authState?.userProfile || {};

  return {
    // Settings1 values remain first only when scoped to the current tenant.
    // Unscoped/stale local identity is ignored so one tenant cannot display another tenant's school header.
    organizationName: pickText(
      local.organizationName,
      configData?.schoolName,
      configData?.schoolNameAr,
      configData?.name,
      configData?.tenantName,
      rootData?.schoolName,
      rootData?.schoolNameAr,
      rootData?.name,
      rootData?.tenantName,
      allow?.schoolName,
      allow?.tenantName,
      profile?.schoolName,
      profile?.tenantName
    ),
    governorate: pickText(
      local.governorate,
      configData?.governorate,
      configData?.directorate,
      configData?.directorateName,
      configData?.scope,
      rootData?.governorate,
      rootData?.directorate,
      rootData?.directorateName,
      rootData?.scope,
      allow?.governorate,
      allow?.scope,
      profile?.governorate,
      profile?.scope
    ),
    semester: pickText(local.semester, configData?.semester, configData?.term, rootData?.semester, rootData?.term),
    academicYear: pickText(
      local.academicYear,
      configData?.academicYear,
      configData?.schoolYear,
      rootData?.academicYear,
      rootData?.schoolYear,
      getAcademicYearFromSystemDate()
    ),
    logo: pickText(local.logo, configData?.logo, configData?.logoUrl, rootData?.logo, rootData?.logoUrl, APP_LOGO_URL),
    tenantId: local.tenantId || String(currentTenantId || "").trim(),
  };
}

function OfficialMinistryHeader({
  pageTitle,
  identity,
  lang,
  readOnlyBanner,
}: {
  pageTitle: string;
  identity: OfficialIdentity;
  lang: "ar" | "en";
  readOnlyBanner?: React.ReactNode;
}) {
  const isArabic = lang === "ar";
  const title = String(pageTitle || "").trim();
  const organizationName = String(identity?.organizationName || "").trim();
  const governorate = String(identity?.governorate || "").trim();
  const semester = String(identity?.semester || "").trim();
  const academicYear = String(identity?.academicYear || getAcademicYearFromSystemDate()).trim();
  const logo = String(identity?.logo || APP_LOGO_URL).trim();

  return (
    <header className="moe-school-letterhead" aria-label={isArabic ? "الترويسة الرسمية" : "Official header"}>
      <div className="moe-school-letterhead__grid">
        <div className="moe-school-letterhead__side moe-school-letterhead__right">
          <div className="moe-school-letterhead__country">{isArabic ? "سلطنة عمان" : "Sultanate of Oman"}</div>
          <div className="moe-school-letterhead__ministry">{isArabic ? "وزارة التعليم" : "Ministry of Education"}</div>
          <div className="moe-school-letterhead__directorate">
            {governorate || (isArabic ? "المحافظة / المديرية" : "Governorate / Directorate")}
          </div>
          {organizationName ? <div className="moe-school-letterhead__school">{organizationName}</div> : null}
        </div>

        <div className="moe-school-letterhead__logoWrap">
          <img
            src={logo || APP_LOGO_URL}
            alt={isArabic ? "شعار وزارة التعليم" : "Ministry logo"}
            className="moe-school-letterhead__logo"
            onError={(event) => {
              const img = event.currentTarget as HTMLImageElement;
              if (img.src !== APP_LOGO_URL) img.src = APP_LOGO_URL;
            }}
          />
        </div>

        <div className="moe-school-letterhead__side moe-school-letterhead__left">
          <div className="moe-school-letterhead__title">{title || (isArabic ? "نظام إدارة الامتحانات" : "Exam Management System")}</div>
          {semester ? <div className="moe-school-letterhead__meta">{semester}</div> : null}
          <div className="moe-school-letterhead__meta">
            {isArabic ? "العام الدراسي" : "Academic Year"}: {academicYear}
          </div>
        </div>
      </div>

      <div className="moe-school-letterhead__rule" />

      <div className="moe-school-letterhead__summary">
        <div>
          <span>{isArabic ? "اسم المدرسة" : "School"}: </span>
          <strong>{organizationName || (isArabic ? "غير محدد" : "Not set")}</strong>
        </div>
        <div>
          <span>{isArabic ? "المحافظة" : "Governorate"}: </span>
          <strong>{governorate || (isArabic ? "غير محددة" : "Not set")}</strong>
        </div>
        <div>
          <span>{isArabic ? "الفصل" : "Semester"}: </span>
          <strong>{semester || (isArabic ? "غير محدد" : "Not set")}</strong>
        </div>
      </div>
      {readOnlyBanner ? (
        <div
          data-readonly-inside-official-header-card="true"
          style={{
            marginTop: 18,
            borderRadius: 20,
            border: "2px solid rgba(212,175,55,0.85)",
            background: "linear-gradient(135deg, rgba(255,251,235,0.98) 0%, rgba(254,243,199,0.94) 52%, rgba(255,247,237,0.98) 100%)",
            boxShadow: "0 14px 32px rgba(120, 53, 15, 0.12), inset 0 1px 0 rgba(255,255,255,0.65)",
            padding: "12px 16px",
          }}
        >
          {readOnlyBanner}
        </div>
      ) : null}

    </header>
  );
}

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

  const actualAdministrativeActor =
    resolveActualAdministrativeActor(authState);

  const readOnlyReturnPath = useMemo(() => {
    if (actualAdministrativeActor !== "governorate_super") return "";
    if (authState?.isSupportMode) return "";
    if (!isGovernorateReadOnlySessionActive()) return "";

    // SCHOOL_RETURN_CONTEXT_SECURITY:
    // A school tenant opened by a real governorate supervisor
    // always returns to the school-admin directory.
    // Stale stored paths such as /exam-supers are intentionally ignored.
    return "/school-admins";
  }, [
    actualAdministrativeActor,
    authState?.isSupportMode,
    location.pathname,
  ]);

  const supportReturnPath = authState?.isSupportMode
    ? actualAdministrativeActor === "platform_owner"
      ? "/school-admins"
      : actualAdministrativeActor === "governorate_super"
        ? "/super-system"
        : ""
    : readOnlyReturnPath;

  const isGovernorateReadOnlyReturn = Boolean(readOnlyReturnPath) && !authState?.isSupportMode;

  const supportReturnLabel = isGovernorateReadOnlyReturn
    ? tr("العودة إلى دليل مدراء المدارس", "Back to School Managers Directory")
    : actualAdministrativeActor === "platform_owner"
      ? tr("العودة إلى دليل مدراء المدارس", "Back to School Managers Directory")
      : tr("العودة إلى صفحة مشرف المحافظة", "Back to Governorate Supervisor Page");

  const canBackToProgramsGateway = Boolean(supportReturnPath);

  const handleSupportReturn = async () => {
    const target = supportReturnPath;
    if (!target) return;

    if (isGovernorateReadOnlyReturn) {
      clearGovernorateReadOnlySession();
      navigate(target, { replace: true });
      return;
    }

    try {
      await authState?.endSupport?.();
    } catch {}

    navigate(target, { replace: true });
  };

  const currentTenantId = String(
    authState?.effectiveTenantId ||
    authState?.allow?.tenantId ||
    authState?.profile?.tenantId ||
    authState?.userProfile?.tenantId ||
    ""
  ).trim();

  const [tenantType, setTenantType] = useState("");
  const [tenantTypeLoading, setTenantTypeLoading] = useState(true);
  const [officialIdentity, setOfficialIdentity] = useState<OfficialIdentity>(() => readLocalSchoolIdentity());

  const roleLabel =
    currentRole === "exam_super"
      ? translateRoleLabel("سوبر الامتحانات", lang)
      : translateRoleLabel(resolvePrimaryRoleLabel(authzSnapshot), lang);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadTenantIdentity() {
      const id = String(routeTenantId || "").trim();
      const localIdentity = readLocalSchoolIdentity(id);

      if (!id) {
        if (mounted) {
          setTenantType("");
          setOfficialIdentity(localIdentity);
          setTenantTypeLoading(false);
        }
        return;
      }

      try {
        const [rootResult, configResult] = await Promise.allSettled([
          getDoc(doc(db, "tenants", id)),
          getDoc(doc(db, "tenants", id, "meta", "config")),
        ]);

        const rootData = rootResult.status === "fulfilled" ? rootResult.value.data() || {} : {};
        const configData = configResult.status === "fulfilled" ? configResult.value.data() || {} : {};
        const rootType = String((rootData as any)?.type || "").trim();
        const configType = String((configData as any)?.type || "").trim();

        if (mounted) {
          setTenantType(rootType || configType);
          setOfficialIdentity(resolveOfficialIdentity(rootData, configData, authState, id));
          setTenantTypeLoading(false);
        }
      } catch {
        if (mounted) {
          setTenantType("");
          setOfficialIdentity(localIdentity);
          setTenantTypeLoading(false);
        }
      }
    }

    void loadTenantIdentity();

    return () => {
      mounted = false;
    };
  }, [routeTenantId]);

  useEffect(() => {
    const refreshLocalIdentity = () => {
      const id = String(routeTenantId || "").trim();
      const next = readLocalSchoolIdentity(id);

      setOfficialIdentity((previous) => {
        // TENANT_IDENTITY_ISOLATION:
        // On tenant routes, accept local school identity updates only when
        // the stored tenantId explicitly matches the current route tenant.
        if (id && next.tenantId !== id) {
          return previous;
        }

        return {
          organizationName: next.organizationName || previous.organizationName,
          governorate: next.governorate || previous.governorate,
          semester: next.semester || previous.semester,
          academicYear: next.academicYear || previous.academicYear || getAcademicYearFromSystemDate(),
          logo: next.logo || previous.logo || APP_LOGO_URL,
          tenantId: next.tenantId || previous.tenantId,
        };
      });
    };

    window.addEventListener("exam-manager:changed", refreshLocalIdentity);
    window.addEventListener("storage", refreshLocalIdentity);
    return () => {
      window.removeEventListener("exam-manager:changed", refreshLocalIdentity);
      window.removeEventListener("storage", refreshLocalIdentity);
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
      path.includes("/cloud-health12") ||
      path.includes("/cloud-backup12") ||
      path.includes("/suggestions12page") ||
      path.includes("/about12") ||
      path.includes("/candidate-violation-report12") ||
      path.includes("/candidate-written-warning12")
    );
  }, [location.pathname]);

  const schoolOfficialPageClass = useMemo(() => {
    const path = String(location.pathname || "").toLowerCase();
    if (isDiploma12Area) return "";
    if (path.endsWith("/teachers") || path.includes("/teachers/")) return "moe-school-page--teachers";
    if (path.endsWith("/exams") || path.includes("/exams/")) return "moe-school-page--exams";
    if (path.endsWith("/rooms") || path.includes("/rooms/")) return "moe-school-page--rooms";
    return "";
  }, [location.pathname, isDiploma12Area]);

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
      { to: tp("cloud-health12"), label: tr("فحص التخزين السحابي", "Cloud Health"), icon: "☁️" },
      { to: tp("cloud-backup12"), label: tr("النسخ الاحتياطي السحابي", "Cloud Backup"), icon: "🛡️", adminOnly: true },
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
    <div className="moe-official-app-shell moe-school-shell" style={{ direction: isRTL ? "rtl" : "ltr", display: "flex", minHeight: "100vh" }}>
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

        <CloudStorageStatusPill collapsed={sidebarCollapsed} lang={lang} />

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
                  background: active ? "linear-gradient(180deg, #fff1b8 0%, #eadb9f 100%)" : "rgba(255,253,247,0.82)",
                  border: active ? "2px solid rgba(184,134,11,0.70)" : "1.5px solid rgba(184,134,11,0.34)",
                  color: "#111111",
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

        {canBackToProgramsGateway && !isGovernorateReadOnlyReturn ? (
          <button
            onClick={() => void handleSupportReturn()}
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
            {!sidebarCollapsed && <span>{supportReturnLabel}</span>}
          </button>
        ) : null}

        <button
          onClick={() => setShowLogoutConfirm(true)}
          style={{
            padding: sidebarCollapsed ? 14 : "12px 16px",
            borderRadius: 14,
            background: "linear-gradient(180deg, #fee2e2 0%, #fecaca 100%)",
            border: "1px solid rgba(185,28,28,0.30)",
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
        className={`moe-official-main ${isDiploma12Area ? "moe-official-main--diploma" : "moe-official-main--school"} ${schoolOfficialPageClass}`}
        style={{
          [oppositeMarginProp]: SIDEBAR_WIDTH,
          width: `calc(100% - ${SIDEBAR_WIDTH}px)`,
          transition: "all 280ms ease",
          minHeight: "100vh",
          background: "linear-gradient(135deg, #fbf4df 0%, #f5ecd8 50%, #efe3c7 100%)",
          padding: window.innerWidth < 768 ? 16 : 28,
          boxSizing: "border-box",
        } as React.CSSProperties}
      >
<SupportModeBar />
        <OfficialMinistryHeader
          pageTitle={pageTitle || ""}
          identity={officialIdentity}
          lang={lang}
          readOnlyBanner={
            isGovernorateReadOnlyReturn ? (
              <div
                // READONLY_HEADER_BANNER_SCHOOL_ADMINS_RETURN
                dir={isRTL ? "rtl" : "ltr"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 14,
                  flexWrap: "wrap",
                  color: "#111827",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      display: "grid",
                      placeItems: "center",
                      background: "linear-gradient(180deg, #fef3c7 0%, #d4af37 100%)",
                      border: "1px solid rgba(146,64,14,0.25)",
                      boxShadow: "0 10px 22px rgba(146,64,14,0.16)",
                      flex: "0 0 auto",
                    }}
                  >
                    👁️
                  </div>

                  <div style={{ display: "grid", gap: 3 }}>
                    <div style={{ fontSize: 15, fontWeight: 1000, color: "#7c2d12" }}>
                      {tr("وضع مشاهدة فقط", "Read-only view")}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 850, color: "#374151", lineHeight: 1.7 }}>
                      {tr(
                        "مشرف المحافظة يستطيع متابعة بيانات المدرسة داخل نطاق محافظته بدون إضافة أو تعديل أو حذف.",
                        "The governorate supervisor can review this school within their governorate scope without adding, editing, or deleting."
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleSupportReturn()}
                  style={{
                    minHeight: 42,
                    padding: "0 16px",
                    borderRadius: 14,
                    border: "2px solid rgba(212,175,55,0.95)",
                    background: "linear-gradient(180deg, #fff7d6 0%, #d4af37 100%)",
                    color: "#3f2d07",
                    fontWeight: 1000,
                    cursor: "pointer",
                    boxShadow: "0 10px 20px rgba(150,120,20,0.16)",
                    whiteSpace: "nowrap",
                  }}
                >
                  ↩️ {tr("العودة إلى دليل مدراء المدارس", "Back to School Managers Directory")}
                </button>
              </div>
            ) : null
          }
        />
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

