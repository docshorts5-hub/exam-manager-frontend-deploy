import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { MINISTRY_SCOPE } from "../../constants/directorates";
import { useAuth } from "../../auth/AuthContext";
import { isMinistrySuperViewer } from "./ministryPageGuard";
import "./MinistrySuperSystemView.css";

type ExamSuperRow = {
  id: string;
  name: string;
  email: string;
  tenantId: string;
  governorate: string;
  enabled?: boolean;
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

function isExamSuper(value: any) {
  const roles = roleList(value);
  return roles.includes("exam_super") || roles.includes("exam_super12") || roles.includes("diploma_super");
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

  window.dispatchEvent(
    new StorageEvent("storage", {
      key: "readOnly",
      newValue: "true",
    })
  );
}

export default function MinistryGovernorateExamSupers() {
  const auth = useAuth() as any;
  const navigate = useNavigate();
  const params = useParams();

  const governorate = useMemo(() => decodeValue(params.governorateId), [params.governorateId]);
  const encodedGovernorate = encodeURIComponent(governorate || "");

  const [rows, setRows] = useState<ExamSuperRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const canUseMinistryPage = !auth?.loading && isMinistrySuperViewer(auth);

  const filteredRows = useMemo(() => {
    const query = normalizeText(searchQuery);

    if (!query) return rows;

    return rows.filter((row) => {
      const supervisorName = normalizeText(row.name);
      const supervisorEmail = normalizeText(row.email);

      return supervisorName.includes(query) || supervisorEmail.includes(query);
    });
  }, [rows, searchQuery]);

  const applyExamSuperSearch = () => {
    setSearchQuery(searchDraft);
  };

  const clearExamSuperSearch = () => {
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
        const snap = await getDocs(collection(db, "allowlist"));
        const list = snap.docs
          .map((docSnap) => {
            const data = (docSnap.data() as any) || {};
            const email = String(data?.email || docSnap.id || "").trim().toLowerCase();
            const rowGov = String(data?.governorate || data?.tenantGovernorate || "").trim();

            return {
              id: email || String(docSnap.id || "").trim(),
              email,
              tenantId: String(data?.tenantId || "").trim(),
              name: String(data?.userName || data?.name || data?.displayName || email || "مشرف دبلوم").trim(),
              governorate: rowGov,
              enabled: data?.enabled !== false,
              raw: data,
            };
          })
          .filter((row: any) => isExamSuper(row.raw))
          .filter((row: any) => !governorate || sameGovernorate(row.governorate, governorate))
          .map(({ raw, ...row }: any) => row as ExamSuperRow)
          .sort((a, b) => String(a.name || a.email).localeCompare(String(b.name || b.email), "ar"));

        if (!alive) return;
        setRows(list);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setError("تعذر تحميل مشرفي امتحانات الدبلوم.");
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


  const openExamSuperTenantReadOnly = (row: ExamSuperRow) => {
    const tenantId = String(row.tenantId || "").trim();

    if (!tenantId) {
      window.alert(
        "\u0644\u0627 \u064a\u0648\u062c\u062f \u0645\u0631\u0643\u0632 \u062f\u0628\u0644\u0648\u0645 \u0645\u0631\u062a\u0628\u0637 \u0628\u0647\u0630\u0627 \u0627\u0644\u0645\u0634\u0631\u0641."
      );
      return;
    }

    const returnTo =
      `/super-system/governorate/${encodedGovernorate}/exam-supers`;

    setMinistryReadOnlyFlags(tenantId, returnTo);

    navigate(
      `/t/${encodeURIComponent(tenantId)}/dashboard12?readOnly=1&fromMinistrySuper=1`
    );
  };

  if (auth?.loading) return null;
  if (!canUseMinistryPage) return <Navigate to="/super-system" replace />;

  return (
    <div className="ministry-page ministry-m3-governorate-schools-page ministry-m3-governorate-exam-supers-page" dir="rtl">
      <header className="ministry-hero">
        <div className="ministry-hero-top">
          <div>
            <div className="ministry-kicker">وزارة التعليم</div>
            <h1 className="ministry-title">مشرفي امتحانات الدبلوم</h1>
            <div className="ministry-subtitle">
              عرض مشرفي الدبلوم داخل المحافظة ثم فتح مراكز الدبلوم التابعة لهم.
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
          <div className="ministry-readonly-badge">مشاهدة فقط · مشرفو الدبلوم: {rows.length}</div>
        </div>
      </header>

      <main className="ministry-main-card">
        <div className="ministry-section-head">
          <div>
            <h2>قائمة مشرفي الدبلوم</h2>
            <p>اختر مشرف دبلوم لعرض المراكز المرتبطة به أو مراكز المحافظة بصلاحية مشاهدة فقط.</p>
          </div>
          <span className="ministry-section-tag">قراءة فقط</span>
        </div>

        <div className="ministry-school-search-box">
          <div className="ministry-school-search-field">
            <label htmlFor="ministry-exam-super-search-input">
              البحث عن مشرف دبلوم
            </label>

            <input
              id="ministry-exam-super-search-input"
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  applyExamSuperSearch();
                }
              }}
              placeholder="اكتب اسم مشرف الدبلوم أو البريد الإلكتروني"
              autoComplete="off"
            />
          </div>

          <div className="ministry-school-search-actions">
            <button
              type="button"
              className="ministry-school-search-btn"
              onClick={applyExamSuperSearch}
            >
              بحث
            </button>

            {(searchDraft || searchQuery) ? (
              <button
                type="button"
                className="ministry-school-search-clear"
                onClick={clearExamSuperSearch}
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
            <h3>جاري تحميل مشرفي الدبلوم...</h3>
          </div>
        ) : error ? (
          <div className="ministry-empty-state">
            <div className="ministry-empty-icon">⚠️</div>
            <h3>{error}</h3>
          </div>
        ) : rows.length ? (
          <div className="ministry-governorate-grid">
            {filteredRows.map((row) => (
              <article className="ministry-governorate-card ministry-school-variant-card ministry-exam-super-variant-card" key={row.id}>
                <div className="ministry-card-header">
                  <div>
                    <h3>{row.name || row.email}</h3>
                    <p>{row.email || "—"}</p>
                  </div>
                  <span className={row.enabled === false ? "ministry-status off" : "ministry-status on"}>
                    {row.enabled === false ? "غير مفعل" : "مفعل"}
                  </span>
                </div>

                <img
                  className="ministry-school-card-image ministry-exam-super-card-image"
                  src="https://i.postimg.cc/J0p7vKgk/Chat-GPT-Image-6-ywlyw-2026-11-52-32-s.png"
                  alt=""
                  loading="lazy"
                  aria-hidden="true"
                />

                <div className="ministry-card-meta">
                  <span>المحافظة: {row.governorate || governorate || "—"}</span>
                  <span>المسار التالي: مركز الدبلوم</span>
                  <span>الدخول: مشاهدة فقط</span>
                </div>

                <button
                  type="button"
                  className="ministry-open-btn"
                  onClick={() => openExamSuperTenantReadOnly(row)}
                >
                  عرض مركز الدبلوم
                </button>
              </article>
            ))}

            {searchQuery && filteredRows.length === 0 ? (
              <div className="ministry-school-search-empty">
                <div className="ministry-school-search-empty-icon">??</div>
                <h3>لا يوجد مشرف دبلوم مطابق للبحث</h3>
                <p>
                  جرّب البحث باسم مشرف آخر أو باستخدام البريد الإلكتروني.
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="ministry-empty-state">
            <div className="ministry-empty-icon">🎓</div>
            <h3>لا يوجد مشرفو دبلوم ظاهرون لهذه المحافظة</h3>
            <p>إن كانت البيانات موجودة، سنراجع أسماء أدوار مشرفي الدبلوم داخل allowlist.</p>
          </div>
        )}
      </main>
    </div>
  );
}
