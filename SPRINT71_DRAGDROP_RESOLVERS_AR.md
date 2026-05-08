# Sprint 71

- إضافة helper جديدة: `resultsDragDropResolvers.ts`
- نقل حسم هدف الإسقاط من `useResultsDragDropActions` إلى دالة قابلة للاختبار:
  - `resolveResultsSameTypeDropTargetUid(...)`
- تحديث `useResultsDragDropActions` لاستخدام helper الجديدة بدل البحث المباشر داخل `dstCellList`
- إضافة اختبار وحدة مباشر: `resultsDragDropResolvers.test.ts`
