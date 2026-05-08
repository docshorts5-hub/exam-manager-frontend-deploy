التعديلات المضافة:
1) firestore.rules:
- السماح بقراءة/كتابة teachers, exams, rooms, roomBlocks داخل tenants/{tenantId}/...
2) Teachers.tsx:
- حفظ فوري بعد الاستيراد باستخدام persistTeachersNow(next)
3) Exams.tsx:
- حفظ فوري بعد الاستيراد باستخدام persistExamsNow(next)

سبب المشكلة:
- البيانات كانت تُحفظ مؤجلًا debounce 600ms
- عند التنقل السريع بين الصفحات قد لا يتم الحفظ
- والقواعد كانت تمنع أصلًا الكتابة/القراءة على teachers/exams
