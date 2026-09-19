import React from "react";
import { ministryLogo } from "../../assets/branding";
 
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import "./ownerDashboard.css";

export const OWNER_MINISTRY_LOGO_URL = ministryLogo;

type Props = {
  children: React.ReactNode;
  backTo?: string;
  backLabel?: string;
  sectionTitle?: string;
};

export default function OwnerDashboardShell({
  children,
  backTo,
  backLabel = "العودة إلى لوحة مالك المنصة",
  sectionTitle = "",
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const sectionLabel =
    location.pathname.startsWith("/system/management")
      ? "الإدارة الرئيسية"
      : location.pathname.startsWith("/system/security")
        ? "الأمن والرقابة"
        : location.pathname.startsWith("/system/operations")
          ? "النظام والتطوير"
          : location.pathname.startsWith("/system/help")
            ? "دليل الاستخدام"
            : "";
  const auth = useAuth() as any;

  const email = String(
    auth?.user?.email ||
      auth?.profile?.email ||
      auth?.allow?.email ||
      ""
  ).trim();

  const logout = async () => {
    try {
      if (typeof auth?.logout === "function") {
        await auth.logout();
      }
    } finally {
      navigate("/login", { replace: true });
    }
  };

  return (
    <main className="owner-hub" dir="rtl">
      <header className="owner-hub__header">
        <div className="owner-hub__brand">
          <img
            src={OWNER_MINISTRY_LOGO_URL}
            alt="شعار وزارة التعليم"
            className="owner-hub__logo"
          />
          <div className="owner-hub__brandText">
            <strong>سلطنة عمان</strong>
            <span>وزارة التعليم</span>
          </div>
        </div>

        <div className="owner-hub__accountArea">
          <div className="owner-hub__quickActions" aria-label="روابط سريعة">
            <button
              type="button"
              className="owner-hub__iconButton"
              onClick={() => navigate("/super/suggestions")}
              title="رسائل التطوير"
              aria-label="رسائل التطوير"
            >
              ◔
            </button>
            <button
              type="button"
              className="owner-hub__iconButton"
              onClick={() => navigate("/system/security")}
              title="الأمن والرقابة"
              aria-label="الأمن والرقابة"
            >
              ⚙
            </button>
          </div>

          <div className="owner-hub__accountCard">
            <div className="owner-hub__avatar" aria-hidden="true">●</div>
            <div>
              <strong>مالك المنصة</strong>
              <span>{email || "حساب مالك المنصة"}</span>
            </div>
          </div>
        </div>
      </header>
      {backTo ? (
        <div className="owner-hub__backRow">
          <nav className="owner-hub__breadcrumb" aria-label="مسار التنقل">
            <span>الرئيسية</span>
            <b aria-hidden="true">←</b>
            <strong>{sectionLabel || "لوحة مالك المنصة"}</strong>
          </nav>

          <button
            type="button"
            className="owner-hub__backButton"
            onClick={() => navigate(backTo)}
          >
            ← {backLabel}
          </button>
        </div>
      ) : null}

      {children}

      <footer className="owner-hub__footer">
        <button
          type="button"
          className="owner-hub__logout"
          onClick={() => void logout()}
        >
          تسجيل الخروج
        </button>

        

        <button
          type="button"
          className="owner-hub__helpButton"
          onClick={() => navigate("/system/help")}
        >
          ؟ دليل الاستخدام
        </button>

        <div className="owner-hub__copyright">
          جميع الحقوق محفوظة © 2026 وزارة التعليم - سلطنة عمان
        </div>
      </footer>
    </main>
  );
}






