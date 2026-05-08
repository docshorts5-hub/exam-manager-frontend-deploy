الخطوة الرابعة عشرة: تحسين ملفات repositories لضمان اتساق Firestore.

ما تم:
- تعديل createTenantArrayRepository لإضافة safeTenantId و safeSubCollection.
- جميع repositories أصبحت تمر عبر tenantId آمن بدل احتمال المسار الفارغ.
- إضافة audit meta في replaceAll لعدد السجلات.
- تعديل teachersRepository.importBatch ليستخدم doc(db, 'tenants', tid, 'teachers', id) بدل path string، ويضيف updatedAt.
- إضافة subscribe إلى examRoomAssignmentsRepository.
- تعديل generalSettingsRepository ليستخدم safeTenantId ويضيف updatedAt عند merge.
- userProfileRepository لم يتم تغييره لأنه يعمل على users/{uid} وليس tenant collection.

استبدل الملفات في:
src/infra/repositories/
