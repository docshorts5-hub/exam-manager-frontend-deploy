# Sprint 46 — تثبيت جدول النتائج وتقسيمه

## ما تم
- استخراج رأس جدول النتائج إلى `ResultsTableHeader.tsx`
- استخراج سطر الإجماليات إلى `ResultsTotalsRow.tsx`
- تبسيط `ResultsTable.tsx` ليصبح ملف تنسيق وتجميع بدل احتواء كل header/footer داخله
- إضافة اختبارات helpers لملف `resultsActions.ts`

## الأثر
- تقليل حجم وتعقيد `ResultsTable.tsx`
- جعل رأس الجدول وسطر الإجماليات قابلين للصيانة والعزل بشكل أوضح
- رفع الثقة في helpers الخاصة بعنوان التشغيل واسم الأرشيف
