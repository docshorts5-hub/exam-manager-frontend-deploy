# Sprint 25 — توحيد Runtime لخدمات النشاط والتدقيق والمزامنة

## ما تم تطويره
- إضافة دالة تشغيل موحدة للوظائف السحابية:
  - `runFunctionWithRuntimePolicy(...)`
- توسيع `functionsRuntimePolicy.ts` ليشمل:
  - `canRetryFunctionLocally(...)`
  - `isCloudPreferredFunction(...)`
- جعل `writeActivityLog` وظيفة **cloud-preferred** داخل `functionsCatalog.ts`.
- تحديث الخدمات التالية لتستخدم نفس بوابة runtime:
  - `src/services/activityLog.service.ts`
  - `src/services/audit.service.ts`
  - `src/services/securityAudit.ts`
  - `src/services/autoCloudSync.ts`
- إزالة المزج القديم في `src/services/tenantData.ts` حيث كانت `writeTenantAudit(...)` تكتب مباشرة إلى Firestore ثم تكتب أيضًا عبر Cloud Functions.
  - أصبحت الآن تعتمد على `writeActivityLog(...)` فقط كمسار موحد.
- إضافة اختبار أولي لسياسة runtime:
  - `src/services/__tests__/functionsRuntimePolicy.test.ts`

## الأثر الهندسي
- لم تعد خدمات التدقيق والمزامنة تختار runtime محليًا/سحابيًا كل واحدة بمنطق مختلف.
- صار سجل النشاط والتدقيق أكثر اتساقًا مع سياسة Cloud Functions الحالية.
- اختفى السلوك المختلط الذي كان يكتب audit مباشرة إلى Firestore وفي الوقت نفسه يرسل Activity Log عبر الوظائف.

## النتيجة
هذه المرحلة لا تجعل كل العمليات “سحابية بالكامل” بعد، لكنها تجعل **قرار التشغيل نفسه موحدًا** في طبقة واحدة، وهذا مهم جدًا قبل مواصلة نقل بقية الخدمات الحساسة إلى Cloud runtime واضح ومفهوم.
