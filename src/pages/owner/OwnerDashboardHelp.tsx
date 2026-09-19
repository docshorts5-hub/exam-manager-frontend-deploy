import React from "react";
import OwnerDashboardShell from "./OwnerDashboardShell";

export default function OwnerDashboardHelp() {
  return (
    <OwnerDashboardShell backTo="/system">
      <section className="owner-hub__sectionHero owner-hub__sectionHero--blue">
        <h1>دليل استخدام لوحة مالك المنصة</h1>
        <p>خريطة مختصرة للأقسام الرئيسية ومساراتها.</p>
      </section>

      <section className="owner-hub__helpGrid">
        <article>
          <strong>الإدارة الرئيسية</strong>
          <p>المحافظات والمدارس ومراكز الدبلوم والمستخدمون والمشرفون.</p>
        </article>
        <article>
          <strong>الأمن والرقابة</strong>
          <p>الصلاحيات وTOTP وسجل العمليات وسجل الأخطاء.</p>
        </article>
        <article>
          <strong>النظام والتطوير</strong>
          <p>المراقبة والصيانة والإصدارات والجاهزية والاختبارات.</p>
        </article>
      </section>
    </OwnerDashboardShell>
  );
}