export interface Env {
  RESEND_API_KEY: string;
  WORKER_TEST_TOKEN: string;
  ACCESS_CODE_SECRET: string;
  ACCESS_GRANT_SECRET: string;
  TEACHERS12_ACCESS_CODES: KVNamespace;
}

const ACCESS_CODE_TTL_SECONDS = 5 * 60;
const ACCESS_CODE_MAX_ATTEMPTS = 5;
const PRIVILEGED_ACCESS_GRANT_TTL_SECONDS = 10 * 60;
const MOE_FROM_EMAIL = "MOE Exam Manager <no-reply@mail.exam-manager-system.com>";
const FIREBASE_PROJECT_ID = "exam-manager-frontend";
const FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

function corsHeaders(): HeadersInit {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization, x-worker-test-token",
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(),
  });
}

async function readJsonBody(request: Request): Promise<any> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return null;
  }

  try {
    return await request.json();
  } catch {
    return null;
  }
}

function unauthorized(): Response {
  return json({
    ok: false,
    error: "UNAUTHORIZED",
  }, 401);
}

function base64UrlToString(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new TextDecoder().decode(bytes);
}

function base64UrlToUint8Array(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function verifyFirebaseIdToken(idToken: string): Promise<{ ok: true; uid: string; email?: string } | { ok: false; error: string }> {
  const parts = idToken.split(".");

  if (parts.length !== 3) {
    return { ok: false, error: "INVALID_FIREBASE_TOKEN_FORMAT" };
  }

  let header: any = null;
  let payload: any = null;

  try {
    header = JSON.parse(base64UrlToString(parts[0]));
    payload = JSON.parse(base64UrlToString(parts[1]));
  } catch {
    return { ok: false, error: "INVALID_FIREBASE_TOKEN_JSON" };
  }

  if (!header || header.alg !== "RS256" || !header.kid) {
    return { ok: false, error: "INVALID_FIREBASE_TOKEN_HEADER" };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;

  if (payload.aud !== FIREBASE_PROJECT_ID) {
    return { ok: false, error: "INVALID_FIREBASE_TOKEN_AUDIENCE" };
  }

  if (payload.iss !== expectedIssuer) {
    return { ok: false, error: "INVALID_FIREBASE_TOKEN_ISSUER" };
  }

  if (!payload.sub || typeof payload.sub !== "string") {
    return { ok: false, error: "INVALID_FIREBASE_TOKEN_SUBJECT" };
  }

  if (typeof payload.exp !== "number" || payload.exp <= nowSeconds) {
    return { ok: false, error: "FIREBASE_TOKEN_EXPIRED" };
  }

  const jwksResponse = await fetch(FIREBASE_JWKS_URL, {
    headers: {
      "accept": "application/json",
    },
  });

  if (!jwksResponse.ok) {
    return { ok: false, error: "FIREBASE_JWKS_FETCH_FAILED" };
  }

  const jwks: any = await jwksResponse.json();
  const jwk = Array.isArray(jwks.keys)
    ? jwks.keys.find((key: any) => key.kid === header.kid)
    : null;

  if (!jwk) {
    return { ok: false, error: "FIREBASE_JWK_NOT_FOUND" };
  }

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["verify"],
  );

  const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlToUint8Array(parts[2]);

  const validSignature = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    signature,
    signedData,
  );

  if (!validSignature) {
    return { ok: false, error: "INVALID_FIREBASE_TOKEN_SIGNATURE" };
  }

  return {
    ok: true,
    uid: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
  };
}

async function assertWorkerAccess(request: Request, env: Env): Promise<Response | null> {
  const testToken = request.headers.get("x-worker-test-token") || "";

  if (env.WORKER_TEST_TOKEN && testToken && testToken === env.WORKER_TEST_TOKEN) {
    return null;
  }

  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return unauthorized();
  }

  const verified = await verifyFirebaseIdToken(match[1]);

  if (!verified.ok) {
    return json({
      ok: false,
      error: verified.error,
    }, 401);
  }

  return null;
}

function isPrivilegedAdminAccessPage(page: string): boolean {
  return page === "GovernorateSuperSystem" || page === "MinistrySuperSystem";
}

async function assertPrivilegedAdminEmailBinding(
  request: Request,
  page: string,
  to: string,
): Promise<Response | null> {
  if (!isPrivilegedAdminAccessPage(page)) return null;

  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) return unauthorized();

  const verified = await verifyFirebaseIdToken(match[1]);

  if (!verified.ok) {
    return json({
      ok: false,
      error: verified.error,
    }, 401);
  }

  const verifiedEmail = String(verified.email || "").trim().toLowerCase();

  if (!verifiedEmail || verifiedEmail !== to) {
    return json({
      ok: false,
      error: "EMAIL_MUST_MATCH_AUTHENTICATED_FIREBASE_ACCOUNT",
    }, 403);
  }

  return null;
}

function assertTestToken(request: Request, env: Env): Response | null {
  const token = request.headers.get("x-worker-test-token") || "";
  if (!env.WORKER_TEST_TOKEN || token !== env.WORKER_TEST_TOKEN) {
    return unauthorized();
  }
  return null;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  if (name.length <= 2) return `${name[0] || "*"}***@${domain}`;
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

function isAllowedAccessPage(
  page: string
): page is "Teachers12" | "Control12" | "StudentSeatRegister12" | "Sync12" | "CloudBackup12" | "CloudStorageHealth12" | "TaskDistributionRun12" | "Settings12" | "SuperSystem" | "AdminSystem" | "SuperAdminArea" | "GovernorateSuperSystem" | "MinistrySuperSystem" {
  return (
    page === "Teachers12" ||
    page === "Control12" ||
    page === "StudentSeatRegister12" ||
    page === "Sync12" ||
    page === "CloudBackup12" ||
    page === "CloudStorageHealth12" ||
    page === "TaskDistributionRun12" ||
    page === "Settings12" ||
        page === "SuperSystem" ||
        page === "AdminSystem" ||
        page === "SuperAdminArea" ||
        page === "GovernorateSuperSystem" ||
        page === "MinistrySuperSystem"
  );
}

function accessPageArabicLabel(page: string): string {
  if (page === "Control12") return "صفحة الكنترول";
  if (page === "StudentSeatRegister12") return "سجل أرقام جلوس الطلبة";
  if (page === "Sync12") return "المزامنة السحابية";
  if (page === "CloudBackup12") return "النسخ السحابي";
  if (page === "CloudStorageHealth12") return "فحص التخزين السحابي";
  if (page === "TaskDistributionRun12") return "تشغيل توزيع المهام للدبلوم";
  if (page === "Settings12") return "إعدادات مركز الدبلوم";
  if (page === "SuperSystem") return "بوابة مالك المنصة";
  if (page === "AdminSystem") return "لوحة مالك المنصة";
  if (page === "SuperAdminArea") return "بوابة مالك المنصة والصلاحيات العليا";
  if (page === "GovernorateSuperSystem") return "\u0628\u0648\u0627\u0628\u0629 \u0645\u0634\u0631\u0641 \u0627\u0644\u0645\u062d\u0627\u0641\u0638\u0629";
  if (page === "MinistrySuperSystem") return "\u0628\u0648\u0627\u0628\u0629 \u0645\u0634\u0631\u0641 \u0627\u0644\u0648\u0632\u0627\u0631\u0629";
  return "مركز إدارة بيانات الكادر التعليمي";
}

function generateSixDigitCode(): string {
  const range = 900000;
  const max = 0x100000000 - (0x100000000 % range);
  const values = new Uint32Array(1);

  let value = 0;
  do {
    crypto.getRandomValues(values);
    value = values[0];
  } while (value >= max);

  return String(100000 + (value % range));
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}

type PrivilegedAccessGrantPayload = {
  v: 1;
  grantId: string;
  email: string;
  tenantId: string;
  page: "GovernorateSuperSystem" | "MinistrySuperSystem";
  issuedAt: number;
  expiresAt: number;
};

function textToBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function generateGrantId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function createPrivilegedAccessGrant(
  env: Env,
  input: {
    email: string;
    tenantId: string;
    page: "GovernorateSuperSystem" | "MinistrySuperSystem";
  },
): Promise<{ token: string; expiresAt: number }> {
  const now = Date.now();

  const payload: PrivilegedAccessGrantPayload = {
    v: 1,
    grantId: generateGrantId(),
    email: input.email.toLowerCase(),
    tenantId: input.tenantId,
    page: input.page,
    issuedAt: now,
    expiresAt: now + PRIVILEGED_ACCESS_GRANT_TTL_SECONDS * 1000,
  };

  const encodedPayload = textToBase64Url(JSON.stringify(payload));
  const signature = await hmacSha256Hex(
    env.ACCESS_GRANT_SECRET,
    `privileged-access-grant:v1:${encodedPayload}`,
  );

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: payload.expiresAt,
  };
}

async function verifyPrivilegedAccessGrantToken(
  env: Env,
  token: string,
): Promise<
  | { ok: true; payload: PrivilegedAccessGrantPayload }
  | { ok: false; error: string }
> {
  if (!env.ACCESS_GRANT_SECRET) {
    return { ok: false, error: "ACCESS_GRANT_SECRET_NOT_CONFIGURED" };
  }

  const parts = String(token || "").trim().split(".");

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, error: "INVALID_ACCESS_GRANT_FORMAT" };
  }

  const expectedSignature = await hmacSha256Hex(
    env.ACCESS_GRANT_SECRET,
    `privileged-access-grant:v1:${parts[0]}`,
  );

  if (!timingSafeEqual(expectedSignature, parts[1])) {
    return { ok: false, error: "INVALID_ACCESS_GRANT_SIGNATURE" };
  }

  let payload: any = null;

  try {
    payload = JSON.parse(base64UrlToString(parts[0]));
  } catch {
    return { ok: false, error: "INVALID_ACCESS_GRANT_PAYLOAD" };
  }

  const validPage = isPrivilegedAdminAccessPage(String(payload?.page || ""));
  const validEmail = isValidEmail(String(payload?.email || ""));
  const validTenantId = typeof payload?.tenantId === "string" && payload.tenantId.trim().length > 0;
  const validGrantId = typeof payload?.grantId === "string" && /^[a-f0-9]{32}$/i.test(payload.grantId);
  const validIssuedAt = typeof payload?.issuedAt === "number" && Number.isFinite(payload.issuedAt);
  const validExpiresAt = typeof payload?.expiresAt === "number" && Number.isFinite(payload.expiresAt);

  if (
    payload?.v !== 1 ||
    !validPage ||
    !validEmail ||
    !validTenantId ||
    !validGrantId ||
    !validIssuedAt ||
    !validExpiresAt
  ) {
    return { ok: false, error: "INVALID_ACCESS_GRANT_PAYLOAD" };
  }

  if (payload.expiresAt <= Date.now()) {
    return { ok: false, error: "ACCESS_GRANT_EXPIRED" };
  }

  if (payload.expiresAt - payload.issuedAt > PRIVILEGED_ACCESS_GRANT_TTL_SECONDS * 1000) {
    return { ok: false, error: "INVALID_ACCESS_GRANT_LIFETIME" };
  }

  return {
    ok: true,
    payload: payload as PrivilegedAccessGrantPayload,
  };
}

function accessCodeKey(tenantId: string, page: string, email: string): string {
  return `teachers12:access-code:${tenantId}:${page}:${email.toLowerCase()}`;
}

async function sendEmail(
  env: Env,
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: true; result: unknown } | { ok: false; status: number; result: unknown }> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: MOE_FROM_EMAIL,
      to: [to],
      subject,
      html,
    }),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      result,
    };
  }

  return {
    ok: true,
    result,
  };
}

async function sendTestEmail(env: Env, to: string): Promise<Response> {
  const result = await sendEmail(
    env,
    to,
    "MOE Teachers12 Worker Test",
    `
      <div style="font-family:Arial,sans-serif;line-height:1.7">
        <h2>MOE Teachers12 Worker Test</h2>
        <p>Cloudflare Worker is able to send email through Resend.</p>
        <p>This is only a test email. No Firebase write was performed.</p>
      </div>
    `,
  );

  if (!result.ok) {
    return json({
      ok: false,
      error: "RESEND_SEND_FAILED",
      status: result.status,
      details: result.result,
    }, 502);
  }

  return json({
    ok: true,
    mode: "RESEND_TEST_EMAIL_ONLY",
    message: "Test email sent through Resend.",
    to,
    resend: result.result,
  });
}

async function requestTeachers12Code(request: Request, env: Env): Promise<Response> {
  const authError = await assertWorkerAccess(request, env);
  if (authError) return authError;

  const body = await readJsonBody(request);

  if (!body || typeof body !== "object") {
    return json({
      ok: false,
      error: "INVALID_JSON_BODY",
    }, 400);
  }

  const tenantId = String(body.tenantId || "").trim();
  const page = String(body.page || "").trim();
  const to = String(body.to || "").trim().toLowerCase();

  if (!tenantId) {
    return json({
      ok: false,
      error: "TENANT_ID_REQUIRED",
    }, 400);
  }

  if (!isAllowedAccessPage(page)) {
    return json({
      ok: false,
      error: "PAGE_NOT_ALLOWED",
    }, 400);
  }

  if (!to || !isValidEmail(to)) {
    return json({
      ok: false,
      error: "VALID_TO_EMAIL_REQUIRED",
    }, 400);
  }

  const privilegedEmailError = await assertPrivilegedAdminEmailBinding(request, page, to);
  if (privilegedEmailError) return privilegedEmailError;

  if (!env.ACCESS_CODE_SECRET) {
    return json({
      ok: false,
      error: "ACCESS_CODE_SECRET_NOT_CONFIGURED",
    }, 500);
  }

  const code = generateSixDigitCode();
  const now = Date.now();
  const expiresAt = now + ACCESS_CODE_TTL_SECONDS * 1000;

  const codeHash = await hmacSha256Hex(
    env.ACCESS_CODE_SECRET,
    `${tenantId}|${page}|${to}|${code}`,
  );

  await env.TEACHERS12_ACCESS_CODES.put(
    accessCodeKey(tenantId, page, to),
    JSON.stringify({
      tenantId,
      page,
      email: to,
      codeHash,
      attempts: 0,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
    }),
    {
      expirationTtl: ACCESS_CODE_TTL_SECONDS,
    },
  );

  const emailResult = await sendEmail(
    env,
    to,
    `رمز الدخول إلى ${accessPageArabicLabel(page)}`,
    `
      <div style="font-family:Arial,sans-serif;line-height:1.8;direction:rtl;text-align:right">
        <h2>MOE Exam Manager</h2>
        <p>رمز الدخول إلى ${accessPageArabicLabel(page)}:</p>
        <div style="font-size:28px;font-weight:bold;letter-spacing:4px;margin:16px 0;direction:ltr;text-align:center">
          ${code}
        </div>
        <p>صلاحية الرمز: 5 دقائق فقط.</p>
        <p>إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.</p>
      </div>
    `,
  );

  if (!emailResult.ok) {
    await env.TEACHERS12_ACCESS_CODES.delete(accessCodeKey(tenantId, page, to));

    return json({
      ok: false,
      error: "RESEND_SEND_FAILED",
      status: emailResult.status,
      details: emailResult.result,
    }, 502);
  }

  return json({
    ok: true,
    mode: "TEACHERS12_REQUEST_CODE_EMAIL",
    message: `${page} access code generated, stored in KV, and sent by email`,
    tenantId,
    page,
    to: maskEmail(to),
    expiresInSeconds: ACCESS_CODE_TTL_SECONDS,
  });
}

async function verifyTeachers12Code(request: Request, env: Env): Promise<Response> {
  const authError = await assertWorkerAccess(request, env);
  if (authError) return authError;

  const body = await readJsonBody(request);

  if (!body || typeof body !== "object") {
    return json({
      ok: false,
      error: "INVALID_JSON_BODY",
    }, 400);
  }

  const tenantId = String(body.tenantId || "").trim();
  const page = String(body.page || "").trim();
  const to = String(body.to || "").trim().toLowerCase();
  const code = String(body.code || "").trim();

  if (!tenantId) {
    return json({
      ok: false,
      error: "TENANT_ID_REQUIRED",
    }, 400);
  }

  if (!isAllowedAccessPage(page)) {
    return json({
      ok: false,
      error: "PAGE_NOT_ALLOWED",
    }, 400);
  }

  if (!to || !isValidEmail(to)) {
    return json({
      ok: false,
      error: "VALID_TO_EMAIL_REQUIRED",
    }, 400);
  }

  const privilegedEmailError = await assertPrivilegedAdminEmailBinding(request, page, to);
  if (privilegedEmailError) return privilegedEmailError;

  if (!/^\d{6}$/.test(code)) {
    return json({
      ok: false,
      error: "VALID_6_DIGIT_CODE_REQUIRED",
    }, 400);
  }

  if (!env.ACCESS_CODE_SECRET) {
    return json({
      ok: false,
      error: "ACCESS_CODE_SECRET_NOT_CONFIGURED",
    }, 500);
  }

  const key = accessCodeKey(tenantId, page, to);
  const storedRaw = await env.TEACHERS12_ACCESS_CODES.get(key);

  if (!storedRaw) {
    return json({
      ok: false,
      error: "CODE_EXPIRED_OR_NOT_FOUND",
    }, 404);
  }

  let stored: any = null;

  try {
    stored = JSON.parse(storedRaw);
  } catch {
    await env.TEACHERS12_ACCESS_CODES.delete(key);

    return json({
      ok: false,
      error: "CORRUPTED_CODE_RECORD",
    }, 500);
  }

  const attempts = Number(stored.attempts || 0);

  if (attempts >= ACCESS_CODE_MAX_ATTEMPTS) {
    await env.TEACHERS12_ACCESS_CODES.delete(key);

    return json({
      ok: false,
      error: "TOO_MANY_ATTEMPTS",
    }, 429);
  }

  const expectedHash = await hmacSha256Hex(
    env.ACCESS_CODE_SECRET,
    `${tenantId}|${page}|${to}|${code}`,
  );

  const isValid = typeof stored.codeHash === "string"
    && timingSafeEqual(stored.codeHash, expectedHash);

  if (!isValid) {
    const nextAttempts = attempts + 1;

    if (nextAttempts >= ACCESS_CODE_MAX_ATTEMPTS) {
      await env.TEACHERS12_ACCESS_CODES.delete(key);

      return json({
        ok: false,
        error: "TOO_MANY_ATTEMPTS",
        attempts: nextAttempts,
        maxAttempts: ACCESS_CODE_MAX_ATTEMPTS,
      }, 429);
    }

    await env.TEACHERS12_ACCESS_CODES.put(
      key,
      JSON.stringify({
        ...stored,
        attempts: nextAttempts,
        lastFailedAt: new Date().toISOString(),
      }),
      {
        expirationTtl: ACCESS_CODE_TTL_SECONDS,
      },
    );

    return json({
      ok: false,
      error: "INVALID_CODE",
      attempts: nextAttempts,
      maxAttempts: ACCESS_CODE_MAX_ATTEMPTS,
    }, 400);
  }

  await env.TEACHERS12_ACCESS_CODES.delete(key);

  if (isPrivilegedAdminAccessPage(page)) {
    if (!env.ACCESS_GRANT_SECRET) {
      return json({
        ok: false,
        error: "ACCESS_GRANT_SECRET_NOT_CONFIGURED",
      }, 500);
    }

    const grant = await createPrivilegedAccessGrant(env, {
      email: to,
      tenantId,
      page: page as "GovernorateSuperSystem" | "MinistrySuperSystem",
    });

    return json({
      ok: true,
      mode: "PRIVILEGED_ADMIN_VERIFY_CODE",
      message: `${page} access code verified successfully`,
      tenantId,
      page,
      to: maskEmail(to),
      accessGranted: true,
      accessGrant: grant.token,
      grantExpiresAt: new Date(grant.expiresAt).toISOString(),
      grantExpiresInSeconds: PRIVILEGED_ACCESS_GRANT_TTL_SECONDS,
    });
  }

  return json({
    ok: true,
    mode: "TEACHERS12_VERIFY_CODE",
    message: `${page} access code verified successfully`,
    tenantId,
    page,
    to: maskEmail(to),
    accessGranted: true,
  });
}

async function verifyPrivilegedAccessGrant(request: Request, env: Env): Promise<Response> {
  const authError = await assertWorkerAccess(request, env);
  if (authError) return authError;

  const body = await readJsonBody(request);

  if (!body || typeof body !== "object") {
    return json({
      ok: false,
      error: "INVALID_JSON_BODY",
    }, 400);
  }

  const tenantId = String(body.tenantId || "").trim();
  const page = String(body.page || "").trim();
  const to = String(body.to || "").trim().toLowerCase();
  const accessGrant = String(body.accessGrant || "").trim();

  if (!tenantId) {
    return json({
      ok: false,
      error: "TENANT_ID_REQUIRED",
    }, 400);
  }

  if (!isPrivilegedAdminAccessPage(page)) {
    return json({
      ok: false,
      error: "PRIVILEGED_PAGE_REQUIRED",
    }, 400);
  }

  if (!to || !isValidEmail(to)) {
    return json({
      ok: false,
      error: "VALID_TO_EMAIL_REQUIRED",
    }, 400);
  }

  if (!accessGrant) {
    return json({
      ok: false,
      error: "ACCESS_GRANT_REQUIRED",
    }, 400);
  }

  const privilegedEmailError = await assertPrivilegedAdminEmailBinding(request, page, to);
  if (privilegedEmailError) return privilegedEmailError;

  const verifiedGrant = await verifyPrivilegedAccessGrantToken(env, accessGrant);

  if (!verifiedGrant.ok) {
    const status = verifiedGrant.error === "ACCESS_GRANT_SECRET_NOT_CONFIGURED" ? 500 : 401;

    return json({
      ok: false,
      error: verifiedGrant.error,
    }, status);
  }

  const payload = verifiedGrant.payload;

  if (
    payload.email !== to ||
    payload.tenantId !== tenantId ||
    payload.page !== page
  ) {
    return json({
      ok: false,
      error: "ACCESS_GRANT_CONTEXT_MISMATCH",
    }, 403);
  }

  return json({
    ok: true,
    mode: "PRIVILEGED_ACCESS_GRANT_VERIFIED",
    accessGranted: true,
    tenantId,
    page,
    to: maskEmail(to),
    grantExpiresAt: new Date(payload.expiresAt).toISOString(),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return json({ ok: true });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "teachers12-access-worker",
        message: "Worker is running",
      });
    }

    if (request.method === "POST" && url.pathname === "/api/teachers12/request-code-dry-run") {
      const body = await readJsonBody(request);

      if (!body || typeof body !== "object") {
        return json({
          ok: false,
          error: "INVALID_JSON_BODY",
        }, 400);
      }

      const tenantId = String(body.tenantId || "").trim();
      const page = String(body.page || "").trim();

      if (!tenantId) {
        return json({
          ok: false,
          error: "TENANT_ID_REQUIRED",
        }, 400);
      }

      if (!isAllowedAccessPage(page)) {
        return json({
          ok: false,
          error: "PAGE_NOT_ALLOWED",
        }, 400);
      }

      return json({
        ok: true,
        mode: "DRY_RUN_ONLY",
        message: "Worker received Teachers12 request successfully. No email sent. No Firebase write.",
        tenantId,
        page,
      });
    }

    if (request.method === "POST" && url.pathname === "/api/test/send-email") {
      const authError = await assertWorkerAccess(request, env);
      if (authError) return authError;

      const body = await readJsonBody(request);

      if (!body || typeof body !== "object") {
        return json({
          ok: false,
          error: "INVALID_JSON_BODY",
        }, 400);
      }

      const to = String(body.to || "").trim();

      if (!to || !isValidEmail(to)) {
        return json({
          ok: false,
          error: "VALID_TO_EMAIL_REQUIRED",
        }, 400);
      }

      return await sendTestEmail(env, to);
    }

    if (request.method === "POST" && url.pathname === "/api/teachers12/request-code") {
      return await requestTeachers12Code(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/teachers12/verify-code") {
      return await verifyTeachers12Code(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/privileged-access/verify-grant") {
      return await verifyPrivilegedAccessGrant(request, env);
    }

    return json({
      ok: false,
      error: "NOT_FOUND",
    }, 404);
  },
};






