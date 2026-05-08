أضف مجلد functions إلى مشروعك (firebase init functions إذا غير موجود).
ثم ضع الملف functions/src/index.ts كما هو.
بعدها فعّل استدعاء Cloud Functions من الواجهة بإضافة:
  VITE_DISABLE_FUNCTIONS=false
في ملف .env الخاص بالواجهة.
ثم انشر الدوال:
  cd functions
  npm i
  firebase deploy --only functions
