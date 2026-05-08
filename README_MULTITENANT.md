# Multi-tenant (Subdomain) setup

## How tenant is resolved
1) **Subdomain** (recommended)
   - `tenant1.<your-domain>` -> tenantId = `tenant1`
   - In local dev you can use `tenant1.localhost` or `tenant1.local` (via hosts file).

   **When you are ready for production** set your base domain in `.env`:
   - `VITE_BASE_DOMAIN=exam.om`
   - then `azaan-9-12.exam.om` will resolve to tenantId `azaan-9-12`.

2) **.env fallback** (local dev)
   - Create a `.env` file next to this README and set:
     - `VITE_TENANT_ID=azaan-9-12`

## Migration (move data from root -> tenants/{tenantId})
If you already had old data in root collections like `teachers`, `exams`, `rooms`, you can migrate them using the built-in tool:

1) Login as **Super Admin**
2) Open: `/migrate`
3) Click **تشغيل النقل الآن**

The tool will copy these collections:
`teachers, exams, rooms, unavailability, roomBlocks, runs, tasks, settings`

> You can enable "حذف المصدر بعد النسخ" only after you confirm everything is working.

## App Check (recommended)
Add reCAPTCHA v3 key in `.env`:

```env
VITE_APP_CHECK_SITE_KEY=YOUR_RECAPTCHA_V3_SITE_KEY
VITE_APP_CHECK_DEBUG=true
```

Then in Firebase Console enable **App Check enforcement** for Firestore.

## Firestore structure
Tenant config must exist at:
- `tenants/{tenantId}/meta/config`

Required fields (minimum):
- `enabled` (boolean)
- `ministryAr` (string)
- `schoolNameAr` (string)
- `systemNameAr` (string)

Optional:
- `logoUrl`, `regionAr`, `wilayatAr`

