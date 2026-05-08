# Sprint 26 — توسيع repositories وسياسة runtime

## ما تم تطويره
- إنشاء repository مستقلة للإعدادات العامة:
  - `src/infra/repositories/generalSettingsRepository.ts`
- تحديث `src/services/settings.service.ts` لتصبح واجهة توافقية فوق الـ repository بدل القراءة/الكتابة المباشرة.
- إنشاء خدمة موحدة للأرشيف السحابي:
  - `src/services/cloudArchive.service.ts`
- تحديث `src/pages/Sync.tsx` لاستخدام الخدمة الجديدة بدل حمل منطق:
  - قراءة أرشيف السحابة
  - رفع عناصر الأرشيف
  - مزامنة السحابة
  داخل الصفحة نفسها.

## الأثر الهندسي
- تقليل الوصول المباشر إلى Firestore في مسارات حساسة.
- توحيد runtime policy للأرشيف السحابي عبر خدمة واحدة.
- تمهيد الطريق لاستخراج مزيد من الخدمات/الـ repositories من الصفحات القديمة.

## ملاحظة
- هذه المرحلة لم تُعد كتابة شاشة `Sync` بالكامل، لكنها سحبت أهم مسار Firestore/Functions منها إلى طبقة أوضح وأكثر صدقًا.
