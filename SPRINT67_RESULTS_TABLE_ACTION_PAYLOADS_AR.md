# Sprint 67

## ما تم
- استخراج حمولة تصدير Excel من `useResultsTableActions` إلى `resultsTableActionPayloads.ts`
- استخراج رسالة الحظر الموحدة للخلايا إلى helper مستقلة قابلة للاختبار
- تحديث `useResultsTableActions.ts` لاستخدام الـ helpers الجديدة
- إضافة اختبارات وحدة مباشرة على helpers الجديدة

## الأثر
- خفة إضافية في `useResultsTableActions`
- توحيد رسالة الحظر
- وضوح أفضل في حمولة التصدير
