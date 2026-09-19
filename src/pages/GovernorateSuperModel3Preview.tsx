import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { buildAuthzSnapshot } from "../features/authz";
import { resolveAdministrativeTheme } from "../features/administrative-theme/administrativeTheme";
import "./GovernorateSuperModel3Preview.css";
import "./GovernorateSuperModel3CardsFinal.css";

import "./SuperSystemOmanBrand.css";
const MODEL3_LOGO = "https://i.postimg.cc/j5G4NQvZ/sh%CA%BFar-1.png";
const SCHOOL_PREVIEW = "https://i.postimg.cc/YC9R5944/352d2558-14ff-434e-821d-3ffad98df2c4.jpg";
const DIPLOMA_PREVIEW = "https://i.postimg.cc/J0p7vKgk/Chat-GPT-Image-6-ywlyw-2026-11-52-32-s.png";

function getProfile(auth: any) {
  return auth?.profile || auth?.userProfile || auth?.allow || {};
}

function getSupportGovernorateFromAuth(auth: any) {
  const allow = auth?.allow || {};
  const profile = auth?.profile || auth?.userProfile || {};
  const claims = auth?.claims || auth?.tokenClaims || {};

  return String(
    auth?.supportGovernorate ||
      auth?.supportGov ||
      auth?.actingGovernorate ||
      allow?.supportGovernorate ||
      allow?.supportGov ||
      allow?.actingGovernorate ||
      profile?.supportGovernorate ||
      profile?.supportGov ||
      profile?.actingGovernorate ||
      claims?.supportGovernorate ||
      claims?.supportGov ||
      claims?.actingGovernorate ||
      ""
  ).trim();
}

function getGovernorate(auth: any) {
  const p = getProfile(auth);
  return String(
    p?.governorate ||
      p?.tenantGovernorate ||
      p?.regionAr ||
      p?.region ||
      auth?.governorate ||
      "شمال الشرقية"
  ).trim();
}

function cleanGovernorateName(value: string) {
  let v = String(value || "").replace(/\s+/g, " ").trim();

  const fullPrefix = "المديرية العامة للتعليم بمحافظة";

  // لو القيمة جاءت كاملة من البيانات، نأخذ اسم المحافظة فقط.
  if (v.includes(fullPrefix)) {
    v = v.slice(v.lastIndexOf(fullPrefix) + fullPrefix.length).trim();
  }

  v = v
    .replace(/^محافظة\s+/g, "")
    .replace(/^بمحافظة\s+/g, "")
    .replace(/\s*\|\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return v || "شمال الشرقية";
}

type IconName =
  | "school"
  | "schoolAdd"
  | "userAdd"
  | "users"
  | "edit"
  | "grad"
  | "shield"
  | "chart"
  | "clipboard"
  | "doc"
  | "eye"
  | "lock";

function LineIcon({ name }: { name: IconName }) {
  const common = {
    viewBox: "0 0 48 48",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
  } as any;

  if (name === "eye") {
    return (
      <svg {...common}>
        <path d="M5 24s7.5-11 19-11 19 11 19 11-7.5 11-19 11S5 24 5 24Z" />
        <circle cx="24" cy="24" r="6" />
      </svg>
    );
  }

  if (name === "edit") {
    return (
      <svg {...common}>
        <path d="M12 35h8L36 19l-7-7-16 16-1 7Z" />
        <path d="M27 14l7 7" />
        <path d="M10 40h28" />
      </svg>
    );
  }

  if (name === "users") {
    return (
      <svg {...common}>
        <circle cx="18" cy="17" r="5.5" />
        <circle cx="31" cy="19" r="4.5" />
        <path d="M8 39c1.8-7 5.8-10 10-10s8.2 3 10 10" />
        <path d="M27 39c1.1-4.7 4-7 7-7 2.8 0 5.4 2.2 6.7 7" />
      </svg>
    );
  }

  if (name === "userAdd") {
    return (
      <svg {...common}>
        <circle cx="19" cy="17" r="5.5" />
        <path d="M9 39c1.8-7 5.8-10 10-10s8.2 3 10 10" />
        <path d="M35 12v13" />
        <path d="M28.5 18.5h13" />
      </svg>
    );
  }

  if (name === "school" || name === "schoolAdd") {
    return (
      <svg {...common}>
        <path d="M7 41h34" />
        <path d="M11 21h26v20H11V21Z" />
        <path d="M24 8 8 21h32L24 8Z" />
        <path d="M20 41V30h8v11" />
        <path d="M15 26h4M29 26h4M15 32h4M29 32h4" />
        {name === "schoolAdd" ? (
          <>
            <path d="M36 30v11" />
            <path d="M30.5 35.5h11" />
          </>
        ) : null}
      </svg>
    );
  }

  if (name === "grad") {
    return (
      <svg {...common}>
        <path d="M5 18 24 9l19 9-19 9-19-9Z" />
        <path d="M11 23v8c5 4.5 21 4.5 26 0v-8" />
        <path d="M42 20v10" />
      </svg>
    );
  }

  if (name === "shield" || name === "lock") {
    return (
      <svg {...common}>
        <path d="M24 6 38 12v10c0 9.5-5.6 16-14 19-8.4-3-14-9.5-14-19V12l14-6Z" />
        {name === "shield" ? (
          <path d="m17 24 5 5 10-12" />
        ) : (
          <>
            <path d="M19 24h10v10H19V24Z" />
            <path d="M21 24v-4a3 3 0 0 1 6 0v4" />
          </>
        )}
      </svg>
    );
  }

  if (name === "chart") {
    return (
      <svg {...common}>
        <path d="M13 38V25" />
        <path d="M24 38V12" />
        <path d="M35 38V19" />
      </svg>
    );
  }

  if (name === "doc" || name === "clipboard") {
    return (
      <svg {...common}>
        <path d="M14 8h20v32H14V8Z" />
        <path d="M19 7h10l2 6H17l2-6Z" />
        <path d="M19 22h11" />
        <path d="M19 29h11" />
        {name === "doc" ? <circle cx="35" cy="35" r="5" /> : null}
      </svg>
    );
  }

  return null;
}

function Card({
  icon,
  label,
  onClick,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="gm3-final-card" type="button" onClick={onClick}>
      <span className="gm3-final-card__inner">
        <span className="gm3-final-card__icon" aria-hidden="true">
          <LineIcon name={icon} />
        </span>
        <span className="gm3-final-card__label">{label}</span>
      </span>
    </button>
  );
}

export default function GovernorateSuperModel3Preview() {
  const nav = useNavigate();
  const auth = useAuth() as any;
  const administrativeTheme = resolveAdministrativeTheme(buildAuthzSnapshot(auth));
  const location = useLocation();
  const params = new URLSearchParams(location.search || "");
  const p = getProfile(auth);
  const governorate = cleanGovernorateName(
    params.get("supportGovernorate") ||
      params.get("supportGov") ||
      params.get("actingGovernorate") ||
      getSupportGovernorateFromAuth(auth) ||
      getGovernorate(auth),
  );
  const email = String(auth?.user?.email || p?.email || "yraaa8211@gmail.com").trim();

  const go = (path: string) => nav(path);
  const logout = () => {
    if (typeof auth?.logout === "function") auth.logout();
    else nav("/login");
  };

  return (
    <main className={`m3-page ${administrativeTheme.rootClassName}`} dir="rtl">
      <div className="m3-canvas">
        <header className="m3-header">
          <div className="m3-actions">
            <button className="m3-back" type="button" onClick={() => go("/super")}>
              <span>←</span>
            
              العودة
            </button>
            <button
              className="m3-back"
              type="button"
              onClick={() => go("/security/totp-reset")}
            >
              إعادة تهيئة TOTP
            </button>
            <button className="m3-logout" type="button" onClick={logout}>
              تسجيل الخروج
              <span>↪</span>
            </button>
          </div>

          <div className="m3-user">
            <span className="m3-user-avatar" />
            <span className="m3-user-email">{email}</span>
            <span className="m3-user-arrow">⌄</span>
          </div>

          <div className="m3-title-block">
            <h1>بوابة مشرف المحافظة</h1>
            <div className="super-system-model3-title-country-brand">
               سلطنة عمان / وزارة التعليم
            </div>
            <p className="m3-location">المديرية العامة للتعليم بمحافظة {governorate}</p>
          </div>

          <img src={MODEL3_LOGO} alt="شعار " />

          <div className="m3-pills">
            <span className="m3-pill m3-pill-green">
              مشرف المحافظة
              <span>♙</span>
            </span>
            <span className="m3-pill m3-pill-gold">
              صلاحيات حسب نطاق المحافظة
              <span>♢</span>
            </span>
          </div>
        </header>

        <div className="m3-body">
          <section className="m3-main">
            <div className="m3-notice">
              <span className="m3-notice-doc">
                <LineIcon name="doc" />
              </span>
              <p>عند فتح المدرسة أو مركز الدبلوم تظهر صفحة مشاهدة فقط مع زر عودة إلى سوبر المحافظة.</p>
              <span className="m3-notice-info">i</span>
            </div>

            <section className="m3-panel">
              <div className="m3-panel-title">
                <span>
                  <LineIcon name="school" />
                </span>
                <h2>المدارس و البوابة التشغيلية</h2>
              </div>

              <div className="m3-cards m3-five">
                <Card icon="school" label="إدارة المدارس" onClick={() => go("/super-system/schools-management")} />
                <Card icon="schoolAdd" label="إضافة مدرسة" onClick={() => go("/super-system/schools-management#create")} />
                <Card icon="userAdd" label="إضافة مدير مدرسة" onClick={() => go("/super-system/add-school-admin")} />
                <Card icon="users" label={"البوابة التشغيلية\nفي المحافظة"} onClick={() => go("/programs-gateway")} />
                <Card icon="edit" label={"تعديل بيانات\nالمدرسة"} onClick={() => go("/super-system/schools-management#edit")} />
              </div>
            </section>

            <section className="m3-panel m3-panel-sm">
              <div className="m3-panel-title">
                <span>
                  <LineIcon name="grad" />
                </span>
                <h2>مراكز الدبلوم ومشرفو الامتحانات</h2>
              </div>

              <div className="m3-cards m3-three">
                <Card icon="users" label={"مشرفو امتحانات\nالدبلوم"} onClick={() => go("/exam-supers")} />
                <Card icon="shield" label={"إضافة مشرف امتحانات\nدبلوم"} onClick={() => go("/super-system/add-exam-super12")} />
                <Card icon="school" label="عرض مراكز الدبلوم" onClick={() => go("/exam-supers")} />
              </div>
            </section>


            <div className="m3-safety">
              <span>
                <LineIcon name="lock" />
              </span>
              <p>جميع صفحات المشاهدة تعمل بنمط قراءة فقط لضمان سلامة البيانات.</p>
            </div>
          </section>

          <aside className="m3-preview-panel">
            <div className="m3-preview-head">
              <span>
                <LineIcon name="eye" />
              </span>
              <h2>معاينة صفحات المشاهدة</h2>
            </div>

            <div className="m3-preview-card">
              <h3>دخول مدرسة - مشاهدة فقط</h3>
              <img className="m3-building-img" src={SCHOOL_PREVIEW} alt="دخول مدرسة - مشاهدة فقط" />
              <div className="m3-readonly">
                مشاهدة فقط
                <LineIcon name="eye" />
              </div>
              <button type="button" onClick={() => go("/programs-gateway")}>
                ← العودة إلى سوبر المحافظة
              </button>
            </div>

            <div className="m3-preview-card">
              <h3>دخول مركز دبلوم - مشاهدة فقط</h3>
              <img className="m3-building-img" src={DIPLOMA_PREVIEW} alt="دخول مركز دبلوم - مشاهدة فقط" />
              <div className="m3-readonly">
                مشاهدة فقط
                <LineIcon name="eye" />
              </div>
              <button type="button" onClick={() => go("/exam-supers")}>
                ← العودة إلى سوبر المحافظة
              </button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

