import React, { useCallback, useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { normalizeText } from "../constants/directorates";
import "./GovernorateSupersDirectory.model3.css";

const GOLD = "#d4af37";
const BG = "linear-gradient(180deg, #f4efe2 0%, #ebe4d3 100%)";
const CARD = "linear-gradient(180deg, #f8f4e8 0%, #f2eddf 100%)";
const INK = "#111111";
const MINISTRY_LOGO_URL = "https://i.postimg.cc/j5G4NQvZ/sh%CA%BFar-1.png";

const TENANT_KEYS = [
  "effectiveTenantId",
  "tenantId",
  "selectedTenantId",
  "currentTenantId",
  "exam-manager:effectiveTenantId",
  "exam-manager:tenantId",
];

const ROLE_KEYS = [
  "effectiveRole",
  "role",
  "selectedRole",
  "viewAsRole",
  "exam-manager:effectiveRole",
];

const EMAIL_KEYS = [
  "effectiveExamSuperEmail",
  "examSuperEmail",
  "selectedExamSuperEmail",
  "viewAsEmail",
];

type SupervisorRow = {
  email: string;
  displayName: string;
  governorate: string;
  tenantId: string;
  enabled: boolean;
};

type GroupedRows = Record<string, SupervisorRow[]>;

type AuthLike = {
  effectiveRole?: string;
  effectiveTenantId?: string;
  allow?: {
    role?: string;
    email?: string;
    governorate?: string;
  };
  profile?: {
    role?: string;
    email?: string;
    governorate?: string;
    tenantId?: string;
  };
  userProfile?: {
    role?: string;
    email?: string;
    governorate?: string;
    tenantId?: string;
  };
  user?: {
    email?: string;
    tenantId?: string;
  };
  currentUser?: {
    email?: string;
  };
  setEffectiveTenantId?: (tenantId: string) => void | Promise<void>;
  setTenantId?: (tenantId: string) => void | Promise<void>;
  setSelectedTenantId?: (tenantId: string) => void | Promise<void>;
  setCurrentTenantId?: (tenantId: string) => void | Promise<void>;
  setEffectiveRole?: (role: string) => void | Promise<void>;
  setRole?: (role: string) => void | Promise<void>;
  setViewAsRole?: (role: string) => void | Promise<void>;
  setImpersonation?: (payload: { tenantId: string; role: string; email?: string }) => void | Promise<void>;
};

function cleanGovernorate(value: string): string {
  return normalizeText(String(value || "").trim())
    .replace(/المديرية\s*العامة\s*للتعليم\s*بمحافظة/g, "")
    .replace(/المديريةالعامةللتعليمبمحافظة/g, "")
    .replace(/محافظة/g, "")
    .trim();
}

function sameGovernorate(a: string, b: string): boolean {
  const aa = cleanGovernorate(a);
  const bb = cleanGovernorate(b);

  if (!aa || !bb) return false;
  if (aa === bb) return true;
  return aa.includes(bb) || bb.includes(aa);
}

function readRole(auth: AuthLike): string {
  return String(
    auth?.effectiveRole || auth?.allow?.role || auth?.profile?.role || auth?.userProfile?.role || ""
  )
    .trim()
    .toLowerCase();
}

function readEmail(auth: AuthLike): string {
  return String(
    auth?.allow?.email || auth?.profile?.email || auth?.user?.email || auth?.currentUser?.email || ""
  )
    .trim()
    .toLowerCase();
}

function readGovernorateFromAuth(auth: AuthLike): string {
  return String(
    auth?.allow?.governorate || auth?.profile?.governorate || auth?.userProfile?.governorate || ""
  ).trim();
}

function persistValue(keys: string[], value: string) {
  for (const key of keys) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore storage failures
    }

    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // ignore storage failures
    }
  }
}


function persistGovernorateExamSuperReadOnly(params: { tenantId: string; email: string; returnTo: string }) {
  const tenantId = String(params.tenantId || "").trim();
  const email = String(params.email || "").trim().toLowerCase();
  const returnTo = String(params.returnTo || "/governorate-supers").trim() || "/governorate-supers";
  const expiresAt = String(Date.now() + 6 * 60 * 60 * 1000);

  const entries: Record<string, string> = {
    governorateSuperReadOnly: "true",
    viewAsReadOnly: "true",
    readOnly: "true",
    isReadOnlyView: "true",
    openedByGovernorateSuper: "true",
    governorateSuperViewTenantId: tenantId,
    viewAsTenantId: tenantId,
    effectiveTenantId: tenantId,
    selectedTenantId: tenantId,
    tenantId,
    governorateSuperViewExpiresAt: expiresAt,
    governorateSuperReturnTo: returnTo,
    readOnlyReturnTo: returnTo,
    viewAsRole: "exam_super",
    effectiveRole: "exam_super",
    viewAsScope: "exam_center",
  };

  if (email) {
    entries.viewAsEmail = email;
    entries.effectiveViewAsEmail = email;
    entries.examSuperEmail = email;
  }

  Object.entries(entries).forEach(([key, value]) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore localStorage failures
    }

    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // ignore sessionStorage failures
    }
  });

  window.dispatchEvent(new CustomEvent("auth-changed", { detail: { tenantId, role: "exam_super", email, readOnly: true } }));
  window.dispatchEvent(new CustomEvent("effective-tenant-changed", { detail: { tenantId, readOnly: true } }));
  window.dispatchEvent(new CustomEvent("effective-role-changed", { detail: { role: "exam_super", readOnly: true } }));
  window.dispatchEvent(new Event("yr-authz-refresh"));
}


export default function GovernorateSupersDirectory() {
  const navigate = useNavigate();
  const auth = (useAuth() as AuthLike) || {};
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const role = readRole(auth);
  const currentEmail = readEmail(auth);
  const isOwner = role === "super_admin";
  const isGovernorateSuper = role === "super";

  const [rows, setRows] = useState<SupervisorRow[]>([]);
  const [myGovernorate, setMyGovernorate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openingTenantId, setOpeningTenantId] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function resolveExactGovernorate(): Promise<string> {
      const governorateFromAuth = readGovernorateFromAuth(auth);

      if (currentEmail) {
        try {
          const ownDoc = await getDoc(doc(db, "allowlist", currentEmail));
          if (ownDoc.exists()) {
            const ownData = (ownDoc.data() as Record<string, unknown>) || {};
            const exactGov = String(ownData.governorate || "").trim();
            if (exactGov) return exactGov;
          }
        } catch {
          // ignore and continue fallback chain
        }
      }

      return governorateFromAuth;
    }

    async function loadRows() {
      setLoading(true);
      setError("");

      try {
        let supervisorRows: SupervisorRow[] = [];
        let resolvedGov = "";

        if (isOwner) {
          const ownerSnap = await getDocs(
            query(collection(db, "allowlist"), where("role", "==", "exam_super"))
          );

          supervisorRows = ownerSnap.docs.map((docSnap) => {
            const data = (docSnap.data() as Record<string, unknown>) || {};
            return {
              email: String(data.email || docSnap.id || "").trim().toLowerCase(),
              displayName: String(
                data.name || data.userName || data.schoolName || docSnap.id || ""
              ).trim(),
              governorate: String(data.governorate || "").trim(),
              tenantId: String(data.tenantId || "").trim(),
              enabled: data.enabled === true,
            };
          });
        } else if (isGovernorateSuper) {
          resolvedGov = await resolveExactGovernorate();

          if (!resolvedGov) {
            throw new Error("NO_GOVERNORATE");
          }

          const regionalSnap = await getDocs(
            query(
              collection(db, "allowlist"),
              where("role", "==", "exam_super"),
              where("governorate", "==", resolvedGov)
            )
          );

          supervisorRows = regionalSnap.docs.map((docSnap) => {
            const data = (docSnap.data() as Record<string, unknown>) || {};
            return {
              email: String(data.email || docSnap.id || "").trim().toLowerCase(),
              displayName: String(
                data.name || data.userName || data.schoolName || docSnap.id || ""
              ).trim(),
              governorate: String(data.governorate || "").trim(),
              tenantId: String(data.tenantId || "").trim(),
              enabled: data.enabled === true,
            };
          });
        }

        if (cancelled) return;

        setMyGovernorate(resolvedGov);
        setRows(supervisorRows);
      } catch (err: any) {
        if (cancelled) return;

        console.error("Failed to load governorate exam supervisors", err);

        const message = String(err?.message || "").trim();
        if (message === "NO_GOVERNORATE") {
          setError(
            tr(
              "تعذر تحديد المحافظة الخاصة بحساب مشرف المحافظة الحالي.",
              "Unable to determine the governorate for the current governorate supervisor account."
            )
          );
        } else {
          setError(
            tr(
              "تعذر تحميل بيانات مشرفي الامتحانات. تحقق من الصلاحيات وقواعد Firestore.",
              "Unable to load exam supervisor data. Check Firestore permissions and rules."
            )
          );
        }

        setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadRows();

    return () => {
      cancelled = true;
    };
  }, [auth, currentEmail, isGovernorateSuper, isOwner, lang]);

  const visibleRows = useMemo(() => {
    if (isOwner) return rows;
    if (isGovernorateSuper && myGovernorate) {
      return rows.filter((row) => sameGovernorate(row.governorate, myGovernorate));
    }
    return rows;
  }, [isGovernorateSuper, isOwner, myGovernorate, rows]);

  const grouped = useMemo<GroupedRows>(() => {
    return visibleRows.reduce((acc, row) => {
      const key = String(row.governorate || "").trim() || tr("بدون محافظة", "No governorate");
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {} as GroupedRows);
  }, [tr, visibleRows]);

  const openExamSuper = useCallback(
    async (row: SupervisorRow) => {
      const tenantId = String(row.tenantId || "").trim();
      if (!tenantId) return;

      setOpeningTenantId(tenantId);

      try {
        if (isGovernorateSuper && !isOwner) {
          persistGovernorateExamSuperReadOnly({
            tenantId,
            email: row.email,
            returnTo: "/governorate-supers",
          });

          navigate(`/t/${tenantId}/dashboard12?readOnly=1&fromGovernorateSuper=1`, {
            state: {
              effectiveTenantId: tenantId,
              effectiveRole: "exam_super",
              examSuperEmail: row.email,
              openedFrom: "governorate-supers",
              readOnly: true,
            },
            replace: false,
          });

          return;
        }

        const calls: Array<void | Promise<void>> = [];

        if (typeof auth?.setImpersonation === "function") {
          calls.push(auth.setImpersonation({ tenantId, role: "exam_super", email: row.email }));
        }
        if (typeof auth?.setEffectiveTenantId === "function") {
          calls.push(auth.setEffectiveTenantId(tenantId));
        }
        if (typeof auth?.setTenantId === "function") {
          calls.push(auth.setTenantId(tenantId));
        }
        if (typeof auth?.setSelectedTenantId === "function") {
          calls.push(auth.setSelectedTenantId(tenantId));
        }
        if (typeof auth?.setCurrentTenantId === "function") {
          calls.push(auth.setCurrentTenantId(tenantId));
        }
        if (typeof auth?.setEffectiveRole === "function") {
          calls.push(auth.setEffectiveRole("exam_super"));
        }
        if (typeof auth?.setRole === "function") {
          calls.push(auth.setRole("exam_super"));
        }
        if (typeof auth?.setViewAsRole === "function") {
          calls.push(auth.setViewAsRole("exam_super"));
        }

        persistValue(TENANT_KEYS, tenantId);
        persistValue(ROLE_KEYS, "exam_super");
        persistValue(EMAIL_KEYS, row.email);

        window.dispatchEvent(new CustomEvent("auth-changed", { detail: { tenantId, role: "exam_super", email: row.email } }));
        window.dispatchEvent(new CustomEvent("effective-tenant-changed", { detail: { tenantId } }));
        window.dispatchEvent(new CustomEvent("effective-role-changed", { detail: { role: "exam_super" } }));

        await Promise.allSettled(calls.filter(Boolean).map((item) => Promise.resolve(item)));

        navigate(`/t/${tenantId}/dashboard12`, {
          state: {
            effectiveTenantId: tenantId,
            effectiveRole: "exam_super",
            examSuperEmail: row.email,
            openedFrom: "governorate-supers",
          },
          replace: false,
        });
      } finally {
        window.setTimeout(() => {
          setOpeningTenantId((current) => (current === tenantId ? "" : current));
        }, 800);
      }
    },
    [auth, navigate, isGovernorateSuper, isOwner]
  );

  return (
    <div
      className="governorate-supers-model3-force"
      style={{
        minHeight: "100vh",
        background: BG,
        padding: 22,
        boxSizing: "border-box",
        direction: isRTL ? "rtl" : "ltr",
      }}
    >
      <div style={{ maxWidth: 1700, margin: "0 auto", display: "grid", gap: 24 }}>
        <section className="governorate-supers-model3-hero" style={heroStyle}>
          <div className="governorate-supers-model3-official-brand">
            <img src={MINISTRY_LOGO_URL} alt="شعار وزارة التعليم" />
            <div>
              <strong>وزارة التعليم</strong>
              <span>{myGovernorate || tr("نطاق مالك المنصة", "Platform owner scope")}</span>
            </div>
          </div>
          <button className="governorate-supers-model3-back-button" type="button" onClick={() => navigate("/programs-gateway")} style={backBtn}>
            {tr("العودة إلى البوابة التشغيلية", "Back to Operational Gateway")}
          </button>

          <div className="governorate-supers-model3-title-block" style={{ display: "grid", gap: 10 }}>
            <div className="governorate-supers-model3-kicker" style={pill}>{tr("دليل مشرفي امتحانات الدبلوم", "Exam Supervisors Directory")}</div>
            <h1 style={h1}>
              {tr("مشرفو امتحانات الدبلوم العام داخل المحافظة", "All Diploma Exam Supervisors")}
            </h1>
            {!isOwner && isGovernorateSuper && myGovernorate ? (
              <div style={{ color: "#fff7d8", fontWeight: 800, fontSize: 16 }}>
                {tr(`نطاق العرض: ${myGovernorate}`, `Scope: ${myGovernorate}`)}
              </div>
            ) : null}
          </div>
        </section>

        <section className="governorate-supers-model3-panel" style={panel}>
          {loading ? (
            <div style={empty}>{tr("جاري تحميل القائمة...", "Loading list...")}</div>
          ) : error ? (
            <div style={errorBox}>{error}</div>
          ) : !Object.keys(grouped).length ? (
            <div style={empty}>
              {tr(
                "لا يوجد مشرفو امتحانات مطابقون لنطاق العرض الحالي.",
                "No exam supervisors match the current scope."
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 24 }}>
              {(Object.entries(grouped) as [string, SupervisorRow[]][]).map(([gov, items]) => (
                <div key={gov} style={{ display: "grid", gap: 16 }}>
                  <div className="governorate-supers-model3-gov-header" style={govHeader}>{gov}</div>
                  <div style={{ display: "grid", gap: 16 }}>
                    {items.map((row) => {
                      const isOpening = openingTenantId === row.tenantId;

                      return (
                        <div key={row.email} className="governorate-supers-model3-row-card" style={rowCard}>
                          <div style={{ display: "grid", gap: 10 }}>
                            <div className="governorate-supers-model3-row-title" style={rowTitle}>{row.displayName || row.email}</div>
                            <div style={rowMeta}>{row.email}</div>

                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                              <span style={tag}>{row.tenantId || tr("بدون Tenant", "No Tenant")}</span>
                              <span
                                style={{
                                  ...tag,
                                  background: row.enabled
                                    ? "rgba(16,185,129,0.10)"
                                    : "rgba(239,68,68,0.10)",
                                }}
                              >
                                {row.enabled ? tr("مفعل", "Enabled") : tr("موقوف", "Disabled")}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              void openExamSuper(row);
                            }}
                            disabled={!row.tenantId || isOpening}
                            style={{
                              ...btn,
                              opacity: row.tenantId ? 1 : 0.55,
                              cursor: row.tenantId && !isOpening ? "pointer" : "not-allowed",
                            }}
                          >
                            {isOpening ? tr("جاري الدخول...", "Opening...") : isGovernorateSuper && !isOwner ? tr("دخول مشاهدة فقط", "Open read-only") : tr("دخول", "Open")}
                          </button>
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

const heroStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #8b6a00 0%, #b8860b 48%, #7a5c00 100%)",
  borderRadius: 38,
  border: `4px solid ${GOLD}`,
  padding: "28px 30px",
  color: "#fff7d8",
  display: "grid",
  gap: 18,
  boxShadow: "0 20px 48px rgba(0,0,0,0.20)",
};

const panel: React.CSSProperties = {
  background: CARD,
  borderRadius: 40,
  border: `5px solid ${GOLD}`,
  padding: 28,
  display: "grid",
  gap: 22,
  boxShadow: "0 0 0 10px rgba(212,175,55,0.12) inset, 0 18px 38px rgba(150,120,20,0.14)",
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

const pill: React.CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  padding: "10px 18px",
  borderRadius: 999,
  border: "2px solid rgba(16,185,129,0.22)",
  background: "rgba(16,185,129,0.10)",
  color: INK,
  fontWeight: 900,
  fontSize: 14,
};

const h1: React.CSSProperties = {
  margin: 0,
  fontSize: "clamp(28px,5vw,54px)",
  lineHeight: 1.15,
  fontWeight: 1000,
};

const empty: React.CSSProperties = {
  color: INK,
  fontWeight: 900,
  fontSize: 20,
  padding: 12,
};

const errorBox: React.CSSProperties = {
  color: "#7f1d1d",
  background: "rgba(239,68,68,0.10)",
  border: "2px solid rgba(239,68,68,0.25)",
  borderRadius: 18,
  padding: 16,
  fontWeight: 900,
  fontSize: 18,
};

const govHeader: React.CSSProperties = {
  color: INK,
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
};

const rowTitle: React.CSSProperties = {
  color: INK,
  fontWeight: 1000,
  fontSize: 28,
  lineHeight: 1.3,
};

const rowMeta: React.CSSProperties = {
  color: INK,
  fontWeight: 800,
  fontSize: 18,
  wordBreak: "break-word",
};

const tag: React.CSSProperties = {
  display: "inline-flex",
  padding: "8px 14px",
  borderRadius: 999,
  border: `2px solid ${GOLD}`,
  background: "rgba(212,175,55,0.10)",
  color: INK,
  fontWeight: 900,
  fontSize: 14,
};

const btn: React.CSSProperties = {
  minHeight: 56,
  minWidth: 130,
  padding: "0 20px",
  borderRadius: 18,
  border: `3px solid ${GOLD}`,
  background: "linear-gradient(180deg, #f2dc8a 0%, #d4af37 100%)",
  color: INK,
  fontWeight: 1000,
  fontSize: 18,
};
