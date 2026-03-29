# Sprint 1 - Authorization Foundation

تم في هذه المرحلة إنشاء طبقة صلاحيات مركزية أولية داخل `src/features/authz`، وربط الحراس الأساسية بها بدل الاعتماد على شروط متفرقة داخل أكثر من ملف.

## ما تم
- إضافة `src/features/authz/types.ts`
- إضافة `src/features/authz/policies.ts`
- إضافة `src/features/authz/index.ts`
- تحديث `src/auth/permissions.ts` ليستخدم الطبقة الجديدة
- تحديث `src/auth/ProtectedRoute.tsx` لتوحيد منطق الوصول
- تحديث `src/pages/HomeRedirect.tsx` لاستخدام `resolveHomePath`

## الهدف
تقليل التشعب في منطق الصلاحيات، وجعل أي تطوير لاحق لـ Auth و Route Guards أسهل وأكثر أمانًا.
