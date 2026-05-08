import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { db } from "../firebase/firebase";
import { tenantPath } from "../config/tenantRoutes";

type NavCard = {
  ar: string;
  en: string;
  route: string;
  icon: string;
  color: string;
};

const PAGE_BG = "#f7f3e7";
const CARD_BG = "linear-gradient(180deg, #f7f3e7 0%, #f3efdf 100%)";
const PANEL_BG = "linear-gradient(180deg, #faf7ee 0%, #f6f1e2 100%)";
const GOLD_BORDER = "#d4af37";

const EXAM_CENTER_DATA_KEY = "exam-manager:exam-center-data:v1";
const EXAM_CENTER_LOGO_KEY = "exam-manager:exam-center-logo:v1";
const APP_LOGO_KEY = "exam-manager:app-logo";
const CONTROL_HEAD_NAME_KEY = "exam-manager:control-head-name:v1";
const DEFAULT_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

type OfficialHeaderData = {
  centerName: string;
  governorate: string;
  semester: string;
  phone: string;
  address: string;
  controlHeadName: string;
  academicYear: string;
  logoUrl: string;
};

function readJsonSafe<T = any>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    if (text) return text;
  }
  return "";
}

function getAcademicYearFromSystemDate(now = new Date()) {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear} / ${startYear + 1}`;
}

function readOfficialHeaderData(lang: "ar" | "en"): OfficialHeaderData {
  const raw = readJsonSafe<any>(EXAM_CENTER_DATA_KEY) || {};
  const logoUrl = firstText(localStorage.getItem(EXAM_CENTER_LOGO_KEY), localStorage.getItem(APP_LOGO_KEY), raw.logoUrl, raw.logo, DEFAULT_LOGO_URL);
  const centerName = firstText(raw.name, raw.centerName, raw.examCenterName, raw.schoolName, lang === "ar" ? "مركز الامتحانات" : "Exam Center");
  const governorate = firstText(raw.governorate, raw.directorate, raw.region, lang === "ar" ? "المديرية العامة للتعليم" : "Directorate General of Education");
  const semester = firstText(raw.semester, raw.term, raw.studyTerm, lang === "ar" ? "الفصل الدراسي" : "Semester");
  const phone = firstText(raw.phone, raw.phoneNumber, raw.mobile, "—");
  const address = firstText(raw.address, raw.location, "—");
  const controlHeadName = firstText(raw.controlHeadName, raw.controlHead, raw.centerHead, localStorage.getItem(CONTROL_HEAD_NAME_KEY), "—");
  const academicYear = firstText(raw.academicYear, raw.schoolYear, raw.studyYear, getAcademicYearFromSystemDate());

  return {
    centerName,
    governorate,
    semester,
    phone,
    address,
    controlHeadName,
    academicYear,
    logoUrl,
  };
}

function getStoredExamSuperEmail() {
  try {
    return String(
      sessionStorage.getItem("effectiveExamSuperEmail") ||
      sessionStorage.getItem("examSuperEmail") ||
      sessionStorage.getItem("selectedExamSuperEmail") ||
      sessionStorage.getItem("viewAsEmail") ||
      localStorage.getItem("effectiveExamSuperEmail") ||
      localStorage.getItem("examSuperEmail") ||
      localStorage.getItem("selectedExamSuperEmail") ||
      localStorage.getItem("viewAsEmail") ||
      ""
    ).trim().toLowerCase();
  } catch {
    return "";
  }
}

function getStoredRole() {
  try {
    return String(
      sessionStorage.getItem("effectiveRole") ||
      sessionStorage.getItem("role") ||
      sessionStorage.getItem("selectedRole") ||
      sessionStorage.getItem("viewAsRole") ||
      localStorage.getItem("effectiveRole") ||
      localStorage.getItem("role") ||
      localStorage.getItem("selectedRole") ||
      localStorage.getItem("viewAsRole") ||
      ""
    ).trim().toLowerCase();
  } catch {
    return "";
  }
}
function normalizeRoleText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    if (text) return text;
  }
  return "";
}

function isPlatformOwnerLike(auth: any, profile: any, appUser: any, allowDoc: any) {
  const role = normalizeRoleText(
    allowDoc?.role,
    profile?.role,
    profile?.systemRole,
    profile?.accountRole,
    auth?.role,
    auth?.effectiveRole,
    getStoredRole()
  );

  const values = [role, profile?.roleAr, profile?.title, profile?.accountType, allowDoc?.roleAr]
    .map((v) => String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase())
    .filter(Boolean);

  return (
    Boolean(
      auth?.isPlatformOwner ||
        auth?.isOwner ||
        profile?.isPlatformOwner ||
        profile?.platformOwner ||
        profile?.isOwner ||
        appUser?.isPlatformOwner ||
        appUser?.platformOwner ||
        allowDoc?.isPlatformOwner ||
        allowDoc?.platformOwner
    ) ||
    values.some((v) =>
      [
        "platform_owner",
        "platform owner",
        "owner",
        "super_admin",
        "superadmin",
        "مالك_المنصة",
        "مالك المنصة",
        "مالك المنصه",
      ].includes(v)
    )
  );
}

function isTruthyEnabled(docLike: any) {
  if (!docLike) return true;
  return docLike.enabled !== false && docLike.disabled !== true && docLike.active !== false;
}

const navCards: NavCard[] = [
  { ar: "بيانات مركز الامتحانات", en: "Exam Center Data", route: "/settings12", icon: "🏫", color: "#93c5fd" },
  { ar: "إدارة الكادر التعليمي", en: "Teachers Management", route: "/teachers12", icon: "👨‍🏫", color: "#86efac" },
  { ar: "مركز إدارة القاعات", en: "Rooms Center", route: "/rooms12", icon: "🏛️", color: "#fca5a5" },
  { ar: "مركز إدارة الامتحانات", en: "Exams Center", route: "/exams12", icon: "📝", color: "#c4b5fd" },
  { ar: "غياب الكادر التعليمي", en: "Teacher Unavailability", route: "/unavailability12", icon: "⏰", color: "#fdba74" },
  { ar: "منصة تشغيل توزيع المهام", en: "Task Distribution Runner", route: "/task-distribution-run12", icon: "🔄", color: "#67e8f9" },
  { ar: "الجدول الشامل", en: "Master Distribution Table", route: "/task-distribution-results12", icon: "📋", color: "#f9a8d4" },
  { ar: "مركز رقابة التوزيع", en: "Distribution Control Center", route: "/setting12", icon: "⚙️", color: "#a5b4fc" },
  { ar: "بوابة التقارير الرسمية للتوزيع", en: "Official Distribution Reports", route: "/task-distribution-print12", icon: "🖨️", color: "#fcd34d" },
  { ar: "لوحة التحليل", en: "Analytics Dashboard", route: "/analytics12", icon: "📊", color: "#6ee7b7" },
  { ar: "حصر الحضور والغياب", en: "Attendance Register", route: "/attendance12", icon: "✅", color: "#bbf7d0" },
  { ar: "ملفات الكنترول", en: "Control Files", route: "/control12", icon: "📁", color: "#fda4af" },
  { ar: "تطوير البرنامج", en: "Program Suggestions", route: "/suggestions12page", icon: "💡", color: "#7dd3fc" },
  { ar: "مصمم البرنامج", en: "About the Designer", route: "/about12", icon: "🛠️", color: "#d8b4fe" },
];

export default function Dashboard12() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const { effectiveTenantId, userProfile, user, allow } = auth;
  const { lang, isRTL } = useI18n();

  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const { tenantId: routeTenantId } = useParams();
  const tenantId = String(routeTenantId || effectiveTenantId || "").trim();

  const currentEmail = String(user?.email || userProfile?.email || "").trim().toLowerCase();
  const [guardLoading, setGuardLoading] = useState(true);
  const [allowDoc, setAllowDoc] = useState<any>(allow || null);
  const [officialInfo, setOfficialInfo] = useState<OfficialHeaderData>(() => readOfficialHeaderData(lang));

  useEffect(() => {
    if (!currentEmail) {
      setAllowDoc(null);
      setGuardLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, "allowlist", currentEmail),
      (snap) => {
        setAllowDoc(snap.exists() ? { email: currentEmail, ...(snap.data() as any) } : null);
        setGuardLoading(false);
      },
      () => {
        setAllowDoc(null);
        setGuardLoading(false);
      }
    );

    return () => unsub();
  }, [currentEmail]);

  useEffect(() => {
    const refreshOfficialInfo = () => setOfficialInfo(readOfficialHeaderData(lang));
    refreshOfficialInfo();
    window.addEventListener("storage", refreshOfficialInfo);
    window.addEventListener("exam-manager:changed", refreshOfficialInfo);
    window.addEventListener("exam-manager:control-head-changed", refreshOfficialInfo);
    return () => {
      window.removeEventListener("storage", refreshOfficialInfo);
      window.removeEventListener("exam-manager:changed", refreshOfficialInfo);
      window.removeEventListener("exam-manager:control-head-changed", refreshOfficialInfo);
    };
  }, [lang]);

  const accessState = useMemo(() => {
    const profile = userProfile || {};
    const role = normalizeRoleText(
      allowDoc?.role,
      profile?.role,
      profile?.systemRole,
      profile?.accountRole,
      auth?.role,
      auth?.effectiveRole,
      getStoredRole()
    );

    const linkedTenantId = firstText(
      allowDoc?.tenantId,
      allowDoc?.effectiveTenantId,
      profile?.tenantId,
      profile?.effectiveTenantId,
      sessionStorage.getItem("effectiveTenantId"),
      sessionStorage.getItem("selectedTenantId"),
      localStorage.getItem("effectiveTenantId"),
      localStorage.getItem("selectedTenantId")
    );

    const enabled = isTruthyEnabled(allowDoc || profile);

    const isOwner = isPlatformOwnerLike(auth, profile, user, allowDoc);
    const isExamSuper =
      enabled &&
      ["exam_super", "exam_center_admin", "diploma_center_admin", "center_admin"].includes(role) &&
      (!linkedTenantId || !tenantId || linkedTenantId === tenantId);
    const isGovernorateSuper =
      enabled &&
      ["super", "governorate_super", "ministry_super", "governorate_admin"].includes(role);

    return {
      role,
      linkedTenantId,
      isOwner,
      isExamSuper,
      isGovernorateSuper,
      allowed: isOwner || isExamSuper || isGovernorateSuper,
    };
  }, [allowDoc, tenantId, userProfile, user, auth]);

  if (!user) return <Navigate to="/login" replace />;
  if (guardLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: PAGE_BG, color: "#000000", fontWeight: 900, fontSize: 22 }}>
        {lang === "ar" ? "جاري التحقق من صلاحيات الدخول..." : "Checking access permissions..."}
      </div>
    );
  }
  if (!accessState.allowed) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: PAGE_BG, padding: 24 }}>
        <div style={{ maxWidth: 760, width: "100%", background: CARD_BG, border: `5px solid ${GOLD_BORDER}`, borderRadius: 28, padding: 28, color: "#000000", boxShadow: "0 0 0 6px rgba(245,232,170,0.35) inset, 0 14px 28px rgba(190,160,40,0.12)" }}>
          <div style={{ fontSize: 34, fontWeight: 900, marginBottom: 12 }}>
            {lang === "ar" ? "غير مصرح بالدخول" : "Access denied"}
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.9, marginBottom: 18 }}>
            {lang === "ar"
              ? "هذه الصفحة مخصصة لسوبر الامتحانات أو سوبر المحافظة داخل النطاق أو مالك المنصة."
              : "This page is restricted to exam_super, in-scope governorate super, or the platform owner."}
          </div>
          <button
            onClick={() => navigate(tenantId ? tenantPath(tenantId, "/") : "/")}
            style={{
              background: "linear-gradient(180deg, #bfdbfe 0%, #93c5fd 100%)",
              color: "#000000",
              border: `3px solid ${GOLD_BORDER}`,
              borderRadius: 16,
              padding: "12px 18px",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 10px 22px rgba(212,175,55,0.18), 0 0 0 2px rgba(255,235,140,0.35) inset",
            }}
          >
            {lang === "ar" ? "العودة" : "Back"}
          </button>
        </div>
      </div>
    );
  }


  const go = (path: string) => {
    const p = String(path || "").trim();
    if (!p) return;
    if (!tenantId) {
      navigate("/");
      return;
    }
    navigate(tenantPath(tenantId, p));
  };

  const displayName =
    (userProfile?.displayName || "").trim() ||
    (userProfile?.email ? String(userProfile.email).split("@")[0] : "") ||
    tr("مستخدم", "User");

  return (
    <>
      <style>{`
        html,
        body,
        #root {
          margin: 0 !important;
          min-height: 100% !important;
          background: ${PAGE_BG} !important;
        }

        body {
          background-color: ${PAGE_BG} !important;
        }

        .dashboard12Page {
          direction: ${isRTL ? "rtl" : "ltr"};
          position: relative;
          min-height: 100vh;
          color: #000000;
          padding: 28px;
          box-sizing: border-box;
          overflow-x: hidden;
        }

        .dashboard12FixedBg {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            radial-gradient(1200px 520px at 50% -10%, rgba(212, 175, 55, 0.18), transparent 62%),
            linear-gradient(180deg, #fffdf7 0%, #f7f3e7 48%, #fffaf0 100%) !important;
        }

        .dashboard12Content {
          position: relative;
          z-index: 1;
          max-width: 1680px;
          margin: 0 auto;
          display: grid;
          gap: 24px;
        }

        .dashboard12OfficialGrid {
          display: grid;
          grid-template-columns: 1fr 150px 1fr;
          gap: 22px;
          align-items: center;
        }

        .dashboard12OfficialMeta {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .dashboard12HeroGrid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 18px;
          align-items: center;
        }

        .dashboard12HeroTitle {
          font-size: 54px;
          font-weight: 900;
          line-height: 1.15;
        }

        @media (max-width: 1100px) {
          .dashboard12HeroGrid,
          .dashboard12OfficialGrid {
            grid-template-columns: 1fr;
          }

          .dashboard12OfficialMeta {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 992px) {
          .dashboard12Page {
            padding: 16px;
          }

          .dashboard12HeroTitle {
            font-size: 34px;
          }

          .dashboard12OfficialMeta {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="dashboard12Page">
        <div className="dashboard12FixedBg" />
        <div className="dashboard12Content">
        <OfficialDashboardHeader data={officialInfo} lang={lang} />
        <section
          style={{
            background: CARD_BG,
            border: `5px solid ${GOLD_BORDER}`,
            borderRadius: 30,
            padding: 24,
            boxShadow: "0 0 0 6px rgba(245,232,170,0.35) inset, 0 14px 28px rgba(190,160,40,0.12)",
          }}
        >
          <div className="dashboard12HeroGrid">
            <div style={{ display: "grid", gap: 10 }}>
              <div
                style={{
                  display: "inline-flex",
                  width: "fit-content",
                  padding: "10px 16px",
                  borderRadius: 999,
                  background: "linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%)",
                  border: "3px solid #d4af37",
                  boxShadow: "0 8px 18px rgba(212,175,55,0.15)",
                  fontWeight: 900,
                  color: "#000000",
                }}
              >
                {tr("واجهة تشغيل مخصصة", "Dedicated operation console")}
              </div>

              <div className="dashboard12HeroTitle">
                {tr("مركز امتحان دبلوم التعليم العام وما في مستواه", "General Education Diploma Examination Center")}
              </div>

              <div style={{ fontSize: 20, fontWeight: 900 }}>
                {tr("لوحة تحكم مركز الامتحانات", "Examination Center Dashboard")}
              </div>

              <div style={{ fontSize: 18, lineHeight: 1.9, fontWeight: 900 }}>
                {tr(
                  "هذه الصفحة تجمع كل وحدات مركز الامتحانات في واجهة واحدة، مع انتقال مباشر لكل صفحة مستقلة بنفس نمط النظام.",
                  "This page gathers all examination center modules in one place with direct navigation to every standalone page."
                )}
              </div>
            </div>

            <div
              style={{
                background: PANEL_BG,
                border: `3px solid ${GOLD_BORDER}`,
                borderRadius: 26,
                padding: 20,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75), 0 8px 18px rgba(190,160,40,0.10)",
                display: "grid",
                gap: 12,
              }}
            >
              <InfoRow label={tr("مركز الامتحانات", "Exam center")} value={officialInfo.centerName} />
              <InfoRow label={tr("المستخدم الحالي", "Current user")} value={displayName} />
              <InfoRow label={tr("لغة الواجهة", "Interface language")} value={lang === "ar" ? "العربية" : "English"} />
              <InfoRow
                label={tr("حالة الجهة", "Tenant status")}
                value={tenantId ? tr("مرتبطة", "Connected") : tr("غير مرتبطة", "Not connected")}
              />
            </div>
          </div>
        </section>

        <section
          style={{
            background: CARD_BG,
            border: `5px solid ${GOLD_BORDER}`,
            borderRadius: 30,
            padding: 24,
            boxShadow: "0 0 0 6px rgba(245,232,170,0.35) inset, 0 14px 28px rgba(190,160,40,0.12)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 18,
            }}
          >
            <div style={{ fontSize: 34, fontWeight: 900 }}>
              {tr("الوصول السريع", "Quick access")}
            </div>

            {accessState.isOwner || accessState.isGovernorateSuper ? (
              <button
                onClick={() =>
                  navigate(accessState.isGovernorateSuper ? "/governorate-supers" : "/programs-gateway")
                }
                style={{
                  background: "linear-gradient(180deg, #e9d5ff 0%, #d8b4fe 100%)",
                  color: "#000000",
                  border: `3px solid ${GOLD_BORDER}`,
                  borderRadius: 16,
                  padding: "12px 18px",
                  fontWeight: 900,
                  cursor: "pointer",
                  boxShadow: "0 10px 22px rgba(212,175,55,0.18), 0 0 0 2px rgba(255,235,140,0.35) inset",
                }}
              >
                {accessState.isGovernorateSuper
                  ? tr("العودة إلى صفحة مشرفي الامتحانات", "Back to Governorate Exam Supervisors")
                  : tr("العودة إلى البوابة التشغيلية", "Back to Programs Gateway")}
              </button>
            ) : null}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
              gap: 20,
            }}
          >
            {navCards.map((card, index) => (
              <InteractiveNavCard
                key={card.route}
                card={card}
                index={index}
                isRTL={isRTL}
                lang={lang}
                onClick={() => go(card.route)}
              />
            ))}
          </div>
        </section>
        </div>
      </div>
    </>
  );
}


function OfficialDashboardHeader({ data, lang }: { data: OfficialHeaderData; lang: "ar" | "en" }) {
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  return (
    <section
      style={{
        background: "linear-gradient(180deg, #fffdf7 0%, #f7f3e7 100%)",
        border: `5px solid ${GOLD_BORDER}`,
        borderRadius: 30,
        padding: 22,
        boxShadow: "0 0 0 6px rgba(245,232,170,0.35) inset, 0 14px 28px rgba(190,160,40,0.12)",
      }}
    >
      <div className="dashboard12OfficialGrid">
        <div style={{ display: "grid", gap: 7, textAlign: "right" }}>
          <div style={officialLineMainStyle}>{tr("سلطنة عمان", "Sultanate of Oman")}</div>
          <div style={officialLineMainStyle}>{tr("وزارة التعليم", "Ministry of Education")}</div>
          <div style={officialLineSubStyle}>{data.governorate}</div>
          <div style={officialLineSubStyle}>{data.centerName}</div>
        </div>

        <div style={{ display: "grid", placeItems: "center" }}>
          <div style={officialLogoBoxStyle}>
            <img
              src={data.logoUrl || DEFAULT_LOGO_URL}
              alt="logo"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = DEFAULT_LOGO_URL;
              }}
            />
          </div>
        </div>

        <div style={{ display: "grid", gap: 7, textAlign: "left" }}>
          <div style={officialTitleStyle}>{tr("لوحة التحكم الرسمية", "Official Dashboard")}</div>
          <div style={officialLineSubStyle}>{tr("مركز امتحان دبلوم التعليم العام وما في مستواه", "General Education Diploma Exam Center")}</div>
          <div style={officialLineSubStyle}>{data.semester}</div>
          <div style={officialLineSubStyle}>{tr("العام الدراسي", "Academic Year")}: {data.academicYear}</div>
        </div>
      </div>

      <div style={{ height: 3, background: "linear-gradient(90deg, transparent, #111827, transparent)", margin: "18px 0 14px" }} />

      <div className="dashboard12OfficialMeta">
        <OfficialMetaBox label={tr("رئيس المركز", "Center Head")} value={data.controlHeadName} />
        <OfficialMetaBox label={tr("الهاتف", "Phone")} value={data.phone} />
        <OfficialMetaBox label={tr("العنوان", "Address")} value={data.address} />
        <OfficialMetaBox label={tr("حالة اللوحة", "Dashboard Status")} value={tr("رسمية ومعتمدة", "Official and active")} />
      </div>
    </section>
  );
}

function OfficialMetaBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: `2px solid ${GOLD_BORDER}`,
        borderRadius: 18,
        background: PANEL_BG,
        padding: "12px 14px",
        display: "grid",
        gap: 5,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75), 0 8px 18px rgba(190,160,40,0.10)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 900, color: "#000000" }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 900, color: "#000000", lineHeight: 1.55 }}>{value || "—"}</div>
    </div>
  );
}

const officialLineMainStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: "#000000",
  lineHeight: 1.3,
};

const officialLineSubStyle: React.CSSProperties = {
  fontSize: 19,
  fontWeight: 900,
  color: "#000000",
  lineHeight: 1.45,
};

const officialTitleStyle: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  color: "#000000",
  lineHeight: 1.25,
};

const officialLogoBoxStyle: React.CSSProperties = {
  width: 120,
  height: 120,
  borderRadius: 24,
  padding: 12,
  background: "linear-gradient(180deg, #ffffff 0%, #fff7d6 100%)",
  border: `4px solid ${GOLD_BORDER}`,
  boxShadow: "0 14px 28px rgba(180,140,20,0.18), inset 0 1px 0 rgba(255,255,255,0.88)",
};

function InteractiveNavCard({
  card,
  index,
  isRTL,
  lang,
  onClick,
}: {
  card: NavCard;
  index: number;
  isRTL: boolean;
  lang: "ar" | "en";
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        textAlign: isRTL ? "right" : "left",
        background: PANEL_BG,
        border: `3px solid ${GOLD_BORDER}`,
        borderRadius: 28,
        padding: 24,
        cursor: "pointer",
        boxShadow: hovered
          ? "0 22px 40px rgba(212,175,55,0.28), 0 0 0 4px rgba(255,235,140,0.40) inset"
          : "0 14px 30px rgba(212,175,55,0.22), 0 0 0 3px rgba(255,235,140,0.36) inset",
        display: "grid",
        gap: 14,
        minHeight: 210,
        position: "relative",
        overflow: "hidden",
        transform: hovered ? "translateY(-6px)" : "translateY(0)",
        transition: "all 180ms ease",
        outline: "none",
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        aria-label={lang === "ar" ? card.ar : card.en}
        style={{
          position: "absolute",
          insetInlineStart: isRTL ? "auto" : 16,
          insetInlineEnd: isRTL ? 16 : "auto",
          top: 16,
          width: 92,
          height: 92,
          borderRadius: 24,
          background: `linear-gradient(180deg, ${card.color} 0%, #ffffff 140%)`,
          border: `3px solid ${GOLD_BORDER}`,
          boxShadow: hovered
            ? "0 26px 42px rgba(0,0,0,0.24), 0 10px 0 rgba(180,140,20,0.34), inset 0 2px 0 rgba(255,255,255,0.88), inset 0 -12px 18px rgba(0,0,0,0.10)"
            : "0 18px 30px rgba(0,0,0,0.18), 0 8px 0 rgba(180,140,20,0.28), inset 0 2px 0 rgba(255,255,255,0.84), inset 0 -10px 16px rgba(0,0,0,0.08)",
          display: "grid",
          placeItems: "center",
          fontSize: 44,
          transform: hovered ? "translateY(-6px) scale(1.14) rotate(-6deg)" : "translateY(0) scale(1) rotate(0deg)",
          transition: "all 180ms ease",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <span
          style={{
            filter: hovered ? "drop-shadow(0 6px 8px rgba(0,0,0,0.22))" : "drop-shadow(0 4px 6px rgba(0,0,0,0.16))",
            transform: hovered ? "translateY(-1px)" : "translateY(0)",
            transition: "all 180ms ease",
            lineHeight: 1,
          }}
        >
          {card.icon}
        </span>
      </button>

      <div
        style={{
          position: "absolute",
          insetInlineStart: isRTL ? 24 : "auto",
          insetInlineEnd: isRTL ? "auto" : 24,
          top: 32,
          fontSize: 92,
          fontWeight: 900,
          color: hovered ? "rgba(212,175,55,0.22)" : "rgba(212,175,55,0.14)",
          pointerEvents: "none",
          lineHeight: 1,
          transition: "all 180ms ease",
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </div>

      <div style={{ minHeight: 44 }} />

      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: "#000000",
          lineHeight: 1.45,
          transform: hovered ? "translateX(-2px)" : "translateX(0)",
          transition: "all 180ms ease",
        }}
      >
        {lang === "ar" ? card.ar : card.en}
      </div>

      <div style={{ minHeight: 6 }} />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        padding: "14px 16px",
        borderRadius: 18,
        background: "linear-gradient(180deg, #faf7ee 0%, #f6f1e2 100%)",
        border: "2px solid #d4af37",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75), 0 8px 18px rgba(190,160,40,0.10)",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 900, color: "#000000" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#000000" }}>{value}</div>
    </div>
  );
}
