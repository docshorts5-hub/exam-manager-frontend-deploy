import "./MinistrySuperSystemView.css";
import { ADMINISTRATIVE_THEMES } from "../../features/administrative-theme/administrativeTheme";

export type MinistryGovernorateSuperRow = {
  id: string;
  name?: string;
  email?: string;
  governorate?: string;
  enabled?: boolean;
  schoolsCount?: number;
  diplomaCentersCount?: number;
  schoolAdminsCount?: number;
  examSupersCount?: number;
};

type MinistrySuperSystemViewProps = {
  userEmail?: string;
  governorateSupers?: MinistryGovernorateSuperRow[];
  onBack: () => void;
  onLogout: () => void;
  onOpenGovernorate?: (row: MinistryGovernorateSuperRow) => void;
  onOpenTotpReset: () => void;
};

function valueOrDash(value: unknown) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function numberOrZero(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function MinistryStatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="ministry-stat-card">
      <div className="ministry-stat-value">{value}</div>
      <div className="ministry-stat-label">{label}</div>
    </div>
  );
}

export default function MinistrySuperSystemView({
  userEmail,
  governorateSupers = [],
  onBack,
  onLogout,
  onOpenGovernorate,
  onOpenTotpReset,
}: MinistrySuperSystemViewProps) {
  const totalSchools = governorateSupers.reduce((sum, row) => sum + numberOrZero(row.schoolsCount), 0);
  const totalDiplomaCenters = governorateSupers.reduce((sum, row) => sum + numberOrZero(row.diplomaCentersCount), 0);
  const totalSchoolAdmins = governorateSupers.reduce((sum, row) => sum + numberOrZero(row.schoolAdminsCount), 0);
  const totalExamSupers = governorateSupers.reduce((sum, row) => sum + numberOrZero(row.examSupersCount), 0);

  return (
    <main className={`ministry-m3-page ${ADMINISTRATIVE_THEMES.ministry.rootClassName}`} dir="rtl">
      <div className="ministry-m3-canvas">
        <header className="ministry-m3-header">
          <div className="ministry-m3-actions">
            <button className="ministry-m3-back" type="button" onClick={onBack}>
              <span>←</span>
              العودة
            </button>

            <button className="ministry-m3-back" type="button" onClick={onOpenTotpReset}>
              إعادة تهيئة TOTP
            </button>
            <button className="ministry-m3-logout" type="button" onClick={onLogout}>
              تسجيل الخروج
              <span>↪</span>
            </button>
          </div>

          <div className="ministry-m3-user">
            <span className="ministry-m3-user-avatar" aria-hidden="true" />
            <span className="ministry-m3-user-email">{valueOrDash(userEmail)}</span>
            <span className="ministry-m3-user-arrow">⌄</span>
          </div>

          <div className="ministry-m3-title-block">
            <h1>بوابة مشرف الوزارة</h1>
            <div className="ministry-m3-country-brand">سلطنة عمان / وزارة التعليم</div>
            <p className="ministry-m3-location">المتابعة المركزية لجميع المحافظات</p>
          </div>

          <img
            className="ministry-m3-logo"
            src="https://i.postimg.cc/j5G4NQvZ/sh%CA%BFar-1.png"
            alt="شعار وزارة التعليم"
          />

          <div className="ministry-m3-pills">
            <span className="ministry-m3-pill ministry-m3-pill-blue">
              مشرف الوزارة
              <span>♙</span>
            </span>
            <span className="ministry-m3-pill ministry-m3-pill-silver">
              مشاهدة فقط على مستوى النظام
              <span>♢</span>
            </span>
          </div>
        </header>

        <div className="ministry-m3-body">
          <section className="ministry-m3-main">
            <div className="ministry-m3-notice">
              <span className="ministry-m3-notice-doc" aria-hidden="true">◆</span>
              <p>
                جميع صفحات مشرف الوزارة تعمل بصلاحية مشاهدة فقط بدون إضافة أو تعديل أو حذف.
              </p>
              <span className="ministry-m3-notice-info">i</span>
            </div>

            <section className="ministry-m3-panel">
              <div className="ministry-m3-panel-title">
                <span aria-hidden="true">◎</span>
                <h2>الملخص المركزي</h2>
              </div>

              <div className="ministry-m3-stats-grid" aria-label="ملخص بيانات الوزارة">
                <MinistryStatCard label="المحافظات" value={governorateSupers.length} />
                <MinistryStatCard label="المدارس" value={totalSchools} />
                <MinistryStatCard label="مراكز الدبلوم" value={totalDiplomaCenters} />
                <MinistryStatCard label="مدراء المدارس" value={totalSchoolAdmins} />
                <MinistryStatCard label="مشرفو امتحانات الدبلوم" value={totalExamSupers} />
              </div>
            </section>

            <section className="ministry-m3-panel">
              <div className="ministry-m3-panel-title">
                <span aria-hidden="true">◇</span>
                <h2>المحافظات والجهات التابعة</h2>
              </div>

              {governorateSupers.length ? (
                <div className="ministry-m3-governorate-grid">
                  {governorateSupers.map((row) => (
                    <article className="ministry-m3-governorate-card" key={row.id}>
                      <div className="ministry-m3-governorate-head">
                        <div>
                          <h3>{valueOrDash(row.name || row.governorate)}</h3>
                          <p className="ministry-m3-card-email">{valueOrDash(row.email)}</p>
                        </div>
                        <span
                          className={!row.email || row.enabled === false ? "ministry-m3-status off" : "ministry-m3-status on"}
                        >
                          {!row.email ? "بدون مشرف" : row.enabled === false ? "غير مفعل" : "مفعل"}
                        </span>
                      </div>

                      <div className="ministry-m3-governorate-meta">
                        <span>المحافظة: {valueOrDash(row.governorate)}</span>
                        <span>المدارس: {numberOrZero(row.schoolsCount)}</span>
                        <span>مراكز الدبلوم: {numberOrZero(row.diplomaCentersCount)}</span>
                        <span>مدراء المدارس: {numberOrZero(row.schoolAdminsCount)}</span>
                        <span>مشرفو امتحانات الدبلوم: {numberOrZero(row.examSupersCount)}</span>
                      </div>

                      <button
                        type="button"
                        className="ministry-m3-open-btn"
                        onClick={() => onOpenGovernorate?.(row)}
                      >
                        عرض المحافظة
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="ministry-m3-empty">
                  لا توجد بيانات محافظات متاحة للعرض حاليًا.
                </div>
              )}
            </section>

            <div className="ministry-m3-safety">
              <span aria-hidden="true">◇</span>
              <p>المشاهدة فقط لحماية البيانات ومنع أي عمليات كتابة غير مصرح بها.</p>
            </div>
          </section>

          <aside className="ministry-m3-preview-panel">
            <div className="ministry-m3-preview-head">
              <span aria-hidden="true">◎</span>
              <h2>معاينة صفحات المشاهدة</h2>
            </div>

            <div className="ministry-m3-preview-card">
              <h3>دخول مدرسة - مشاهدة فقط</h3>
              <img
                className="ministry-m3-building-img"
                src="https://i.postimg.cc/YC9R5944/352d2558-14ff-434e-821d-3ffad98df2c4.jpg"
                alt="دخول مدرسة - مشاهدة فقط"
              />
              <div className="ministry-m3-readonly">
                مشاهدة فقط
                <span aria-hidden="true">◉</span>
              </div>
              <button type="button" onClick={onBack}>
                ← العودة إلى بوابة مشرف الوزارة
              </button>
            </div>

            <div className="ministry-m3-preview-card">
              <h3>دخول مركز دبلوم - مشاهدة فقط</h3>
              <img
                className="ministry-m3-building-img"
                src="https://i.postimg.cc/J0p7vKgk/Chat-GPT-Image-6-ywlyw-2026-11-52-32-s.png"
                alt="دخول مركز دبلوم - مشاهدة فقط"
              />
              <div className="ministry-m3-readonly">
                مشاهدة فقط
                <span aria-hidden="true">◉</span>
              </div>
              <button type="button" onClick={onBack}>
                ← العودة إلى بوابة مشرف الوزارة
              </button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
