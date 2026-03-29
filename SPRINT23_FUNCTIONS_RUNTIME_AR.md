# Sprint 23 — تنظيم طبقة العمليات السحابية

ما تم في هذه المرحلة:

- إنشاء كتالوج واضح للوظائف السحابية في:
  - `src/services/functionsCatalog.ts`
- فصل الـ local fallbacks الفعلية إلى ملف مستقل:
  - `src/services/functionsLocalFallbacks.ts`
- تبسيط `functionsRegistry.ts` ليصبح مسؤولًا فقط عن:
  - معرفة وجود fallback محلي
  - تشغيله
- إعادة ضبط `functionsClient.ts` بحيث:
  - يستخدم **Cloud Functions Emulator** فعليًا إذا كان مفعّلًا
  - لا يتجاوز إلى fallback محلي مباشرة كما كان يحدث سابقًا
  - يقرر بين cloud / local fallback بناءً على سياسة واضحة لكل function
- وسم العمليات الحساسة الخاصة بمالك المنصة داخل الكتالوج، مثل:
  - `adminUpsertTenant`
  - `adminDeleteTenant`
  - `adminUpsertAllowlist`
  - `bootstrapOwner`
  - `adminMigrateRootToTenant`

الأثر الهندسي:

- صار واضحًا ما هي الوظائف السحابية الموجودة اسميًا في المنظومة.
- صار واضحًا أيها يسمح بـ local fallback وأيها يُفضّل cloud runtime.
- تم إصلاح خطأ معماري مهم: تفعيل emulator في بيئة التطوير لم يكن يُستخدم فعليًا لأن client كان يذهب إلى fallback المحلي أولًا.
- صارت العمليات الحساسة المرتبطة بمالك المنصة أوضح في طبقة موحدة بدل اختلاطها بمنطق التشغيل العام.

الخطوة التالية الأنسب:

- Sprint 24: مراجعة النداءات الحساسة في `AdminSystem` و`SuperSystem` وربط الرسائل/الأخطاء بمفهوم `CLOUD_RUNTIME_REQUIRED` عندما لا يكون fallback مناسبًا.
