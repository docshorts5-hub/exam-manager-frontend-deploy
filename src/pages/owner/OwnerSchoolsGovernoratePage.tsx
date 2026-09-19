import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { callFn } from "../../services/functionsClient";
import { DIRECTORATES } from "../../constants/directorates";
import { loadOwnerSchoolReadModel } from "./ownerSchoolReadModel";
import {
  canonicalGovernorate,
  classifyOwnerSchoolTenant,
  safeDecodeRouteValue,
  sameGovernorate,
  tenantDisplayName,
  tenantGovernorate,
  type OwnerSchoolTenant,
} from "./ownerSchoolReadModel";
import "./ownerSchools.css";
import { schoolsDiplomaIcon, ministryLogo } from "../../assets/branding";


type LoadState = "loading" | "ready" | "error";
type SchoolWriteMode = "create" | "edit";

type SchoolUpsertRequest = {
  tenantId: string;
  schoolName: string;
  governorate: string;
};

const upsertSchoolTenant = callFn<SchoolUpsertRequest, unknown>(
  "adminUpsertSchoolTenant",
);

type SchoolDeleteRequest = {
  tenantId: string;
};

const deleteSchoolTenant = callFn<SchoolDeleteRequest, unknown>(
  "adminDeleteSchoolTenant",
);

const updateSchoolStatus = callFn<
  {
    tenantId: string;
    enabled: boolean;
  },
  {
    tenantId: string;
    enabled: boolean;
  }
>("adminUpdateSchoolStatus");

function SchoolIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M7 18.5 24 9l17 9.5-17 9.5L7 18.5Z" />
      <path d="M13 23.5V35h22V23.5" />
      <path d="M20 35v-8h8v8" />
      <path d="M8 18.5V31" />
    </svg>
  );
}

export default function OwnerSchoolsGovernoratePage() {
  const navigate = useNavigate();
  const { governorateId } = useParams();
  const { logout } = useAuth() as any;

  const decodedGovernorate = canonicalGovernorate(
    safeDecodeRouteValue(governorateId),
  );

  const officialGovernorates = useMemo(
    () => DIRECTORATES.map((value) => canonicalGovernorate(value)).filter(Boolean),
    [],
  );

  const isOfficialGovernorate = officialGovernorates.some(
    (item) => item === decodedGovernorate,
  );

  const [rows, setRows] = useState<OwnerSchoolTenant[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [writeMode, setWriteMode] = useState<SchoolWriteMode | null>(null);
  const [writeTenantId, setWriteTenantId] = useState("");
  const [writeSchoolName, setWriteSchoolName] = useState("");
  const [writeSaving, setWriteSaving] = useState(false);
  const [writeError, setWriteError] = useState("");
  const [writeNotice, setWriteNotice] = useState("");

  const [statusDialogSchool, setStatusDialogSchool] = useState<{
    id: string;
    name: string;
    enabled: boolean;
  } | null>(null);

  const [statusUpdatePending, setStatusUpdatePending] = useState(false);
  const [reloadSequence, setReloadSequence] = useState(0);

  const [deleteDialogSchool, setDeleteDialogSchool] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [deletePending, setDeletePending] = useState(false);

  useEffect(() => {
    if (!isOfficialGovernorate) return;

    setLoadState("loading");
    setLoadError("");

    let cancelled = false;

    loadOwnerSchoolReadModel({
      isPlatformOwner: true,
    })
      .then((result) => {
        if (cancelled) return;

        setRows(
          (Array.isArray(result?.schools)
            ? result.schools
            : []) as OwnerSchoolTenant[],
        );

        setLoadState("ready");
        setLoadError("");
      })
      .catch((error) => {
        console.error(
          "OWNER_SCHOOLS_GOVERNORATE_READ_FAILED",
          error,
        );

        if (cancelled) return;

        setRows([]);
        setLoadState("error");
        setLoadError("تعذر تحميل مدارس المحافظة.");
      });

    return () => {
      cancelled = true;
    };
  }, [isOfficialGovernorate, reloadSequence]);

  const schoolRows = useMemo(
    () =>
      rows
        .filter((row) => classifyOwnerSchoolTenant(row) === "school")
        .filter((row) =>
          sameGovernorate(tenantGovernorate(row), decodedGovernorate),
        )
        .sort((a, b) =>
          tenantDisplayName(a).localeCompare(tenantDisplayName(b), "ar"),
        ),
    [rows, decodedGovernorate],
  );

  const hiddenUnknownInGovernorate = useMemo(
    () =>
      rows.filter(
        (row) =>
          classifyOwnerSchoolTenant(row) === "unknown" &&
          sameGovernorate(tenantGovernorate(row), decodedGovernorate),
      ).length,
    [rows, decodedGovernorate],
  );

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return schoolRows;

    return schoolRows.filter((row) => {
      const name = tenantDisplayName(row).toLowerCase();
      const id = String(row.id || "").trim().toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [schoolRows, search]);

  const openCreateForm = () => {
    if (loadState !== "ready" || writeSaving) return;

    setWriteMode("create");
    setWriteTenantId("");
    setWriteSchoolName("");
    setWriteError("");
    setWriteNotice("");
  };

  const openEditForm = (row: OwnerSchoolTenant) => {
    if (loadState !== "ready" || writeSaving) return;

    const tenantId = String(row.id || "").trim();
    if (!tenantId) return;

    setWriteMode("edit");
    setWriteTenantId(tenantId);
    setWriteSchoolName(tenantDisplayName(row));
    setWriteError("");
    setWriteNotice("");
  };

  const requestSchoolStatusChange = (school: {
    id: string;
    name: string;
    enabled: boolean;
  }) => {
    if (statusUpdatePending) {
      return;
    }

    setStatusDialogSchool(school);
  };

  const closeWriteForm = () => {
    setWriteMode(null);
    setWriteTenantId("");
    setWriteSchoolName("");
    setWriteError("");
    setWriteNotice("");
  };
  const confirmSchoolStatusChange = async () => {
  if (!statusDialogSchool || statusUpdatePending) {
    return;
  }

  const school = statusDialogSchool;
  const nextEnabled = !school.enabled;

  setStatusUpdatePending(true);
  setWriteError("");

  try {
    const response = await updateSchoolStatus({
      tenantId: school.id,
      enabled: nextEnabled,
    });

    if (
      !response ||
      response.tenantId !== school.id ||
      response.enabled !== nextEnabled
    ) {
      throw new Error("SCHOOL_STATUS_VERIFY_FAILED");
    }

    setRows((currentRows) =>
      currentRows.map((row) =>
        String(row.id) === school.id
          ? {
              ...row,
              enabled: nextEnabled,
            }
          : row,
      ),
    );

    setStatusDialogSchool(null);

    setWriteNotice(
      nextEnabled
        ? "تم تفعيل المدرسة بنجاح."
        : "تم تعطيل المدرسة بنجاح.",
    );

    setReloadSequence((value) => value + 1);

  } catch (error) {
    console.error(
      "SCHOOL_STATUS_UPDATE_FAILED",
      error,
    );

    setWriteError(
      "تعذر تحديث حالة المدرسة.",
    );

  } finally {
    setStatusUpdatePending(false);
  }
};

  const submitSchoolWrite = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (
      !writeMode ||
      writeSaving ||
      loadState !== "ready" ||
      !isOfficialGovernorate
    ) {
      return;
    }

    const tenantId = writeTenantId.trim();
    const schoolName = writeSchoolName.trim();

    

    if (/[\\/]/.test(tenantId)) {
      setWriteError("Tenant ID غير صالح.");
      return;
    }

    if (!schoolName) {
      setWriteError("اسم المدرسة مطلوب.");
      return;
    }

    // SECURITY: governorate is taken only from the validated route.
    // SECURITY: edit mode keeps the existing tenantId immutable.
    // SECURITY: no browser Firestore write or privileged local fallback.
    const mode = writeMode;

    setWriteSaving(true);
    setWriteError("");
    setWriteNotice("");

    try {
      await upsertSchoolTenant({
        tenantId,
        schoolName,
        governorate: decodedGovernorate,
      });

      setWriteMode(null);
      setWriteTenantId("");
      setWriteSchoolName("");
      setWriteNotice(
        mode === "create"
          ? "تم إنشاء المدرسة عبر سلطة الخادم."
          : "تم تحديث المدرسة عبر سلطة الخادم.",
      );
    } catch (error) {
      console.error("OWNER_SCHOOL_UPSERT_FAILED", error);
      setWriteError(
        "تعذر حفظ المدرسة. تم الإيقاف دون أي كتابة بديلة من المتصفح.",
      );
    } finally {
      setWriteSaving(false);
    }
  };

  const submitSchoolDelete = async () => {

    if (
      !deleteDialogSchool ||
      deletePending ||
      !isOfficialGovernorate
    ) {
      return;
    }

    const tenantId =
      String(deleteDialogSchool.id || "").trim();

    if (!tenantId) {
      setWriteError("Tenant ID missing.");
      return;
    }

    setDeletePending(true);
    setWriteError("");
    setWriteNotice("");

    try {

      await deleteSchoolTenant({
        tenantId,
      });

      setDeleteDialogSchool(null);

      setReloadSequence((value) => value + 1);

      setWriteNotice(
        "تم حذف المدرسة عبر سلطة الخادم.",
      );

    } catch (error) {

      console.error(
        "OWNER_SCHOOL_DELETE_FAILED",
        error,
      );

      setWriteError(
        "تعذر حذف المدرسة. تم إيقاف العملية بدون كتابة بديلة من المتصفح.",
      );

    } finally {

      setDeletePending(false);

    }
  };

  if (!isOfficialGovernorate) {
    return <Navigate to="/system/management/schools" replace />;
  }

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

      <main className="owner-schools__main owner-schools__main--governorate">
        <div className="owner-schools__breadcrumb">
          <button type="button" onClick={() => navigate("/system/management")}>
            الإدارة الرئيسية
          </button>
          <span>‹</span>
          <button type="button" onClick={() => navigate("/system/management/schools")}>
            المدارس
          </button>
          <span>‹</span>
          <strong>محافظة {decodedGovernorate}</strong>
        </div>

        <section className="owner-schools__hero owner-schools__hero--child">
          <div className="owner-schools__heroIcon">
            <img
              src={schoolsDiplomaIcon}
              alt=""
              aria-hidden="true"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
          <div>
            <p>المدارس حسب المحافظة</p>
            <h1>محافظة {decodedGovernorate}</h1>
            <span>إدارة مدارس المحافظة عبر سلطة خادم مخصصة للإنشاء والتعديل، مع بقاء الحذف غير مفعّل.</span>
          </div>
        </section>

        {/* OWNER_SCHOOLS_BACK_TO_GOVERNORATE_GATEWAY */}
        <div
          style={{
            width: "min(1180px, calc(100% - 36px))",
            margin: "10px auto 14px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            className="owner-schools__backButton"
            onClick={() =>
              navigate(
                `/system/management/governorates/${encodeURIComponent(
                  decodedGovernorate
                )}`
              )
            }
            style={{
              minWidth: 240,
              minHeight: 42,
              fontWeight: 1000,
            }}
          >
            ← العودة إلى بوابة محافظة {decodedGovernorate}
          </button>
        </div>

        <section className="owner-schools__childToolbar">
<button
            type="button"
            className="owner-schools__backButton"
            onClick={() => navigate("/system/management/schools")}
          >
            العودة إلى المحافظات
          </button>

          <button
            type="button"
            className="owner-schools__backButton"
            onClick={openCreateForm}
            disabled={loadState !== "ready" || writeSaving}
          >
            إضافة مدرسة
          </button>
          <label className="owner-schools__search">
            <span>بحث</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="اسم المدرسة أو Tenant ID"
              disabled={loadState !== "ready"}
            />
          </label>
        </section>

        {writeMode ? (
          <section
            className="owner-schools__childToolbar"
            aria-label={
              writeMode === "create" ? "إنشاء مدرسة" : "تعديل مدرسة"
            }
          >
            <form
              onSubmit={submitSchoolWrite}
              style={{ display: "contents" }}
            >
              <label className="owner-schools__search">
                <span>Tenant ID</span>
                <input
                  type="text"
                  value={writeTenantId}
                  onChange={(event) => {
                    const value = event.target.value;

                    if (/^[A-Za-z0-9_-]*$/.test(value)) {
                      setWriteTenantId(value);
                    }
                  }}
                  placeholder="school-tenant-id"
                  disabled={writeMode === "edit" || writeSaving}
                  autoComplete="off"
                  required
                />
              </label>

              <label className="owner-schools__search">
                <span>اسم المدرسة</span>
                <input
                  type="text"
                  value={writeSchoolName}
                  onChange={(event) => setWriteSchoolName(event.target.value)}
                  placeholder="اسم المدرسة"
                  disabled={writeSaving}
                  autoComplete="off"
                  required
                />
              </label>

              <span className="owner-schools__guardNotice">
                المحافظة مقفلة من المسار: {decodedGovernorate}
              </span>

              <button
                type="submit"
                className="owner-schools__backButton"
                disabled={writeSaving}
              >
                {writeSaving
                  ? "جارٍ الحفظ..."
                  : writeMode === "create"
                    ? "إنشاء المدرسة"
                    : "حفظ التعديل"}
              </button>

              <button
                type="button"
                className="owner-schools__backButton"
                onClick={closeWriteForm}
                disabled={writeSaving}
              >
                إلغاء
              </button>

              {writeError ? (
                <span className="owner-schools__guardNotice">
                  {writeError}
                </span>
              ) : null}
            </form>
          </section>
        ) : null}

        {writeNotice ? (
          <section className="owner-schools__statusRow" aria-live="polite">
            <span className="owner-schools__status owner-schools__status--ready">
              {writeNotice}
            </span>
          </section>
        ) : null}
        <section className="owner-schools__statusRow" aria-live="polite">
          <span className={`owner-schools__status owner-schools__status--${loadState}`}>
            {loadState === "loading"
              ? "جارٍ تحميل مدارس المحافظة..."
              : loadState === "error"
                ? loadError
                : `${schoolRows.length} مدرسة مصنفة صراحةً`}
          </span>

          {loadState === "ready" && hiddenUnknownInGovernorate > 0 ? (
            <span className="owner-schools__guardNotice">
              {hiddenUnknownInGovernorate} سجل غير مصنف داخل المحافظة مخفي وفق Fail-Closed
            </span>
          ) : null}
        </section>

        <section className="owner-schools__schoolList" aria-label={`مدارس محافظة ${decodedGovernorate}`}>
          {loadState === "ready" && visibleRows.length === 0 ? (
            <div className="owner-schools__empty">
              {search
                ? "لا توجد مدرسة مصنفة تطابق البحث."
                : "لا توجد مدارس مصنفة صراحةً داخل هذه المحافظة حتى الآن."}
            </div>
          ) : null}

          {visibleRows.map((row) => (
            <article key={row.id} className="owner-schools__schoolRow">
              <span className="owner-schools__schoolRowIcon">
                <SchoolIcon />
              </span>

              <div className="owner-schools__schoolRowText">
                <strong>{tenantDisplayName(row)}</strong>
                <span>Tenant ID: {row.id}</span>
              </div>

              <span
                className={`owner-schools__enabled ${
                  row.enabled === false ? "owner-schools__enabled--off" : ""
                }`}
              >
                {row.enabled === false ? "غير مفعلة" : "مفعلة"}
              </span>

                            <div className="owner-schools__actions">
              {/* OWNER_SCHOOL_TENANT_ENTRY_BUTTON */}
              <button
                type="button"
                className="
                  owner-schools__backButton
                  owner-schools__tenantEntry
                "
                onClick={() => {
                  const tenantId =
                    String(row.id || "").trim();

                  if (!tenantId) {
                    return;
                  }

                  navigate(
                    `/t/${encodeURIComponent(
                      tenantId
                    )}/dashboard`
                  );
                }}
                disabled={
                  loadState !== "ready" ||
                  !String(row.id || "").trim()
                }
              >
                🚪 دخول المدرسة
              </button>


              <button
                type="button"
                className="owner-schools__backButton"
                onClick={() => openEditForm(row)}
                disabled={writeSaving}
              >
                ✏️ تعديل
              </button>

              <button
                type="button"
                className="owner-schools__backButton"
                onClick={() =>
                  requestSchoolStatusChange({
                    id: String(row.id),
                    name: tenantDisplayName(row),
                    enabled: Boolean(row.enabled),
                  })
                }
                disabled={statusUpdatePending}
              >
                {row.enabled ? "🔴 تعطيل" : "🟢 تفعيل"}
              </button>
              <button
                type="button"
                className="owner-schools__backButton"
                onClick={() =>
                  setDeleteDialogSchool({
                    id: String(row.id),
                    name: tenantDisplayName(row),
                  })
                }
                disabled={
                  writeSaving ||
                  statusUpdatePending ||
                  deletePending
                }
              >
                🗑️ حذف
              </button>

              </div>
              <span className="owner-schools__readonlyBadge">إدارة عبر الخادم</span>
            </article>
          ))}
        </section>

        <div className="owner-schools__writeHold">
          الإنشاء والتعديل مفعّلان فقط عبر adminUpsertSchoolTenant مع تثبيت المحافظة من المسار. الحذف ونقل المحافظة والكتابة المباشرة إلى Firestore غير مفعّلة.
        </div>

        {statusDialogSchool ? (
          <div
            className="owner-schools__statusModalOverlay"
            role="dialog"
            aria-modal="true"
          >
            <div className="owner-schools__statusModalCard">

              <div className="owner-schools__statusModalIcon">
                {statusDialogSchool.enabled ? "🔴" : "🟢"}
              </div>

              <h3 className="owner-schools__statusModalTitle">
                {statusDialogSchool.enabled
                  ? "تعطيل المدرسة"
                  : "تفعيل المدرسة"}
              </h3>

              <p className="owner-schools__statusModalText">
                هل أنت متأكد من{" "}
                {statusDialogSchool.enabled ? "تعطيل" : "تفعيل"}
                المدرسة؟
                <br />

                <strong className="owner-schools__statusSchoolName">
                  "{statusDialogSchool.name}"
                </strong>
              </p>

              <div className="owner-schools__statusModalActions">

                <button
                  type="button"
                  className="owner-schools__actionButton"
                  onClick={() => setStatusDialogSchool(null)}
                  disabled={statusUpdatePending}
                >
                  إلغاء
                </button>

                <button
                  type="button"
                  className="owner-schools__actionButton owner-schools__actionButton--disable"
                  onClick={() => {
                    void confirmSchoolStatusChange();
                  }}
                  disabled={statusUpdatePending}
                >
                  {statusUpdatePending
                    ? "جارٍ التنفيذ..."
                    : statusDialogSchool.enabled
                      ? "تعطيل المدرسة"
                      : "تفعيل المدرسة"}
                </button>

              </div>

            </div>
          </div>
        ) : null}
      </main>
      {deleteDialogSchool ? (
        <section className="owner-schools__dialogOverlay">
          <div className="owner-schools__dialog">
            <h2>تأكيد حذف المدرسة</h2>

            <p>
              هل أنت متأكد من حذف:
              <strong>
                {" "}
                {deleteDialogSchool.name}
              </strong>
              ؟
            </p>

            <button
              type="button"
              className="owner-schools__backButton"
              onClick={submitSchoolDelete}
              disabled={deletePending}
            >
              {deletePending
                ? "جارٍ الحذف..."
                : "تأكيد الحذف"}
            </button>

            <button
              type="button"
              className="owner-schools__backButton"
              onClick={() => setDeleteDialogSchool(null)}
              disabled={deletePending}
            >
              إلغاء
            </button>
          </div>
        </section>
      ) : null}

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






