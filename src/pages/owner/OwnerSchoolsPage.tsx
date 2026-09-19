import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { DIRECTORATES } from "../../constants/directorates";
import { schoolsDiplomaIcon } from "../../assets/branding";
import { ministryLogo } from "../../assets/branding";
import { subscribeSuperTenants } from "../../features/super-admin/services/superSystemService";
import {
  canonicalGovernorate,
  classifyOwnerSchoolTenant,
  tenantGovernorate,
  type OwnerSchoolTenant,
} from "./ownerSchoolReadModel";
import "./ownerSchools.css";


type LoadState = "loading" | "ready" | "error";

  "https://i.postimg.cc/YC9R5944/352d2558-14ff-434e-821d-3ffad98df2c4.jpg";

export default function OwnerSchoolsPage() {
  const navigate = useNavigate();
  const { logout } = useAuth() as any;
  const [rows, setRows] = useState<OwnerSchoolTenant[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    setLoadState("loading");
    setLoadError("");

    return subscribeSuperTenants(
      (nextRows) => {
        setRows((Array.isArray(nextRows) ? nextRows : []) as OwnerSchoolTenant[]);
        setLoadState("ready");
        setLoadError("");
      },
      (error) => {
        console.error("OWNER_SCHOOLS_READ_FAILED", error);
        setRows([]);
        setLoadState("error");
        setLoadError("تعذر تحميل المدارس. لم يتم عرض بيانات غير مؤكدة.");
      },
      { canSeeAllGovs: true, myGov: "" },
    );
  }, []);

  const officialGovernorates = useMemo(
    () =>
      DIRECTORATES.map((directorate) => ({
        directorate: String(directorate || "").trim(),
        governorate: canonicalGovernorate(directorate),
      })).filter((item) => item.governorate),
    [],
  );

  const classified = useMemo(() => {
    const schools: OwnerSchoolTenant[] = [];
    let excludedCenters = 0;
    let unknown = 0;

    for (const row of rows) {
      const result = classifyOwnerSchoolTenant(row);

      if (result === "school") {
        schools.push(row);
      } else if (result === "excluded_center") {
        excludedCenters += 1;
      } else {
        unknown += 1;
      }
    }

    return { schools, excludedCenters, unknown };
  }, [rows]);

  const countsByGovernorate = useMemo(() => {
    const map = new Map<string, number>();

    for (const row of classified.schools) {
      const gov = tenantGovernorate(row);
      if (!gov) continue;
      map.set(gov, (map.get(gov) || 0) + 1);
    }

    return map;
  }, [classified.schools]);

  const officialSet = useMemo(
    () => new Set(officialGovernorates.map((item) => item.governorate)),
    [officialGovernorates],
  );

  const unscopedSchools = useMemo(
    () =>
      classified.schools.filter((row) => {
        const gov = tenantGovernorate(row);
        return !gov || !officialSet.has(gov);
      }).length,
    [classified.schools, officialSet],
  );

  return (
    <div className="owner-schools" dir="rtl">
      <header className="owner-schools__header">
        <div className="owner-schools__identity">
          <img src={ministryLogo} alt="شعار وزارة التعليم" />
          <div>
            <strong>سلطنة عمان</strong>
            <span>وزارة التعليم</span>
          </div>
        </div>

        <div className="owner-schools__ownerBadge">مالك المنصة</div>
      </header>

      <main className="owner-schools__main">
        <div className="owner-schools__breadcrumb">
          <button type="button" onClick={() => navigate("/system/management")}>
            الإدارة الرئيسية
          </button>
          <span>‹</span>
          <strong>المدارس</strong>
        </div>

        <section className="owner-schools__hero">
          <div className="owner-schools__heroImage">
            <img
              src={schoolsDiplomaIcon}
              alt=""
              aria-hidden="true"
            />
          </div>
          <div>
            <p>الإدارة الرئيسية</p>
            <h1>المدارس</h1>
            <span>
              عرض المدارس حسب المحافظات ضمن نطاق مالك المنصة — قراءة فقط في هذه المرحلة.
            </span>
          </div>
        </section>
        <section className="owner-schools__statusRow" aria-live="polite">
          <button
  type="button"
  onClick={() => navigate("/system/management/schools/deleted")}
  style={{
    padding:"10px 24px",
    borderRadius:"14px",
    border:"1px solid #e6b8b8",
    background:"#fff5f5",
    color:"#a33",
    fontWeight:700,
    cursor:"pointer"
  }}
>
  المدارس المحذوفة 🗑️
</button>

          <span className={`owner-schools__status owner-schools__status--${loadState}`}>
            {loadState === "loading"
              ? "جارٍ تحميل المدارس..."
              : loadState === "error"
                ? loadError
                : `تم تحميل ${classified.schools.length} مدرسة مصنفة صراحةً`}
          </span>

          {loadState === "ready" && classified.unknown > 0 ? (
            <span className="owner-schools__guardNotice">
              {classified.unknown} سجل غير مصنف مخفي وفق Fail-Closed
            </span>
          ) : null}

          {loadState === "ready" && unscopedSchools > 0 ? (
            <span className="owner-schools__guardNotice">
              {unscopedSchools} مدرسة ذات محافظة غير معتمدة مخفية من التقسيم
            </span>
          ) : null}
        </section>

        <section className="owner-schools__grid" aria-label="المدارس حسب المحافظات">
          {officialGovernorates.map((item, index) => {
            const count =
              loadState === "ready"
                ? countsByGovernorate.get(item.governorate) || 0
                : null;

            return (
              <button
                key={item.directorate}
                type="button"
                className="owner-schools__card"
                onClick={() =>
                  navigate(
                    `/system/management/schools/${encodeURIComponent(item.governorate)}`,
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

                <strong>محافظة {item.governorate}</strong>
                <small>{item.directorate}</small>

                <span className="owner-schools__count">
                  {count === null ? "—" : count}
                  <em>مدرسة</em>
                </span>

                <span className="owner-schools__open">فتح مدارس المحافظة</span>
              </button>
            );
          })}
        </section>
      </main>

      <footer className="owner-schools__footer">
        <div>
          <button type="button" onClick={() => navigate("/system/help")}>
            دليل الاستخدام
          </button>
          <button type="button" onClick={() => navigate("/programs-gateway")}>
            البوابة التشغيلية
          </button>
          <button type="button" onClick={() => void logout?.()}>
            تسجيل الخروج
          </button>
        </div>
        <span>© 2026 وزارة التعليم — نظام إدارة الامتحانات الذكي</span>
      </footer>
    </div>
  );
}





