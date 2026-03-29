# Sprint 24

تم تحسين رسائل أخطاء Cloud Functions الحساسة، خصوصًا عمليات مالك المنصة (`super_admin`).

## ما تم
- إضافة `src/services/functionsRuntimePolicy.ts`
- منع fallback المحلي الصامت لعمليات حساسة مثل:
  - `adminUpsertTenant`
  - `adminDeleteTenant`
  - `adminUpsertAllowlist`
  - `adminDeleteAllowlist`
- تمرير رسائل عربية أوضح داخل `AdminSystem` و`SuperSystem`

## الأثر
- إذا تعطلت Cloud Functions أو لم تكن منشورة، تظهر رسالة واضحة بدل نجاح زائف عبر fallback محلي.
- العمليات المرتبطة بمالك المنصة أصبحت أكثر أمانًا ووضوحًا تشغيليًا.
