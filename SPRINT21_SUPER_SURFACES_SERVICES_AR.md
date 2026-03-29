# Sprint 21 — تفكيك أسطح السوبر والخدمات السحابية

## ما تم تطويره
- إنشاء طبقة `features/super-admin` للأنواع والخدمات والـ hooks الخاصة بأسطح السوبر.
- إضافة `useSuperSystemTenants` لعزل الاستماع للمدارس والفلترة والاختيار خارج `SuperSystem.tsx`.
- إضافة `superSystemService.ts` لعزل عمليات:
  - إنشاء المدرسة
  - تحميل إعدادات المدرسة المختارة
  - حفظ إعدادات المدرسة
  - حذف المدرسة مع الأرشفة
  - ربط Admin بالمدرسة
- إضافة `superPortalService.ts` لبناء بطاقات الدخول في `SuperPortal` بدل كتابة المنطق داخل الصفحة.
- إضافة مكوّن `SuperPortalCard` لتقليل تكرار واجهات البطاقات.
- إصلاح خطأ قديم في `SuperPortal.tsx` كان يعتمد على متغير `isSuper` غير معرّف.
- تفكيك `functionsClient.ts` عبر نقل الـ local fallback registry إلى ملف مستقل:
  - `src/services/functionsRegistry.ts`

## الأثر الهندسي
- `SuperSystem.tsx` أصبح أقرب إلى container بدل حمل عمليات القراءة/الكتابة داخله.
- `SuperPortal.tsx` صار يعتمد على service تبني أسطح الدخول بحسب الصلاحيات.
- `functionsClient.ts` صار أنظف وأسهل صيانة، مع إبقاء fallback المحلي مفصولًا عن طبقة الاستدعاء.
- ظل شرط المنصة محفوظًا: `super_admin` هو مالك المنصة وصاحب أعلى الصلاحيات.

## الخطوة التالية
- إدخال اختبارات على `superSystemService` و`superPortalService`.
- مراجعة بقية الصفحات الكبيرة المرتبطة بالسوبر لتنظيف ما تبقى من logic قديم أو متكرر.
