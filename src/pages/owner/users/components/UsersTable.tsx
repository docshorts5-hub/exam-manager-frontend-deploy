import React, { useState } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { callFn } from "../../../../services/functionsClient";
import { db } from "../../../../firebase/firebase";
import { OMAN_GOVERNORATES } from "../../../../constants/omanGovernorates";


type Props = {
  users: any[];
};


type DeleteAllowlistRequest = {
  email: string;
};


const deleteAllowlistUser =
  callFn<DeleteAllowlistRequest, unknown>(
    "adminDeleteAllowlist"
  );


type UpdateAllowlistRequest = {
  email: string;
  name?: string;
  role: string;
  enabled: boolean;
  tenantId?: string;
  governorate?: string;
  schoolName?: string;
};


const updateAllowlistUser =
  callFn<UpdateAllowlistRequest, unknown>(
    "adminUpsertAllowlist"
  );


type TotpResetRequest = {
  requestId: string;
  email: string;
  confirmTargetEmail: string;
  reason: string;
  confirmSelfReset?: boolean;
};


type TotpResetResult = {
  ok: true;
  auditId: string;
  requestId: string;
  status: "SUCCESS" | "PARTIAL_SUCCESS";
  targetUid: string;
  targetEmail: string;
  removedTotpFactors: number;
  preservedOtherFactors: number;
  refreshTokensRevoked: boolean;
  selfReset: boolean;
  requiresNewTotpEnrollment: true;
  warningCode?: string;
};


const resetTotpUser =
  callFn<TotpResetRequest, TotpResetResult>(
    "totpAdminResetUser"
  );


const normalize = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase();


const sameGovernorate = (
  a: unknown,
  b: unknown
) =>
  normalize(a) === normalize(b);


function getRoleLabel(role: unknown) {
  const value = normalize(role);

  if (value === "super_admin") {
    return "مالك المنصة";
  }

  if (value === "ministry_super") {
    return "مشرف الوزارة";
  }

  if (
    [
      "super",
      "super_regional",
      "regional_super",
    ].includes(value)
  ) {
    return "مشرف المحافظة";
  }

  if (value === "tenant_admin") {
    return "مشرف المدرسة";
  }

  if (value === "exam_super") {
    return "مشرف مركز الدبلوم";
  }

  if (value === "admin") {
    return "مشرف مدرسة - قديم";
  }

  if (value === "user") {
    return "مستخدم - قديم";
  }

  return role
    ? String(role)
    : "غير محدد";
}


function getEntityLabel(user: any) {
  const role = normalize(user?.role);

  if (role === "super_admin") {
    return "المنصة";
  }

  if (role === "ministry_super") {
    return "وزارة التعليم";
  }

  if (
    [
      "super",
      "super_regional",
      "regional_super",
    ].includes(role)
  ) {
    return user?.governorate || "المحافظة";
  }

  return (
    user?.tenantName ||
    user?.schoolName ||
    user?.tenantId ||
    "—"
  );
}


const cellStyle: React.CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid #edf1f5",
  verticalAlign: "middle",
  textAlign: "right",
};


const actionButtonStyle: React.CSSProperties = {
  minHeight: 40,
  border: "1px solid transparent",
  borderRadius: 11,
  padding: "8px 15px",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 900,
  whiteSpace: "nowrap",
  boxShadow: "0 3px 9px rgba(15,23,42,.06)",
};


export default function UsersTable({
  users,
}: Props) {
  const [togglingEmail, setTogglingEmail] = useState<string>("");

  const [toggleTarget, setToggleTarget] =
    useState<{
      user: any;
      nextEnabled: boolean;
    } | null>(null);

  const [toggleError, setToggleError] =
    useState<string>("");


  const [editTarget, setEditTarget] =
    useState<any | null>(null);

  const [editName, setEditName] =
    useState<string>("");

  const [editError, setEditError] =
    useState<string>("");

  const [editRole, setEditRole] =
    useState<string>("");

  const [editGovernorate, setEditGovernorate] =
    useState<string>("");

  const [editTenantId, setEditTenantId] =
    useState<string>("");

  const [editSchools, setEditSchools] =
    useState<any[]>([]);

  const [editCenters, setEditCenters] =
    useState<any[]>([]);

  const [
    editOrganizationsLoading,
    setEditOrganizationsLoading
  ] = useState<boolean>(false);


  const [totpTarget, setTotpTarget] =
    useState<any | null>(null);

  const [totpReason, setTotpReason] =
    useState<string>("");

  const [totpError, setTotpError] =
    useState<string>("");

  const [totpSuccess, setTotpSuccess] =
    useState<string>("");

  const [resettingTotpEmail, setResettingTotpEmail] =
    useState<string>("");

  const loadEditOrganizations = async () => {

    if (editOrganizationsLoading) {
      return;
    }

    setEditOrganizationsLoading(true);


    try {

      const snap = await getDocs(
        collection(db, "tenants")
      );


      const rows = await Promise.all(
        snap.docs.map(async (tenant) => {

          const root:any =
            tenant.data() || {};


          let cfg:any = {};

          try {

            const cfgSnap = await getDoc(
              doc(
                db,
                "tenants",
                tenant.id,
                "meta",
                "config"
              )
            );

            cfg = cfgSnap.exists()
              ? cfgSnap.data()
              : {};

          } catch (error) {

            console.error(
              "EDIT_TENANT_CONFIG_LOAD_FAILED",
              tenant.id,
              error
            );

          }


          const governorate =
            String(
              cfg?.governorate ||
              cfg?.regionAr ||
              cfg?.region ||
              cfg?.tenantGovernorate ||
              cfg?.governorateName ||
              root?.governorate ||
              root?.tenantGovernorate ||
              root?.regionAr ||
              root?.region ||
              ""
            ).trim();


          const name =
            String(
              cfg?.schoolNameAr ||
              cfg?.centerNameAr ||
              cfg?.tenantName ||
              root?.schoolName ||
              root?.centerName ||
              root?.name ||
              tenant.id
            ).trim();


          const marker =
            [
              root?.tenantType,
              root?.centerType,
              root?.kind,
              cfg?.tenantType,
              cfg?.centerType,
              cfg?.kind,
            ]
              .map((value) =>
                String(value || "")
                  .trim()
                  .toLowerCase()
              )
              .join(" ");


          const isCenter =
            root?.isDiplomaCenter === true ||
            root?.isExamCenter === true ||
            cfg?.isDiplomaCenter === true ||
            cfg?.isExamCenter === true ||
            marker.includes("center") ||
            marker.includes("diploma") ||
            marker.includes("exam") ||
            marker.includes("دبلوم");


          return {
            id: tenant.id,
            name,
            governorate,
            isCenter,
          };

        })
      );


      const schools =
        rows
          .filter((row) =>
            !row.isCenter &&
            Boolean(row.governorate)
          )
          .sort((a,b) =>
            a.name.localeCompare(
              b.name,
              "ar"
            )
          );


      const centers =
        rows
          .filter((row) =>
            row.isCenter &&
            Boolean(row.governorate)
          )
          .sort((a,b) =>
            a.name.localeCompare(
              b.name,
              "ar"
            )
          );


      setEditSchools(schools);
      setEditCenters(centers);


    } catch (error) {

      console.error(
        "EDIT_ORGANIZATIONS_LOAD_FAILED",
        error
      );


    } finally {

      setEditOrganizationsLoading(false);

    }

  };

  const allUsers =
  [...(users || [])].sort((a,b)=>{

    const roleWeight = (role:any)=>{

      const value = normalize(role);

      if(value === "super_admin"){
        return 1;
      }

      if(value === "ministry_super"){
        return 2;
      }

      if(
        [
          "super",
          "super_regional",
          "regional_super",
        ].includes(value)
      ){
        return 3;
      }

      if(value === "tenant_admin"){
        return 4;
      }

      if(value === "exam_super"){
        return 5;
      }

      return 99;
    };


    return roleWeight(a?.role) - roleWeight(b?.role);

  });

  const [deleteTarget, setDeleteTarget] =
    useState<any | null>(null);

  const [deletingEmail, setDeletingEmail] =
    useState("");

  const [deleteError, setDeleteError] =
    useState("");


  const closeDeleteDialog = () => {
    if (deletingEmail) {
      return;
    }

    setDeleteTarget(null);
    setDeleteError("");
  };


  const confirmDelete = async () => {

    const email =
      String(
        deleteTarget?.email ||
        deleteTarget?.id ||
        ""
      )
        .trim()
        .toLowerCase();

    if (!email || deletingEmail) {
      return;
    }

    if (
      normalize(deleteTarget?.role) ===
      "super_admin"
    ) {
      setDeleteError(
        "حساب مالك المنصة محمي ولا يمكن حذفه."
      );
      return;
    }

    setDeletingEmail(email);
    setDeleteError("");

    try {

      await deleteAllowlistUser({
        email,
      });

      setDeleteTarget(null);

    } catch (error) {

      console.error(
        "OWNER_USER_DELETE_FAILED",
        error
      );

      setDeleteError(
        "تعذر حذف المستخدم. لم يتم تنفيذ حذف بديل من المتصفح."
      );

    } finally {

      setDeletingEmail("");

    }
  };


  return (
    <section
      style={{
        background: "#ffffff",
        border: "1px solid rgba(15,23,42,.08)",
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 8px 25px rgba(15,23,42,.04)",
      }}
    >

      <header
        style={{
          padding: "18px 20px",
          borderBottom: "1px solid #edf1f5",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              color: "#172033",
              fontSize: 19,
              fontWeight: 900,
            }}
          >
            المستخدمون
          </h2>

          <div
            style={{
              marginTop: 5,
              color: "#718096",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            عدد النتائج: {allUsers.length}
          </div>
        </div>
      </header>


      <div
        style={{
          overflowX: "auto",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: 1180,
          }}
        >
          <thead>
            <tr
              style={{
                background: "#f8fafc",
                color: "#475569",
                fontSize: 13,
              }}
            >
              <th style={cellStyle}>الاسم</th>
              <th style={cellStyle}>البريد الإلكتروني</th>
              <th style={cellStyle}>الدور</th>
              <th style={cellStyle}>المحافظة</th>
              <th style={cellStyle}>الجهة</th>
              <th style={cellStyle}>الحالة</th>
<th style={cellStyle}>الجهاز</th>
              <th style={cellStyle}>الإجراءات</th>
            </tr>
          </thead>


          <tbody>

            {allUsers.map(
              (user: any, index: number) => {

                const email =
                  String(
                    user?.email ||
                    user?.id ||
                    ""
                  ).trim();

                const role =
                  normalize(user?.role);

                const isOwner =
                  role === "super_admin";

                const enabled =
                  user?.enabled !== false;


                return (
                  <tr
                    key={
                      email ||
                      user?.id ||
                      `user-${index}`
                    }
                  >

                    <td style={cellStyle}>
                      <strong
                        style={{
                          color: "#1e293b",
                          fontSize: 14,
                        }}
                      >
                        {role === "super_admin"
                        ? "مالك المنصة"
                        : user?.name ||
                          user?.userName ||
                          "بدون اسم"}
                      </strong>
                    </td>


                    <td
                      style={{
                        ...cellStyle,
                        direction: "ltr",
                        textAlign: "right",
                        color: "#475569",
                      }}
                    >
                      {email || "—"}
                    </td>


                    <td style={cellStyle}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          minHeight: 28,
                          borderRadius: 999,
                          padding: "3px 10px",
                          background: "#eef4ff",
                          color: "#244879",
                          fontSize: 12,
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {getRoleLabel(user?.role)}
                      </span>
                    </td>


                    <td style={cellStyle}>
                      {role === "ministry_super" ||
                      role === "super_admin"
                        ? "—"
                        : user?.governorate || "—"}
                    </td>


                    <td style={cellStyle}>
                      {getEntityLabel(user)}
                    </td>


                    <td style={cellStyle}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 800,
                          color: enabled
                            ? "#087443"
                            : "#9a3412",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: enabled
                              ? "#12a864"
                              : "#ea580c",
                          }}
                        />

                        {enabled
                          ? "مفعّل"
                          : "غير مفعّل"}
                      </span>
                    </td>


                    <td style={cellStyle}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          lineHeight: 1.6,
                        }}
                      >
                        <div>
                          الجهاز:
                          {
                            user?.device?.deviceName ||
                            "غير معروف"
                          }
                        </div>

                        <div>
                          النظام:
                          {
                            user?.device?.platform ||
                            "—"
                          }
                        </div>

                        <div>
                          المتصفح:
                          {
                            user?.device?.browser ||
                            "—"
                          }
                        </div>

                        <div>
                          الحالة:
                          {
                            user?.device?.status === "revoked"
                            ? "ملغى"
                            : "نشط"
                          }
                        </div>
                      </div>
                    </td>


                    <td style={cellStyle}>

                      {isOwner ? (

                        <span
                          style={{
                            color: "#94a3b8",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          حساب محمي
                        </span>

                      ) : (

                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 7,
                          }}
                        >

                          <button
                              type="button"
                              onClick={() => {
                                setEditError("");
                                setEditTarget(user);
                                setEditName(
                                  String(user?.name || "")
                                );

                                const currentRole =
                                  normalize(user?.role);

                                setEditRole(
                                  [
                                    "super_regional",
                                    "regional_super",
                                  ].includes(currentRole)
                                    ? "super"
                                    : currentRole
                                );

                                setEditGovernorate(
                                  String(
                                    user?.governorate || ""
                                  ).trim()
                                );

                                setEditTenantId(
                                  String(
                                    user?.tenantId || ""
                                  ).trim()
                                );

                                void loadEditOrganizations();
                              }}
                              style={{
                                ...actionButtonStyle,
                                background: "#eaf2fc",
                                borderColor: "#aac1dd",
                                color: "#17345f",
                                cursor: "pointer",
                              }}
                            >
                              تعديل
                            </button>


                          <button
                            type="button"
                            onClick={() => {
                              setTotpTarget(user);
                              setTotpReason("");
                              setTotpError("");
                              setTotpSuccess("");
                            }}
                            disabled={Boolean(resettingTotpEmail)}
                            style={{
                              ...actionButtonStyle,
                              background: "#fff4d5",
                              borderColor: "#dfbd55",
                              color: "#705300",
                              cursor: resettingTotpEmail
                                ? "not-allowed"
                                : "pointer",
                              opacity: resettingTotpEmail
                                ? 0.65
                                : 1,
                            }}
                          >
                            إعادة تهيئة TOTP
                          </button>


                          <button
  type="button"
  onClick={() => {
    setToggleError("");
    setToggleTarget({
      user,
      nextEnabled: !enabled,
    });
  }}
  disabled={
    Boolean(togglingEmail)
  }
  style={{
    ...actionButtonStyle,
    background: enabled
      ? "#fdecec"
      : "#e8f7ef",
    borderColor: enabled
      ? "#efb0aa"
      : "#9bd5b6",
    color: enabled
      ? "#b42318"
      : "#087443",
    cursor: togglingEmail
      ? "not-allowed"
      : "pointer",
    opacity:
      togglingEmail &&
      togglingEmail !==
        String(user?.email || "")
          .trim()
          .toLowerCase()
        ? 0.65
        : 1,
  }}
>
  {togglingEmail ===
   String(user?.email || "")
     .trim()
     .toLowerCase()
    ? "جارٍ التنفيذ..."
    : enabled
      ? "تعطيل"
      : "تفعيل"}
</button>


                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError("");
                              setDeleteTarget(user);
                            }}
                            disabled={
                              Boolean(deletingEmail)
                            }
                            style={{
                              ...actionButtonStyle,
                              background:
                                "linear-gradient(135deg,#c62828,#e53935)",
                              borderColor: "#b91c1c",
                              color: "#ffffff",
                              cursor: deletingEmail
                                ? "not-allowed"
                                : "pointer",
                              boxShadow:
                                "0 5px 14px rgba(198,40,40,.18)",
                            }}
                          >
                            حذف
                          </button>

                        </div>

                      )}

                    </td>

                  </tr>
                );
              }
            )}


            {!allUsers.length ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: 40,
                    textAlign: "center",
                    color: "#64748b",
                  }}
                >
                  لا توجد نتائج مطابقة.
                </td>
              </tr>
            ) : null}

          </tbody>
        </table>
      </div>



      {toggleTarget ? (

        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 12100,
            background: "rgba(15,23,42,.48)",
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
          onMouseDown={(event) => {

            if (
              event.currentTarget === event.target &&
              !togglingEmail
            ) {
              setToggleTarget(null);
              setToggleError("");
            }

          }}
        >

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="toggle-user-title"
            dir="rtl"
            style={{
              width: "min(500px,95vw)",
              background: "#ffffff",
              borderRadius: 20,
              padding: 26,
              borderTop: toggleTarget.nextEnabled
                ? "5px solid #15803d"
                : "5px solid #c62828",
              boxShadow:
                "0 24px 65px rgba(15,23,42,.28)",
              textAlign: "right",
            }}
          >

            <h2
              id="toggle-user-title"
              style={{
                margin: 0,
                color: toggleTarget.nextEnabled
                  ? "#166534"
                  : "#991b1b",
                fontSize: 22,
                fontWeight: 900,
              }}
            >
              {toggleTarget.nextEnabled
                ? "تأكيد تفعيل الحساب"
                : "تأكيد تعطيل الحساب"}
            </h2>


            <p
              style={{
                margin: "18px 0 6px",
                color: "#334155",
                fontSize: 16,
                fontWeight: 700,
                lineHeight: 1.9,
              }}
            >
              {toggleTarget.nextEnabled
                ? "هل تريد إعادة تفعيل حساب المستخدم التالي؟"
                : "هل أنت متأكد من تعطيل حساب المستخدم التالي؟"}
            </p>


            <div
              style={{
                marginTop: 14,
                padding: "14px 16px",
                borderRadius: 14,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >

              <div
                style={{
                  color: "#17345f",
                  fontSize: 16,
                  fontWeight: 900,
                }}
              >
                {String(
                  toggleTarget.user?.name ||
                  getRoleLabel(
                    toggleTarget.user?.role
                  )
                )}
              </div>

              <div
                dir="ltr"
                style={{
                  marginTop: 8,
                  color: "#17345f",
                  fontSize: 18,
                  fontWeight: 800,
                  textAlign: "right",
                  letterSpacing: ".2px",
                }}
              >
                {String(
                  toggleTarget.user?.email || ""
                )}
              </div>

            </div>


            <p
              style={{
                color: "#64748b",
                lineHeight: 1.9,
                fontSize: 14,
                margin: "16px 0",
              }}
            >
              {toggleTarget.nextEnabled
                ? "سيتم استعادة صلاحيات الحساب وفق الدور والنطاق المرتبطين به."
                : "سيتم منع المستخدم من استخدام صلاحياته حتى يتم تفعيل الحساب مرة أخرى."}
            </p>


            {toggleError ? (

              <div
                role="alert"
                style={{
                  marginBottom: 16,
                  padding: "11px 14px",
                  borderRadius: 12,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#b91c1c",
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                {toggleError}
              </div>

            ) : null}


            <div
              style={{
                display: "flex",
                justifyContent: "flex-start",
                gap: 10,
                marginTop: 20,
              }}
            >

              <button
                type="button"
                disabled={Boolean(togglingEmail)}
                onClick={() => {
                  setToggleTarget(null);
                  setToggleError("");
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: 12,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: togglingEmail
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                إلغاء
              </button>


              <button
                type="button"
                disabled={Boolean(togglingEmail)}
                onClick={async () => {

                  const targetUser =
                    toggleTarget.user;

                  const nextEnabled =
                    toggleTarget.nextEnabled;

                  const email =
                    String(
                      targetUser?.email || ""
                    )
                      .trim()
                      .toLowerCase();


                  if (!email) {

                    setToggleError(
                      "لا يمكن تنفيذ العملية لأن البريد الإلكتروني غير موجود."
                    );

                    return;
                  }


                  setToggleError("");
                  setTogglingEmail(email);


                  try {

                    await updateAllowlistUser({

                      email,

                      name:
                        String(
                          targetUser?.name || ""
                        ).trim(),

                      role:
                        String(
                          targetUser?.role || ""
                        ).trim(),

                      enabled:
                        nextEnabled,

                      governorate:
                        String(
                          targetUser?.governorate ||
                          ""
                        ).trim(),

                      tenantId:
                        [
                          "tenant_admin",
                          "exam_super",
                          "admin",
                        ].includes(
                          normalize(
                            targetUser?.role
                          )
                        )
                          ? String(
                              targetUser?.tenantId ||
                              ""
                            ).trim()
                          : "",

                      schoolName:
                        String(
                          targetUser?.schoolName ||
                          targetUser?.tenantName ||
                          ""
                        ).trim(),

                    });


                    setToggleTarget(null);
                    setToggleError("");


                  } catch (error) {

                    console.error(
                      "TOGGLE_USER_ENABLED_FAILED",
                      error
                    );

                    setToggleError(
                      nextEnabled
                        ? "تعذر تفعيل الحساب. لم يتم حفظ أي تغيير."
                        : "تعذر تعطيل الحساب. لم يتم حفظ أي تغيير."
                    );


                  } finally {

                    setTogglingEmail("");

                  }

                }}
                style={{
                  padding: "10px 22px",
                  borderRadius: 12,
                  border: "none",
                  background:
                    toggleTarget.nextEnabled
                      ? "#15803d"
                      : "#c62828",
                  color: "#ffffff",
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 900,
                  cursor: togglingEmail
                    ? "not-allowed"
                    : "pointer",
                  opacity: togglingEmail
                    ? 0.7
                    : 1,
                }}
              >
                {togglingEmail
                  ? "جارٍ التنفيذ..."
                  : toggleTarget.nextEnabled
                    ? "تفعيل الحساب"
                    : "تعطيل الحساب"}
              </button>

            </div>

          </section>

        </div>

      ) : null}



      {totpTarget ? (

        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 12300,
            background: "rgba(15,23,42,.52)",
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
          onMouseDown={(event) => {

            if (
              event.currentTarget === event.target &&
              !resettingTotpEmail
            ) {
              setTotpTarget(null);
              setTotpReason("");
              setTotpError("");
              setTotpSuccess("");
            }

          }}
        >

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="totp-reset-title"
            dir="rtl"
            style={{
              width: "min(540px,95vw)",
              background: "#ffffff",
              borderRadius: 20,
              padding: 26,
              borderTop: "5px solid #c99720",
              boxShadow:
                "0 24px 65px rgba(15,23,42,.30)",
              textAlign: "right",
            }}
          >

            <h2
              id="totp-reset-title"
              style={{
                margin: 0,
                color: "#17345f",
                fontSize: 22,
                fontWeight: 900,
              }}
            >
              إعادة تهيئة المصادقة TOTP
            </h2>


            <p
              style={{
                color: "#475569",
                fontSize: 14,
                lineHeight: 1.9,
                margin: "14px 0",
              }}
            >
              سيتم إبطال تسجيل تطبيق المصادقة الحالي
              لهذا المستخدم. عند تسجيل الدخول التالي
              سيُطلب منه إعداد TOTP من جديد.
            </p>


            <div
              style={{
                padding: "14px 16px",
                borderRadius: 14,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >

              <div
                style={{
                  color: "#17345f",
                  fontSize: 16,
                  fontWeight: 900,
                }}
              >
                {String(
                  totpTarget?.name ||
                  getRoleLabel(totpTarget?.role)
                )}
              </div>


              <div
                dir="ltr"
                style={{
                  marginTop: 7,
                  color: "#102f57",
                  fontSize: 19,
                  fontWeight: 900,
                  textAlign: "right",
                }}
              >
                {String(totpTarget?.email || "")}
              </div>

            </div>


            <label
              style={{
                display: "block",
                marginTop: 18,
                color: "#17345f",
                fontSize: 17,
                fontWeight: 900,
              }}
            >
              سبب إعادة التهيئة

              <textarea
                className="owner-users__totp-reason"
                value={totpReason}
                disabled={Boolean(resettingTotpEmail)}
                onChange={(event) => {
                  setTotpReason(event.target.value);
                  setTotpError("");
                }}
                placeholder="مثال: المستخدم فقد الوصول إلى تطبيق المصادقة السابق"
                maxLength={500}
                style={{
                  display: "block",
                  boxSizing: "border-box",
                  width: "100%",
                  minHeight: 112,
                  marginTop: 10,
                  resize: "vertical",
                  borderRadius: 14,
                  border: "1.5px solid #d6b354",
                  padding: "14px 16px",
                  background: "#fffdf6",
                  color: "#102f57",
                  fontFamily: "inherit",
                  fontSize: 17,
                  fontWeight: 800,
                  lineHeight: 1.9,
                  direction: "rtl",
                  textAlign: "right",
                  caretColor: "#17345f",
                  outline: "none",
                }}
              />

            </label>


            <div
              style={{
                marginTop: 6,
                color:
                  totpReason.trim().length >= 10
                    ? "#64748b"
                    : "#b45309",
                fontSize: 14,
                fontWeight: 800,
              }}
            >
              يجب أن يكون السبب بين 10 و500 حرف.
            </div>


            {totpError ? (

              <div
                role="alert"
                style={{
                  marginTop: 15,
                  padding: "11px 14px",
                  borderRadius: 12,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#b91c1c",
                  fontSize: 13,
                  fontWeight: 800,
                  lineHeight: 1.7,
                }}
              >
                {totpError}
              </div>

            ) : null}


            {totpSuccess ? (

              <div
                role="status"
                style={{
                  marginTop: 15,
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "#ecfdf3",
                  border: "1px solid #a7f3d0",
                  color: "#166534",
                  fontSize: 14,
                  fontWeight: 900,
                  lineHeight: 1.8,
                }}
              >
                {totpSuccess}
              </div>

            ) : null}


            <div
              style={{
                marginTop: 22,
                display: "flex",
                gap: 10,
                justifyContent: "flex-start",
              }}
            >

              <button
                type="button"
                disabled={Boolean(resettingTotpEmail)}
                onClick={() => {
                  setTotpTarget(null);
                  setTotpReason("");
                  setTotpError("");
                  setTotpSuccess("");
                }}
                style={{
                  minHeight: 42,
                  padding: "0 20px",
                  borderRadius: 11,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  fontFamily: "inherit",
                  fontWeight: 900,
                  cursor: resettingTotpEmail
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                {totpSuccess ? "إغلاق" : "إلغاء"}
              </button>


              {!totpSuccess ? (

                <button
                  type="button"
                  disabled={
                    Boolean(resettingTotpEmail) ||
                    totpReason.trim().length < 10 ||
                    totpReason.trim().length > 500
                  }
                  onClick={async () => {

                    const email =
                      String(totpTarget?.email || "")
                        .trim()
                        .toLowerCase();

                    const reason =
                      totpReason.trim();


                    if (!email) {
                      setTotpError(
                        "البريد الإلكتروني للمستخدم غير موجود."
                      );
                      return;
                    }


                    if (
                      reason.length < 10 ||
                      reason.length > 500
                    ) {
                      setTotpError(
                        "يجب كتابة سبب واضح بين 10 و500 حرف."
                      );
                      return;
                    }


                    const requestId =
                      `${Date.now().toString(36)}_${
                        crypto.randomUUID()
                          .replace(/-/g, "")
                      }`;


                    setTotpError("");
                    setTotpSuccess("");
                    setResettingTotpEmail(email);


                    try {

                      const result =
                        await resetTotpUser({
                          requestId,
                          email,
                          confirmTargetEmail: email,
                          reason,
                          confirmSelfReset: false,
                        });


                      const removed =
                        Number(
                          result?.removedTotpFactors || 0
                        );


                      setTotpSuccess(
                        removed > 0
                          ? `تمت إعادة تهيئة TOTP بنجاح. تم إلغاء ${removed} تسجيل TOTP، وسيُطلب من المستخدم إعداد تطبيق المصادقة من جديد عند تسجيل الدخول التالي.`
                          : "اكتملت العملية، وسيُطلب من المستخدم إعداد TOTP من جديد عند الحاجة."
                      );


                    } catch (error: any) {

                      console.error(
                        "TOTP_ADMIN_RESET_FAILED",
                        error
                      );


                      const message =
                        String(
                          error?.message ||
                          error?.details ||
                          ""
                        );


                      if (
                        message.includes(
                          "AUTH_USER_NOT_FOUND"
                        )
                      ) {

                        setTotpError(
                          "لا يوجد حساب Firebase Authentication مطابق لهذا البريد."
                        );

                      } else if (
                        message.includes(
                          "RESET_REASON"
                        )
                      ) {

                        setTotpError(
                          "سبب إعادة التهيئة يجب أن يكون بين 10 و500 حرف."
                        );

                      } else if (
                        message.includes(
                          "SECOND_FACTOR_ADMIN_SESSION_REQUIRED"
                        )
                      ) {

                        setTotpError(
                          "تتطلب هذه العملية الحساسة تسجيل دخول المشرف باستخدام المصادقة الثنائية TOTP. سجّل الخروج من حساب مالك المنصة، ثم سجّل الدخول من جديد وأدخل رمز TOTP، وبعدها أعد المحاولة."
                        );

                      } else if (
                        message.includes(
                          "TOTP_SESSION_FACTOR_COULD_NOT_BE_VERIFIED"
                        )
                      ) {

                        setTotpError(
                          "تعذر التحقق من عامل TOTP المستخدم في جلسة المشرف الحالية. سجّل الخروج ثم أعد تسجيل الدخول باستخدام TOTP وحاول مرة أخرى."
                        );

                      } else if (
                        message.includes(
                          "TOTP_SESSION"
                        )
                      ) {

                        setTotpError(
                          "انتهت صلاحية جلسة المصادقة الإدارية أو تعذر التحقق منها. أعد تسجيل الدخول باستخدام TOTP ثم حاول مرة أخرى."
                        );

                      } else if (
                        message.includes(
                          "permission-denied"
                        )
                      ) {

                        setTotpError(
                          "ليس لديك صلاحية لإعادة تهيئة TOTP لهذا المستخدم."
                        );

                      } else {

                        setTotpError(
                          message ||
                          "تعذر إعادة تهيئة TOTP. لم يتم تنفيذ أي تغيير غير مؤكد."
                        );

                      }

                    } finally {

                      setResettingTotpEmail("");

                    }

                  }}
                  style={{
                    minHeight: 42,
                    padding: "0 22px",
                    borderRadius: 11,
                    border: 0,
                    background: "#c99720",
                    color: "#ffffff",
                    fontFamily: "inherit",
                    fontWeight: 900,
                    cursor:
                      resettingTotpEmail ||
                      totpReason.trim().length < 10
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      resettingTotpEmail ||
                      totpReason.trim().length < 10
                        ? 0.6
                        : 1,
                  }}
                >
                  {resettingTotpEmail
                    ? "جارٍ إعادة التهيئة..."
                    : "تأكيد إعادة التهيئة"}
                </button>

              ) : null}

            </div>

          </section>

        </div>

      ) : null}

      {editTarget ? (

        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 12200,
            background: "rgba(15,23,42,.48)",
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
          onMouseDown={(event)=>{

            if(event.currentTarget === event.target){
              setEditTarget(null);
              setEditError("");
            }

          }}
        >

          <section
            role="dialog"
            aria-modal="true"
            dir="rtl"
            style={{
              width: "min(520px,95vw)",
              background:"#ffffff",
              borderRadius:20,
              padding:26,
              borderTop:"5px solid #17345f",
              boxShadow:
                "0 24px 65px rgba(15,23,42,.28)",
            }}
          >

            <h2
              style={{
                margin:0,
                color:"#17345f",
                fontSize:22,
                fontWeight:900,
              }}
            >
              تعديل بيانات المستخدم
            </h2>


            <div
              style={{
                marginTop:20,
                display:"grid",
                gap:14,
              }}
            >

              <label
                style={{
                  fontWeight:800,
                  color:"#334155",
                }}
              >
                الاسم

                <input
                  value={editName}
                  onChange={(e)=>
                    setEditName(e.target.value)
                  }
                  style={{
                    marginTop:6,
                    width:"100%",
                    height:42,
                    borderRadius:10,
                    border:"1px solid #cbd5e1",
                    padding:"0 12px",
                    fontFamily:"inherit",
                  }}
                />

              </label>


              <div
                style={{
                  padding:12,
                  borderRadius:12,
                  background:"#f8fafc",
                  border:"1px solid #e2e8f0",
                }}
              >

                <div
                  style={{
                    color:"#64748b",
                    fontSize:13,
                    fontWeight:700,
                  }}
                >
                  البريد الإلكتروني
                </div>

                <div
                  dir="ltr"
                  style={{
                    marginTop:5,
                    color:"#17345f",
                    fontSize:16,
                    fontWeight:900,
                    textAlign:"right",
                  }}
                >
                  {String(editTarget?.email || "")}
                </div>

              </div>



              <div
                style={{
                  display: "grid",
                  gap: 14,
                }}
              >

                <label
                  style={{
                    color: "#334155",
                    fontSize: 14,
                    fontWeight: 900,
                  }}
                >
                  الدور

                  <select
                    value={editRole}
                    onChange={(event) => {

                      const nextRole =
                        event.target.value;

                      setEditError("");
                      setEditRole(nextRole);

                      if (nextRole !== editRole) {
                        setEditTenantId("");
                      }

                      if (
                        nextRole ===
                        "ministry_super"
                      ) {
                        setEditGovernorate("");
                        setEditTenantId("");
                      }

                      if (
                        nextRole === "super"
                      ) {
                        setEditTenantId("");
                      }

                    }}
                    style={{
                      display: "block",
                      boxSizing: "border-box",
                      width: "100%",
                      minHeight: 44,
                      marginTop: 7,
                      borderRadius: 11,
                      border:
                        "1px solid #cbd5e1",
                      padding: "0 12px",
                      background: "#ffffff",
                      color: "#17345f",
                      fontFamily: "inherit",
                      fontSize: 15,
                      fontWeight: 800,
                    }}
                  >
                    <option value="ministry_super">
                      مشرف الوزارة
                    </option>

                    <option value="super">
                      مشرف المحافظة
                    </option>

                    <option value="tenant_admin">
                      مشرف المدرسة
                    </option>

                    <option value="exam_super">
                      مشرف مركز الدبلوم
                    </option>

                    {normalize(
                      editTarget?.role
                    ) === "admin" ? (
                      <option value="admin">
                        مشرف مدرسة - قديم
                      </option>
                    ) : null}
                  </select>

                </label>


                {[
                  "tenant_admin",
                  "exam_super",
                  "admin",
                ].includes(editRole) ? (

                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 11,
                      background: "#fff8e8",
                      border:
                        "1px solid #ead29a",
                      color: "#795b12",
                      fontSize: 13,
                      fontWeight: 800,
                      lineHeight: 1.7,
                    }}
                  >
                    عند اختيار مشرف المدرسة أو مشرف مركز الدبلوم، اختر المحافظة ثم الجهة المرتبطة قبل حفظ التعديل.
                  </div>

                ) : null}


                {editRole !== "ministry_super" ? (

                  <label
                    style={{
                      color: "#334155",
                      fontSize: 14,
                      fontWeight: 900,
                    }}
                  >
                    المحافظة

                    <select
                      value={editGovernorate}

                      onChange={(event) => {
                        setEditError("");
                        setEditGovernorate(
                          event.target.value
                        );
                        setEditTenantId("");
                      }}
                      style={{
                        display: "block",
                        boxSizing: "border-box",
                        width: "100%",
                        minHeight: 44,
                        marginTop: 7,
                        borderRadius: 11,
                        border:
                          "1px solid #cbd5e1",
                        padding: "0 12px",
                        background: "#ffffff",
                        color: "#17345f",
                        fontFamily: "inherit",
                        fontSize: 15,
                        fontWeight: 800,
                      }}
                    >
                      <option value="">
                        اختر المحافظة
                      </option>

                      {[...OMAN_GOVERNORATES]
                        .sort((a,b) =>
                          a.localeCompare(b,"ar")
                        )
                        .map((gov) => (
                          <option
                            key={gov}
                            value={gov}
                          >
                            {`محافظة ${gov}`}
                          </option>
                        ))}
                    </select>

                  </label>

                ) : (

                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 11,
                      background: "#f8fafc",
                      border:
                        "1px solid #e2e8f0",
                      color: "#64748b",
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    مشرف الوزارة لا يرتبط بمحافظة
                    محددة.
                  </div>

                )}

              </div>


              {editRole === "tenant_admin" ? (

                <label
                  style={{
                    color: "#334155",
                    fontSize: 14,
                    fontWeight: 900,
                  }}
                >
                  المدرسة

                  <select
                    value={editTenantId}
                    disabled={
                      !editGovernorate ||
                      editOrganizationsLoading
                    }
                    onChange={(event) => {
                      setEditError("");
                      setEditTenantId(
                        event.target.value
                      );
                    }}
                    style={{
                      display: "block",
                      boxSizing: "border-box",
                      width: "100%",
                      minHeight: 44,
                      marginTop: 7,
                      borderRadius: 11,
                      border:
                        "1px solid #cbd5e1",
                      padding: "0 12px",
                      background: "#ffffff",
                      color: "#17345f",
                      fontFamily: "inherit",
                      fontSize: 15,
                      fontWeight: 800,
                    }}
                  >
                    <option value="">
                      {!editGovernorate
                        ? "اختر المحافظة أولاً"
                        : editOrganizationsLoading
                          ? "جارٍ تحميل المدارس..."
                          : "اختر المدرسة"}
                    </option>

                    {editSchools
                      .filter(
                        (school) =>
                          sameGovernorate(
                            school.governorate,
                            editGovernorate
                          )
                      )
                      .map((school) => (
                        <option
                          key={school.id}
                          value={school.id}
                        >
                          {school.name}
                        </option>
                      ))}
                  </select>

                </label>

              ) : null}


              {editRole === "exam_super" ? (

                <label
                  style={{
                    color: "#334155",
                    fontSize: 14,
                    fontWeight: 900,
                  }}
                >
                  مركز الدبلوم

                  <select
                    value={editTenantId}
                    disabled={
                      !editGovernorate ||
                      editOrganizationsLoading
                    }
                    onChange={(event) => {
                      setEditError("");
                      setEditTenantId(
                        event.target.value
                      );
                    }}
                    style={{
                      display: "block",
                      boxSizing: "border-box",
                      width: "100%",
                      minHeight: 44,
                      marginTop: 7,
                      borderRadius: 11,
                      border:
                        "1px solid #cbd5e1",
                      padding: "0 12px",
                      background: "#ffffff",
                      color: "#17345f",
                      fontFamily: "inherit",
                      fontSize: 15,
                      fontWeight: 800,
                    }}
                  >
                    <option value="">
                      {!editGovernorate
                        ? "اختر المحافظة أولاً"
                        : editOrganizationsLoading
                          ? "جارٍ تحميل المراكز..."
                          : "اختر مركز الدبلوم"}
                    </option>

                    {editCenters
                      .filter(
                        (center) =>
                          sameGovernorate(
                            center.governorate,
                            editGovernorate
                          )
                      )
                      .map((center) => (
                        <option
                          key={center.id}
                          value={center.id}
                        >
                          {center.name}
                        </option>
                      ))}
                  </select>

                </label>

              ) : null}

              {editError ? (

                <div
                  style={{
                    padding:12,
                    borderRadius:12,
                    background:"#fef2f2",
                    color:"#b91c1c",
                    fontWeight:800,
                  }}
                >
                  {editError}
                </div>

              ) : null}

            </div>


            <div
              style={{
                marginTop:22,
                display:"flex",
                gap:10,
                justifyContent:"flex-start",
              }}
            >

              <button
                type="button"
                onClick={()=>{
                  setEditTarget(null);
                  setEditError("");
                }}
                style={{
                  height:42,
                  padding:"0 20px",
                  borderRadius:11,
                  border:"1px solid #cbd5e1",
                  background:"#fff",
                  fontWeight:800,
                  cursor:"pointer",
                }}
              >
                إلغاء
              </button>


              <button
                type="button"
                onClick={async () => {

                  const email =
                    String(editTarget?.email || "")
                      .trim()
                      .toLowerCase();


                  if (!email) {
                    setEditError("البريد الإلكتروني غير موجود.");
                    return;
                  }


                  const name =
                    String(editName || "")
                      .trim();


                  if (!name) {
                    setEditError("الاسم مطلوب.");
                    return;
                  }


                  if (
                    editRole === "super" &&
                    !editGovernorate
                  ) {
                    setEditError(
                      "يجب اختيار المحافظة لمشرف المحافظة."
                    );
                    return;
                  }

                  const selectedOrganization =
                    editRole === "tenant_admin"
                      ? editSchools.find(
                          (item) =>
                            item.id === editTenantId
                        )
                      : editRole === "exam_super"
                        ? editCenters.find(
                            (item) =>
                              item.id === editTenantId
                          )
                        : null;


                  if (
                    [
                      "tenant_admin",
                      "exam_super",
                    ].includes(editRole)
                  ) {

                    if (!editGovernorate) {
                      setEditError(
                        "يجب اختيار المحافظة."
                      );
                      return;
                    }


                    if (!editTenantId) {
                      setEditError(
                        editRole === "tenant_admin"
                          ? "يجب اختيار المدرسة."
                          : "يجب اختيار مركز الدبلوم."
                      );
                      return;
                    }


                    if (
                      !selectedOrganization ||
                      selectedOrganization.governorate !==
                        editGovernorate
                    ) {
                      setEditError(
                        "الجهة المختارة غير صالحة للمحافظة المحددة."
                      );
                      return;
                    }

                  }


                  setEditError("");


                  try {

                    await updateAllowlistUser({

                      email,

                      name,

                      role:
                        editRole,

                      enabled:
                        editTarget?.enabled !== false,

                      governorate:
                        editRole === "ministry_super"
                          ? ""
                          : editGovernorate,

                      tenantId:
                        [
                          "tenant_admin",
                          "exam_super",
                        ].includes(editRole)
                          ? editTenantId
                          : "",

                      schoolName:
                        String(
                          selectedOrganization?.name ||
                          ""
                        ).trim(),

                    });


                    setEditTarget(null);


                  } catch (error: any) {

                    console.error(
                      "EDIT_USER_ERROR",
                      error
                    );

                    const editMessage =
                      String(
                        error?.message ||
                        error?.details ||
                        ""
                      );

                    setEditError(
                      editMessage.includes(
                        "TENANT_SUPERVISOR_ALREADY_ASSIGNED"
                      )
                        ? (
                            editRole === "exam_super"
                              ? "مركز الدبلوم المحدد مرتبط بالفعل بمشرف آخر. اختر مركزًا آخر أو عدّل المشرف الحالي للمركز."
                              : "المدرسة المحددة مرتبطة بالفعل بمشرف آخر. اختر مدرسة أخرى أو عدّل المشرف الحالي للمدرسة."
                          )
                        : (
                            editMessage ||
                            "تعذر حفظ التعديل."
                          )
                    );

                  }

                }}
                style={{
                  height:42,
                  padding:"0 22px",
                  borderRadius:11,
                  border:0,
                  background:"#17345f",
                  color:"#fff",
                  fontWeight:900,
                  cursor:"pointer",
                }}
              >
                حفظ التعديل
              </button>

            </div>


          </section>

        </div>

      ) : null}

      {deleteTarget ? (

        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 12000,
            background: "rgba(15,23,42,.48)",
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
          onMouseDown={(event) => {
            if (
              event.currentTarget === event.target
            ) {
              closeDeleteDialog();
            }
          }}
        >

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
            style={{
              width: "min(480px,95vw)",
              background: "#ffffff",
              borderRadius: 20,
              padding: 24,
              borderTop: "5px solid #c62828",
              boxShadow:
                "0 24px 65px rgba(15,23,42,.28)",
            }}
          >

            <h2
              id="delete-user-title"
              style={{
                margin: 0,
                color: "#991b1b",
                fontSize: 22,
              }}
            >
              تأكيد حذف المستخدم
            </h2>


            <p
              style={{
                color: "#475569",
                lineHeight: 1.9,
                fontSize: 14,
                margin: "14px 0",
              }}
            >
              سيتم حذف سجل المستخدم الإداري من
              قائمة السماح. هذه العملية لا تعتمد
              على حذف مباشر من المتصفح.
            </p>


            <div
              style={{
                background: "#fff7f7",
                border: "1px solid #fecaca",
                borderRadius: 12,
                padding: 12,
                color: "#7f1d1d",
                fontWeight: 800,
                direction: "ltr",
                textAlign: "left",
              }}
            >
              {String(
                deleteTarget?.email ||
                deleteTarget?.id ||
                ""
              )}
            </div>


            {deleteError ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 10,
                  background: "#fef2f2",
                  color: "#b91c1c",
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                {deleteError}
              </div>
            ) : null}


            <div
              style={{
                marginTop: 20,
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >

              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={Boolean(deletingEmail)}
                style={{
                  minHeight: 42,
                  borderRadius: 11,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  padding: "0 18px",
                  fontFamily: "inherit",
                  fontWeight: 900,
                  cursor: deletingEmail
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                إلغاء
              </button>


              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={Boolean(deletingEmail)}
                style={{
                  minHeight: 42,
                  borderRadius: 11,
                  border: 0,
                  background:
                    "linear-gradient(135deg,#b91c1c,#e53935)",
                  color: "#ffffff",
                  padding: "0 20px",
                  fontFamily: "inherit",
                  fontWeight: 900,
                  cursor: deletingEmail
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                {deletingEmail
                  ? "جارٍ الحذف..."
                  : "تأكيد الحذف"}
              </button>

            </div>

          </section>

        </div>

      ) : null}

    </section>
  );
}
