# Super Admin Page Fix (Arabic)

## ما المشكلة؟
كانت صفحة `/system` تختفي لأن التطبيق يعتمد على **Custom Claims** لتحديد السوبر أدمن.
حتى لو كان لديك allowlist role=super، بدون Claims (`role=super` و `enabled=true`) لن يتم اعتبار الحساب سوبر في الواجهة.

## ماذا تم تعديله؟
1) **AuthContext.tsx**
- `isSuperAdmin` أصبح يعتمد على الـ Claims **أو** allowlist كـ fallback مؤقت (Bootstrap).
- تمت إضافة منطق **تلقائي**: إذا كان allowlist يقول `super` لكن الـ Claims غير متزامنة، يتم استدعاء Cloud Function `syncMyClaims` مرة واحدة ثم عمل refresh للـ token لتحديث claims.

## المتطلبات
- يجب أن تكون Cloud Functions منشورة (Deploy):
```bash
firebase deploy --only functions
```

## طريقة الاستخدام
1) ادخل بحساب `3asal2030@gmail.com`
2) التطبيق سيحاول تلقائياً تشغيل `syncMyClaims` مرة واحدة عند الحاجة
3) بعد تحديث التوكن ستظهر صفحة السوبر:
- `/system`

### إن لم تظهر مباشرة
- اعمل Logout / Login أو Ctrl+F5 ثم افتح `/system`.

## ملاحظة أمنية
الـ fallback من allowlist للواجهة هو **Bootstrap فقط** لعدم قفل السوبر قبل تزامن claims.
يظل التحكم الحقيقي في الوصول للبيانات حسب Firestore Rules (Claims-based).
