# تقرير التعديلات (Multi‑School + Super Admin System/Support)

تاريخ: 2026-02-27

## الهدف
تهيئة المشروع للعمل **لعدة مدارس** بحيث:
- **لكل مدرسة مستخدم واحد** (Admin/Owner).
- **Super Admin** لديه لوحة نظام (System) لإدارة المدارس وفتح مدرسة للدعم.
- دعم مسار واضح للمدارس عبر `/t/:tenantId/*` مع رجوع آمن وسريع إلى صفحة النظام `/system`.

---

## أهم ما تم تغييره

### 1) إعادة تنظيم المسارات Routes
**قبل:** كل الصفحات داخل `/` مع وجود `/system` داخل نفس الـ Layout.

**بعد:** فصل واضح بين System و Tenant:
- **System (Super فقط):**
  - `/system`
  - `/system/migrate`
- **School/Tenant:**
  - `/t/:tenantId/*` (كل صفحات المدرسة داخل Layout)
- `/` أصبح تحويل ذكي حسب نوع المستخدم.

> الملف: `src/App.tsx`

### 2) إضافة صفحة تحويل ذكية HomeRedirect
عند الدخول إلى `/`:
- Super Admin → `/system`
- مستخدم المدرسة → `/t/{tenantId}`

> الملف: `src/pages/HomeRedirect.tsx`

### 3) تحديث حمايات الدخول (Route Guards)
تم إضافة **TenantRoute** لضمان العزل بين المدارس:
- المستخدم العادي/المدرسة لا يدخل إلا tenant الخاص به.
- السوبر أدمن لا يدخل صفحات مدرسة إلا عند تفعيل Support Mode (تحديد tenant).

> الملف: `src/auth/ProtectedRoute.tsx`

### 4) تحديث القائمة الجانبية داخل Layout
بما أن مسارات المدرسة أصبحت `/t/:tenantId/*`، تم تحديث جميع روابط القائمة لتضيف الـ tenantId تلقائيًا.

> الملف: `src/layout/Layout.tsx`

### 5) تحسين وضع الدعم Support Mode (Claims-based)
تم نقل Support Mode ليعمل عبر **Custom Claims** بدل الاعتماد على localStorage.

**Cloud Functions الجديدة:**
- `startSupportSession({ tenantId, reason?, durationMinutes? })`
- `endSupportSession()`

عند تفعيل الدعم يتم ضبط Claims على حساب السوبر:
- `supportTenantId`
- `supportUntil` (epoch ms)

ثم يقوم العميل بعمل `getIdToken(true)` تلقائيًا لالتقاط الـ Claims الجديدة.

**النتيجة:**
- السوبر يستطيع القراءة لأي مدرسة.
- الكتابة مسموحة فقط عندما يكون Support Mode مفعّل لنفس الـ tenant (ومدة صلاحيته سارية).

> الملف: `src/components/SupportModeBar.tsx`

### 6) تحديث صفحة System (AdminSystem)
عند الضغط على زر فتح المدرسة 📂:
- يتم تفعيل Support Mode للـ tenant
- ثم الانتقال مباشرة إلى `/t/{tenantId}` بدلًا من الرجوع إلى `/`

> الملف: `src/pages/AdminSystem.tsx`

### 7) تحديث Login / Onboarding
- بعد الدخول:
  - Super → `/system`
  - مدرسة → `/t/{tenantId}`
- عند إنهاء onboarding يتم التوجيه لنفس المسار الصحيح.

> الملفات:
- `src/pages/Login.tsx`
- `src/pages/Onboarding.tsx`

---

## طريقة الاستخدام

### مستخدم المدرسة (مستخدم واحد لكل مدرسة)
1) تسجيل الدخول Google.
2) النظام يحول تلقائيًا إلى: `/t/{tenantId}`.
3) جميع صفحات المدرسة تعمل داخل نفس المسار.

### Super Admin
1) تسجيل الدخول Google بحساب دور super.
2) النظام يحول تلقائيًا إلى: `/system`.
3) من صفحة **مدير النظام** اختر مدرسة واضغط زر 📂 لفتحها.
4) سيتم تفعيل الدعم لهذه المدرسة والانتقال إلى: `/t/{tenantId}`.
5) أثناء الدعم سيظهر شريط أعلى الصفحة (Support Mode Bar).
6) للرجوع إلى النظام اضغط **"رجوع للسستم"** (سيُنهي جلسة الدعم من خلال Cloud Function).

---

## ملاحظات تقنية مهمة
- يجب نشر **`firestore.rules`** الموجودة في هذا الملف بعد التعديل (Claims-based).
- يجب نشر Cloud Functions لكي تعمل `startSupportSession/endSupportSession`.
- ما زال يوجد fallback للـ allowlist في AuthContext لتجنب قفل المستخدمين قبل مزامنة الـ claims.

