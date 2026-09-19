import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { MINISTRY_SCOPE } from "../../constants/directorates";
import { useAuth } from "../../auth/AuthContext";
import { isMinistrySuperViewer } from "./ministryPageGuard";
import "./MinistrySuperSystemView.css";

type MinistrySchoolRow = {
  id: string;
  name: string;
  governorate: string;
  wilayat?: string;
  enabled?: boolean;
  adminEmail?: string;
};

function decodeGovernorate(value: string | undefined) {
  try {
    return decodeURIComponent(String(value || "").trim());
  } catch {
    return String(value || "").trim();
  }
}

function normalizeText(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
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

function roleList(value: any) {
  const roles: string[] = [];
  const role = String(value?.role || "").trim().toLowerCase();
  if (role) roles.push(role);

  if (Array.isArray(value?.roles)) {
    value.roles.forEach((item: unknown) => {
      const text = String(item || "").trim().toLowerCase();
      if (text) roles.push(text);
    });
  }

  return Array.from(new Set(roles));
}

function isSchoolAdmin(value: any) {
  const roles = roleList(value);
  return roles.includes("tenant_admin") || roles.includes("admin");
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

export default function MinistryGovernorateSchools() {
  const auth = useAuth() as any;
  const navigate = useNavigate();
  const params = useParams();

  const governorate = useMemo(
    () => decodeGovernorate(params.governorateId),
    [params.governorateId]
  );

  const encodedGovernorate = encodeURIComponent(governorate || "");

  const [rows, setRows] = useState<MinistrySchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const canUseMinistryPage = !auth?.loading && isMinistrySuperViewer(auth);

  const filteredRows = useMemo(() => {
    const query = normalizeText(searchQuery);

    if (!query) return rows;

    return rows.filter((row) => {
      const schoolName = normalizeText(row.name);
      const adminEmail = normalizeText(row.adminEmail);

      return schoolName.includes(query) || adminEmail.includes(query);
    });
  }, [rows, searchQuery]);

  const applySchoolSearch = () => {
    setSearchQuery(searchDraft);
  };

  const clearSchoolSearch = () => {
    setSearchDraft("");
    setSearchQuery("");
  };

  useEffect(() => {
    if (auth?.loading) return;

    if (!isMinistrySuperViewer(auth)) {
      setRows([]);
      setLoading(false);
      setError("");
      return;
    }

    let alive = true;

    const run = async () => {
      setLoading(true);
      setError("");

      try {
        const [tenantsSnap, allowSnap] = await Promise.all([
          getDocs(collection(db, "tenants")),
          getDocs(collection(db, "allowlist")),
        ]);

        const allowRows = allowSnap.docs.map((d) => {
          const data = (d.data() as any) || {};
          return {
            ...data,
            email: String(data?.email || d.id || "").trim().toLowerCase(),
          };
        });

        const adminByTenant = new Map<string, string>();
        allowRows.forEach((item) => {
          if (!isSchoolAdmin(item)) return;
          const tenantId = String(item?.tenantId || "").trim();
          const email = String(item?.email || "").trim().toLowerCase();
          if (tenantId && email && !adminByTenant.has(tenantId)) {
            adminByTenant.set(tenantId, email);
          }
        });

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

            if (looksLikeDiplomaCenter(root, config)) return null;

            const tenantGov = getGovernorateFromTenant(root, config);
            if (governorate && !sameGovernorate(tenantGov, governorate)) return null;

            const name = String(
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
              adminEmail: adminByTenant.get(tenantDoc.id) || "",
            } as MinistrySchoolRow;
          })
        );

        const cleanRows = loadedRows
          .filter(Boolean)
          .map((row) => row as MinistrySchoolRow)
          .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), "ar"));

        if (!alive) return;
        setRows(cleanRows);
      } catch (e: any) {
        console.error(e);
        if (!alive) return;
        setError("تعذر تحميل مدارس المحافظة.");
        setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    };

    void run();

    return () => {
      alive = false;
    };
  }, [governorate, auth?.loading, auth?.allow, auth?.profile, auth?.userProfile]);

  const openSchoolReadOnly = (row: MinistrySchoolRow) => {
    const returnTo = `/super-system/governorate/${encodedGovernorate}/schools`;
    setMinistryReadOnlyFlags(row.id, returnTo);
    navigate(`/t/${row.id}/dashboard?readOnly=1&fromMinistrySuper=1`);
  };

  if (auth?.loading) return null;
  if (!canUseMinistryPage) return <Navigate to="/super-system" replace />;

  return (
    <div className="ministry-page ministry-m3-governorate-schools-page" dir="rtl">
      <header className="ministry-hero">
        <div className="ministry-hero-top">
          <div>
            <div className="ministry-kicker">وزارة التعليم</div>
            <h1 className="ministry-title">مدارس امتحانات النقل</h1>
            <div className="ministry-subtitle">
              عرض مدارس المحافظة والدخول إليها بصلاحية مشاهدة فقط.
            </div>
          </div>

          <div className="ministry-actions">
            <button
              type="button"
              className="ministry-btn ministry-btn-muted"
              onClick={() => navigate(`/super-system/governorate/${encodedGovernorate}`)}
            >
              العودة إلى بوابة المحافظة
            </button>
            <button
              type="button"
              className="ministry-btn ministry-btn-muted"
              onClick={() => navigate("/super-system")}
            >
              سوبر المحافظات
            </button>
          </div>
        </div>

        <div className="ministry-identity-strip">
          <div>
            <span className="ministry-pill">مشرف الوزارة</span>
            <span className="ministry-email">المحافظة: {governorate || "—"}</span>
          </div>
          <div className="ministry-readonly-badge">مشاهدة فقط · المدارس: {rows.length}</div>
        </div>
      </header>

      <main className="ministry-main-card">
        <div className="ministry-section-head">
          <div>
            <h2>قائمة المدارس</h2>
            <p>
              اختر مدرسة لفتح لوحة المدرسة بوضع مشاهدة فقط. لا يمكن لمشرف الوزارة الإضافة أو التعديل أو الحذف.
            </p>
          </div>
          <span className="ministry-section-tag">قراءة فقط</span>
        </div>

        <div className="ministry-school-search-box">
          <div className="ministry-school-search-field">
            <label htmlFor="ministry-school-search-input">
              البحث عن مدرسة
            </label>

            <input
              id="ministry-school-search-input"
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  applySchoolSearch();
                }
              }}
              placeholder="اكتب اسم المدرسة أو البريد الإلكتروني"
              autoComplete="off"
            />
          </div>

          <div className="ministry-school-search-actions">
            <button
              type="button"
              className="ministry-school-search-btn"
              onClick={applySchoolSearch}
            >
              بحث
            </button>

            {(searchDraft || searchQuery) ? (
              <button
                type="button"
                className="ministry-school-search-clear"
                onClick={clearSchoolSearch}
              >
                مسح
              </button>
            ) : null}
          </div>
        </div>

        {searchQuery ? (
          <div className="ministry-school-search-summary">
            نتائج البحث: <strong>{filteredRows.length}</strong>
          </div>
        ) : null}

        {loading ? (
          <div className="ministry-empty-state">
            <div className="ministry-empty-icon">⏳</div>
            <h3>جاري تحميل المدارس...</h3>
          </div>
        ) : error ? (
          <div className="ministry-empty-state">
            <div className="ministry-empty-icon">⚠️</div>
            <h3>{error}</h3>
          </div>
        ) : rows.length ? (
          <div className="ministry-governorate-grid">
            {filteredRows.map((row) => (
              <article className="ministry-governorate-card ministry-school-variant-card" key={row.id}>
                <div className="ministry-card-header">
                  <div>
                    <h3>{row.name || row.id}</h3>
                    <p>{row.adminEmail || "لا يوجد بريد أدمن ظاهر"}</p>
                  </div>
                  <span className={row.enabled === false ? "ministry-status off" : "ministry-status on"}>
                    {row.enabled === false ? "غير مفعل" : "مفعل"}
                  </span>
                </div>

                <img
                  className="ministry-school-card-image"
                  src="https://i.postimg.cc/YC9R5944/352d2558-14ff-434e-821d-3ffad98df2c4.jpg"
                  alt=""
                  loading="lazy"
                  aria-hidden="true"
                />

                <div className="ministry-card-meta">
                  <span>Tenant ID: {row.id}</span>
                  <span>المحافظة: {row.governorate || "—"}</span>
                  <span>الولاية: {row.wilayat || "—"}</span>
                  <span>الدخول: مشاهدة فقط</span>
                </div>

                <button
                  type="button"
                  className="ministry-open-btn"
                  onClick={() => openSchoolReadOnly(row)}
                >
                  دخول المدرسة مشاهدة فقط
                </button>
              </article>
            ))}

            {searchQuery && filteredRows.length === 0 ? (
              <div className="ministry-school-search-empty">
                <div className="ministry-school-search-empty-icon">??</div>
                <h3>لا توجد مدرسة مطابقة للبحث</h3>
                <p>
                  جرّب البحث باسم مدرسة آخر أو باستخدام البريد الإلكتروني.
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="ministry-empty-state">
            <div className="ministry-empty-icon">🏫</div>
            <h3>لا توجد مدارس ظاهرة لهذه المحافظة</h3>
            <p>
              إن كانت المدارس موجودة فعليًا، سنراجع في الخطوة التالية حقول نوع المدرسة والمحافظة داخل tenants/meta/config.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
