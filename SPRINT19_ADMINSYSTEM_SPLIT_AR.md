# Sprint 19

تم في هذه المرحلة تفكيك `AdminSystem.tsx` إلى مكونات أصغر مع الحفاظ على منطق الصلاحيات الجديد الذي يعتبر `super_admin` مالك المنصة.

## ما تم فعليًا
- إنشاء طبقة UI مشتركة لصفحة الإدارة في:
  - `src/features/system-admin/ui.tsx`
- استخراج قسم إدارة المدارس إلى:
  - `src/features/system-admin/components/AdminTenantsSection.tsx`
- استخراج قسم إدارة المستخدمين إلى:
  - `src/features/system-admin/components/AdminUsersSection.tsx`
- استخراج قسم أدوات المالك و `meta/owner` إلى:
  - `src/features/system-admin/components/AdminOwnerToolsSection.tsx`
- تحديث `src/pages/AdminSystem.tsx` ليصبح أقرب إلى container orchestrator بدل ملف عرض ضخم.

## الأثر الهندسي
- تقليل حجم `AdminSystem.tsx` بشكل واضح.
- فصل العرض عن orchestration.
- تسهيل متابعة تطوير إدارة المستخدمين والجهات والدعم كمسارات مستقلة لاحقًا.
- إبقاء تمييز مالك المنصة داخل الصفحة نفسها مع الاعتماد على `authz`.
