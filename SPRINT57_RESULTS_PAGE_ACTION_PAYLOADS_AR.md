# Sprint 57 — Results Page Action Payloads

## ما تم
- استخراج بناء حمولة الطباعة/PDF إلى `resultsPageActionPayloads.ts`
- استخراج إنهاء التشغيل المستورد إلى helper مستقلة
- استخراج حالة إغلاق حوار الاستيراد إلى helper موحدة
- تحديث `useResultsPageActions.ts` لاستخدام هذه helpers
- إضافة اختبارات مباشرة على helpers الجديدة

## الأثر
- `useResultsPageActions` أصبح أنظف وأقل حملًا
- توحّد منطق بناء payloads للطباعة/PDF وإغلاق حوار الاستيراد
- صار هذا المنطق أسهل اختبارًا وتعديلًا لاحقًا
