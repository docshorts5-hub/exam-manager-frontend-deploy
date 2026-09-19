import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Navigate,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { DIRECTORATES } from "../../constants/directorates";
import { callFn } from "../../services/functionsClient";
import {
  buildAuthzSnapshot,
  isPlatformOwner,
} from "../../features/authz";
import {
  canonicalDiplomaCenterGovernorate,
  loadOwnerDiplomaCenterReadModel,
  type OwnerDiplomaCenterReadResult,
} from "./ownerDiplomaCenterReadModel";
import "./ownerDiplomaCenters.css";

const MINISTRY_LOGO = "https://i.postimg.cc/j5G4NQvZ/sh%CA%BFar-1.png";

const DIPLOMA_CENTER_ICON =
  "https://i.postimg.cc/YC9R5944/352d2558-14ff-434e-821d-3ffad98df2c4.jpg";

type LoadState = "loading" | "ready" | "error";

type DiplomaCenterFormMode =
  | "create"
  | "update";

type DiplomaCenterUpsertRequest = {
  id?: string;
  name: string;
  governorate: string;
  enabled: boolean;
};

type DiplomaCenterCreateResponse = {
  id: string;
  name: string;
  governorate: string;
  enabled: boolean;
};

const updateDiplomaCenterStatus = callFn<
  {
    id: string;
    enabled: boolean;
  },
  {
    id: string;
    enabled: boolean;
  }
>("adminUpdateDiplomaCenterStatus");


const upsertDiplomaCenterTenant = callFn<
  DiplomaCenterUpsertRequest,
  DiplomaCenterCreateResponse
>("adminUpsertDiplomaCenterTenant");
const deleteDiplomaCenterTenant = callFn<
  {
    id: string;
  },
  {
    ok: boolean;
    id: string;
    deleteExpiresAt: unknown;
    correlationId: string;
  }
>("adminDeleteDiplomaCenterTenant");


const EMPTY_RESULT: OwnerDiplomaCenterReadResult = {
  centers: [],
  rejected: [],
};

function safeDecodeRouteValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

export default function OwnerDiplomaCentersGovernoratePage() {
  const navigate = useNavigate();
  const { governorateId = "" } = useParams<{
    governorateId: string;
  }>();

  const auth = useAuth() as any;
  const { logout } = auth;

  const authzSnapshot = useMemo(
    () => buildAuthzSnapshot(auth),
    [auth],
  );

  const owner = isPlatformOwner(authzSnapshot);

  const routeGovernorate = useMemo(
    () =>
      canonicalDiplomaCenterGovernorate(
        safeDecodeRouteValue(governorateId),
      ),
    [governorateId],
  );

  const officialGovernorates = useMemo(
    () =>
      new Set(
        DIRECTORATES.map((value) =>
          canonicalDiplomaCenterGovernorate(value),
        ).filter(Boolean),
      ),
    [],
  );

  const validGovernorate =
    Boolean(routeGovernorate) &&
    officialGovernorates.has(routeGovernorate);

  const [result, setResult] =
    useState<OwnerDiplomaCenterReadResult>(EMPTY_RESULT);
  const [loadState, setLoadState] =
    useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [reloadSequence, setReloadSequence] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEnabled, setCreateEnabled] = useState(true);
  
const [deletePending, setDeletePending] =
    useState(false);

const [deleteError, setDeleteError] =
    useState("");

const [deleteDialogCenter, setDeleteDialogCenter] =
    useState<{
      id: string;
      name: string;
    } | null>(null);
const [statusUpdatePending, setStatusUpdatePending] = useState(false);

  const [statusDialogCenter, setStatusDialogCenter] =
    useState<{
      id: string;
      name: string;
      enabled: boolean;
    } | null>(null);

  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createNotice, setCreateNotice] = useState("");
  const [centerSearch, setCenterSearch] = useState("");

  const [editingCenter, setEditingCenter] =
    useState<{
      id: string;
      name: string;
      enabled: boolean;
    } | null>(null);

  const [formMode, setFormMode] =
    useState<DiplomaCenterFormMode>("create");

  const createSubmitInFlight = useRef(false);

  useEffect(() => {
    if (!owner || !validGovernorate) {
      setResult(EMPTY_RESULT);
      setLoadState("error");
      setLoadError(
        !owner
          ? "هذه الصفحة مخصصة لمالك المنصة فقط."
          : "المحافظة المطلوبة غير معتمدة.",
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
          "OWNER_DIPLOMA_CENTERS_GOVERNORATE_READ_FAILED",
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
  }, [
    owner,
    reloadSequence,
    routeGovernorate,
    validGovernorate,
  ]);

  const requestDiplomaCenterStatusChange = (center: {
    id: string;
    name: string;
    enabled: boolean;
  }) => {
    if (statusUpdatePending) {
      return;
    }

    setStatusDialogCenter(center);
  };

  const confirmDiplomaCenterStatusChange = async () => {
    if (!statusDialogCenter || statusUpdatePending) {
      return;
    }

    const center = statusDialogCenter;
    const nextEnabled = !center.enabled;

    setStatusUpdatePending(true);

    try {
      const response = await updateDiplomaCenterStatus({
        id: center.id,
        enabled: nextEnabled,
      });

      if (
        !response ||
        response.id !== center.id ||
        response.enabled !== nextEnabled
      ) {
        throw new Error("DIPLOMA_STATUS_VERIFY_FAILED");
      }

      setStatusDialogCenter(null);
      setReloadSequence((value) => value + 1);

      setFormMode("create");
      setEditingCenter(null);
      setCreateName("");
      setCreateEnabled(true);

    } finally {
      setStatusUpdatePending(false);
    }
  };


  const requestDeleteDiplomaCenter = (center: {
    id: string;
    name: string;
  }) => {
    if (deletePending) {
      return;
    }

    setDeleteError("");

    setDeleteDialogCenter({
      id: center.id,
      name: center.name,
    });
  };


  const confirmDeleteDiplomaCenter = async () => {
    if (!deleteDialogCenter || deletePending) {
      return;
    }

    setDeletePending(true);
setDeleteError("");

    try {
      const response = await deleteDiplomaCenterTenant({
        id: deleteDialogCenter.id,
      });

      if (
        !response ||
        response.ok !== true ||
        response.id !== deleteDialogCenter.id
      ) {
        throw new Error("DIPLOMA_DELETE_VERIFY_FAILED");
      }

      setDeleteDialogCenter(null);

      setReloadSequence((value) => value + 1);

    } catch {
      setDeleteError(
        "تعذر حذف مركز الدبلوم. لم يتم اعتماد أي تغيير من الواجهة.",
      );
    } finally {
      setDeletePending(false);
    }
  };

  const openCreateForm = () => {
    if (
      loadState !== "ready" ||
      createPending ||
      !owner ||
      !validGovernorate
    ) {
      return;
    }

    setFormMode("create");
    setEditingCenter(null);

    setCreateName("");
    setCreateEnabled(true);
    setCreateError("");
    setCreateNotice("");
    setCreateOpen(true);
  };

  const openEditForm = (center: {
    id: string;
    name: string;
    enabled: boolean;
  }) => {
    if (
      createPending ||
      loadState !== "ready" ||
      !owner ||
      !validGovernorate
    ) {
      return;
    }

    setFormMode("update");
    setEditingCenter(center);
    setCreateName(center.name);
    setCreateEnabled(center.enabled);
    setCreateError("");
    setCreateNotice("");
    setCreateOpen(true);
  };

  const closeCreateForm = () => {
    if (createPending) return;

    setCreateOpen(false);

    setFormMode("create");
    setEditingCenter(null);

    setCreateName("");
    setCreateEnabled(true);
    setCreateError("");
    setCreateNotice("");
  };

  const submitCreateDiplomaCenter = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (
      createSubmitInFlight.current ||
      createPending ||
      loadState !== "ready" ||
      !owner ||
      !validGovernorate
    ) {
      return;
    }

    const name = createName.trim();

    if (!name) {
      setCreateError("اسم مركز الدبلوم مطلوب.");
      return;
    }

    if (
      !routeGovernorate ||
      !officialGovernorates.has(routeGovernorate)
    ) {
      setCreateError("المحافظة المطلوبة غير معتمدة.");
      return;
    }

    // SECURITY: governorate is taken only from the validated route.
    // SECURITY: no client-supplied tenant id on create.
    // SECURITY: no browser Firestore write or privileged local fallback.
    createSubmitInFlight.current = true;
    setCreatePending(true);
    setCreateError("");
    setCreateNotice("");

    try {
      const response = await upsertDiplomaCenterTenant({
        ...(editingCenter
          ? { id: editingCenter.id }
          : {}),
        name,
        governorate: routeGovernorate,
        enabled: createEnabled,
      });

      if (
        !response ||
        typeof response.id !== "string" ||
        response.id.trim() === "" ||
        response.name !== name ||
        response.governorate !== routeGovernorate
      ) {
        throw new Error("UPSERT_NOT_CONFIRMED");
      }

      setCreateOpen(false);
      setCreateName("");
      setCreateEnabled(true);
      setCreateError("");
      setCreateNotice(
        "تم تأكيد العملية من الخادم. يتم تحديث قائمة المحافظة من نموذج القراءة.",
      );

      // No optimistic insertion. Visibility comes only from
      // the existing dedicated read model after reload.
      setReloadSequence((value) => value + 1);

      setFormMode("create");
      setEditingCenter(null);
      setCreateName("");
      setCreateEnabled(true);
    } catch {
      setCreateError(
        "تعذر إنشاء مركز الدبلوم. تم الإيقاف دون أي كتابة بديلة من المتصفح.",
      );
    } finally {
      createSubmitInFlight.current = false;
      setCreatePending(false);
    }
  };

  const governorateCenters = useMemo(
    () =>
      result.centers.filter(
        (center) =>
          canonicalDiplomaCenterGovernorate(
            center.governorate,
          ) === routeGovernorate,
      ),
    [result.centers, routeGovernorate],
  );

  const filteredGovernorateCenters = useMemo(
    () => {
      const query = centerSearch
        .trim()
        .toLowerCase();

      if (!query) {
        return governorateCenters;
      }

      return governorateCenters.filter((center) =>
        center.name
          .toLowerCase()
          .includes(query),
      );
    },
    [centerSearch, governorateCenters],
  );

  const governorateRejectedCount = useMemo(
    () =>
      result.rejected.filter((item) =>
        item.governorates.some(
          (value) =>
            canonicalDiplomaCenterGovernorate(value) ===
            routeGovernorate,
        ),
      ).length,
    [result.rejected, routeGovernorate],
  );

  if (!owner) {
    return <Navigate to="/system" replace />;
  }

  if (!validGovernorate) {
    return (
      <Navigate
        to="/system/management/diploma-centers"
        replace
      />
    );
  }

  return (
    <div className="owner-diploma-centers" dir="rtl">
      <header className="owner-diploma-centers__header">
        <div className="owner-diploma-centers__identity">
          <img
            src={MINISTRY_LOGO}
            alt="شعار وزارة التعليم"
          />
          <div>
            <strong>سلطنة عمان</strong>
            <span>وزارة التعليم</span>
          </div>
        </div>

        <div className="owner-diploma-centers__ownerBadge">
          مالك المنصة
        </div>
      </header>

      <main className="owner-diploma-centers__main owner-diploma-centers__main--governorate">
<div className="owner-diploma-centers__breadcrumb">
          <button
            type="button"
            onClick={() =>
              navigate("/system/management")
            }
          >
            الإدارة الرئيسية
          </button>
          <span>‹</span>
          <button
            type="button"
            onClick={() =>
              navigate(
                "/system/management/diploma-centers",
              )
            }
          >
            مراكز الدبلوم
          </button>
          <span>‹</span>
          <strong>{routeGovernorate}</strong>
        </div>

        <section className="owner-diploma-centers__hero">
          <div className="owner-diploma-centers__heroIcon">
            <img
              src={DIPLOMA_CENTER_ICON}
              alt=""
              aria-hidden="true"
            />
          </div>

          <div>
            <p>مراكز الدبلوم</p>
            <h1>محافظة {routeGovernorate}</h1>
            <span>
              عرض مراكز الدبلوم المصنفة صراحة في المحافظة
              المحددة، مع إنشاء مركز جديد داخل نطاق المحافظة المثبت فقط.
            </span>
          </div>
        </section>

<section
          className="owner-diploma-centers__statusRow"
          aria-live="polite"
        >
          <span
            className={`owner-diploma-centers__status owner-diploma-centers__status--${loadState}`}
          >
            {loadState === "loading"
              ? "جارٍ تحميل مراكز المحافظة..."
              : loadState === "error"
                ? loadError
                : `تم تحميل ${governorateCenters.length} مركز دبلوم مصنف صراحة`}
          </span>

          {loadState === "ready" &&
          governorateRejectedCount > 0 ? (
            <span className="owner-diploma-centers__guardNotice">
              {governorateRejectedCount} سجل مرتبط بالمحافظة
              مخفي وفق Fail-Closed بسبب تصنيف أو نطاق غير حاسم
            </span>
          ) : null}

          <button
            type="button"
            className="owner-diploma-centers__backButton"
            onClick={() =>
              setReloadSequence((value) => value + 1)
            }
            disabled={loadState === "loading"}
          >
            تحديث القراءة
          </button>
        </section>

        <section className="owner-diploma-centers__childToolbar">
                    {/* OWNER_DIPLOMA_BACK_TO_GOVERNORATE_GATEWAY */}
          <button
            type="button"
            onClick={() =>
              navigate(
                `/system/management/governorates/${encodeURIComponent(
                  routeGovernorate
                )}`
              )
            }
            style={{
              minHeight: 42,
              padding: "0 18px",
              borderRadius: 12,
              border: "1px solid #15803d",
              borderBottom: "4px solid #166534",
              background:
                "linear-gradient(180deg,#22a65a,#15803d)",
              color: "#ffffff",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 1000,
              cursor: "pointer",
              boxShadow:
                "0 7px 16px rgba(21,128,61,.16)",
            }}
          >
            ← العودة إلى بوابة محافظة {routeGovernorate}
          </button>
<button
            type="button"
            className="owner-diploma-centers__backButton"
            onClick={() =>
              navigate(
                "/system/management/diploma-centers",
              )
            }
          >
            العودة إلى المحافظات
          </button>

          <button
            type="button"
            className="owner-diploma-centers__backButton"
            onClick={openCreateForm}
            disabled={loadState !== "ready" || createPending}
          >
            {formMode === "update"
              ? "تعديل مركز الدبلوم"
              : "إنشاء مركز دبلوم جديد"}
          </button>
        </section>

        {createOpen ? (
          <section
            className="owner-diploma-centers__childToolbar"
            aria-label={
              formMode === "update"
                ? "تعديل مركز دبلوم"
                : "إنشاء مركز دبلوم"
            }
          >
            <form
              onSubmit={submitCreateDiplomaCenter}
              style={{ display: "contents" }}
            >
              <label className="owner-diploma-centers__search">
                <span>اسم مركز الدبلوم</span>
                <input
                  type="text"
                  value={createName}
                  onChange={(event) =>
                    setCreateName(event.target.value)
                  }
                  placeholder="اسم مركز الدبلوم"
                  disabled={createPending}
                  autoComplete="off"
                  required
                />
              </label>

              <span className="owner-diploma-centers__guardNotice">
                المحافظة مقفلة من المسار: {routeGovernorate}
              </span>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <input
                  type="checkbox"
                  checked={createEnabled}
                  onChange={(event) =>
                    setCreateEnabled(event.target.checked)
                  }
                  disabled={createPending}
                />
                <span>مفعّل</span>
              </label>

              <button
                type="submit"
                className="owner-diploma-centers__backButton"
                disabled={createPending}
              >
                {createPending
                  ? formMode === "update"
                    ? "جارٍ حفظ التعديل..."
                    : "جارٍ الإنشاء..."
                  : formMode === "update"
                    ? "حفظ التعديل"
                    : "إنشاء المركز"}
              </button>

              <button
                type="button"
                className="owner-diploma-centers__backButton"
                onClick={closeCreateForm}
                disabled={createPending}
              >
                إلغاء
              </button>

              {createError ? (
                <span
                  className="owner-diploma-centers__guardNotice"
                  role="alert"
                  aria-live="polite"
                >
                  {createError}
                </span>
              ) : null}
            </form>
          </section>
        ) : null}

        {createNotice ? (
          <section
            className="owner-diploma-centers__statusRow"
            aria-live="polite"
          >
            <span className="owner-diploma-centers__status owner-diploma-centers__status--ready">
              {createNotice}
            </span>
          </section>
        ) : null}

        <section
          className="owner-diploma-centers__listCard"
          aria-label={`مراكز الدبلوم في محافظة ${routeGovernorate}`}
        >
          <div className="owner-diploma-centers__listHeader">
            <div>
              <strong>
                مراكز الدبلوم — {routeGovernorate}{" "}
              </strong>
              <span>
                {loadState === "ready"
                  ? `${governorateCenters.length} مركز`
                  : "—"}
              </span>
            </div>

            <span className="owner-diploma-centers__readOnlyBadge">
              نطاق المحافظة مثبت
            </span>
          </div>

          {loadState === "ready" &&
          governorateCenters.length > 0 ? (
            <div className="owner-diploma-centers__searchPanel">
              <label className="owner-diploma-centers__search">
                <span>البحث باسم مركز الدبلوم</span>

                <input
                  type="text"
                  value={centerSearch}
                  onChange={(event) =>
                    setCenterSearch(event.target.value)
                  }
                  placeholder="اكتب اسم المركز..."
                />
              </label>

              <div className="owner-diploma-centers__searchMeta">
                عدد النتائج:
                {" "}
                {filteredGovernorateCenters.length}
                {" "}
                من
                {" "}
                {governorateCenters.length}
              </div>

              {centerSearch ? (
                <button
                  type="button"
                  className="owner-diploma-centers__clearSearch"
                  onClick={() => setCenterSearch("")}
                >
                  مسح البحث
                </button>
              ) : null}
            </div>
          ) : null}

          {loadState === "loading" ? (
            <div className="owner-diploma-centers__empty">
              جارٍ تحميل البيانات...
            </div>
          ) : null}

          {loadState === "error" ? (
            <div className="owner-diploma-centers__empty">
              {loadError}
            </div>
          ) : null}

          {loadState === "ready" &&
          governorateCenters.length === 0 ? (
            <div className="owner-diploma-centers__empty">
              لا توجد مراكز دبلوم مصنفة صراحة في هذه
              المحافظة.
            </div>
          ) : null}

          {loadState === "ready" &&
          governorateCenters.length > 0 ? (
            <div className="owner-diploma-centers__tableWrap">
              <table className="owner-diploma-centers__table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>اسم المركز</th>
                    <th>Tenant ID</th>
                    <th>المحافظة</th>
                    <th>الحالة</th>
                    <th>الإجراءات</th>
                      </tr>
                </thead>

                <tbody>
                  {filteredGovernorateCenters.map(
                    (center, index) => (
                      <tr key={center.id}>
                        <td>{index + 1}</td>
                        <td>
                          <strong>{center.name}</strong>
                        </td>
                        <td>
                          <code>{center.id}</code>
                        </td>
                        <td>{center.governorate}</td>
                        <td>
                          <span
                            className={
                              center.enabled
                                ? "owner-diploma-centers__enabled"
                                : "owner-diploma-centers__disabled"
                            }
                          >
                            {center.enabled
                              ? "مفعّل"
                              : "غير مفعّل"}
                          </span>
                        </td>
                      
                        <td>
                          <div className="owner-diploma-centers__actions">
                            {/* OWNER_DIPLOMA_TENANT_ENTRY_BUTTON */}
                            <button
                              type="button"
                              className="
                                owner-diploma-centers__actionButton
                                owner-diploma-centers__actionButton--open
                              "
                              onClick={() => {
                                const tenantId =
                                  String(
                                    center.id || ""
                                  ).trim();

                                if (!tenantId) {
                                  return;
                                }

                                navigate(
                                  `/t/${encodeURIComponent(
                                    tenantId
                                  )}/dashboard12`
                                );
                              }}
                              disabled={
                                loadState !== "ready" ||
                                !String(
                                  center.id || ""
                                ).trim()
                              }
                            >
                              🚪 دخول المركز
                            </button>

                            <button
                              type="button"
                              className="owner-diploma-centers__actionButton owner-diploma-centers__actionButton--edit"
                              onClick={() => {
openEditForm(center);
                              }}
                            >
                              تعديل
                            </button>

                            <button
                              type="button"
                              className={
                                center.enabled
                                  ? "owner-diploma-centers__actionButton owner-diploma-centers__actionButton--disable"
                                  : "owner-diploma-centers__actionButton owner-diploma-centers__actionButton--enable"
                              }
                              onClick={() =>
                                void requestDiplomaCenterStatusChange(center)
                              }
                              disabled={statusUpdatePending}
                            >
                              {center.enabled
                                ? "تعطيل"
                                : "تفعيل"}
                            </button>

                            <button
                              type="button"
                              className="owner-diploma-centers__actionButton owner-diploma-centers__actionButton--delete"
                               onClick={() => requestDeleteDiplomaCenter(center)}
                               disabled={deletePending}
                            >
                              حذف
                            </button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        {statusDialogCenter ? (
          <div
            className="owner-diploma-centers__statusModalOverlay"
            role="dialog"
            aria-modal="true"
          >
            <div className="owner-diploma-centers__statusModalCard">

              <div className="owner-diploma-centers__statusModalIcon">
                {statusDialogCenter.enabled ? "⏸" : "▶"}
              </div>

              <h3 className="owner-diploma-centers__statusModalTitle">
                {statusDialogCenter.enabled
                  ? "تعطيل مركز الدبلوم"
                  : "تفعيل مركز الدبلوم"}
              </h3>

              <p className="owner-diploma-centers__statusModalText">
                هل أنت متأكد من{" "}
                {statusDialogCenter.enabled ? "تعطيل" : "تفعيل"} المركز؟
                <br />
                <strong>
                  "{statusDialogCenter.name}"
                </strong>
              </p>

              <div className="owner-diploma-centers__statusModalActions">

                <button
                  type="button"
                  className="owner-diploma-centers__actionButton"
                  onClick={() => {
                    setStatusDialogCenter(null);
                  }}
                  disabled={statusUpdatePending}
                >
                  إلغاء
                </button>


                <button
                  type="button"
                  className="owner-diploma-centers__actionButton owner-diploma-centers__actionButton--disable"
                  onClick={() => {
                    void confirmDiplomaCenterStatusChange();
                  }}
                  disabled={statusUpdatePending}
                >
                  {statusUpdatePending
                    ? "جارٍ التنفيذ..."
                    : statusDialogCenter.enabled
                      ? "تعطيل المركز"
                      : "تفعيل المركز"}
                </button>

              </div>

            </div>
          </div>
        ) : null}
        <div className="owner-diploma-centers__writeHold">
          الإنشاء مفعّل فقط عبر adminUpsertDiplomaCenterTenant مع تثبيت المحافظة من المسار.
          التعديل والحذف ونقل المحافظة والكتابة المباشرة إلى Firestore غير مفعّلة.
        </div>
      </main>


      {deleteDialogCenter ? (
        <div className="owner-diploma-centers__deleteModalOverlay">

          <div className="owner-diploma-centers__deleteModal">

            <div className="owner-diploma-centers__deleteModalIcon">
              🗑️
            </div>

            <h3 className="owner-diploma-centers__deleteModalTitle">
              حذف مركز الدبلوم
            </h3>

            <p className="owner-diploma-centers__deleteModalText">
              هل تريد نقل المركز:
              <br />
              <strong>
                "{deleteDialogCenter.name}"
              </strong>
              <br />
              إلى الحذف المؤقت؟
            </p>

            <div className="owner-diploma-centers__deleteNotice">
              سيتم الاحتفاظ بالمركز خلال فترة الحذف المؤقت قبل أي حذف نهائي.
            </div>

            {deleteError ? (
              <div className="owner-diploma-centers__deleteError">
                {deleteError}
              </div>
            ) : null}

            <div className="owner-diploma-centers__deleteActions">

              <button
                type="button"
                className="owner-diploma-centers__actionButton"
                onClick={() => setDeleteDialogCenter(null)}
                disabled={deletePending}
              >
                إلغاء
              </button>


              <button
                type="button"
                className="owner-diploma-centers__actionButton owner-diploma-centers__actionButton--delete"
                onClick={() => void confirmDeleteDiplomaCenter()}
                disabled={deletePending}
              >
                {deletePending
                  ? "جاري الحذف..."
                  : "تأكيد الحذف"}
              </button>

            </div>

          </div>

        </div>
      ) : null}
      <footer className="owner-diploma-centers__footer">
        <div>
          <button
            type="button"
            onClick={() => navigate("/system/help")}
          >
            دليل الاستخدام
          </button>
          <button
            type="button"
            onClick={() =>
              navigate("/programs-gateway")
            }
          >
            البوابة التشغيلية
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





















































