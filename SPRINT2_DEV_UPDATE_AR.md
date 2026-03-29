# Sprint 2 - Auth Context Decomposition + Duplicate Cleanup

تم في هذه المرحلة تطوير بنيوي إضافي داخل المشروع:

## 1) تفكيك أولي لـ AuthContext
تم استخراج أجزاء مشتركة من `src/auth/AuthContext.tsx` إلى ملفات مستقلة:

- `src/auth/types.ts`
- `src/auth/auth-helpers.ts`
- `src/auth/profile-helpers.ts`

### الهدف
- تقليل حجم وتعقيد `AuthContext`
- توحيد أنواع المصادقة والصلاحيات
- إزالة التكرار في منطق user profile shell
- جعل إعادة التطوير لاحقًا أسهل في Sprint 3

## 2) توحيد user profile shell
تم استبدال تكرار منطق كتابة/قراءة `/users/{uid}` داخل `AuthContext` بـ helpers مشتركة:

- `upsertBaseUserProfile(...)`
- `loadUiUserProfile(...)`

## 3) تنظيف التكرار الظاهر في الصفحات
تم تحويل الملفات التالية إلى aliases انتقالية بدل نسخ منطق منفصلة:

- `src/pages/HomeRedirect1.tsx`
- `src/pages/Settings1.tsx`

وهذا يمنع انجراف النسخ مع استمرار التطوير.

## 4) النتيجة
- البناء يستمر بالنجاح
- AuthContext أصبح أخف من حيث المسؤوليات المباشرة
- التكرار الواضح انخفض
- أصبح الطريق ممهدًا لـ Sprint 3: فصل session / support mode hooks
