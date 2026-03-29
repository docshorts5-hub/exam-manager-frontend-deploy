# Sprint 3 - Session / Support Extraction + First Repository

تم في هذه المرحلة:

- استخراج منطق جلسة الدعم المحلي إلى:
  - `src/auth/hooks/useSupportSession.ts`
- استخراج منطق session/auth state الرئيسي إلى:
  - `src/auth/hooks/useAuthSessionState.ts`
- تبسيط `AuthContext.tsx` ليصبح مجمعًا orchestrator بدل ملف يحتوي كل التفاصيل داخله.
- بدء نقل طبقة البيانات إلى repository حقيقي عبر:
  - `src/infra/repositories/userProfileRepository.ts`
- تحديث `profile-helpers.ts` ليقرأ/يكتب من خلال repository بدل الوصول المباشر المبعثر إلى Firestore.
- تبسيط `SessionContext.tsx` ليعتمد على `AuthContext` بدل بناء جلسة ثانية مستقلة.

## النتيجة الهندسية

- لم يعد `AuthContext` يحمل منطق local support وقراءة حالة الجلسة بالكامل داخله.
- أصبحت هناك نقطة بداية واضحة لبناء repositories لباقي الكيانات.
- تم تقليل خطر وجود مصدرين مختلفين لحالة الجلسة داخل التطبيق.

## الخطوة التالية

Sprint 4 يجب أن يركز على:

- إنشاء repositories فعلية لـ teachers / rooms / exams
- نقل أول feature بعيدًا عن localStorage إلى data layer موحدة
- بدء تقسيم صفحات الإدارة أو التوزيع الثقيلة
