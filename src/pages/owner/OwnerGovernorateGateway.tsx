import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Navigate,
  useNavigate,
  useParams,
} from "react-router-dom";

import { DIRECTORATES } from "../../constants/directorates";
import { governoratesIcon } from "../../assets/branding";
import { callFn } from "../../services/functionsClient";

import {
  classifyOwnerSchoolTenant,
  loadOwnerSchoolReadModel,
  sameGovernorate,
  tenantGovernorate,
  type OwnerSchoolTenant,
} from "./ownerSchoolReadModel";

import {
  canonicalDiplomaCenterGovernorate,
  loadOwnerDiplomaCenterReadModel,
} from "./ownerDiplomaCenterReadModel";

import OwnerDashboardShell from "./OwnerDashboardShell";
import "./ownerGovernorates.css";


const DIRECTORATE_PREFIX =
  "المديرية العامة للتعليم بمحافظة ";


type StatStatus =
  | "loading"
  | "ready"
  | "error";


type GatewayStat = {
  status: StatStatus;
  value: number | null;
};


type GatewayBreakdownStat = GatewayStat & {
  enabled: number | null;
  disabled: number | null;
};


type ManagedUserRow = {
  id?: unknown;
  email?: unknown;
  role?: unknown;
  governorate?: unknown;
  tenantGovernorate?: unknown;
  governorateAr?: unknown;
  regionAr?: unknown;
  enabled?: unknown;
};



const INITIAL_BREAKDOWN_STAT: GatewayBreakdownStat = {
  status: "loading",
  value: null,
  enabled: null,
  disabled: null,
};


const listManagedUsers = callFn<
  Record<string, never>,
  unknown
>("adminListManagedUsers");


function decodeGovernorate(
  value: string | undefined
) {
  try {
    return decodeURIComponent(
      String(value || "").trim()
    );
  } catch {
    return String(value || "").trim();
  }
}


function governorateFromDirectorate(
  value: string
) {
  return String(value || "")
    .replace(DIRECTORATE_PREFIX, "")
    .trim();
}


function extractSchoolRows(
  model: unknown
): OwnerSchoolTenant[] {

  const source =
    model as Record<string, any> | null;

  const candidates: unknown[] = [
    model,
    source?.rows,
    source?.items,
    source?.schools,
    source?.schoolRows,
    source?.tenants,
    source?.records,
    source?.data?.items,
    source?.data?.rows,
  ];

  const rows =
    candidates.find((value) =>
      Array.isArray(value)
    );

  if (!Array.isArray(rows)) {
    throw new Error(
      "OWNER_GATEWAY_SCHOOL_MODEL_UNRECOGNIZED"
    );
  }

  return rows as OwnerSchoolTenant[];
}


function extractManagedUsers(
  response: unknown
): ManagedUserRow[] {

  const source =
    response as Record<string, any> | null;

  const candidates: unknown[] = [
    response,
    source?.items,
    source?.users,
    source?.rows,
    source?.managedUsers,
    source?.data,
    source?.data?.items,
    source?.data?.users,
    source?.data?.rows,
  ];

  const rows =
    candidates.find((value) =>
      Array.isArray(value)
    );

  if (!Array.isArray(rows)) {
    throw new Error(
      "OWNER_GATEWAY_MANAGED_USERS_UNRECOGNIZED"
    );
  }

  return rows as ManagedUserRow[];
}


function formatStatValue(
  stat: GatewayStat
) {
  if (stat.status === "loading") {
    return "…";
  }

  if (stat.status === "error") {
    return "—";
  }

  return String(stat.value ?? 0);
}



function formatBreakdownStatus(
  stat: GatewayBreakdownStat
) {
  if (stat.status === "loading") {
    return "جارٍ التحقق";
  }

  if (stat.status === "error") {
    return "تعذر التحقق";
  }

  return `مفعّل: ${stat.enabled ?? 0} · موقوف: ${
    stat.disabled ?? 0
  }`;
}


export default function OwnerGovernorateGateway() {

  const navigate = useNavigate();
  const params = useParams();


  const governorate = useMemo(
    () =>
      decodeGovernorate(
        params.governorateId
      ),
    [params.governorateId]
  );


  const directorate = useMemo(
    () =>
      DIRECTORATES.find(
        (item) =>
          governorateFromDirectorate(item) ===
          governorate
      ) || "",
    [governorate]
  );


  const [
    schoolsStat,
    setSchoolsStat,
  ] = useState<GatewayBreakdownStat>(
    INITIAL_BREAKDOWN_STAT
  );


  const [
    diplomaStat,
    setDiplomaStat,
  ] = useState<GatewayBreakdownStat>(
    INITIAL_BREAKDOWN_STAT
  );


  const [
    supervisorsStat,
    setSupervisorsStat,
  ] = useState<GatewayBreakdownStat>(
    INITIAL_BREAKDOWN_STAT
  );


  const [
    refreshSequence,
    setRefreshSequence,
  ] = useState(0);


  const [
    lastVerifiedAt,
    setLastVerifiedAt,
  ] = useState("");


  useEffect(() => {

    if (!directorate || !governorate) {
      return;
    }

    let active = true;


    setSchoolsStat({
      status: "loading",
      value: null,
      enabled: null,
      disabled: null,
    });


    setDiplomaStat({
      status: "loading",
      value: null,
      enabled: null,
      disabled: null,
    });


    setSupervisorsStat({
      status: "loading",
      value: null,
      enabled: null,
      disabled: null,
    });


    // ==========================================================
    // SCHOOLS
    // ==========================================================

    void (async () => {
      try {

        const model =
          await loadOwnerSchoolReadModel({
            isPlatformOwner: true,
          });


        const rows =
          extractSchoolRows(model);


        const governorateSchools =
          rows.filter(
            (row) =>
              classifyOwnerSchoolTenant(row) ===
                "school" &&
              sameGovernorate(
                tenantGovernorate(row),
                governorate
              )
          );


        const enabled =
          governorateSchools.filter(
            (row) =>
              row.enabled !== false
          ).length;


        const disabled =
          governorateSchools.filter(
            (row) =>
              row.enabled === false
          ).length;


        if (!active) return;


        setSchoolsStat({
          status: "ready",
          value: governorateSchools.length,
          enabled,
          disabled,
        });

      } catch (error) {

        console.error(
          "OWNER_GATEWAY_SCHOOLS_STATS_FAILED",
          error
        );


        if (!active) return;


        setSchoolsStat({
          status: "error",
          value: null,
          enabled: null,
          disabled: null,
        });
      }
    })();


    // ==========================================================
    // DIPLOMA CENTERS
    // ==========================================================

    void (async () => {
      try {

        const result =
          await loadOwnerDiplomaCenterReadModel({
            isPlatformOwner: true,
          });


        if (
          !result ||
          !Array.isArray(result.centers)
        ) {
          throw new Error(
            "OWNER_GATEWAY_DIPLOMA_MODEL_INVALID"
          );
        }


        const governorateCenters =
          result.centers.filter(
            (center) =>
              canonicalDiplomaCenterGovernorate(
                center.governorate
              ) === governorate
          );


        const enabled =
          governorateCenters.filter(
            (center) =>
              center.enabled !== false
          ).length;


        const disabled =
          governorateCenters.filter(
            (center) =>
              center.enabled === false
          ).length;


        if (!active) return;


        setDiplomaStat({
          status: "ready",
          value: governorateCenters.length,
          enabled,
          disabled,
        });

      } catch (error) {

        console.error(
          "OWNER_GATEWAY_DIPLOMA_STATS_FAILED",
          error
        );


        if (!active) return;


        setDiplomaStat({
          status: "error",
          value: null,
          enabled: null,
          disabled: null,
        });
      }
    })();


    // ==========================================================
    // GOVERNORATE SUPERVISORS
    // ==========================================================

    void (async () => {
      try {

        const response =
          await listManagedUsers({});


        const rows =
          extractManagedUsers(response);


        const governorateSupervisors =
          rows.filter((row) => {

            const role =
              String(
                row.role ?? ""
              )
                .trim()
                .toLowerCase();


            const rowGovernorate =
              canonicalDiplomaCenterGovernorate(
                row.governorate ??
                row.tenantGovernorate ??
                row.governorateAr ??
                row.regionAr ??
                ""
              );


            return (
              role === "super" &&
              rowGovernorate === governorate
            );
          });


        const enabled =
          governorateSupervisors.filter(
            (row) =>
              row.enabled !== false
          ).length;


        const disabled =
          governorateSupervisors.filter(
            (row) =>
              row.enabled === false
          ).length;


        if (!active) return;


        setSupervisorsStat({
          status: "ready",
          value: governorateSupervisors.length,
          enabled,
          disabled,
        });

      } catch (error) {

        console.error(
          "OWNER_GATEWAY_SUPERVISORS_STATS_FAILED",
          error
        );


        if (!active) return;


        setSupervisorsStat({
          status: "error",
          value: null,
          enabled: null,
          disabled: null,
        });
      }
    })();


    return () => {
      active = false;
    };

  }, [
    directorate,
    governorate,
    refreshSequence,
  ]);


  useEffect(() => {

    const allFinished =
      schoolsStat.status !== "loading" &&
      diplomaStat.status !== "loading" &&
      supervisorsStat.status !== "loading";

    if (!allFinished) {
      return;
    }

    setLastVerifiedAt(
      new Intl.DateTimeFormat(
        "ar-OM",
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      ).format(new Date())
    );

  }, [
    schoolsStat.status,
    diplomaStat.status,
    supervisorsStat.status,
  ]);


  if (!directorate) {
    return (
      <Navigate
        to="/system/management/governorates"
        replace
      />
    );
  }


  const encodedGovernorate =
    encodeURIComponent(governorate);


  const openSchools = () => {
    navigate(
      `/system/management/schools/${encodedGovernorate}`
    );
  };


  const openDiplomaCenters = () => {
    navigate(
      `/system/management/diploma-centers/${encodedGovernorate}`
    );
  };


  const openGovernorateSupervisors = () => {
    navigate(
      `/platform-governorate-supers?governorate=${encodedGovernorate}`
    );
  };


  const disabledSchools =
    schoolsStat.status === "ready"
      ? schoolsStat.disabled ?? 0
      : 0;


  const disabledDiplomaCenters =
    diplomaStat.status === "ready"
      ? diplomaStat.disabled ?? 0
      : 0;


  const noGovernorateSupervisor =
    supervisorsStat.status === "ready" &&
    supervisorsStat.value === 0;


  const noActiveGovernorateSupervisor =
    supervisorsStat.status === "ready" &&
    (supervisorsStat.value ?? 0) > 0 &&
    (supervisorsStat.enabled ?? 0) === 0;


  const hasOperationalWarnings =
    disabledSchools > 0 ||
    disabledDiplomaCenters > 0 ||
    noGovernorateSupervisor ||
    noActiveGovernorateSupervisor;


  const operationalWarningCount =
    (disabledSchools > 0 ? 1 : 0) +
    (disabledDiplomaCenters > 0 ? 1 : 0) +
    (noGovernorateSupervisor ? 1 : 0) +
    (noActiveGovernorateSupervisor ? 1 : 0);


  const statsLoading =
    schoolsStat.status === "loading" ||
    diplomaStat.status === "loading" ||
    supervisorsStat.status === "loading";


  const failedDataSources =
    (schoolsStat.status === "error" ? 1 : 0) +
    (diplomaStat.status === "error" ? 1 : 0) +
    (supervisorsStat.status === "error" ? 1 : 0);


  const healthTone =
    statsLoading
      ? "loading"
      : failedDataSources > 0
        ? "error"
        : hasOperationalWarnings
          ? "warning"
          : "ready";


  const healthLabel =
    statsLoading
      ? "جارٍ التحقق من بيانات المحافظة"
      : failedDataSources > 0
        ? "التحقق من البيانات غير مكتمل"
        : hasOperationalWarnings
          ? "توجد حالات تحتاج إلى مراجعة"
          : "لا توجد تنبيهات تشغيلية حالية";


  const refreshGovernorateData = () => {

    if (statsLoading) {
      return;
    }

    setRefreshSequence(
      (value) => value + 1
    );
  };


  return (
    <OwnerDashboardShell
      backTo="/system/management/governorates"
      backLabel="العودة إلى المحافظات"
    >

      <section className="owner-governorate-gateway__hero">

        <div
          className="owner-governorate-gateway__image"
          aria-hidden="true"
        >
          <img
            src={governoratesIcon}
            alt=""
          />
        </div>

        <span className="owner-governorates__eyebrow">
          المحافظات ← الإدارة الرئيسية
        </span>

        <h1>
          محافظة {governorate}
        </h1>

        <p>
          {directorate}
        </p>

      </section>


      {/* =======================================================
          INTERACTIVE GOVERNORATE STATS
          ======================================================= */}

      <section
        className="owner-governorate-gateway__stats"
        aria-label={`ملخص محافظة ${governorate}`}
      >

        <button
          type="button"
          className={`
            owner-governorate-gateway__stat
            owner-governorate-gateway__stat--schools
            owner-governorate-gateway__stat--${schoolsStat.status}
          `}
          onClick={openSchools}
          aria-label={`فتح مدارس محافظة ${governorate}`}
        >
          <span
            className="owner-governorate-gateway__statIcon"
            aria-hidden="true"
          >
            🏫
          </span>

          <div>
            <small>
              المدارس
            </small>

            <strong>
              {formatStatValue(schoolsStat)}
            </strong>

            <span className="owner-governorate-gateway__statMeta">
              {formatBreakdownStatus(schoolsStat)}
            </span>
          </div>
        </button>


        <button
          type="button"
          className={`
            owner-governorate-gateway__stat
            owner-governorate-gateway__stat--diploma
            owner-governorate-gateway__stat--${diplomaStat.status}
          `}
          onClick={openDiplomaCenters}
          aria-label={`فتح مراكز الدبلوم بمحافظة ${governorate}`}
        >
          <span
            className="owner-governorate-gateway__statIcon"
            aria-hidden="true"
          >
            🎓
          </span>

          <div>
            <small>
              مراكز الدبلوم
            </small>

            <strong>
              {formatStatValue(diplomaStat)}
            </strong>

            <span className="owner-governorate-gateway__statMeta">
              {formatBreakdownStatus(diplomaStat)}
            </span>
          </div>
        </button>


        <button
          type="button"
          className={`
            owner-governorate-gateway__stat
            owner-governorate-gateway__stat--supervisors
            owner-governorate-gateway__stat--${supervisorsStat.status}
          `}
          onClick={openGovernorateSupervisors}
          aria-label={`فتح مشرفي محافظة ${governorate}`}
        >
          <span
            className="owner-governorate-gateway__statIcon"
            aria-hidden="true"
          >
            👥
          </span>

          <div>
            <small>
              مشرفو المحافظة
            </small>

            <strong>
              {formatStatValue(supervisorsStat)}
            </strong>

            <span className="owner-governorate-gateway__statMeta">
              {formatBreakdownStatus(supervisorsStat)}
            </span>
          </div>
        </button>

      </section>


      <section
        className={`
          owner-governorate-gateway__health
          owner-governorate-gateway__health--${healthTone}
        `}
        aria-live="polite"
      >

        <div className="owner-governorate-gateway__healthMain">

          <span
            className="owner-governorate-gateway__healthIcon"
            aria-hidden="true"
          >
            {statsLoading
              ? "⏳"
              : failedDataSources > 0
                ? "⚠️"
                : hasOperationalWarnings
                  ? "🔎"
                  : "✅"}
          </span>

          <div>
            <strong>
              حالة محافظة {governorate}
            </strong>

            <span>
              {healthLabel}
            </span>
          </div>

        </div>


        <div className="owner-governorate-gateway__healthMeta">

          {!statsLoading &&
          failedDataSources === 0 ? (
            <span>
              التنبيهات:
              {" "}
              <b>
                {operationalWarningCount}
              </b>
            </span>
          ) : null}


          {failedDataSources > 0 ? (
            <span>
              مصادر تعذر التحقق منها:
              {" "}
              <b>
                {failedDataSources}
              </b>
            </span>
          ) : null}


          {lastVerifiedAt ? (
            <span>
              آخر تحقق:
              {" "}
              <b>
                {lastVerifiedAt}
              </b>
            </span>
          ) : null}


          <button
            type="button"
            disabled={statsLoading}
            onClick={refreshGovernorateData}
            className="owner-governorate-gateway__refresh"
          >
            <span aria-hidden="true">
              ↻
            </span>

            {statsLoading
              ? "جارٍ التحديث"
              : "تحديث البيانات"}
          </button>

        </div>

      </section>

      {hasOperationalWarnings ? (
        <section
          className="owner-governorate-gateway__alerts"
          aria-label={`التنبيهات التشغيلية لمحافظة ${governorate}`}
        >
          <div className="owner-governorate-gateway__alertsHeader">
            <span aria-hidden="true">
              ⚠️
            </span>

            <div>
              <strong>
                تنبيهات تشغيلية
              </strong>

              <small>
                حالات تحتاج إلى مراجعة داخل محافظة {governorate}
              </small>
            </div>
          </div>


          <div className="owner-governorate-gateway__alertsGrid">

            {disabledSchools > 0 ? (
              <button
                type="button"
                className="
                  owner-governorate-gateway__alertCard
                  owner-governorate-gateway__alertCard--school
                "
                onClick={openSchools}
              >
                <span aria-hidden="true">
                  🏫
                </span>

                <div>
                  <strong>
                    {disabledSchools}
                  </strong>

                  <small>
                    {disabledSchools === 1
                      ? "مدرسة موقوفة"
                      : "مدارس موقوفة"}
                  </small>
                </div>

                <b aria-hidden="true">
                  ←
                </b>
              </button>
            ) : null}


            {disabledDiplomaCenters > 0 ? (
              <button
                type="button"
                className="
                  owner-governorate-gateway__alertCard
                  owner-governorate-gateway__alertCard--diploma
                "
                onClick={openDiplomaCenters}
              >
                <span aria-hidden="true">
                  🎓
                </span>

                <div>
                  <strong>
                    {disabledDiplomaCenters}
                  </strong>

                  <small>
                    {disabledDiplomaCenters === 1
                      ? "مركز دبلوم موقوف"
                      : "مراكز دبلوم موقوفة"}
                  </small>
                </div>

                <b aria-hidden="true">
                  ←
                </b>
              </button>
            ) : null}


            {noGovernorateSupervisor ? (
              <button
                type="button"
                className="
                  owner-governorate-gateway__alertCard
                  owner-governorate-gateway__alertCard--supervisor
                "
                onClick={openGovernorateSupervisors}
              >
                <span aria-hidden="true">
                  👥
                </span>

                <div>
                  <strong>
                    لا يوجد مشرف
                  </strong>

                  <small>
                    لم يتم ربط مشرف بهذه المحافظة
                  </small>
                </div>

                <b aria-hidden="true">
                  ←
                </b>
              </button>
            ) : null}


            {noActiveGovernorateSupervisor ? (
              <button
                type="button"
                className="
                  owner-governorate-gateway__alertCard
                  owner-governorate-gateway__alertCard--supervisor
                "
                onClick={openGovernorateSupervisors}
              >
                <span aria-hidden="true">
                  ⛔
                </span>

                <div>
                  <strong>
                    لا يوجد مشرف مفعّل
                  </strong>

                  <small>
                    جميع مشرفي المحافظة موقوفون
                  </small>
                </div>

                <b aria-hidden="true">
                  ←
                </b>
              </button>
            ) : null}

          </div>
        </section>
      ) : null}
{/* =======================================================
          OPERATIONAL CARDS
          ======================================================= */}

      <section
        className="owner-governorate-gateway__actions"
        aria-label={`الخدمات الإدارية لمحافظة ${governorate}`}
      >

        <button
          type="button"
          className={`
            owner-governorate-gateway__actionCard
            owner-governorate-gateway__actionCard--schools
            ${
              disabledSchools > 0
                ? "owner-governorate-gateway__actionCard--attention"
                : ""
            }
          `}
          onClick={openSchools}
        >
          <span
            className="owner-governorate-gateway__actionIcon"
            aria-hidden="true"
          >
            🏫
          </span>

          <span className="owner-governorate-gateway__actionText">
            <strong>
              مدارس محافظة {governorate}
            </strong>

            <small>
              عرض وإدارة المدارس المرتبطة بهذه المحافظة
            </small>

            <span
              className={`
                owner-governorate-gateway__actionStatus
                owner-governorate-gateway__actionStatus--${schoolsStat.status}
              `}
            >
              {schoolsStat.status === "loading"
                ? "جارٍ التحقق من بيانات المدارس"
                : schoolsStat.status === "error"
                  ? "تعذر التحقق من بيانات المدارس"
                  : `الإجمالي: ${schoolsStat.value ?? 0} · مفعّل: ${
                      schoolsStat.enabled ?? 0
                    } · موقوف: ${
                      schoolsStat.disabled ?? 0
                    }`}
            </span>
          </span>

          <span className="owner-governorate-gateway__actionOpen">
            فتح إدارة المدارس
            <b aria-hidden="true">←</b>
          </span>
        </button>


        <button
          type="button"
          className={`
            owner-governorate-gateway__actionCard
            owner-governorate-gateway__actionCard--diploma
            ${
              disabledDiplomaCenters > 0
                ? "owner-governorate-gateway__actionCard--attention"
                : ""
            }
          `}
          onClick={openDiplomaCenters}
        >
          <span
            className="owner-governorate-gateway__actionIcon"
            aria-hidden="true"
          >
            🎓
          </span>

          <span className="owner-governorate-gateway__actionText">
            <strong>
              مراكز الدبلوم بمحافظة {governorate}
            </strong>

            <small>
              عرض وإدارة مراكز امتحانات الدبلوم التابعة للمحافظة
            </small>

            <span
              className={`
                owner-governorate-gateway__actionStatus
                owner-governorate-gateway__actionStatus--${diplomaStat.status}
              `}
            >
              {diplomaStat.status === "loading"
                ? "جارٍ التحقق من بيانات المراكز"
                : diplomaStat.status === "error"
                  ? "تعذر التحقق من بيانات المراكز"
                  : `الإجمالي: ${diplomaStat.value ?? 0} · مفعّل: ${
                      diplomaStat.enabled ?? 0
                    } · موقوف: ${
                      diplomaStat.disabled ?? 0
                    }`}
            </span>
          </span>

          <span className="owner-governorate-gateway__actionOpen">
            فتح مراكز الدبلوم
            <b aria-hidden="true">←</b>
          </span>
        </button>


        <button
          type="button"
          className={`
            owner-governorate-gateway__actionCard
            owner-governorate-gateway__actionCard--supervisor
            ${
              noGovernorateSupervisor ||
              noActiveGovernorateSupervisor
                ? "owner-governorate-gateway__actionCard--attention"
                : ""
            }
          `}
          onClick={openGovernorateSupervisors}
        >
          <span
            className="owner-governorate-gateway__actionIcon"
            aria-hidden="true"
          >
            👥
          </span>

          <span className="owner-governorate-gateway__actionText">
            <strong>
              مشرف محافظة {governorate}
            </strong>

            <small>
              الانتقال إلى إدارة مشرفي المحافظات ومراجعة حساب المشرف
            </small>

            <span
              className={`
                owner-governorate-gateway__actionStatus
                owner-governorate-gateway__actionStatus--${supervisorsStat.status}
              `}
            >
              {supervisorsStat.status === "loading"
                ? "جارٍ التحقق من حسابات المشرفين"
                : supervisorsStat.status === "error"
                  ? "تعذر التحقق من حسابات المشرفين"
                  : noGovernorateSupervisor
                    ? "لم يتم ربط مشرف بهذه المحافظة"
                    : `الإجمالي: ${supervisorsStat.value ?? 0} · مفعّل: ${
                        supervisorsStat.enabled ?? 0
                      } · موقوف: ${
                        supervisorsStat.disabled ?? 0
                      }`}
            </span>
          </span>

          <span className="owner-governorate-gateway__actionOpen">
            إدارة مشرف المحافظة
            <b aria-hidden="true">←</b>
          </span>
        </button>

      </section>


      <section className="owner-governorate-gateway__scopeNotice">

        <span aria-hidden="true">
          🛡️
        </span>

        <div>
          <strong>
            نطاق محافظة {governorate}
          </strong>

          <p>
            الإحصاءات تعرض فقط البيانات التي تم التحقق منها من مصادر النظام.
            ويمكن فتح كل قسم مباشرة من بطاقة الإحصاء أو من بطاقة الإدارة.
          </p>
        </div>

      </section>

    </OwnerDashboardShell>
  );
}