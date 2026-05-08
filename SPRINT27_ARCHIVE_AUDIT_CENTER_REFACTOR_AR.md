# Sprint 27

تم في هذه المرحلة:

- استخراج منطق صفحة الأرشيف إلى:
  - `src/features/archive/hooks/useArchiveItems.ts`
  - `src/features/archive/services/archiveService.ts`
  - `src/features/archive/types.ts`
- تحديث `src/pages/Archive.tsx` ليصبح أخف ويستهلك hook/service بدل حمل منطق الدمج والحذف والاستعادة والتحقق السحابي داخله.
- تحديث `src/pages/ArchiveCloudListener.tsx` ليعتمد على hook الأرشيف نفسها بدل استماع Firestore مباشر داخل الصفحة.
- استخراج منطق صفحة التدقيق إلى:
  - `src/features/audit/hooks/useTenantAuditFeed.ts`
- تحديث `src/pages/Audit.tsx` ليستهلك feed hook مستقلة بدل احتواء استماع snapshot داخله.
- استخراج منطق مركز تحكم السوبر أدمن إلى:
  - `src/features/super-admin/hooks/useSuperAdminCenter.ts`
  - `src/features/super-admin/services/superAdminCenterService.ts`
- تحديث `src/pages/SuperAdminCenter.tsx` ليصبح واجهة أخف تستخدم hook/service بدلاً من حمل عمليات allowlist والنسخ السحابي والعدادات داخله.

الأثر الهندسي:
- صفحات `Archive` و`Audit` و`SuperAdminCenter` أصبحت أخف وأسهل صيانة.
- القراءة/الكتابة الحساسة في هذه الأسطح لم تعد مبعثرة داخل الصفحات نفسها.
- هذا يمهّد لاختبارات أسهل لاحقًا على طبقات الخدمات والـ hooks بدل اختبار صفحات ضخمة مباشرة.
