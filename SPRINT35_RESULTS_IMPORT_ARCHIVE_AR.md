# Sprint 35 — Results Import/Archive Logic Split

تم في هذه المرحلة نقل جزء إضافي من lifecycle التشغيلي خارج `TaskDistributionResults.tsx`:

- إضافة service جديدة:
  - `src/pages/taskDistributionResults/services/resultsImportArchive.ts`
- نقل منطق فتح منتقي ملف الاستيراد إلى helper مستقلة
- نقل منطق إنشاء/حفظ نسخة الأرشيف من النتائج إلى helper مستقلة
- تحديث الصفحة لتستخدم helpers الجديدة بدل تنفيذ هذه التفاصيل داخليًا مباشرة

## الأثر
- خفّ حمل الصفحة من ناحية import/archive lifecycle
- صار منطق الأرشفة والاستيراد أقرب لإعادة الاستخدام والاختبار لاحقًا
