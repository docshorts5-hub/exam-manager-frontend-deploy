import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DIRECTORATES } from "../../constants/directorates";
import OwnerDashboardShell, {
  OWNER_MINISTRY_LOGO_URL,
} from "./OwnerDashboardShell";
import "./ownerGovernorates.css";

const DIRECTORATE_PREFIX = "المديرية العامة للتعليم بمحافظة ";

function governorateFromDirectorate(value: string) {
  return String(value || "").replace(DIRECTORATE_PREFIX, "").trim();
}

export default function OwnerGovernoratesPage() {
  const navigate = useNavigate();

  const governorates = useMemo(
    () =>
      DIRECTORATES.map((directorate, index) => ({
        id: index + 1,
        directorate,
        governorate: governorateFromDirectorate(directorate),
      })),
    []
  );

  return (
    <OwnerDashboardShell
      backTo="/system/management"
      backLabel="العودة إلى الإدارة الرئيسية"
    >
      <section className="owner-governorates__hero">
        <span className="owner-governorates__eyebrow">الإدارة الرئيسية</span>
        <h1>المحافظات</h1>
        <p>
          المديريات العامة للتعليم بالمحافظات الإحدى عشرة في سلطنة عمان
        </p>
      </section>

      <section
        className="owner-governorates__grid"
        aria-label="المحافظات الإحدى عشرة"
      >
        {governorates.map((item) => (
          <button
            type="button"
            key={item.directorate}
            className="owner-governorates__card"
            onClick={() =>
              navigate(
                `/system/management/governorates/${encodeURIComponent(
                  item.governorate
                )}`
              )
            }
          >
            <span className="owner-governorates__logoWrap" aria-hidden="true">
              <img
                src={OWNER_MINISTRY_LOGO_URL}
                alt=""
                className="owner-governorates__logo"
              />
            </span>

            <span className="owner-governorates__number">
              {String(item.id).padStart(2, "0")}
            </span>

            <strong>محافظة {item.governorate}</strong>
            <small>{item.directorate}</small>

            <span className="owner-governorates__open">
              فتح المحافظة
              <b aria-hidden="true">←</b>
            </span>
          </button>
        ))}
      </section>
    </OwnerDashboardShell>
  );
}