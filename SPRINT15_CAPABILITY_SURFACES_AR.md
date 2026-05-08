# Sprint 15 – توسيع الاعتماد على capabilities

تم في هذه المرحلة:
- تنظيف مزيد من الصفحات القديمة من الاعتماد المباشر على role strings.
- ربط صفحات Onboarding وSuperPortal وSuperProgramEnter وSupportModeBar بطبقة authz/capabilities.
- تثبيت أن super_admin هو مالك المنصة بصلاحيات كاملة في الأسطح التشغيلية، وليس فقط في السياسات.
- تحديث Gallery وTeachersFirestore لاستخدام الصلاحيات الفعلية بدل localStorage أو البريد الصريح.
- تخفيف بعض منطق Login عبر roleLabel وresolveHomePath.
