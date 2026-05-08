# Sprint 4 – Repositories for Teachers / Rooms / Exams

تم في هذه المرحلة:

- إنشاء نماذج بيانات أولية في:
  - `src/entities/teacher/model.ts`
  - `src/entities/room/model.ts`
  - `src/entities/exam/model.ts`
- إنشاء repository generic للـ tenant collections:
  - `src/infra/repositories/createTenantArrayRepository.ts`
- إنشاء repositories فعلية لـ:
  - `teachersRepository`
  - `roomsRepository`
  - `examsRepository`
- تحديث الخدمات لتصبح واجهة توافقية فوق repositories بدل الوصول المباشر المبعثر.
- ربط صفحات `Teachers` و`Rooms` و`Exams` بأنواع موحدة من الخدمات بدل تعريف أنواع محلية مكررة.

النتيجة:
- بدأ انتقال طبقة البيانات من service helpers مباشرة إلى Repository Layer قابلة للتوسع.
- أول feature trio (Teachers/Rooms/Exams) صار يمر عبر بنية أوضح، تمهيدًا لنقل hooks والواجهات لاحقًا.
