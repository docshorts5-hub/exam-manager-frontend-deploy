import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import "./ProgramsGateway.model3.css";

const MINISTRY_LOGO_URL = "https://i.postimg.cc/j5G4NQvZ/sh%CA%BFar-1.png";

type ActionCard = {
  key: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  icon: string;
  onClick: () => void;
};

// SECURITY: keep tenant path sanitized before using it inside navigation paths.
const validateSafePath = (id: string | null | undefined): string => {
  if (!id) return "";
  return String(id).replace(/[^a-zA-Z0-9_-]/g, "");
};

export default function ProgramsGateway() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const role = String(
    auth?.effectiveRole || auth?.allow?.role || auth?.profile?.role || auth?.userProfile?.role || ""
  ).trim().toLowerCase();

  const tenantId = validateSafePath(
    auth?.effectiveTenantId || auth?.allow?.tenantId || auth?.profile?.tenantId || auth?.userProfile?.tenantId
  );

  const isOwner = role === "super_admin";
  const isGovernorateSuper = role === "super";
  const isExamSuper = role === "exam_super";
  const isSchoolAdmin = role === "tenant_admin" || role === "admin";

  const adminReturnPath = isOwner ? "/system" : isGovernorateSuper ? "/super-system" : "";
  const adminReturnLabel = isOwner
    ? tr("العودة إلى لوحة مالك المنصة", "Back to Platform Owner Panel")
    : tr("العودة إلى بوابة مشرف المحافظة", "Back to Governorate Supervisor Gateway");

  const cards = useMemo<ActionCard[]>(() => {
    const list: ActionCard[] = [];

    if (isOwner || isExamSuper) {
      list.push({
        key: "diploma",
        titleAr: "برنامج إدارة امتحانات الدبلوم العام",
        titleEn: "Diploma Exams Program",
        descAr: isOwner
          ? "فتح صفحة مشرفي امتحانات الدبلوم العام حسب المحافظة."
          : "الدخول إلى منظومة مراكز امتحانات الدبلوم العام.",
        descEn: isOwner
          ? "Open the exam supervisors page by governorate."
          : "Enter the General Education Diploma exam center system.",
        icon: "🎓",
        onClick: () => {
          if (isOwner) {
            navigate("/governorate-supers");
            return;
          }

          if (tenantId) navigate(`/t/${tenantId}/dashboard12`);
        },
      });
    }

    if (isOwner || isSchoolAdmin || isGovernorateSuper) {
      list.push({
        key: "school",
        titleAr: "إدارة امتحانات النقل",
        titleEn: "School Exams Program",
        descAr: isOwner || isGovernorateSuper
          ? "فتح دليل مدراء المدارس داخل نطاق الصلاحية."
          : "الدخول إلى منظومة المدرسة الخاصة بامتحانات النقل.",
        descEn: isOwner || isGovernorateSuper
          ? "Open the school managers directory within the allowed scope."
          : "Enter the school operating system.",
        icon: "🏫",
        onClick: () => {
          if (isOwner || isGovernorateSuper) {
            navigate("/school-admins");
            return;
          }

          if (tenantId) navigate(`/t/${tenantId}`);
        },
      });
    }

    if (isOwner || isGovernorateSuper) {
      list.push({
        key: "gov",
        titleAr: "مشرفو امتحانات الدبلوم العام",
        titleEn: "Diploma Exam Supervisors",
        descAr: "فتح صفحة مشرفي امتحانات الدبلوم العام حسب المحافظة.",
        descEn: "Open the diploma exam supervisors page by governorate.",
        icon: "🛡️",
        // DIPLOMA_EXAM_SUPERS_CARD_TO_EXAM_SUPERS
        onClick: () => navigate("/exam-supers"),
      });
    }

    return list;
  }, [isOwner, isExamSuper, isSchoolAdmin, isGovernorateSuper, tenantId, navigate]);

  return (
    <div
      className={`programs-gateway-model3 ${isRTL ? "programs-gateway-model3-rtl" : "programs-gateway-model3-ltr"}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="programs-gateway-model3-shell">
        <section className="programs-gateway-model3-hero">
          <div className="programs-gateway-model3-logoCard" aria-hidden="true">
            <img src={MINISTRY_LOGO_URL} alt={tr("شعار وزارة التعليم", "Ministry logo")} />
          </div>

          <div className="programs-gateway-model3-titleBlock">
            <div className="programs-gateway-model3-kicker">
              {tr("وزارة التعليم", "Ministry of Education")}
            </div>
            <h1>{tr("البوابة التشغيلية", "Operational Gateway")}</h1>
            <p>
              {tr(
                "اختر الوجهة المناسبة حسب صلاحيات حسابك، مع الحفاظ على نطاق المحافظة والمدرسة والمركز.",
                "Choose the operational destination based on your account permissions and scope."
              )}
            </p>
          </div>

          {adminReturnPath ? (
            <button
              type="button"
              className="programs-gateway-model3-returnButton"
              onClick={() => navigate(adminReturnPath)}
            >
              {adminReturnLabel}
            </button>
          ) : null}
        </section>

        <section className="programs-gateway-model3-board">
          <div className="programs-gateway-model3-boardHeader">
            <div>
              <div className="programs-gateway-model3-sectionLabel">
                {tr("الوجهات المتاحة", "Available Destinations")}
              </div>
              <h2>{tr("اختر الوجهة التشغيلية", "Choose Your Operational Destination")}</h2>
            </div>
            <span className="programs-gateway-model3-rolePill">
              {isOwner
                ? tr("مالك المنصة", "Platform Owner")
                : isGovernorateSuper
                  ? tr("مشرف محافظة", "Governorate Supervisor")
                  : isExamSuper
                    ? tr("مشرف امتحانات الدبلوم", "Diploma Exam Supervisor")
                    : isSchoolAdmin
                      ? tr("مدير مدرسة", "School Manager")
                      : tr("حساب مستخدم", "User Account")}
            </span>
          </div>

          {cards.length === 0 ? (
            <div className="programs-gateway-model3-empty">
              {tr("لا توجد وجهات متاحة لهذا الحساب.", "No destinations are available for this account.")}
            </div>
          ) : (
            <div className="programs-gateway-model3-grid">
              {cards.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  onClick={card.onClick}
                  className={`programs-gateway-model3-card programs-gateway-model3-card-${card.key}`}
                >
                  <span className="programs-gateway-model3-cardIcon">{card.icon}</span>
                  <span className="programs-gateway-model3-cardText">
                    <strong>{tr(card.titleAr, card.titleEn)}</strong>
                    <small>{tr(card.descAr, card.descEn)}</small>
                  </span>
                  <span className="programs-gateway-model3-cardArrow" aria-hidden="true">
                    ←
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
