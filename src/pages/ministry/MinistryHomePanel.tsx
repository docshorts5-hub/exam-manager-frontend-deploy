type MinistryHomePanelProps = {
  userEmail?: string;
  onLogout?: () => void;
  onOpenSystem: () => void;
  onOpenTotp: () => void;
};

const t = {
  ministry: "\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u062a\u0639\u0644\u064a\u0645",
  title: "\u0628\u0648\u0627\u0628\u0629 \u0645\u0634\u0631\u0641 \u0627\u0644\u0648\u0632\u0627\u0631\u0629",
  subtitle:
    "\u0645\u062a\u0627\u0628\u0639\u0629 \u0633\u0648\u0628\u0631 \u0627\u0644\u0645\u062d\u0627\u0641\u0638\u0627\u062a \u0648\u0627\u0644\u0645\u062f\u0627\u0631\u0633 \u0648\u0645\u0631\u0627\u0643\u0632 \u0627\u0645\u062a\u062d\u0627\u0646\u0627\u062a \u0627\u0644\u062f\u0628\u0644\u0648\u0645 \u0628\u0635\u0644\u0627\u062d\u064a\u0629 \u0645\u0634\u0627\u0647\u062f\u0629 \u0641\u0642\u0637.",
  logout: "\u062a\u0633\u062c\u064a\u0644 \u062e\u0631\u0648\u062c",
  role: "\u0645\u0634\u0631\u0641 \u0627\u0644\u0648\u0632\u0627\u0631\u0629",
  email: "\u0627\u0644\u0628\u0631\u064a\u062f",
  readonly:
    "\u0648\u0636\u0639 \u0627\u0644\u0645\u0634\u0627\u0647\u062f\u0629 \u0641\u0642\u0637 \u00b7 \u0628\u062f\u0648\u0646 \u0625\u0636\u0627\u0641\u0629 \u0623\u0648 \u062a\u0639\u062f\u064a\u0644 \u0623\u0648 \u062d\u0630\u0641",
  choose: "\u0627\u062e\u062a\u0631 \u0645\u0633\u0627\u0631 \u0627\u0644\u0645\u062a\u0627\u0628\u0639\u0629",
  chooseDesc:
    "\u0627\u0628\u062f\u0623 \u0645\u0646 \u062c\u0645\u064a\u0639 \u0633\u0648\u0628\u0631 \u0627\u0644\u0645\u062d\u0627\u0641\u0638\u0627\u062a\u060c \u062b\u0645 \u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u062d\u0627\u0641\u0638\u0629\u060c \u062b\u0645 \u0627\u0644\u0645\u062f\u0627\u0631\u0633 \u0623\u0648 \u0627\u0644\u062f\u0628\u0644\u0648\u0645.",
  ministryTag: "\u0648\u0632\u0627\u0631\u0629",
  showGovSupers: "\u0639\u0631\u0636 \u0633\u0648\u0628\u0631 \u0627\u0644\u0645\u062d\u0627\u0641\u0638\u0627\u062a",
  showGovSupersDesc:
    "\u0627\u0644\u0648\u0627\u062c\u0647\u0629 \u0627\u0644\u062c\u062f\u064a\u062f\u0629 \u0627\u0644\u062e\u0627\u0635\u0629 \u0628\u0645\u0634\u0631\u0641 \u0627\u0644\u0648\u0632\u0627\u0631\u0629.",
  basic: "\u0623\u0633\u0627\u0633\u064a",
  allGovSupers: "\u0645\u0634\u0627\u0647\u062f\u0629 \u062c\u0645\u064a\u0639 \u0633\u0648\u0628\u0631 \u0627\u0644\u0645\u062d\u0627\u0641\u0638\u0627\u062a",
  openGovGateway: "\u0641\u062a\u062d \u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0645\u062d\u0627\u0641\u0638\u0629",
  thenSchoolsDiploma: "\u062b\u0645 \u0627\u0644\u0645\u062f\u0627\u0631\u0633 \u0623\u0648 \u0627\u0644\u062f\u0628\u0644\u0648\u0645",
  openMinistryBoard: "\u0641\u062a\u062d \u0644\u0648\u062d\u0629 \u0645\u0634\u0631\u0641 \u0627\u0644\u0648\u0632\u0627\u0631\u0629",
};

export default function MinistryHomePanel({
  userEmail,
  onLogout,
  onOpenSystem,
  onOpenTotp,
}: MinistryHomePanelProps) {
  return (
    <main className="ministry-m3-page ministry-m3-home-entry" dir="rtl">
      <div className="ministry-m3-canvas">
        <header className="ministry-m3-header">
          <div className="ministry-m3-actions">
            <button
              className="ministry-m3-logout"
              type="button"
              onClick={onOpenTotp}
            >
              إدارة TOTP
            </button>

            <button className="ministry-m3-logout" type="button" onClick={onLogout}>
              {t.logout}
              <span>↪</span>
            </button>
          </div>

          <div className="ministry-m3-user">
            <span className="ministry-m3-user-avatar" aria-hidden="true" />
            <span className="ministry-m3-user-email">{userEmail || "—"}</span>
            <span className="ministry-m3-user-arrow">⌄</span>
          </div>

          <div className="ministry-m3-title-block">
            <h1>{t.title}</h1>
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
              {t.role}
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
              <p>{t.readonly}</p>
              <span className="ministry-m3-notice-info">i</span>
            </div>

            <section className="ministry-m3-panel">
              <div className="ministry-m3-panel-title">
                <span aria-hidden="true">◎</span>
                <h2>{t.choose}</h2>
              </div>

              <article className="ministry-m3-governorate-card">
                <div className="ministry-m3-governorate-head">
                  <div>
                    <h3>{t.showGovSupers}</h3>
                    <p>{t.showGovSupersDesc}</p>
                  </div>
                  <span className="ministry-m3-status on">{t.basic}</span>
                </div>

                <div className="ministry-m3-governorate-meta">
                  <span>{t.allGovSupers}</span>
                  <span>{t.openGovGateway}</span>
                  <span>{t.thenSchoolsDiploma}</span>
                  <span>{t.readonly}</span>
                </div>

                <button
                  type="button"
                  className="ministry-m3-open-btn"
                  onClick={onOpenSystem}
                >
                  {t.openMinistryBoard}
                </button>
              </article>
            </section>

            <div className="ministry-m3-safety">
              <span aria-hidden="true">◇</span>
              <p>{t.subtitle}</p>
            </div>
          </section>

          <aside className="ministry-m3-preview-panel">
            <div className="ministry-m3-preview-head">
              <span aria-hidden="true">◎</span>
              <h2>بوابة المتابعة المركزية</h2>
            </div>

            <div className="ministry-m3-preview-card">
              <h3>المحافظات والمدارس ومراكز الدبلوم</h3>
              <img
                className="ministry-m3-building-img"
                src="https://i.postimg.cc/YC9R5944/352d2558-14ff-434e-821d-3ffad98df2c4.jpg"
                alt="المتابعة المركزية للمدارس"
              />
              <div className="ministry-m3-readonly">
                مشاهدة فقط
                <span aria-hidden="true">◉</span>
              </div>
              <button type="button" onClick={onOpenSystem}>
                فتح لوحة مشرف الوزارة
              </button>
            </div>

            <div className="ministry-m3-preview-card">
              <h3>متابعة مراكز امتحانات الدبلوم</h3>
              <img
                className="ministry-m3-building-img"
                src="https://i.postimg.cc/J0p7vKgk/Chat-GPT-Image-6-ywlyw-2026-11-52-32-s.png"
                alt="المتابعة المركزية لمراكز الدبلوم"
              />
              <div className="ministry-m3-readonly">
                مشاهدة فقط
                <span aria-hidden="true">◉</span>
              </div>
              <button type="button" onClick={onOpenSystem}>
                فتح لوحة مشرف الوزارة
              </button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
