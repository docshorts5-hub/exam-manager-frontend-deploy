import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import "./SchoolAdminsDirectory.model3.css";

const GOLD = "#d4af37";
const SOFT = "rgba(212,175,55,0.18)";
const BG = "linear-gradient(180deg, #f4efe2 0%, #ebe4d3 100%)";
const CARD = "linear-gradient(180deg, #f8f4e8 0%, #f2eddf 100%)";
const MINISTRY_LOGO_URL = "https://i.postimg.cc/j5G4NQvZ/sh%CA%BFar-1.png";

type AllowDoc = {
  email?: string;
  role?: string;
  tenantId?: string;
  governorate?: string;
  enabled?: boolean;
  userName?: string;
  name?: string;
  schoolName?: string;
};

type Grouped = Record<string, AllowDoc[]>;

// 🛡️ SECURITY LAYER: التنظيف الجذري للمدخلات 🛡️
const sanitizeInput = (input: string | null | undefined): string => {
  if (!input) return "";
  return String(input)
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// 🛡️ SECURITY LAYER: التحقق الصارم من معرف المدرسة (Tenant ID Validator) لمنع Path Traversal 🛡️
const validateTenantId = (id: string | null | undefined): string => {
  if (!id) return "";
  const sanitized = sanitizeInput(id);
  // السماح فقط بالحروف الإنجليزية، الأرقام، الشرطات العادية والسفلية لمنع حقن المسارات
  return sanitized.replace(/[^a-zA-Z0-9_-]/g, "");
};

const normalizeScopeValue = (value: string | null | undefined): string => {
  return sanitizeInput(value).replace(/\s+/g, " ").trim().toLowerCase();
};

export default function SchoolAdminsDirectory() {
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

  const currentEmail = String(
    auth?.allow?.email ||
      auth?.profile?.email ||
      auth?.user?.email ||
      auth?.currentUser?.email ||
      ""
  ).trim().toLowerCase();

  const isOwner = role === "super_admin";
  const isGovernorateSuper = role === "super";

  const governorateFromAuth = String(
    auth?.allow?.governorate ||
      auth?.profile?.governorate ||
      auth?.userProfile?.governorate ||
      ""
  ).trim();

  const [rows, setRows] = useState<AllowDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvedGovernorate, setResolvedGovernorate] = useState(governorateFromAuth);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function resolveGovernorate(): Promise<string> {
      if (governorateFromAuth) return sanitizeInput(governorateFromAuth);
      if (!currentEmail) return "";

      try {
        const ownDoc = await getDoc(doc(db, "allowlist", currentEmail));
        if (ownDoc.exists()) {
          const ownData = (ownDoc.data() as Record<string, unknown>) || {};
          const exactGov = String(ownData.governorate || "").trim();
          if (exactGov) return sanitizeInput(exactGov);
        }
      } catch {
        // ignore and continue fallback
      }

      try {
        const ownByEmail = await getDocs(
          query(collection(db, "allowlist"), where("email", "==", currentEmail))
        );
        const first = ownByEmail.docs[0];
        if (first) {
          const ownData = (first.data() as Record<string, unknown>) || {};
          const exactGov = String(ownData.governorate || "").trim();
          if (exactGov) return sanitizeInput(exactGov);
        }
      } catch {
        // ignore
      }

      return "";
    }

    async function loadRows() {
      setLoading(true);
      setErrorText("");

      try {
        const gov = await resolveGovernorate();
        if (!cancelled) setResolvedGovernorate(gov);

        let snap;
        if (isOwner) {
          snap = await getDocs(
            query(
              collection(db, "allowlist"),
              where("role", "in", ["tenant_admin", "admin"])
            )
          );
        } else if (isGovernorateSuper) {
          if (!gov) {
            if (!cancelled) {
              setRows([]);
              setErrorText(
                tr(
                  "تعذر تحديد المحافظة الخاصة بحساب مشرف المحافظة الحالي.",
                  "Unable to determine the governorate for the current governorate supervisor account."
                )
              );
            }
            return;
          }

          snap = await getDocs(
            query(
              collection(db, "allowlist"),
              where("role", "in", ["tenant_admin", "admin"]),
              where("governorate", "==", gov)
            )
          );
        } else {
          if (!cancelled) setRows([]);
          return;
        }

        if (cancelled) return;

        const next: AllowDoc[] = [];
        snap.forEach((docSnap) => {
          const data = (docSnap.data() as AllowDoc) || {};
          // ✅ تطبيق الحماية الشاملة للبيانات الواردة من قاعدة البيانات
          next.push({ 
            email: sanitizeInput(docSnap.id),
            role: sanitizeInput(data.role),
            tenantId: validateTenantId(data.tenantId),
            governorate: sanitizeInput(data.governorate),
            enabled: !!data.enabled,
            userName: sanitizeInput(data.userName),
            name: sanitizeInput(data.name),
            schoolName: sanitizeInput(data.schoolName)
          });
        });

        setRows(next);
      } catch (error) {
        console.error("Failed to load school admins directory", error);
        if (!cancelled) {
          setRows([]);
          setErrorText(
            tr(
              "تعذر تحميل بيانات مدراء المدارس. تحقق من الصلاحيات وقواعد Firestore.",
              "Unable to load school manager data. Check Firestore permissions and rules."
            )
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadRows();

    return () => {
      cancelled = true;
    };
  }, [currentEmail, governorateFromAuth, isGovernorateSuper, isOwner, lang]);

  const grouped = useMemo<Grouped>(() => {
    return rows.reduce((acc, row) => {
      const key = String(row.governorate || "").trim() || tr("بدون محافظة", "No governorate");
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {} as Grouped);
  }, [rows, lang]);

  if (!isOwner && !isGovernorateSuper) {
    return (
      <DeniedCard
        title={tr("غير مصرح بالدخول", "Access denied")}
        desc={tr(
          "هذه الصفحة مخصصة لمالك المنصة أو لسوبر المحافظة ضمن نطاقه.",
          "This page is limited to the platform owner or governorate super within scope."
        )}
      />
    );
  }

  return (
    <div
      className="school-admins-model3-force"
      style={{
        minHeight: "100vh",
        background: BG,
        padding: 22,
        boxSizing: "border-box",
        direction: isRTL ? "rtl" : "ltr",
      }}
    >
      <div style={{ maxWidth: 1700, margin: "0 auto", display: "grid", gap: 24 }}>
        
      <section className="school-admins-model3-hero-rebuilt" aria-label={tr("ترويسة دليل مدراء المدارس", "School managers directory header")}>
        <div className="school-admins-model3-hero-right">
          <div className="school-admins-model3-hero-logoCard">
            <img src={MINISTRY_LOGO_URL} alt={tr("شعار وزارة التعليم", "Ministry of Education logo")} />
          </div>
          <div className="school-admins-model3-hero-brand">
            <div>{tr("سلطنة عمان", "Sultanate of Oman")}</div>
            <div>{tr("وزارة التعليم", "Ministry of Education")}</div>
            <div>{tr("واجهة إشرافية رسمية", "Official supervisory interface")}</div>
          </div>
        </div>

        <div className="school-admins-model3-hero-center">
          <div className="school-admins-model3-hero-kicker">
            {tr("قائمة إشرافية", "Supervision Directory")}
          </div>

          <h1>
            {tr("دليل مدراء المدارس حسب المحافظات", "School Managers Directory by Governorate")}
          </h1>

          <p>
            {isGovernorateSuper && resolvedGovernorate
              ? tr(`نطاق العرض: ${resolvedGovernorate}`, `Scope: ${resolvedGovernorate}`)
              : tr(
                  "هذه الصفحة تعرض مدراء المدارس مرتبين حسب المحافظة، ويمكن الدخول إلى نظام المدرسة للعرض والمتابعة حسب الصلاحيات.",
                  "This page lists school managers grouped by governorate, with scoped access according to permissions."
                )}
          </p>
        </div>

        <div className="school-admins-model3-hero-left">
          <button
            type="button"
            onClick={() => navigate("/programs-gateway")}
          >
            {tr("العودة إلى البوابة التشغيلية", "Back to Operational Gateway")}
          </button>
        </div>
      </section>
<section className="school-admins-model3-old-hero-hidden" style={heroStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
            <button type="button" onClick={() => navigate("/programs-gateway")} style={backBtn}>
              {tr("العودة إلى البوابة التشغيلية", "Back to Supervisory Gateway")}
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ display: "grid", gap: 4, textAlign: isRTL ? "right" : "left" }}>
                 <div style={{ color: "#5c4a24", fontWeight: 850, fontSize: 20 }}>{tr("سلطنة عمان", "Sultanate of Oman")}</div>
                <div style={{ color: "#7a5a13", fontWeight: 1000, fontSize: 20 }}>{tr("وزارة التعليم", "Ministry of Education")}</div>
                <div style={{ color: "#5c4a24", fontWeight: 800, fontSize: 20 }}>{tr("واجهة إشرافية رسمية", "Official supervisory interface")}</div>
              </div>
              <img src={MINISTRY_LOGO_URL} alt="وزارة التعليم" style={{ width: 64, height: 64, objectFit: "contain" }} />
            </div>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={pillGreen}>{tr("قائمة إشرافية", "Supervision Directory")}</div>
            <h1 style={h1}>{tr("دليل مدراء المدارس حسب المحافظات", "School Managers Directory by Governorate")}</h1>
            {isGovernorateSuper && resolvedGovernorate ? (
              <p style={p}>
                {tr(`نطاق العرض: ${resolvedGovernorate}`, `Scope: ${resolvedGovernorate}`)}
              </p>
            ) : (
              <p style={p}>
                {tr(
                  "هذه الصفحة تعرض مدراء المدارس مرتبين حسب المحافظة، ويمكن الدخول إلى نظام المدرسة للعرض والمتابعة حسب الصلاحيات.",
                  "This page lists school managers grouped by governorate, with scoped access according to permissions."
                )}
              </p>
            )}
          </div>
        </section>

        <section style={panel}>
          {loading ? (
            <div style={emptyStyle}>{tr("جاري تحميل القائمة...", "Loading list...")}</div>
          ) : errorText ? (
            <div style={emptyStyle}>{errorText}</div>
          ) : !Object.keys(grouped).length ? (
            <div style={emptyStyle}>{tr("لا يوجد مدراء مدارس مطابقون للعرض الحالي.", "No school managers match the current view.")}</div>
          ) : (
            <div style={{ display: "grid", gap: 24 }}>
              {Object.entries(grouped).map(([gov, items]) => (
                <div key={gov} style={{ display: "grid", gap: 16 }}>
                  <div style={govHeader}>{gov}</div>
                  <div style={{ display: "grid", gap: 16 }}>
                    {items.map((row) => {
                      const email = row.email || "";
                      const tenantId = row.tenantId || "";
                      const schoolName = row.schoolName || row.name || email.split("@")[0] || "";
                      const enabled = row.enabled === true;

                      return (
                        <div key={email} style={rowCard}>
                          <div style={{ display: "grid", gap: 10 }}>
                            <div className="school-admins-model3-school-name" style={rowTitle}>{schoolName}</div>
                            <div style={rowMeta}>{email}</div>
                            <div style={tagRow}>
                              <span style={tag}>{tenantId || tr("بدون Tenant", "No Tenant")}</span>
                              <span style={{ ...tag, background: enabled ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.10)" }}>
                                {enabled ? tr("مفعل", "Enabled") : tr("موقوف", "Disabled")}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              onClick={() => {
                              if (!tenantId) return;

                              try {
                                // ✅ الكتابة الموثوقة للتخزين والتهيئة للتوجيه
                                const safeTenantId = validateTenantId(tenantId);
                                const readOnlyExpiresAt = String(Date.now() + 6 * 60 * 60 * 1000);

                                // GOVERNORATE_READONLY_OPEN_SCOPE_GUARD
                                if (!safeTenantId) return;

                                if (isGovernorateSuper) {
                                  const rowGovernorate = normalizeScopeValue(row.governorate);
                                  const currentGovernorate = normalizeScopeValue(resolvedGovernorate);

                                  if (!rowGovernorate || !currentGovernorate || rowGovernorate !== currentGovernorate) {
                                    setErrorText(
                                      tr(
                                        "تم منع فتح المدرسة لأنها خارج نطاق محافظة مشرف المحافظة الحالي.",
                                        "Opening was blocked because this school is outside the current governorate supervisor scope."
                                      )
                                    );
                                    return;
                                  }
                                }

                                localStorage.setItem("effectiveTenantId", safeTenantId);
                                localStorage.setItem("tenantId", safeTenantId);
                                localStorage.setItem("selectedTenantId", safeTenantId);

                                sessionStorage.setItem("effectiveTenantId", safeTenantId);
                                sessionStorage.setItem("tenantId", safeTenantId);
                                sessionStorage.setItem("selectedTenantId", safeTenantId);

                                if (isGovernorateSuper) {
                                  const governorateReturnTo = `${window.location.pathname}${window.location.search || ""}` || "/school-admins";
                                  localStorage.setItem("governorateSuperReturnTo", governorateReturnTo);
                                  localStorage.setItem("readOnlyReturnTo", governorateReturnTo);
                                  sessionStorage.setItem("governorateSuperReturnTo", governorateReturnTo);
                                  sessionStorage.setItem("readOnlyReturnTo", governorateReturnTo);
                                  localStorage.setItem("openedByGovernorateSuper", "true");
                                  localStorage.setItem("isReadOnlyView", "true");
                                  localStorage.setItem("governorateSuperViewGovernorate", resolvedGovernorate);

                                  sessionStorage.setItem("openedByGovernorateSuper", "true");
                                  sessionStorage.setItem("isReadOnlyView", "true");
                                  sessionStorage.setItem("governorateSuperViewGovernorate", resolvedGovernorate);
                                  localStorage.setItem("governorateSuperReadOnly", "true");
                                  localStorage.setItem("viewAsReadOnly", "true");
                                  localStorage.setItem("readOnly", "true");
                                  localStorage.setItem("governorateSuperViewTenantId", safeTenantId);
                                  localStorage.setItem("viewAsTenantId", safeTenantId);
                                  localStorage.setItem("governorateSuperViewExpiresAt", readOnlyExpiresAt);

                                  sessionStorage.setItem("governorateSuperReadOnly", "true");
                                  sessionStorage.setItem("viewAsReadOnly", "true");
                                  sessionStorage.setItem("readOnly", "true");
                                  sessionStorage.setItem("governorateSuperViewTenantId", safeTenantId);
                                  sessionStorage.setItem("viewAsTenantId", safeTenantId);
                                  sessionStorage.setItem("governorateSuperViewExpiresAt", readOnlyExpiresAt);
                                } else {
                                  localStorage.removeItem("governorateSuperReadOnly");
                                  localStorage.removeItem("viewAsReadOnly");
                                  localStorage.removeItem("readOnly");
                                  localStorage.removeItem("governorateSuperViewTenantId");
                                  localStorage.removeItem("viewAsTenantId");
                                  localStorage.removeItem("governorateSuperViewExpiresAt");

                                  sessionStorage.removeItem("governorateSuperReadOnly");
                                  sessionStorage.removeItem("viewAsReadOnly");
                                  sessionStorage.removeItem("readOnly");
                                  sessionStorage.removeItem("governorateSuperViewTenantId");
                                  sessionStorage.removeItem("viewAsTenantId");
                                  sessionStorage.removeItem("governorateSuperViewExpiresAt");
                                }

                                const targetPath = isGovernorateSuper ? `/t/${safeTenantId}/dashboard` : `/t/${safeTenantId}`;

                                if (isGovernorateSuper) {
                                  window.location.assign(targetPath);
                                } else {
                                  navigate(targetPath);
                                }
                              } catch (e) {
                                console.error("Error setting tenant storage:", e);
                                const fallbackTenantId = validateTenantId(tenantId);
                                if (!fallbackTenantId) return;

                                const fallbackPath = isGovernorateSuper ? `/t/${fallbackTenantId}/dashboard` : `/t/${fallbackTenantId}`;

                                if (isGovernorateSuper) {
                                  window.location.assign(fallbackPath);
                                } else {
                                  navigate(fallbackPath);
                                }
                              }
                            }}
                              disabled={!tenantId}
                              style={primaryBtn}
                            >
                              {tr("دخول", "Open")}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DeniedCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: BG, padding: 24 }}>
      <div style={{ maxWidth: 760, width: "100%", background: CARD, border: `5px solid ${GOLD}`, borderRadius: 30, padding: 28, color: "#111", boxShadow: "0 0 0 8px rgba(212,175,55,0.12) inset" }}>
        <div style={{ fontSize: 32, fontWeight: 1000, marginBottom: 12 }}>{title}</div>
        <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.9 }}>{desc}</div>
      </div>
    </div>
  );
}

const heroStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #fffdf7 0%, #f4ecd6 100%)",
  borderRadius: 38,
  border: `4px solid ${GOLD}`,
  boxShadow: `0 24px 50px rgba(0,0,0,0.25), 0 0 28px ${SOFT}`,
  padding: "28px 30px",
  color: "#2f2615",
  display: "grid",
  gap: 18,
};
const panel: React.CSSProperties = {
  background: CARD,
  borderRadius: 40,
  border: `5px solid ${GOLD}`,
  boxShadow: "0 0 0 10px rgba(212,175,55,0.12) inset, 0 18px 38px rgba(150,120,20,0.14)",
  padding: 28,
  display: "grid",
  gap: 22,
};
const backBtn: React.CSSProperties = {
  minHeight: 56,
  width: "fit-content",
  padding: "0 20px",
  borderRadius: 18,
  border: `3px solid ${GOLD}`,
  background: "linear-gradient(180deg, #f7e4a8 0%, #d4af37 100%)",
  color: "#3f2d07",
  fontWeight: 1000,
  fontSize: 17,
  cursor: "pointer",
};
const pillGreen: React.CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  padding: "10px 18px",
  borderRadius: 999,
  border: "2px solid rgba(16,185,129,0.22)",
  background: "rgba(16,185,129,0.10)",
  color: "#111",
  fontWeight: 900,
  fontSize: 14,
};
const h1: React.CSSProperties = { margin: 0, fontSize: "clamp(28px,5vw,54px)", lineHeight: 1.15, fontWeight: 1000 };
const p: React.CSSProperties = { margin: 0, fontSize: 18, lineHeight: 1.9, fontWeight: 800 };
const emptyStyle: React.CSSProperties = { color: "#111", fontWeight: 900, fontSize: 20, padding: 12 };
const govHeader: React.CSSProperties = {
  color: "#111",
  fontWeight: 1000,
  fontSize: 28,
  background: "#fbf8ef",
  border: `3px solid ${GOLD}`,
  borderRadius: 22,
  padding: "14px 18px",
};
const rowCard: React.CSSProperties = {
  background: "#fbf8ef",
  border: `4px solid ${GOLD}`,
  borderRadius: 30,
  padding: 22,
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 18,
  alignItems: "center",
  boxShadow: "0 12px 24px rgba(150,120,20,0.10)",
};
const rowTitle: React.CSSProperties = { color: "#111", fontWeight: 1000, fontSize: 28, lineHeight: 1.3 };
const rowMeta: React.CSSProperties = { color: "#111", fontWeight: 800, fontSize: 18 };
const tagRow: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap" };
const tag: React.CSSProperties = {
  display: "inline-flex",
  padding: "8px 14px",
  borderRadius: 999,
  border: `2px solid ${GOLD}`,
  background: "rgba(212,175,55,0.10)",
  color: "#111",
  fontWeight: 900,
  fontSize: 14,
};
const primaryBtn: React.CSSProperties = {
  minHeight: 56,
  minWidth: 130,
  padding: "0 20px",
  borderRadius: 18,
  border: `3px solid ${GOLD}`,
  background: "linear-gradient(180deg, #f2dc8a 0%, #d4af37 100%)",
  color: "#111",
  fontWeight: 1000,
  fontSize: 18,
  cursor: "pointer",
  boxShadow: "0 12px 22px rgba(150,120,20,0.14)",
};
