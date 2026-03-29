# Sprint 16 – تنظيف الـ layouts والـ sidebars على أساس capabilities

## ما تم إنجازه
- إزالة الاعتماد على `localStorage` لتحديد الدور داخل:
  - `src/components/RightSidebar.tsx`
  - `src/layout/AppLayout.tsx`
- ربط القوائم الجانبية بطبقة:
  - `authzSnapshot`
  - `capabilities`
- إبراز `super_admin` بصفته **مالك المنصة** داخل مساحات التنقل والعرض.
- تحديث `src/components/AppLayout.tsx` ليستخدم:
  - `isPlatformOwner(...)`
  - `resolvePrimaryRoleLabel(...)`

## الأثر
- تراجع إضافي لاستخدام role strings الصلبة في الواجهة.
- صار ظهور عناصر مثل:
  - الترحيل
  - لوحات الإدارة
  - المزامنة
  - التقارير

  يعتمد على capabilities بدل تخمين الدور من التخزين المحلي.
- أصبح تمييز مالك المنصة بصريًا ووظيفيًا أوضح داخل الـ layout والـ sidebar.

## ملاحظة
- لم تُعد كتابة كل الـ sidebars القديمة في المشروع، لكن الأسطح الأوضح والأكثر حساسية تم نقلها الآن إلى نفس الاتجاه البنيوي الجديد.
