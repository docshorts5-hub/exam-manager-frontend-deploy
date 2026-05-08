# Sprint 53 — تثبيت طبقة أفعال جدول النتائج

## ما تم
- استخراج منطق تحديد سبب عدم التوفر داخل خلايا النتائج إلى service مستقلة.
- تحديث `useResultsTableActions` لاستخدام helper موحدة بدل احتواء منطق السبب داخله مباشرة.
- إضافة اختبارات وحدة مباشرة على helper الجديدة.

## الملفات الجديدة
- `src/pages/taskDistributionResults/services/resultsTableActionHelpers.ts`
- `src/pages/taskDistributionResults/__tests__/resultsTableActionHelpers.test.ts`

## الملفات المعدلة
- `src/pages/taskDistributionResults/hooks/useResultsTableActions.ts`

## الأثر
- تقليل الحمل المنطقي داخل `useResultsTableActions`.
- توضيح اشتقاق سبب عدم التوفر واختباره بمعزل عن الـ hook.
- رفع الثقة في طبقة نتائج التوزيع قبل الانتقال إلى مرحلة تثبيت أوسع.
