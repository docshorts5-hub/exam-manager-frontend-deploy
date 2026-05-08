الخطوة الثالثة عشرة: تحسين ملفات الخدمات لضمان اتساق المسارات السحابية.

ما تم:
- إضافة safeTenantId في كل خدمة حتى لا يتم الحفظ أو القراءة من tenant فارغ.
- استخدام default عند غياب tenantId.
- الحفاظ على نفس مسارات auditEntity:
  teachers
  rooms
  roomBlocks
  exams
  examRoomAssignments
- إضافة subscribeExamRoomAssignments في examRoomAssignments.service.ts مع fallback إذا كان repository لا يدعم الاشتراك اللحظي.
- حماية save/replace من تمرير قيمة غير Array.

استبدل الملفات في:
src/services/
