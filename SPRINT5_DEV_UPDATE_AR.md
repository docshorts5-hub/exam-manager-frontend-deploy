# Sprint 5 – Hooks + تقليل الاعتماد المباشر على localStorage

ما تم تطويره:

- إضافة hook عامة لإدارة بيانات tenant arrays مع التحميل والحفظ التلقائي:
  - `src/hooks/useTenantArrayState.ts`
- إضافة hooks تخصصية:
  - `src/hooks/useTeachersData.ts`
  - `src/hooks/useRoomsData.ts`
  - `src/hooks/useExamsData.ts`
- تحديث صفحات:
  - `src/pages/Teachers.tsx`
  - `src/pages/Rooms.tsx`
  - `src/pages/Exams.tsx`
  
  لتستخدم hooks الجديدة بدل منطق `load/save + debounce` المكرر داخل كل صفحة.
- إنشاء طبقة تخزين منفصلة لقيود التوزيع:
  - `src/infra/cache/distributionConstraintsStorage.ts`
- تحديث `src/pages/TaskDistributionRun.tsx` بحيث:
  - يستعمل طبقة التخزين الجديدة لقيود التوزيع بدل استدعاءات localStorage المباشرة المنتشرة.
  - يعتمد على بيانات `teachers` و `exams` المحمّلة من المصدر الحالي للتطبيق بدل القراءة المباشرة من localStorage أثناء التشغيل.
  - يستخدم قائمة المعلمين الحالية نفسها في ملخص العدالة بدل snapshot محلي منفصل.

المكسب الهندسي:
- تقليل التكرار بين صفحات المعلمين/القاعات/الامتحانات.
- جعل نقل المزايا إلى feature hooks أسهل في الـ Sprint التالي.
- تقليل اقتران صفحة التوزيع مع مفاتيح localStorage القديمة.

ملاحظة:
- ما زالت صفحة `TaskDistributionRun` كبيرة وتحتاج تفكيكًا لاحقًا، لكن هذه المرحلة نقلت أول جزء مهم منها بعيدًا عن مصدر بيانات محلي مباشر.
