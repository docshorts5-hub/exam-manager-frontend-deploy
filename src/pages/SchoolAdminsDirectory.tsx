import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";

const GOLD = "#d4af37";
const SOFT = "rgba(212,175,55,0.18)";
const BG = "linear-gradient(180deg, #f4efe2 0%, #ebe4d3 100%)";
const CARD = "linear-gradient(180deg, #f8f4e8 0%, #f2eddf 100%)";

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
      if (governorateFromAuth) return governorateFromAuth;
      if (!currentEmail) return "";

      try {
        const ownDoc = await getDoc(doc(db, "allowlist", currentEmail));
        if (ownDoc.exists()) {
          const ownData = (ownDoc.data() as Record<string, unknown>) || {};
          const exactGov = String(ownData.governorate || "").trim();
          if (exactGov) return exactGov;
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
          if (exactGov) return exactGov;
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

          // مهم:
          // الاستعلام نفسه يجب أن يحتوي governorate == المحافظة الحالية
          // حتى يمر مع Firestore Rules الخاصة بسوبر المحافظة.
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
          next.push({ email: docSnap.id, ...data });
        });

        setRows(next);
      } catch (error) {
        console.error("Failed to load school admins directory", error);
        if (!cancelled) {
          setRows([]);
          setErrorText(
            tr(
              "تعذر تحميل بيانات أدمنات المدارس. تحقق من الصلاحيات وقواعد Firestore.",
              "Unable to load school admin data. Check Firestore permissions and rules."
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
      style={{
        minHeight: "100vh",
        background: BG,
        padding: 22,
        boxSizing: "border-box",
        direction: isRTL ? "rtl" : "ltr",
      }}
    >
      <div style={{ maxWidth: 1700, margin: "0 auto", display: "grid", gap: 24 }}>
        <section style={heroStyle}>
          <button type="button" onClick={() => navigate("/programs-gateway")} style={backBtn}>
            {tr("العودة إلى البوابة التشغيلية", "Back to Operational Gateway")}
          </button>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={pillGreen}>{tr("قائمة إشرافية", "Supervision Directory")}</div>
            <h1 style={h1}>{tr("جميع أدمنات المدارس حسب المحافظات", "All School Admins by Governorate")}</h1>
            {isGovernorateSuper && resolvedGovernorate ? (
              <p style={p}>
                {tr(`نطاق العرض: ${resolvedGovernorate}`, `Scope: ${resolvedGovernorate}`)}
              </p>
            ) : (
              <p style={p}>
                {tr(
                  "هذه الصفحة تعرض جميع أدمنات المدارس مرتبين حسب المحافظة، ويمكن الدخول إلى نظام المدرسة مباشرة من كل بطاقة.",
                  "This page lists all school admins grouped by governorate, with direct access to each school system from its card."
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
            <div style={emptyStyle}>{tr("لا يوجد أدمنات مدارس مطابقون للعرض الحالي.", "No school admins match the current view.")}</div>
          ) : (
            <div style={{ display: "grid", gap: 24 }}>
              {Object.entries(grouped).map(([gov, items]) => (
                <div key={gov} style={{ display: "grid", gap: 16 }}>
                  <div style={govHeader}>{gov}</div>
                  <div style={{ display: "grid", gap: 16 }}>
                    {items.map((row) => {
                      const email = String(row.email || "").trim();
                      const tenantId = String(row.tenantId || "").trim();
                      const schoolName = String(row.schoolName || row.name || email.split("@")[0] || "").trim();
                      const enabled = row.enabled === true;

                      return (
                        <div key={email} style={rowCard}>
                          <div style={{ display: "grid", gap: 10 }}>
                            <div style={rowTitle}>{schoolName}</div>
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
                                localStorage.setItem("effectiveTenantId", tenantId);
                                localStorage.setItem("tenantId", tenantId);
                                localStorage.setItem("selectedTenantId", tenantId);

                                sessionStorage.setItem("effectiveTenantId", tenantId);
                                sessionStorage.setItem("tenantId", tenantId);
                                sessionStorage.setItem("selectedTenantId", tenantId);
                              } catch {}

                              navigate(`/t/${tenantId}`);
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
  background: "linear-gradient(135deg, #8b6a00 0%, #b8860b 48%, #7a5c00 100%)",
  borderRadius: 38,
  border: `4px solid ${GOLD}`,
  boxShadow: `0 24px 50px rgba(0,0,0,0.25), 0 0 28px ${SOFT}`,
  padding: "28px 30px",
  color: "#fff7d8",
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
  background: "rgba(255,255,255,0.12)",
  color: "#fff",
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
