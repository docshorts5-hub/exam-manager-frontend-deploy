import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { MINISTRY_SCOPE } from "../../constants/directorates";
import { useAuth } from "../../auth/AuthContext";
import { isMinistrySuperViewer } from "./ministryPageGuard";
import "./MinistrySuperSystemView.css";

type DiplomaCenterRow = {
  id: string;
  name: string;
  governorate: string;
  wilayat?: string;
  enabled?: boolean;
  assignedMatch?: boolean;
};

function decodeValue(value: string | undefined) {
  try {
    return decodeURIComponent(String(value || "").trim());
  } catch {
    return String(value || "").trim();
  }
}

function normalizeText(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function sameGovernorate(a: unknown, b: unknown) {
  return normalizeText(a) === normalizeText(b);
}

function getGovernorateFromTenant(root: any, config: any) {
  return String(
    config?.governorate ??
      config?.regionAr ??
      root?.governorate ??
      root?.tenantGovernorate ??
      ""
  ).trim();
}

function looksLikeDiplomaCenter(root: any, config: any) {
  const markerText = [
    root?.kind,
    root?.type,
    root?.tenantType,
    root?.mode,
    root?.program,
    root?.programType,
    root?.entryMode,
    root?.route,
    root?.path,
    root?.dashboard,
    root?.homePath,
    root?.defaultRoute,
    root?.centerType,
    config?.kind,
    config?.type,
    config?.tenantType,
    config?.mode,
    config?.program,
    config?.programType,
    config?.entryMode,
    config?.route,
    config?.path,
    config?.dashboard,
    config?.homePath,
    config?.defaultRoute,
    config?.centerType,
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");

  return (
    root?.isExamCenter === true ||
    root?.isDiplomaCenter === true ||
    root?.examCenter === true ||
    root?.diplomaCenter === true ||
    config?.isExamCenter === true ||
    config?.isDiplomaCenter === true ||
    config?.examCenter === true ||
    config?.diplomaCenter === true ||
    markerText.includes("center") ||
    markerText.includes("diploma") ||
    markerText.includes("exam") ||
    markerText.includes("dashboard12")
  );
}

function isAssignedToExamSuper(root: any, config: any, examSuperId: string) {
  const target = normalizeText(examSuperId);
  if (!target) return false;

  const values = [
    root?.examSuperId,
    root?.examSuperEmail,
    root?.examSupervisorEmail,
    root?.diplomaSuperId,
    root?.diplomaSuperEmail,
    root?.supervisorEmail,
    config?.examSuperId,
    config?.examSuperEmail,
    config?.examSupervisorEmail,
    config?.diplomaSuperId,
    config?.diplomaSuperEmail,
    config?.supervisorEmail,
  ].map((value) => normalizeText(value));

  return values.some((value) => value && value === target);
}

function setMinistryReadOnlyFlags(tenantId: string, returnTo: string) {
  const safeTenantId = String(tenantId || "").trim();
  const readOnlyExpiresAt = String(Date.now() + 6 * 60 * 60 * 1000);

  const flags: Record<string, string> = {
    governorateSuperReadOnly: "true",
    viewAsReadOnly: "true",
    readOnly: "true",
    governorateSuperViewTenantId: safeTenantId,
    viewAsTenantId: safeTenantId,
    effectiveTenantId: safeTenantId,
    selectedTenantId: safeTenantId,
    governorateSuperViewExpiresAt: readOnlyExpiresAt,
    viewAsRole: "ministry_super",
    effectiveRole: "ministry_super",
    viewAsScope: MINISTRY_SCOPE,
    ministryReturnTo: returnTo,
  };

  Object.entries(flags).forEach(([key, value]) => {
    localStorage.setItem(key, value);
    sessionStorage.setItem(key, value);
  });

  window.dispatchEvent(new Event("yr-authz-refresh"));
  window.dispatchEvent(new StorageEvent("storage", { key: "readOnly", newValue: "true" }));
}

export default function MinistryDiplomaCenters() {
  const auth = useAuth() as any;
  const navigate = useNavigate();
  const params = useParams();

  const governorate = useMemo(() => decodeValue(params.governorateId), [params.governorateId]);
  const examSuperId = useMemo(() => decodeValue(params.examSuperId), [params.examSuperId]);

  const encodedGovernorate = encodeURIComponent(governorate || "");
  const encodedExamSuperId = encodeURIComponent(examSuperId || "");

  const [rows, setRows] = useState<DiplomaCenterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fallbackMode, setFallbackMode] = useState(false);
  const canUseMinistryPage = !auth?.loading && isMinistrySuperViewer(auth);

  useEffect(() => {
    if (auth?.loading) return;

    if (!isMinistrySuperViewer(auth)) {
      setRows([]);
      setLoading(false);
      setError("");
      setFallbackMode(false);
      return;
    }

    let alive = true;

    const run = async () => {
      setLoading(true);
      setError("");
      setFallbackMode(false);

      try {
        const tenantsSnap = await getDocs(collection(db, "tenants"));

        const loadedRows = await Promise.all(
          tenantsSnap.docs.map(async (tenantDoc) => {
            const root = (tenantDoc.data() as any) || {};
            if (root?.deleted === true) return null;

            let config: any = {};
            try {
              const cfgSnap = await getDoc(doc(db, "tenants", tenantDoc.id, "meta", "config"));
              config = cfgSnap.exists() ? ((cfgSnap.data() as any) || {}) : {};
            } catch {
              config = {};
            }

            if (!looksLikeDiplomaCenter(root, config)) return null;

            const tenantGov = getGovernorateFromTenant(root, config);
            if (governorate && !sameGovernorate(tenantGov, governorate)) return null;

            const name = String(
              config?.centerNameAr ||
                config?.schoolNameAr ||
                config?.schoolName ||
                root?.displayName ||
                root?.name ||
                tenantDoc.id
            ).trim();

            return {
              id: tenantDoc.id,
              name,
              governorate: tenantGov,
              wilayat: String(config?.wilayatAr || root?.wilayatAr || "").trim(),
              enabled: root?.enabled !== false && config?.enabled !== false,
              assignedMatch: isAssignedToExamSuper(root, config, examSuperId),
            } as DiplomaCenterRow;
          })
        );

        const allGovCenters = loadedRows
          .filter(Boolean)
          .map((row) => row as DiplomaCenterRow)
          .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), "ar"));

        const assignedCenters = allGovCenters.filter((row) => row.assignedMatch);

        if (!alive) return;

        if (assignedCenters.length) {
          setRows(assignedCenters);
          setFallbackMode(false);
        } else {
          setRows(allGovCenters);
          setFallbackMode(Boolean(examSuperId && allGovCenters.length));
        }
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setError("تعذر تحميل مراكز الدبلوم.");
        setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    };

    void run();

    return () => {
      alive = false;
    };
  }, [governorate, examSuperId, auth?.loading, auth?.allow, auth?.profile, auth?.userProfile]);

  const openCenterReadOnly = (row: DiplomaCenterRow) => {
    const returnTo = `/super-system/governorate/${encodedGovernorate}/exam-supers/${encodedExamSuperId}/centers`;
    setMinistryReadOnlyFlags(row.id, returnTo);
    navigate(`/t/${row.id}/dashboard12?readOnly=1&fromMinistrySuper=1`);
  };

  if (auth?.loading) return null;
  if (!canUseMinistryPage) return <Navigate to="/super-system" replace />;

  return (
    <div className="ministry-page" dir="rtl">
      <header className="ministry-hero">
        <div className="ministry-hero-top">
          <div>
            <div className="ministry-kicker">وزارة التعليم</div>
            <h1 className="ministry-title">مراكز امتحانات الدبلوم</h1>
            <div className="ministry-subtitle">
              عرض مراكز الدبلوم والدخول إلى المركز بصلاحية مشاهدة فقط.
            </div>
          </div>

          <div className="ministry-actions">
            <button
              type="button"
              className="ministry-btn ministry-btn-muted"
              onClick={() => navigate(`/super-system/governorate/${encodedGovernorate}/exam-supers`)}
            >
              العودة إلى مشرفي الدبلوم
            </button>
            <button
              type="button"
              className="ministry-btn ministry-btn-muted"
              onClick={() => navigate(`/super-system/governorate/${encodedGovernorate}`)}
            >
              بوابة المحافظة
            </button>
          </div>
        </div>

        <div className="ministry-identity-strip">
          <div>
            <span className="ministry-pill">مشرف الوزارة</span>
            <span className="ministry-email">المحافظة: {governorate || "—"}</span>
          </div>
          <div className="ministry-readonly-badge">مشاهدة فقط · مراكز الدبلوم: {rows.length}</div>
        </div>
      </header>

      <main className="ministry-main-card">
        <div className="ministry-section-head">
          <div>
            <h2>قائمة مراكز الدبلوم</h2>
            <p>
              المشرف المختار: {examSuperId || "—"}. اختر مركزًا لفتحه في وضع مشاهدة فقط.
            </p>
            {fallbackMode ? (
              <p style={{ color: "#fef3c7", marginTop: 8 }}>
                لم يتم العثور على ربط مباشر بين هذا المشرف ومركز محدد، لذلك تظهر مراكز الدبلوم التابعة للمحافظة.
              </p>
            ) : null}
          </div>
          <span className="ministry-section-tag">قراءة فقط</span>
        </div>

        {loading ? (
          <div className="ministry-empty-state">
            <div className="ministry-empty-icon">⏳</div>
            <h3>جاري تحميل مراكز الدبلوم...</h3>
          </div>
        ) : error ? (
          <div className="ministry-empty-state">
            <div className="ministry-empty-icon">⚠️</div>
            <h3>{error}</h3>
          </div>
        ) : rows.length ? (
          <div className="ministry-governorate-grid">
            {rows.map((row) => (
              <article className="ministry-governorate-card" key={row.id}>
                <div className="ministry-card-header">
                  <div>
                    <h3>{row.name || row.id}</h3>
                    <p>Tenant ID: {row.id}</p>
                  </div>
                  <span className={row.enabled === false ? "ministry-status off" : "ministry-status on"}>
                    {row.enabled === false ? "غير مفعل" : "مفعل"}
                  </span>
                </div>

                <div className="ministry-card-meta">
                  <span>المحافظة: {row.governorate || "—"}</span>
                  <span>الولاية: {row.wilayat || "—"}</span>
                  <span>الدخول: مشاهدة فقط</span>
                </div>

                <button
                  type="button"
                  className="ministry-open-btn"
                  onClick={() => openCenterReadOnly(row)}
                >
                  دخول مركز الدبلوم مشاهدة فقط
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="ministry-empty-state">
            <div className="ministry-empty-icon">🎓</div>
            <h3>لا توجد مراكز دبلوم ظاهرة لهذه المحافظة</h3>
            <p>إن كانت المراكز موجودة، سنراجع حقول تمييز مراكز الدبلوم داخل tenants/meta/config.</p>
          </div>
        )}
      </main>
    </div>
  );
}
