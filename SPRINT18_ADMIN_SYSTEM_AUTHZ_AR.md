# Sprint 18 — توحيد صلاحيات AdminSystem على capabilities

تم في هذه المرحلة نقل جزء أعمق من منطق `AdminSystem.tsx` من الشروط القديمة المبنية على البريد الرئيسي أو role-string المباشر إلى طبقة `authz` الموحدة.

## ما الذي تغير؟
- إضافة helpers جديدة داخل `src/features/authz/policies.ts`:
  - `canManageAdminSystemRole(...)`
  - `listAdminSystemAssignableRoles(...)`
- تحديث `AdminSystem.tsx` ليستخدم `canManageAdminSystemRole(...)` عند:
  - إنشاء مستخدم جديد
  - تعديل مستخدم موجود
  - إظهار خيارات الأدوار في الواجهة
- الإبقاء على حماية البريد الرئيسي `PRIMARY_SUPER_ADMIN_EMAIL` كحساب bootstrap محمي، لكن إزالة الحصر القديم الذي كان يمنع أي `super_admin` آخر من إدارة `super_admin`.
- ربط صلاحية إنشاء المستخدمين أيضًا بـ `USERS_MANAGE` capability بدل الاعتماد على صلاحية الصفحة ضمنيًا.
- إضافة اختبارات تغطي:
  - أن مالك المنصة يستطيع إدارة كل أدوار AdminSystem
  - أن مشرف النطاق لا يرث صلاحيات إدارة `super` أو `super_admin`

## الأثر
- `super_admin` صار فعليًا مالك المنصة داخل `AdminSystem` أيضًا.
- لم تعد إدارة الأدوار العليا محصورة بمنطق legacy قائم على البريد الأساسي فقط.
- بقي البريد الأساسي محميًا من الحذف/التعطيل كحساب bootstrap احتياطي.
