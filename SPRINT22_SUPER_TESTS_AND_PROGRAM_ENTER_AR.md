# Sprint 22

تم في هذه المرحلة:

- إضافة اختبارات جديدة لطبقة السوبر:
  - `src/features/super-admin/__tests__/superPortalService.test.ts`
  - `src/features/super-admin/__tests__/superProgramEnterService.test.ts`
- استخراج helpers مشتركة من طبقة السوبر إلى:
  - `src/features/super-admin/services/superSystemShared.ts`
- نقل `safeTenantId` إلى طبقة مشتركة قابلة للاختبار بدل بقائه داخل service كبيرة.
- إنشاء service جديدة لتهيئة حالة شاشة اختيار المدرسة:
  - `src/features/super-admin/services/superProgramEnterService.ts`
- تحديث `SuperProgramEnter.tsx` ليستخدم منطقًا موحدًا لاشتقاق:
  - المدارس المرئية
  - وصف صلاحية الدخول

الأثر:
- توسعت التغطية الاختبارية في أسطح السوبر.
- صار منطق اختيار المدارس في `SuperProgramEnter` أكثر قابلية للصيانة والاختبار.
- تحسن عزل المنطق الخالص عن صفحة العرض.
