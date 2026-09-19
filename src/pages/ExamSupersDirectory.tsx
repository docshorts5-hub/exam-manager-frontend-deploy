import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import "./ExamSupersDirectory.model3.css";
import MINISTRY_LOGO_LOCAL from "../assets/branding/ministry-logo.png";

const GOLD = "#c9a227";
const DARK_GOLD = "#8b6a00";
const INK = "#1f2933";
const MUTED = "#5f5745";
const BG = "linear-gradient(180deg, #f6f1e3 0%, #eee6d2 100%)";
const CARD = "linear-gradient(180deg, #fffdf5 0%, #f7f1e3 100%)";
const MINISTRY_LOGO_URL = MINISTRY_LOGO_LOCAL;
const EXAM_SUPER_LINKS_COLLECTION = "governorateExamSupers";


const EXAM_CENTER_QUERY_ROLES = [
  // مشرف المحافظة يضيف الآن سوبر الامتحانات فقط من صفحة إضافة مسؤول مركز الدبلوم.
  // لذلك نقرأ الدور الأساسي أولًا لتجنب رفض Firestore بسبب الاستعلامات الواسعة.
  "exam_super",
  "سوبر الامتحانات",
];

const EXAM_CENTER_ROLES = new Set([
  "exam_super",
  "exam-center-super",
  "exam_supervisor",
  "exam_center_admin",
  "diploma_center_admin",
  "diploma_super",
  "center_admin",
  "center_super",
  "control_admin",
  "distribution_super",
  "distribution_admin",
  "سوبر الامتحانات",
  "مسؤول مركز دبلوم",
  "رئيس مركز دبلوم",
  "رئيس/مسؤول مركز دبلوم",
]);

type AllowDoc = {
  email?: string;
  role?: string;
  tenantId?: string;
  governorate?: string;
  tenantGovernorate?: string;
  regionAr?: string;
  enabled?: boolean;
  userName?: string;
  name?: string;
  schoolName?: string;
  centerName?: string;
  centerNameAr?: string;
};

type TenantDoc = {
  id: string;
  name?: string;
  schoolName?: string;
  centerName?: string;
  centerNameAr?: string;
  governorate?: string;
  tenantGovernorate?: string;
  regionAr?: string;
  tenantType?: string;
  type?: string;
  entityType?: string;
  kind?: string;
  category?: string;
  isExamCenter?: boolean;
  isDiplomaCenter?: boolean;
  enabled?: boolean;
};

type DirectoryRow = AllowDoc & {
  email: string;
  tenant?: TenantDoc;
  resolvedGovernorate?: string;
  resolvedTitle?: string;
  resolvedRole?: string;
};

const asText = (value: any) => String(value || "").trim();
const lower = (value: any) => asText(value).toLowerCase();

function normalizeArabicText(value: any) {
  return asText(value)
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .trim()
    .toLowerCase();
}

function compactScope(value: any) {
  return normalizeArabicText(value)
    .replace(/المديريه العامه للتعليم بمحافظه/g, "")
    .replace(/المديريه العامه للتربيه والتعليم بمحافظه/g, "")
    .replace(/محافظه/g, "")
    .replace(/المحافظه/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function sameScope(a: any, b: any) {
  const aa = compactScope(a);
  const bb = compactScope(b);
  if (!aa || !bb) return false;
  return aa === bb || aa.includes(bb) || bb.includes(aa);
}

function normalizeRole(value: any) {
  const raw = lower(value);
  const ar = normalizeArabicText(value);

  if (["exam super", "exam-super", "super_exam", "super-exam", "exam supervisor"].includes(raw)) return "exam_super";
  if (raw === "exam_center_admin" || raw === "exam-center-admin") return "exam_center_admin";
  if (raw === "diploma_center_admin" || raw === "diploma-center-admin") return "diploma_center_admin";
  if (ar.includes("سوبر") && ar.includes("امتحان")) return "exam_super";
  if ((ar.includes("مسؤول") || ar.includes("رئيس")) && ar.includes("مركز") && ar.includes("دبلوم")) {
    return "diploma_center_admin";
  }

  return raw || ar;
}

function isOwnerRole(role: string) {
  return ["super_admin", "platform_owner", "owner", "superadmin", "مالك_المنصة", "مالك المنصة"].includes(role);
}

function isGovernorateSuperRole(role: string) {
  return ["super", "governorate_super", "governorate-super", "مشرف المحافظة", "سوبر المحافظة"].includes(role);
}

function isExamCenterTenant(tenant?: TenantDoc) {
  if (!tenant) return false;
  const values = [tenant.tenantType, tenant.type, tenant.entityType, tenant.kind, tenant.category]
    .map(lower)
    .filter(Boolean);

  const text = `${tenant.id || ""} ${tenant.name || ""} ${tenant.schoolName || ""} ${tenant.centerName || ""} ${tenant.centerNameAr || ""}`.toLowerCase();
  const ar = normalizeArabicText(text);

  return (
    tenant.isExamCenter === true ||
    tenant.isDiplomaCenter === true ||
    values.some((v) => ["exam_center", "exam-center", "examcenter", "diploma_center", "diploma-center", "center", "centre"].includes(v)) ||
    text.includes("exam") ||
    text.includes("diploma") ||
    ar.includes("دبلوم") ||
    ar.includes("امتحان") ||
    ar.includes("مركز")
  );
}

function isExamCenterAllowRow(row: AllowDoc, tenant?: TenantDoc) {
  const role = normalizeRole(row.role);
  if (EXAM_CENTER_ROLES.has(role)) return true;
  if (role === "super" || role === "ministry_super" || role === "tenant_admin" || role === "admin") return false;
  if (row.tenantId && isExamCenterTenant(tenant)) return true;

  const text = normalizeArabicText(`${row.role || ""} ${row.schoolName || ""} ${row.name || ""} ${row.centerName || ""} ${row.centerNameAr || ""}`);
  return text.includes("سوبر الامتحانات") || text.includes("مركز دبلوم") || text.includes("دبلوم") || text.includes("امتحان");
}

function resolveGovernorate(row: AllowDoc, tenant?: TenantDoc) {
  return (
    asText(row.governorate) ||
    asText(row.tenantGovernorate) ||
    asText(row.regionAr) ||
    asText(tenant?.governorate) ||
    asText(tenant?.tenantGovernorate) ||
    asText(tenant?.regionAr)
  );
}

function resolveTitle(row: AllowDoc, tenant?: TenantDoc) {
  return (
    asText(row.centerNameAr) ||
    asText(row.centerName) ||
    asText(row.schoolName) ||
    asText(row.name) ||
    asText(row.userName) ||
    asText(tenant?.centerNameAr) ||
    asText(tenant?.centerName) ||
    asText(tenant?.schoolName) ||
    asText(tenant?.name) ||
    asText(row.email).split("@")[0]
  );
}

function displayRole(role: any) {
  const normalized = normalizeRole(role);
  if (normalized === "exam_super") return "سوبر الامتحانات";
  if (normalized === "exam_center_admin") return "مسؤول مركز امتحانات";
  if (normalized === "diploma_center_admin") return "مسؤول مركز دبلوم";
  if (normalized === "diploma_super") return "سوبر مركز دبلوم";
  if (normalized === "control_admin") return "مسؤول الكنترول";
  if (normalized === "distribution_super") return "مشرف التوزيع";
  return asText(role) || "سوبر الامتحانات";
}

function activateGovernorateReadOnlyView(params: {
  tenantId: string;
  email?: string;
  role?: string;
  scope?: "school" | "exam_center";
}) {
  const tenantId = asText(params.tenantId);
  if (!tenantId) return;

  const expiresAt = String(Date.now() + 6 * 60 * 60 * 1000);
  const viewRole = normalizeRole(params.role || "exam_super") || "exam_super";
  const email = asText(params.email).toLowerCase();

  const entries: Record<string, string> = {
    governorateSuperViewExpiresAt: expiresAt,
    governorateSuperReadOnly: "true",
    viewAsReadOnly: "true",
    readOnly: "true",
    isReadOnlyView: "true",
    openedByGovernorateSuper: "true",
    governorateSuperReturnTo: "/exam-supers",
    readOnlyReturnTo: "/exam-supers",
    governorateSuperViewTenantId: tenantId,
    viewAsTenantId: tenantId,
    effectiveTenantId: tenantId,
    selectedTenantId: tenantId,
    tenantId,
    viewAsRole: viewRole,
    effectiveRole: viewRole,
    viewAsScope: params.scope || "exam_center",
  };

  if (email) {
    entries.viewAsEmail = email;
    entries.effectiveViewAsEmail = email;
  }

  try {
    Object.entries(entries).forEach(([key, value]) => {
      window.sessionStorage.setItem(key, value);
      window.localStorage.setItem(key, value);
    });
    window.dispatchEvent(new CustomEvent("auth-changed", { detail: { tenantId, role: viewRole, email, readOnly: true } }));
    window.dispatchEvent(new CustomEvent("effective-role-changed", { detail: { tenantId, role: viewRole, readOnly: true } }));
  } catch {
    // لا نمنع الدخول إذا تعذر التخزين المحلي في المتصفح.
  }
}

export default function ExamSupersDirectory() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const role = normalizeRole(
    auth?.effectiveRole ||
      auth?.allow?.role ||
      auth?.profile?.role ||
      auth?.userProfile?.role ||
      auth?.user?.role ||
      ""
  );

  const isOwner = isOwnerRole(role);
  const isGovernorateSuper = isGovernorateSuperRole(role);
  const governorateScope = asText(
    auth?.allow?.governorate ||
      auth?.profile?.governorate ||
      auth?.userProfile?.governorate ||
      auth?.governorate ||
      window.localStorage.getItem("governorate") ||
      window.sessionStorage.getItem("governorate") ||
      ""
  );

  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  const loadRows = async () => {
    setLoading(true);
    setErrorText("");

    try {
      if (!isOwner && !isGovernorateSuper) {
        setRows([]);
        return;
      }

      const tenantMap = new Map<string, TenantDoc>();

      // قراءة tenants مساعدة فقط لتحسين اسم المركز. إذا كانت القواعد تمنعها لا نوقف الصفحة.
      try {
        const tenantsSnap = await getDocs(collection(db, "tenants"));
        tenantsSnap.forEach((tenantDoc) => {
          const data = tenantDoc.data() as any;
          tenantMap.set(tenantDoc.id, { id: tenantDoc.id, ...data });
        });
      } catch (tenantError) {
        console.warn("ExamSupersDirectory tenants load skipped", tenantError);
      }

      const next: DirectoryRow[] = [];
      const seen = new Set<string>();

      const pushAllowDoc = (allowDoc: any) => {
        const data = allowDoc.data() as AllowDoc;
        const email = asText(data.email || allowDoc.id).toLowerCase();
        const tenantId = asText(data.tenantId);
        const tenant = tenantId ? tenantMap.get(tenantId) : undefined;

        if (!isExamCenterAllowRow(data, tenant)) return;

        const resolvedGovernorate = resolveGovernorate(data, tenant);

        if (isGovernorateSuper) {
          if (!governorateScope) return;
          if (!sameScope(resolvedGovernorate, governorateScope)) return;
        }

        const key = `${email}__${tenantId || "no-tenant"}`;
        if (seen.has(key)) return;
        seen.add(key);

        next.push({
          ...data,
          email,
          tenant,
          resolvedGovernorate,
          resolvedTitle: resolveTitle({ ...data, email }, tenant),
          resolvedRole: normalizeRole(data.role || "exam_super"),
        });
      };


      // المصدر الأساسي الجديد: روابط سوبر الامتحانات داخل المحافظة.
      // هذا يمنع الاعتماد على قراءة allowlist كاملة ويحافظ على النطاق الأمني لمشرف المحافظة.
      try {
        const linksQuery = isOwner
          ? collection(db, EXAM_SUPER_LINKS_COLLECTION)
          : query(collection(db, EXAM_SUPER_LINKS_COLLECTION), where("governorate", "==", governorateScope));
        const linksSnap = await getDocs(linksQuery as any);
        linksSnap.forEach(pushAllowDoc);
      } catch (linksError) {
        console.warn("ExamSupersDirectory exam-super links load skipped", linksError);
      }

      if (isOwner) {
        const allowSnap = await getDocs(collection(db, "allowlist"));
        allowSnap.forEach(pushAllowDoc);
      } else {
        // مهم: لا نقرأ allowlist كاملًا لمشرف المحافظة لأن Firestore يرفض القراءة العامة.
        // نقرأ فقط المحافظة الحالية + كل دور مسموح، وهذا يطابق قواعد الأمان.
        if (!governorateScope) {
          setRows([]);
          setErrorText(tr("لم يتم تحديد محافظة مشرف المحافظة.", "Governorate scope is missing."));
          return;
        }

        let successQueries = 0;
        let permissionErrors = 0;

        for (const roleValue of EXAM_CENTER_QUERY_ROLES) {
          try {
            const allowSnap = await getDocs(
              query(
                collection(db, "allowlist"),
                where("governorate", "==", governorateScope),
                where("role", "==", roleValue)
              )
            );
            successQueries += 1;
            allowSnap.forEach(pushAllowDoc);
          } catch (roleError) {
            permissionErrors += 1;
            console.warn(`ExamSupersDirectory safe role query skipped: ${roleValue}`, roleError);
          }
        }

        if (next.length === 0 && successQueries === 0 && permissionErrors > 0) {
          setRows([]);
          setErrorText(
            tr(
              "تعذر تحميل سوبر الامتحانات بسبب صلاحيات allowlist ولم يتم العثور على روابط governorateExamSupers. استبدل ملف firestore.rules المرفق ثم انشر القواعد من Firebase.",
              "Unable to load exam supervisors from allowlist and no governorateExamSupers links were found. Replace and publish the attached Firestore rules."
            )
          );
          return;
        }
      }

      next.sort((a, b) => {
        const byGov = asText(a.resolvedGovernorate).localeCompare(asText(b.resolvedGovernorate), "ar");
        if (byGov !== 0) return byGov;
        return asText(a.resolvedTitle).localeCompare(asText(b.resolvedTitle), "ar");
      });

      setRows(next);
    } catch (error) {
      console.error("ExamSupersDirectory load error", error);
      setRows([]);
      setErrorText(
        tr(
          "تعذر تحميل مسؤولي مراكز الدبلوم. تم منع القراءة من Firestore. انشر قواعد Firestore المرفقة ثم أعد المحاولة.",
          "Unable to load diploma center admins. Firestore blocked the read. Publish the attached Firestore rules and try again."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, isGovernorateSuper, governorateScope, lang]);

  const filtered = useMemo(() => {
    if (isOwner) return rows;
    if (isGovernorateSuper && governorateScope) {
      return rows.filter((r) => sameScope(r.resolvedGovernorate, governorateScope));
    }
    return [];
  }, [rows, isOwner, isGovernorateSuper, governorateScope]);

  if (!isOwner && !isGovernorateSuper) {
    return (
      <DeniedCard
        title={tr("غير مصرح بالدخول", "Access denied")}
        desc={tr(
          "هذه الصفحة مخصصة لمالك المنصة أو لمشرف المحافظة داخل نطاق محافظته.",
          "This page is limited to the platform owner or governorate supervisor within scope."
        )}
      />
    );
  }

  return (
    <div className="exam-supers-model3-force" style={{ minHeight: "100vh", background: BG, padding: 24, boxSizing: "border-box", direction: isRTL ? "rtl" : "ltr" }}>
      <div style={{ maxWidth: 1720, margin: "0 auto", display: "grid", gap: 24 }}>
        <section style={heroStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 22, flexWrap: "wrap" }}>
            <div style={brandBlock}>
              <img src={MINISTRY_LOGO_URL} alt="شعار وزارة التعليم" style={logoStyle} />
              <div>
                <div style={ministryText}>وزارة التعليم</div>
                <div style={directorateText}>{governorateScope || tr("نطاق مالك المنصة", "Platform owner scope")}</div>
              </div>
            </div>
            <button type="button" onClick={() => navigate("/programs-gateway")} style={backBtn}>
              {tr("العودة إلى البوابة التشغيلية", "Back to Operational Gateway")}
            </button>
          </div>

          <div style={{ display: "grid", gap: 12, justifyItems: "center", textAlign: "center" }}>
            <h1 style={h1}>{tr("مشرفو امتحانات الدبلوم العام", "Diploma Exam Supervisors")}</h1>
            <div style={subtitleBox}>
              {isGovernorateSuper && governorateScope
                ? tr(`نطاق العرض: ${governorateScope} — الدخول إلى مركز الدبلوم يكون مشاهدة فقط.`, `Scope: ${governorateScope} — access is read-only.`)
                : tr("عرض مشرفي امتحانات الدبلوم ومراكز الدبلوم المسجلين على مستوى المنصة.", "View diploma center supervisors registered in the platform.")}
            </div>
          </div>
        </section>

        <section style={panel}>
          <div style={panelHeader}>
            <div>
              <div style={sectionTitle}>{tr("قائمة مشرفي امتحانات الدبلوم داخل المحافظة", "Exam supervisors within scope")}</div>
              <div style={sectionDesc}>
                {tr(
                  "يتم عرض حسابات سوبر الامتحانات المرتبطة بمراكز الدبلوم داخل محافظة مشرف المحافظة فقط.",
                  "Only accounts linked to diploma centers inside the governorate supervisor scope are displayed."
                )}
              </div>
            </div>
            <button type="button" onClick={() => void loadRows()} style={smallBtn}>
              {tr("تحديث القائمة", "Refresh")}
            </button>
          </div>

          {loading ? (
            <div style={emptyStyle}>{tr("جاري تحميل القائمة...", "Loading list...")}</div>
          ) : errorText ? (
            <div style={errorStyle}>{errorText}</div>
          ) : filtered.length === 0 ? (
            <div style={emptyStyle}>{tr("لا توجد حسابات مطابقة للعرض الحالي.", "No diploma center admins match the current view.")}</div>
          ) : (
            <div style={{ display: "grid", gap: 18 }}>
              {filtered.map((row) => {
                const email = asText(row.email);
                const tenantId = asText(row.tenantId);
                const title = asText(row.resolvedTitle);
                const gov = asText(row.resolvedGovernorate) || tr("بدون محافظة", "No governorate");
                const enabled = row.enabled !== false;
                const rowRole = asText(row.resolvedRole || normalizeRole(row.role || "exam_super"));
                const tenantTitle = asText(row.tenant?.centerNameAr || row.tenant?.centerName || row.tenant?.schoolName || row.tenant?.name || tenantId);

                return (
                  <div key={`${email}-${tenantId || "no-tenant"}`} className="exam-supers-model3-row-card" style={rowCard}>
                    <div style={{ display: "grid", gap: 10 }}>
                      <div className="exam-supers-model3-row-title" style={rowTitle}>{title}</div>
                      <div style={rowMeta}>{email}</div>
                      <div style={tagRow}>
                        <span style={tag}>{displayRole(rowRole)}</span>
                        <span style={tag}>{gov}</span>
                        <span style={tag}>{tenantTitle || tr("بدون مركز", "No center")}</span>
                        <span style={tag}>{tenantId || tr("بدون Tenant", "No Tenant")}</span>
                        <span style={{ ...tag, background: enabled ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)" }}>
                          {enabled ? tr("مفعل", "Enabled") : tr("موقوف", "Disabled")}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => {
                          const safeTenantId = asText(tenantId).replace(/[^a-zA-Z0-9_-]/g, "");
                          if (!safeTenantId) return;

                          // DIPLOMA_READONLY_OPEN_SCOPE_GUARD
                          if (isGovernorateSuper) {
                            const currentGovernorate = asText(governorateScope);
                            const rowGovernorate = asText(row.resolvedGovernorate);

                            if (!currentGovernorate || !rowGovernorate || !sameScope(rowGovernorate, currentGovernorate)) {
                              setErrorText(
                                tr(
                                  "تم منع فتح مركز الدبلوم لأنه خارج نطاق محافظة مشرف المحافظة الحالي.",
                                  "Opening was blocked because this diploma center is outside the current governorate supervisor scope."
                                )
                              );
                              return;
                            }
                          }

                          if (isGovernorateSuper) {
                            activateGovernorateReadOnlyView({
                              tenantId: safeTenantId,
                              email,
                              role: rowRole || "exam_super",
                              scope: "exam_center",
                            });

                            window.location.assign(
                              `/t/${safeTenantId}/dashboard12?readOnly=1&fromGovernorateSuper=1&returnTo=exam-supers`
                            );
                            return;
                          }

                          if (!isOwner) return;

                          const ownerReadOnlyKeysToClear = [
                            "governorateSuperViewExpiresAt",
                            "governorateSuperReadOnly",
                            "viewAsReadOnly",
                            "readOnly",
                            "isReadOnlyView",
                            "openedByGovernorateSuper",
                            "governorateSuperReturnTo",
                            "readOnlyReturnTo",
                            "governorateSuperViewTenantId",
                            "governorateSuperViewGovernorate",
                            "viewAsTenantId",
                            "viewAsRole",
                            "effectiveRole",
                            "viewAsScope",
                            "viewAsEmail",
                            "effectiveViewAsEmail",
                          ];

                          try {
                            for (const key of ownerReadOnlyKeysToClear) {
                              window.sessionStorage.removeItem(key);
                              window.localStorage.removeItem(key);
                            }

                            for (const storage of [window.sessionStorage, window.localStorage]) {
                              storage.setItem("effectiveTenantId", safeTenantId);
                              storage.setItem("selectedTenantId", safeTenantId);
                              storage.setItem("tenantId", safeTenantId);
                            }
                          } catch {
                            // Owner authorization still comes from the authenticated identity, not browser storage.
                          }

                          window.location.assign(`/t/${safeTenantId}/dashboard12`);
                        }}
                        disabled={!tenantId || !enabled}
                        style={{ ...primaryBtn, opacity: !tenantId || !enabled ? 0.55 : 1, cursor: !tenantId || !enabled ? "not-allowed" : "pointer" }}
                      >
                        {isGovernorateSuper ? tr("دخول مشاهدة فقط", "Open read-only") : tr("دخول", "Open")}
                      </button>
                    </div>
                  </div>
                );
              })}
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
      <div style={{ maxWidth: 760, width: "100%", background: CARD, border: `5px solid ${GOLD}`, borderRadius: 30, padding: 28, color: INK, boxShadow: "0 0 0 8px rgba(212,175,55,0.12) inset" }}>
        <div style={{ fontSize: 32, fontWeight: 1000, marginBottom: 12 }}>{title}</div>
        <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.9 }}>{desc}</div>
      </div>
    </div>
  );
}

const heroStyle: React.CSSProperties = {
  background: CARD,
  borderRadius: 38,
  border: `5px solid ${GOLD}`,
  boxShadow: "0 0 0 10px rgba(212,175,55,0.10) inset, 0 22px 46px rgba(150,120,20,0.13)",
  padding: "32px 36px",
  color: INK,
  display: "grid",
  gap: 28,
};

const brandBlock: React.CSSProperties = { display: "flex", alignItems: "center", gap: 18 };
const logoStyle: React.CSSProperties = {
  width: 98,
  height: 98,
  objectFit: "contain",
  borderRadius: 22,
  border: `3px solid ${GOLD}`,
  background: "#fffaf0",
  boxShadow: "0 10px 22px rgba(139,106,0,0.13)",
};
const ministryText: React.CSSProperties = { color: DARK_GOLD, fontSize: 34, fontWeight: 1000, lineHeight: 1.25 };
const directorateText: React.CSSProperties = { color: INK, fontSize: 20, fontWeight: 900, lineHeight: 1.6 };
const panel: React.CSSProperties = {
  background: CARD,
  borderRadius: 40,
  border: `5px solid ${GOLD}`,
  boxShadow: "0 0 0 10px rgba(212,175,55,0.12) inset, 0 18px 38px rgba(150,120,20,0.14)",
  padding: 28,
  display: "grid",
  gap: 22,
};
const panelHeader: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" };
const sectionTitle: React.CSSProperties = { color: DARK_GOLD, fontWeight: 1000, fontSize: 28, lineHeight: 1.35 };
const sectionDesc: React.CSSProperties = { color: MUTED, fontWeight: 800, fontSize: 16, lineHeight: 1.8 };
const backBtn: React.CSSProperties = {
  minHeight: 56,
  width: "fit-content",
  padding: "0 22px",
  borderRadius: 18,
  border: `3px solid ${GOLD}`,
  background: "#fffaf0",
  color: INK,
  fontWeight: 1000,
  fontSize: 17,
  cursor: "pointer",
  boxShadow: "0 10px 20px rgba(150,120,20,0.10)",
};
const smallBtn: React.CSSProperties = { ...backBtn, minHeight: 48, fontSize: 15 };
const h1: React.CSSProperties = { margin: 0, fontSize: "clamp(34px,5vw,64px)", lineHeight: 1.15, fontWeight: 1000, color: INK };
const subtitleBox: React.CSSProperties = {
  maxWidth: 820,
  padding: "14px 24px",
  borderRadius: 999,
  border: `2px solid rgba(201,162,39,0.45)`,
  background: "rgba(255,250,240,0.82)",
  color: DARK_GOLD,
  fontSize: 19,
  lineHeight: 1.7,
  fontWeight: 900,
};
const emptyStyle: React.CSSProperties = { color: INK, fontWeight: 900, fontSize: 20, padding: 18, textAlign: "center" };
const errorStyle: React.CSSProperties = { ...emptyStyle, color: "#8a1f1f", background: "rgba(239,68,68,0.08)", border: "2px solid rgba(239,68,68,0.20)", borderRadius: 22 };
const rowCard: React.CSSProperties = {
  background: "#fffaf0",
  border: `4px solid ${GOLD}`,
  borderRadius: 30,
  padding: 22,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 18,
  alignItems: "center",
  boxShadow: "0 12px 24px rgba(150,120,20,0.10)",
};
const rowTitle: React.CSSProperties = { color: INK, fontWeight: 1000, fontSize: 28, lineHeight: 1.3 };
const rowMeta: React.CSSProperties = { color: MUTED, fontWeight: 900, fontSize: 18 };
const tagRow: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap" };
const tag: React.CSSProperties = {
  display: "inline-flex",
  padding: "8px 14px",
  borderRadius: 999,
  border: `2px solid rgba(201,162,39,0.55)`,
  background: "rgba(212,175,55,0.10)",
  color: INK,
  fontWeight: 900,
  fontSize: 14,
};
const primaryBtn: React.CSSProperties = {
  minHeight: 56,
  minWidth: 170,
  padding: "0 20px",
  borderRadius: 18,
  border: `3px solid ${GOLD}`,
  background: "linear-gradient(180deg, #f3df91 0%, #d4af37 100%)",
  color: INK,
  fontWeight: 1000,
  fontSize: 18,
  boxShadow: "0 12px 22px rgba(150,120,20,0.14)",
};


