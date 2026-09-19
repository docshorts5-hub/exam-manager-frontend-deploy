import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { DIRECTORATES } from "../../constants/directorates";
import {
  buildAuthzSnapshot,
  isPlatformOwner,
} from "../../features/authz";
import {
  canonicalDiplomaCenterGovernorate,
  loadOwnerDiplomaCenterReadModel,
  type OwnerDiplomaCenterReadResult,
} from "./ownerDiplomaCenterReadModel";
import "./ownerSchools.css";

const ministryLogo =
  "https://i.postimg.cc/j5G4NQvZ/sh%CA%BFar-1.png";

const schoolsDiplomaIcon =
  "https://i.postimg.cc/YC9R5944/352d2558-14ff-434e-821d-3ffad98df2c4.jpg";

type LoadState = "loading" | "ready" | "error";

const EMPTY_RESULT: OwnerDiplomaCenterReadResult = {
  centers: [],
  rejected: [],
};

export default function OwnerDiplomaCentersPage() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const { logout } = auth;

  const authzSnapshot = useMemo(
    () => buildAuthzSnapshot(auth),
    [auth],
  );

  const owner = isPlatformOwner(authzSnapshot);

  const [result, setResult] =
    useState<OwnerDiplomaCenterReadResult>(EMPTY_RESULT);
  const [loadState, setLoadState] =
    useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [reloadSequence, setReloadSequence] = useState(0);

  useEffect(() => {
    if (!owner) {
      setResult(EMPTY_RESULT);
      setLoadState("error");
      setLoadError(
        "هذه الصفحة مخصصة لمالك المنصة فقط.",
      );
      return;
    }

    let active = true;

    setLoadState("loading");
    setLoadError("");

    void loadOwnerDiplomaCenterReadModel({
      isPlatformOwner: owner,
    })
      .then((nextResult) => {
        if (!active) return;

        setResult(nextResult);
        setLoadState("ready");
        setLoadError("");
      })
      .catch((error) => {
        if (!active) return;

        console.error(
          "OWNER_DIPLOMA_CENTERS_READ_FAILED",
          error,
        );

        setResult(EMPTY_RESULT);
        setLoadState("error");
        setLoadError(
          "تعذر تحميل مراكز الدبلوم. لم يتم عرض بيانات غير مؤكدة.",
        );
      });

    return () => {
      active = false;
    };
  }, [owner, reloadSequence]);

  const officialGovernorates = useMemo(
    () =>
      DIRECTORATES.map((directorate) => ({
        directorate: String(directorate || "").trim(),
        governorate:
          canonicalDiplomaCenterGovernorate(directorate),
      })).filter((item) => item.governorate),
    [],
  );

  const countsByGovernorate = useMemo(() => {
    const map = new Map<string, number>();

    for (const center of result.centers) {
      const governorate =
        canonicalDiplomaCenterGovernorate(
          center.governorate,
        );

      if (!governorate) continue;

      map.set(
        governorate,
        (map.get(governorate) || 0) + 1,
      );
    }

    return map;
  }, [result.centers]);

  if (!owner) {
    return <Navigate to="/system" replace />;
  }

  return (
    <div className="owner-schools" dir="rtl">
      <header className="owner-schools__header">
        <div className="owner-schools__identity">
          <img
            src={ministryLogo}
            alt="شعار وزارة التعليم"
          />
          <div>
            <strong>سلطنة عمان</strong>
            <span>وزارة التعليم</span>
          </div>
        </div>

        <div className="owner-schools__ownerBadge">
          مالك المنصة
        </div>
      </header>

      <main className="owner-schools__main">
        <div className="owner-schools__breadcrumb">
          <button
            type="button"
            onClick={() =>
              navigate("/system/management")
            }
          >
            الإدارة الرئيسية
          </button>
          <span>‹</span>
          <strong>مراكز الدبلوم</strong>
        </div>

        <section className="owner-schools__hero">
          <div className="owner-schools__heroIcon">
            <img
              src={schoolsDiplomaIcon}
              alt=""
              aria-hidden="true"
            />
          </div>

          <div>
            <p>الإدارة الرئيسية</p>
            <h1>مراكز الدبلوم</h1>
            <span>
              عرض مراكز الدبلوم المصنفة صراحة حسب المحافظات
              ضمن نطاق مالك المنصة — اختر محافظة لعرض مراكزها وإدارة الإنشاء داخل نطاقها المثبت.
            </span>
          </div>
        </section>

        <section
          className="owner-schools__statusRow"
          aria-live="polite"
        >
          <span
            className={`owner-schools__status owner-schools__status--${loadState}`}
          >
            {loadState === "loading"
              ? "جارٍ تحميل مراكز الدبلوم..."
              : loadState === "error"
                ? loadError
                : `تم تحميل ${result.centers.length} مركز دبلوم مصنف صراحة`}
          </span>

          {loadState === "ready" &&
          result.rejected.length > 0 ? (
            <span className="owner-schools__guardNotice">
              {result.rejected.length} سجل مخفي وفق
              Fail-Closed بسبب تصنيف أو نطاق غير حاسم
            </span>
          ) : null}

          <button
            type="button"
            className="owner-schools__backButton"
            onClick={() =>
              setReloadSequence((value) => value + 1)
            }
            disabled={loadState === "loading"}
          >
            تحديث القراءة
          </button>
          <button
            type="button"
            className="owner-schools__backButton"
            onClick={() =>
              navigate("/system/management/diploma-centers/deleted")
            }
            style={{
              minWidth: "190px",
              minHeight: "48px",
              padding: "11px 20px",
              borderRadius: "14px",
              border: "1px solid rgba(185, 28, 28, 0.28)",
              background:
                "linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)",
              color: "#9f1239",
              fontSize: "15px",
              fontWeight: 900,
              boxShadow: "0 8px 22px rgba(159, 18, 57, 0.10)",
            }}
          >
            {"\u0627\u0644\u0645\u0631\u0627\u0643\u0632 \u0627\u0644\u0645\u062d\u0630\u0648\u0641\u0629"}
          </button>

          <button
            type="button"
            className="owner-schools__backButton"
            onClick={() =>
              navigate("/programs-gateway")
            }
            style={{
              minWidth: "190px",
              minHeight: "48px",
              padding: "11px 20px",
              borderRadius: "14px",
              border: "1px solid rgba(30, 64, 175, 0.24)",
              background:
                "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
              color: "#1e3a8a",
              fontSize: "15px",
              fontWeight: 900,
              boxShadow: "0 8px 22px rgba(30, 64, 175, 0.10)",
            }}
          >
            {"\u0627\u0644\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u062a\u0634\u063a\u064a\u0644\u064a\u0629"}
          </button>
        </section>

        <section
          className="owner-schools__grid"
          aria-label="مراكز الدبلوم حسب المحافظات"
        >
          {officialGovernorates.map((item, index) => {
            const count =
              loadState === "ready"
                ? countsByGovernorate.get(
                    item.governorate,
                  ) || 0
                : null;

            return (
              <button
                key={item.directorate}
                type="button"
                className="owner-schools__card"
                onClick={() =>
                  navigate(
                    `/system/management/diploma-centers/${encodeURIComponent(
                      item.governorate,
                    )}`,
                  )
                }
              >
                <span className="owner-schools__cardNumber">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span className="owner-schools__cardIcon">
                  <img
                    src={schoolsDiplomaIcon}
                    alt=""
                    aria-hidden="true"
                  />
                </span>

                <strong>
                  محافظة {item.governorate}
                </strong>
                <small>{item.directorate}</small>

                <span className="owner-schools__count">
                  {count === null ? "—" : count}
                  <em>مركز</em>
                </span>

                <span className="owner-schools__open">
                  فتح مراكز المحافظة
                </span>
              </button>
            );
          })}
        </section>

        <div className="owner-schools__writeHold">
          الإنشاء متاح فقط من داخل صفحة المحافظة بعد تثبيت نطاقها من المسار.
          التعديل والحذف ونقل المحافظة غير مفعّلة في هذه المرحلة.
        </div>
      </main>

      <footer className="owner-schools__footer">
        <div>
          <button
            type="button"
            onClick={() => navigate("/system/help")}
          >
            دليل الاستخدام
          </button>
          <button
            type="button"
            onClick={() => void logout?.()}
          >
            تسجيل الخروج
          </button>
        </div>

        <span>
          © 2026 وزارة التعليم — نظام إدارة الامتحانات
          الذكي
        </span>
      </footer>
    </div>
  );
}
