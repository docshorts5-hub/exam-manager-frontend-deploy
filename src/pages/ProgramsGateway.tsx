import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";

const GOLD = "#d4af37";
const GOLD_SOFT = "rgba(212,175,55,0.22)";
const CREAM = "#f6f1e3";
const INK = "#111111";

type ActionCard = {
  key: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  icon: string;
  onClick: () => void;
};

export default function ProgramsGateway() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const role = String(
    auth?.effectiveRole ||
    auth?.allow?.role ||
    auth?.profile?.role ||
    auth?.userProfile?.role ||
    ""
  ).trim().toLowerCase();

  const tenantId = String(
    auth?.effectiveTenantId ||
    auth?.allow?.tenantId ||
    auth?.profile?.tenantId ||
    auth?.userProfile?.tenantId ||
    ""
  ).trim();

  const isOwner = role === "super_admin";
  const isGovernorateSuper = role === "super";
  const isExamSuper = role === "exam_super";
  const isSchoolAdmin = role === "tenant_admin" || role === "admin";

  const cards = useMemo<ActionCard[]>(() => {
    const list: ActionCard[] = [];

    if (isOwner || isExamSuper) {
      list.push({
        key: "diploma",
        titleAr: "برنامج إدارة امتحانات الدبلوم العام",
        titleEn: "Diploma Exams Program",
        descAr: isOwner
          ? "فتح صفحة جميع مشرفي الامتحانات حسب المحافظة مع زر دخول إلى صفحة المشرف المطلوب."
          : "الدخول إلى منظومة مراكز امتحانات الدبلوم العام وما في مستواه.",
        descEn: isOwner
          ? "Open the page of all exam supervisors by governorate with an entry button to the required supervisor page."
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
        titleAr: "مشرفي إدارة امتحانات النقل",
        titleEn: "School Exams Program",
        descAr:
          isOwner || isGovernorateSuper
            ? "فتح صفحة جميع مدارس المحافظة ثم الدخول إلى صفحة المدرسة المطلوبة."
            : "الدخول إلى منظومة المدرسة الخاصة بامتحانات النقل والإدارة التشغيلية.",
        descEn:
          isOwner || isGovernorateSuper
            ? "Open the governorate school list, then enter the selected school page."
            : "Enter the school operating system for transport exams and daily administration.",
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
        titleAr: "مشرفي إدارة امتحانات الدبلوم العام",
        titleEn: "Governorate Supervisor",
        descAr: isOwner
          ? "فتح صفحة جميع سوبر الامتحانات حسب المحافظة مع زر دخول إلى الصفحة المطلوبة."
          : "فتح صفحة جميع سوبر الامتحانات حسب المحافظة مع زر دخول إلى الصفحة المطلوبة.",
        descEn: isOwner
          ? "Open the exam supervisors page by governorate with an entry button to the required page."
          : "Open the exam supervisors page by governorate with an entry button to the required page.",
        icon: "🛡️",
        onClick: () => navigate("/governorate-supers"),
      });
    }

    return list;
  }, [isOwner, isExamSuper, isSchoolAdmin, isGovernorateSuper, tenantId, navigate]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f4efe2 0%, #ebe4d3 100%)",
        padding: 22,
        boxSizing: "border-box",
        direction: isRTL ? "rtl" : "ltr",
      }}
    >
      <div style={{ maxWidth: 1680, margin: "0 auto", display: "grid", gap: 24 }}>
        <section
          style={{
            background: "linear-gradient(135deg, #8b6a00 0%, #b8860b 48%, #7a5c00 100%)",
            borderRadius: 38,
            border: `4px solid ${GOLD}`,
            boxShadow: `0 24px 50px rgba(0,0,0,0.25), 0 0 28px ${GOLD_SOFT}`,
            padding: "28px 30px",
            color: "#fff7d8",
            display: "grid",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>
                {tr("وزارة التربية والتعليم", "Ministry of Education")}
              </div>
              <div style={{ fontSize: "clamp(28px, 5vw, 56px)", fontWeight: 1000, lineHeight: 1.15 }}>
                {tr("البوابة التشغيلية", "Operational Gateway")}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, maxWidth: 1000, lineHeight: 1.8 }}>
                {tr(
                  "اختر النظام التشغيلي المناسب بحسب صلاحيتك الحالية. تظهر لك فقط البطاقات المسموح بها.",
                  "Choose the operating system that matches your current role. Only permitted cards are shown."
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/system")}
              style={{
                minHeight: 58,
                padding: "0 22px",
                borderRadius: 20,
                border: `3px solid ${GOLD}`,
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                fontWeight: 1000,
                fontSize: 18,
                cursor: "pointer",
              }}
            >
              {tr("العودة إلى مالك المنصة", "Back to Platform Owner")}
            </button>
          </div>
        </section>

        <section
          style={{
            background: "linear-gradient(180deg, #f8f4e8 0%, #f2eddf 100%)",
            borderRadius: 40,
            border: `5px solid ${GOLD}`,
            boxShadow: "0 0 0 10px rgba(212,175,55,0.12) inset, 0 18px 38px rgba(150,120,20,0.14)",
            padding: 28,
            display: "grid",
            gap: 24,
          }}
        >
          <div style={{ display: "grid", gap: 8 }}>
            <div
              style={{
                display: "inline-flex",
                width: "fit-content",
                padding: "10px 18px",
                borderRadius: 999,
                border: "2px solid rgba(16,185,129,0.22)",
                background: "rgba(16,185,129,0.10)",
                color: INK,
                fontWeight: 900,
                fontSize: 14,
              }}
            >
              {tr("اختيار البرنامج", "Program Selection")}
            </div>
            <h2 style={{ margin: 0, color: INK, fontSize: "clamp(26px, 4vw, 44px)", fontWeight: 1000 }}>
              {tr("اختر الوجهة التشغيلية", "Choose Your Operational Destination")}
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 22,
            }}
          >
            {cards.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={card.onClick}
                style={{
                  textAlign: isRTL ? "right" : "left",
                  background: CREAM,
                  border: `4px solid ${GOLD}`,
                  borderRadius: 34,
                  padding: 26,
                  cursor: "pointer",
                  boxShadow: "0 16px 32px rgba(150,120,20,0.12)",
                  display: "grid",
                  gap: 18,
                }}
              >
                <div
                  style={{
                    width: 82,
                    height: 82,
                    borderRadius: 26,
                    border: `3px solid ${GOLD}`,
                    background: "linear-gradient(180deg, #f3e1a2 0%, #efd98a 100%)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 38,
                    boxShadow: "0 12px 24px rgba(150,120,20,0.16)",
                  }}
                >
                  {card.icon}
                </div>

                <div style={{ color: INK, fontWeight: 1000, fontSize: 30, lineHeight: 1.35 }}>
                  {tr(card.titleAr, card.titleEn)}
                </div>

                <div style={{ color: INK, fontWeight: 800, fontSize: 18, lineHeight: 1.9 }}>
                  {tr(card.descAr, card.descEn)}
                </div>
              </button>
            ))}
          </div>

          {!cards.length && (
            <div
              style={{
                background: "#fffdf7",
                border: `3px solid ${GOLD}`,
                borderRadius: 28,
                padding: 24,
                color: INK,
                fontWeight: 900,
                fontSize: 20,
              }}
            >
              {tr("لا توجد وجهات تشغيلية متاحة لهذه الصلاحية حاليًا.", "No operational destinations are currently available for this role.")}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
