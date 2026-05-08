# Sprint 20

تم في هذه المرحلة نقل جزء مهم من منطق `AdminSystem` من الصفحة نفسها إلى hooks/services مستقلة، مع الإبقاء على قاعدة الصلاحيات:

- `super_admin` = مالك المنصة
- يملك كل الصلاحيات العليا
- `super` لا يرث صلاحيات المالك

## ما تم إضافته
- `src/features/system-admin/types.ts`
- `src/features/system-admin/hooks/useAdminTenants.ts`
- `src/features/system-admin/hooks/useAdminUsers.ts`
- `src/features/system-admin/services/adminSystemShared.ts`
- `src/features/system-admin/services/adminTenantsService.ts`
- `src/features/system-admin/services/adminUsersService.ts`

## النتيجة
- `AdminSystem.tsx` صار أخف من ناحية state wiring والاستماع المباشر
- الاستماع للمدارس والمستخدمين صار داخل hooks
- عمليات إنشاء/تعديل/حذف المدارس والمستخدمين صارت في services مستقلة
- الحفاظ على منطق مالك المنصة داخل طبقة `authz` والعمليات الإدارية
