# Sprint 17

تم في هذه المرحلة تنظيف عدد إضافي من الأسطح القديمة التي كانت ما تزال تعتمد على فحص الدور المباشر أو على منطق قديم متفرق.

## ما تم
- تحسين `buildAuthzSnapshot` ليستنتج الأدوار تلقائيًا من `profile.role` عند غياب `roles[]`.
- إضافة helper UI جديد:
  - `src/features/authz/ui.ts`
  - ويحتوي `resolveRoleBadgeStyle(...)` لتمييز مالك المنصة بصريًا.
- تحديث `Login.tsx` لاستخدام capabilities وrole badge موحدة.
- تحديث `SuperPortal.tsx` و`SuperSystem.tsx` لاستخدام role badge/owner labeling من طبقة `authz`.
- تحديث `MigrateToTenant.tsx` ليعتمد على:
  - `isPlatformOwner(...)`
  - `TENANTS_MANAGE`
  بدل قصره على `isSuperAdmin` فقط.

## الأثر
- صار `super_admin` أوضح كـ **مالك المنصة** بصريًا ووظيفيًا.
- تحسن fallback authz للملفات القديمة التي ما زالت تعتمد على `profile.role` أكثر من `roles[]`.
- خفّ الاعتماد على role strings المباشرة في أدوات الإدارة الحساسة.
