# Audit أمني لتغيير الصلاحيات (Roles/Permissions)

هذا التحديث يضيف **تسجيل أمني غير قابل للتعديل من الواجهة** لأي تغييرات على:
- `allowlist/{email}` (تغيير `role` / `enabled` / `tenantId`)
- `users/{uid}` (تغيير `roles` أو `status`)
- `tenants/{tenantId}/meta/owner` (تعيين مالك المدرسة لمرة واحدة)

ويتم الحفظ داخل:
- `tenants/{tenantId}/securityAudit/{autoId}`

> **مهم:** الكتابة على `securityAudit` مقفولة من العميل (rules تمنعها)، والكتابة تتم من **Cloud Functions** فقط.

## 1) استبدال قواعد Firestore
- افتح Firebase Console → Firestore → Rules
- استبدل المحتوى بـ `firestore.rules` الموجود مع هذا التحديث
- Publish

## 2) تفعيل Cloud Functions
داخل مشروعك (جذر الريبو) ضع مجلد `functions` كما هو.

ثم نفّذ:
```bash
cd functions
npm i
npm run build
cd ..
firebase deploy --only functions
```

> لازم تكون مسجّل دخول على firebase CLI ومختار نفس مشروع Firebase.

## 3) أين أرى الـ Audit؟
Firestore → Data →
- tenants → (tenantId) → securityAudit

ستجد سجلات فيها:
- `action` مثل: `allowlist.update`, `users.update`, `tenant.owner.set`
- `actor.email` (إن توفر)
- `before` / `after` للتغييرات الحساسة
- `createdAt`

## 4) لماذا هذا “Audit أمني كامل”؟
- التغيير لا يعتمد على الواجهة (حتى لو تم تعديل الواجهة)
- التسجيل يتم من السيرفر (Functions) + غير قابل للحذف/التعديل من العميل
- يلتقط أهم نقاط الصلاحيات: allowlist + users roles + owner
