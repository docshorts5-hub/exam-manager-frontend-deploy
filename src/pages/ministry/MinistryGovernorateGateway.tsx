import { useMemo } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { isMinistrySuperViewer } from "./ministryPageGuard";
import "./MinistrySuperSystemView.css";

function decodeGovernorate(value: string | undefined) {
  try {
    return decodeURIComponent(String(value || "").trim());
  } catch {
    return String(value || "").trim();
  }
}

export default function MinistryGovernorateGateway() {
  const auth = useAuth() as any;
  const navigate = useNavigate();
  const params = useParams();

  const governorate = useMemo(
    () => decodeGovernorate(params.governorateId),
    [params.governorateId]
  );

  const encodedGovernorate = encodeURIComponent(governorate || "");

  if (auth?.loading) return null;
  if (!isMinistrySuperViewer(auth)) return <Navigate to="/super-system" replace />;

  return (
    <main className="ministry-m3-page ministry-m3-governorate-gateway" dir="rtl">
      <div className="ministry-m3-canvas">
        <header className="ministry-m3-header">
          <div className="ministry-m3-actions">
            <button
              type="button"
              className="ministry-m3-back"
              onClick={() => navigate("/super-system")}
            >
              ← العودة
            </button>
          </div>

          <div className="ministry-m3-user">
            <div className="ministry-m3-user-avatar" aria-hidden="true" />
            <span className="ministry-m3-user-email">
              {String(auth?.user?.email || "").trim() || "—"}
            </span>
            <span className="ministry-m3-user-arrow">⌄</span>
          </div>

          <div className="ministry-m3-title-block">
            <h1>بوابة المحافظة المختارة</h1>
            <div className="ministry-m3-country-brand">
              سلطنة عمان / وزارة التعليم
            </div>
            <div className="ministry-m3-location">
              المتابعة المركزية للمحافظة: {governorate || "—"}
            </div>
          </div>

          <img
            className="ministry-m3-logo"
            src="https://i.postimg.cc/j5G4NQvZ/sh%CA%BFar-1.png"
            alt="شعار سلطنة عمان"
          />

          <div className="ministry-m3-pills">
            <span className="ministry-m3-pill ministry-m3-pill-blue">
              مشرف الوزارة
            </span>
            <span className="ministry-m3-pill ministry-m3-pill-silver">
              مشاهدة فقط على مستوى المحافظة
            </span>
          </div>
        </header>

        <div className="ministry-m3-body">
          <section className="ministry-m3-main">
            <div className="ministry-m3-notice">
              <span className="ministry-m3-notice-info">i</span>
              <strong>
                متابعة المحافظة بصلاحية مشاهدة فقط بدون إضافة أو تعديل أو حذف.
              </strong>
              <span className="ministry-m3-notice-doc">◆</span>
            </div>

            <section className="ministry-m3-panel">
              <div className="ministry-m3-panel-title">
                <h2>اختر مسار المتابعة</h2>
              </div>

              <div className="ministry-m3-governorate-grid">
                <article className="ministry-m3-governorate-card ministry-m3-school-card">
                  <div className="ministry-m3-governorate-head">
                    <div>
                      <h3 className="ministry-m3-path-title ministry-m3-school-title">مشرفي / مدارس امتحانات النقل</h3>
                      <p>
                        عرض المدارس التابعة للمحافظة ثم دخول المدرسة بصلاحية مشاهدة فقط.
                      </p>
                    </div>
                    <span className="ministry-m3-status on">مدارس</span>
                  </div>

                  <img
                    className="ministry-m3-path-image ministry-m3-school-image"
                    src="https://i.postimg.cc/YC9R5944/352d2558-14ff-434e-821d-3ffad98df2c4.jpg"
                    alt="المدارس التابعة للمحافظة"
                  />

                  <div className="ministry-m3-governorate-meta">
                    <span>المحافظة: {governorate || "—"}</span>
                    <span>المسار التالي: قائمة المدارس</span>
                    <span>الدخول: مشاهدة فقط</span>
                  </div>

                  <button
                    type="button"
                    className="ministry-m3-open-btn ministry-m3-school-btn"
                    onClick={() =>
                      navigate(
                        `/super-system/governorate/${encodedGovernorate}/schools`
                      )
                    }
                  >
                    فتح مدارس امتحانات النقل
                  </button>
                </article>

                <article className="ministry-m3-governorate-card ministry-m3-diploma-card">
                  <div className="ministry-m3-governorate-head">
                    <div>
                      <h3 className="ministry-m3-path-title ministry-m3-diploma-title">مشرفي امتحانات الدبلوم</h3>
                      <p>
                        عرض مشرفي الدبلوم داخل المحافظة ثم مراكز الدبلوم التابعة لهم.
                      </p>
                    </div>
                    <span className="ministry-m3-status on">دبلوم</span>
                  </div>

                  <img
                    className="ministry-m3-path-image ministry-m3-diploma-image"
                    src="https://i.postimg.cc/J0p7vKgk/Chat-GPT-Image-6-ywlyw-2026-11-52-32-s.png"
                    alt="مراكز امتحانات الدبلوم"
                  />

                  <div className="ministry-m3-governorate-meta">
                    <span>المحافظة: {governorate || "—"}</span>
                    <span>المسار التالي: مشرفو امتحانات الدبلوم</span>
                    <span>الدخول: مشاهدة فقط</span>
                  </div>

                  <button
                    type="button"
                    className="ministry-m3-open-btn ministry-m3-diploma-btn"
                    onClick={() =>
                      navigate(
                        `/super-system/governorate/${encodedGovernorate}/exam-supers`
                      )
                    }
                  >
                    فتح مشرفي امتحانات الدبلوم
                  </button>
                </article>
              </div>
            </section>

            <div className="ministry-m3-safety">
              جميع المسارات داخل هذه البوابة تعمل بصلاحية مشاهدة فقط لمشرف الوزارة.
            </div>
          </section>

          <aside className="ministry-m3-preview-panel">
            <div className="ministry-m3-preview-head">
              <h2>المحافظة المختارة</h2>
            </div>

            <article className="ministry-m3-preview-card">
              <h3>{governorate || "—"}</h3>
              <div className="ministry-m3-readonly">
                مشاهدة فقط
              </div>

              <button
                type="button"
                className="ministry-m3-open-btn"
                onClick={() =>
                  navigate(
                    `/super-system/governorate/${encodedGovernorate}/schools`
                  )
                }
              >
                فتح قائمة المدارس
              </button>
            </article>

            <article className="ministry-m3-preview-card">
              <h3>امتحانات الدبلوم</h3>
              <div className="ministry-m3-readonly">
                مشاهدة فقط
              </div>

              <button
                type="button"
                className="ministry-m3-open-btn"
                onClick={() =>
                  navigate(
                    `/super-system/governorate/${encodedGovernorate}/exam-supers`
                  )
                }
              >
                فتح مشرفي امتحانات الدبلوم
              </button>
            </article>
          </aside>
        </div>
      </div>
    </main>
  );
}
