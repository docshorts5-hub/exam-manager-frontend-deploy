import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  GoogleAuthProvider,
  OAuthProvider,
  getAdditionalUserInfo,
  getMultiFactorResolver,
  onAuthStateChanged,
  signInWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInWithEmailAndPassword,
  multiFactor,
  TotpMultiFactorGenerator,
  type TotpSecret,
  type MultiFactorResolver,
  signOut,
  type User,
  type UserCredential,
} from "firebase/auth";
import { doc, getDoc, getDocFromCache } from "firebase/firestore";

import { auth, db } from "../firebase/firebase";
import { callFn } from "../services/functionsClient";
import {
  startDeviceTransfer,
  registerVerifiedNewDevice,
} from "../auth/deviceTransfer";
import {
  buildAuthzSnapshot,
  canAccessCapability,
  resolveHomePath,
  resolvePrimaryRoleLabel,
  resolveRoleBadgeStyle,
} from "../features/authz";
import { useI18n } from "../i18n/I18nProvider";
import { QRCodeSVG } from "qrcode.react";
import { startAuthentication } from "@simplewebauthn/browser";
import "./LoginApproved.css";

// ضع صورة الخلفية في هذا المسار:
// src/assets/login-bg.png

// Default to disabling Cloud Functions unless explicitly enabled.
const DISABLE_FUNCTIONS =
  String(import.meta.env.VITE_DISABLE_FUNCTIONS ?? "true") === "true";

const ALLOWLIST_CACHE_PREFIX = "exam-manager:auth:allowlist:";
const ALLOWLIST_READ_TIMEOUT_MS = 3500;
const EMAIL_LINK_STORAGE_KEY = "exam-manager:auth:email-link-address";

type AllowlistDoc = {
  email: string;
  enabled: boolean;
  role: "super_admin" | "ministry_super" | "super" | "exam_super" | "tenant_admin" | "admin" | "user";
  tenantId: string;
};

type Lang = "ar" | "en";

const STR = {
  ar: {
    title: "نظام الامتحانات المدرسية المطور",
    subtitle: "تسجيل دخول آمن للمستخدمين المصرح لهم فقط",
    ministry: "سلطنة عمان - وزارة  التعليم",
    signIn: "Google تسجيل الدخول بواسطة",
    microsoftSignIn: "الدخول بالحساب الوزاري المعتمد Microsoft",
    signedInAs: "تم تسجيل الدخول:",
    status: "الحالة:",
    active: "مفعّل ✅",
    inactive: "غير مفعّل",
    inactiveHint: "(غير موجود في allowlist أو enabled=false)",
    tenant: "الجهة:",
    role: "الصلاحية:",
    refresh: "تحديث الصلاحيات",
    logout: "تسجيل خروج",
    loading: "جاري المعالجة...",
    okGo: "الانتقال للنظام",
    footer: "© جميع الحقوق محفوظة",
    developer: "المطور المعتمد",
    teacher: "الأستاذ: يوسف النعماني",
    errPopupClosed: "تم إغلاق نافذة تسجيل الدخول قبل إكمال العملية.",
    errNotAllowed: "تم تسجيل الدخول لكن حسابك غير مفعّل من مدير النظام.",
    errMoeOnly: "يسمح بالدخول بالحساب الوزاري المعتمد الذي ينتهي بـ @moe.om فقط.",
    errMicrosoftEmailMissing: "تم تسجيل الدخول عبر Microsoft لكن لم نستطع قراءة البريد الوزاري من الحساب.",
    errGeneric: "حدث خطأ. تأكد من إعدادات Firebase وجرّب مرة أخرى.",
  },
  en: {
    title: "Enhanced School Exam System",
    subtitle: "Secure login for authorized users only",
    ministry: "Sultanate of Oman - Ministry of Education",
    signIn: "Sign in with Google",
    microsoftSignIn: "Sign in with MOE Microsoft email",
    signedInAs: "Signed in as:",
    status: "Status:",
    active: "Active ✅",
    inactive: "Inactive",
    inactiveHint: "(Not in allowlist or enabled=false)",
    tenant: "Tenant:",
    role: "Role:",
    refresh: "Refresh permissions",
    logout: "Sign out",
    loading: "Processing...",
    okGo: "Go to app",
    footer: "© All rights reserved",
    developer: "Certified Developer",
    teacher: "Teacher: Youssef Al-Numani",
    errPopupClosed: "Login popup closed before completing.",
    errNotAllowed: "Signed in, but your account is not enabled by the admin.",
    errMoeOnly: "Only @moe.om ministry email accounts are allowed for Microsoft sign-in.",
    errMicrosoftEmailMissing: "Microsoft sign-in succeeded, but the ministry email could not be read.",
    errGeneric: "Something went wrong. Check Firebase setup and try again.",
  },
} as const;


function normalizeLoginEmail(value: any): string {
  return String(value || "").trim().toLowerCase();
}


function isMoeEmail(email: string): boolean {
  return normalizeLoginEmail(email).endsWith("@moe.om");
}

function decodeJwtPayload(token?: string | null): Record<string, any> {
  if (!token || typeof token !== "string") return {};
  const parts = token.split(".");
  if (parts.length < 2) return {};

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = decodeURIComponent(
      Array.from(atob(padded))
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function getEmailFromObject(source: any): string {
  if (!source) return "";
  const candidates = [
    source.email,
    source.mail,
    source.userPrincipalName,
    source.user_principal_name,
    source.preferred_username,
    source.upn,
    source.unique_name,
    source.login_hint,
    source.account,
  ];

  for (const candidate of candidates) {
    const email = normalizeLoginEmail(candidate);
    if (email.includes("@")) return email;
  }

  return "";
}

function safeJsonParse(value: any): any {
  if (!value || typeof value !== "string") return null;
  try { return JSON.parse(value); } catch { return null; }
}

function collectEmailCandidates(value: any, out: string[] = [], seen = new WeakSet<object>(), depth = 0): string[] {
  if (depth > 5 || value == null) return out;

  if (typeof value === "string") {
    const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    for (const match of matches) {
      const email = normalizeLoginEmail(match);
      if (email && !out.includes(email)) out.push(email);
    }
    const parsed = safeJsonParse(value);
    if (parsed) collectEmailCandidates(parsed, out, seen, depth + 1);
    return out;
  }

  if (typeof value !== "object") return out;
  if (seen.has(value)) return out;
  seen.add(value);

  const direct = getEmailFromObject(value);
  if (direct && !out.includes(direct)) out.push(direct);

  for (const key of Object.keys(value)) {
    if (key.toLowerCase().includes("token") && typeof value[key] === "string") {
      const claims = decodeJwtPayload(value[key]);
      collectEmailCandidates(claims, out, seen, depth + 1);
    } else if (key !== "app" && key !== "auth") {
      collectEmailCandidates(value[key], out, seen, depth + 1);
    }
  }

  return out;
}

function pickBestEmail(candidates: string[]): string {
  const clean = candidates.map(normalizeLoginEmail).filter((x, i, arr) => x.includes("@") && arr.indexOf(x) === i);
  return clean.find(isMoeEmail) || clean[0] || "";
}

function getFirebaseUserEmail(user: User | null): string {
  if (!user) return "";

  const direct = normalizeLoginEmail(user.email);
  if (direct) return direct;

  for (const provider of user.providerData || []) {
    const email = normalizeLoginEmail(provider?.email);
    if (email) return email;
  }


  return "";
}

function writeStoredProviderEmail(uid: string | undefined, email: string) {
  if (typeof window === "undefined" || !uid) return;
  const clean = normalizeLoginEmail(email);
  if (!clean) return;
  try {
    window.localStorage.setItem(`exam-manager:microsoft-email:${uid}`, clean);
  } catch {
    // ignore
  }
}

async function getTokenClaimEmail(user: User | null): Promise<string> {
  if (!user) return "";
  try {
    const token = await user.getIdTokenResult(true);
    return getEmailFromObject(token.claims || {});
  } catch {
    return "";
  }
}

async function fetchMicrosoftGraphEmail(accessToken?: string | null): Promise<string> {
  if (!accessToken || typeof fetch === "undefined") return "";

  try {
    const response = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,otherMails", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return "";
    const data = await response.json();
    const direct = getEmailFromObject(data);
    if (direct) return direct;
    if (Array.isArray(data?.otherMails)) {
      for (const item of data.otherMails) {
        const email = normalizeLoginEmail(item);
        if (email.includes("@")) return email;
      }
    }
  } catch {
    // ignore
  }

  return "";
}

async function getMicrosoftLoginEmail(result: UserCredential): Promise<string> {
  const credential = OAuthProvider.credentialFromResult(result) as any;
  const profile = (getAdditionalUserInfo(result)?.profile || {}) as Record<string, any>;
  const tokenResponse = (result as any)?._tokenResponse || {};
  const rawUserInfo = safeJsonParse(tokenResponse.rawUserInfo) || {};
  const idTokenClaims = decodeJwtPayload(credential?.idToken || credential?.oauthIdToken || tokenResponse.oauthIdToken || tokenResponse.idToken);
  const accessTokenClaims = decodeJwtPayload(credential?.accessToken || credential?.oauthAccessToken || tokenResponse.oauthAccessToken || tokenResponse.accessToken);
  const graphEmail = await fetchMicrosoftGraphEmail(credential?.accessToken || credential?.oauthAccessToken || tokenResponse.oauthAccessToken || tokenResponse.accessToken);
  const firebaseClaimEmail = await getTokenClaimEmail(result.user);

  const candidates = collectEmailCandidates({
    firebaseUserEmail: getFirebaseUserEmail(result.user),
    profile,
    tokenResponse,
    rawUserInfo,
    idTokenClaims,
    accessTokenClaims,
    firebaseClaimEmail,
    graphEmail,
  });

  return pickBestEmail(candidates);
}

function normalizeAllowlistData(email: string, raw: Partial<AllowlistDoc> | null): AllowlistDoc | null {
  const key = String(email || "").trim().toLowerCase();


  if (!raw) return null;

  const data: Partial<AllowlistDoc> = { ...raw };

  if (!data.email) data.email = key;
  if (typeof data.enabled !== "boolean") data.enabled = false;

  const r = String((data as any).role ?? "user").trim().toLowerCase();

  if (r === "super_admin" || r === "super admin" || r === "superadmin" || r === "owner" || r === "platform_owner" || r === "platform owner") {
    (data as any).role = "super_admin";
  } else if (r === "ministry_super" || r === "ministry super" || r === "ministry-super") {
    (data as any).role = "ministry_super";
  } else if (r === "super" || r === "governorate_super" || r === "governorate-super" || r === "سوبر المحافظة" || r === "مشرف المحافظة") {
    (data as any).role = "super";
  } else if (
    r === "exam_super" ||
    r === "exam super" ||
    r === "exam-super" ||
    r === "super_exam" ||
    r === "super-exam" ||
    r === "exam_center_admin" ||
    r === "diploma_center_admin" ||
    r === "diploma_super" ||
    r === "center_admin" ||
    r === "control_admin"
  ) {
    (data as any).role = "exam_super";
  } else if (r === "tenant_admin" || r === "tenant admin" || r === "tenant-admin" || r === "school_admin" || r === "school-admin") {
    (data as any).role = "tenant_admin";
  } else if (r === "admin") {
    (data as any).role = "admin";
  } else {
    (data as any).role = "user";
  }

  if (!data.tenantId) data.tenantId = "default";

  return data as AllowlistDoc;
}


function cacheKeyForAllowlist(email: string) {
  return `${ALLOWLIST_CACHE_PREFIX}${String(email || "").trim().toLowerCase()}`;
}

function readCachedAllowlist(email: string): AllowlistDoc | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(cacheKeyForAllowlist(email));
    if (!raw) return normalizeAllowlistData(email, null);
    return normalizeAllowlistData(email, JSON.parse(raw) as Partial<AllowlistDoc>);
  } catch {
    return null;
  }
}

function writeCachedAllowlist(email: string, allow: AllowlistDoc | null) {
  if (typeof window === "undefined" || !allow) return;

  try {
    window.localStorage.setItem(
      cacheKeyForAllowlist(email),
      JSON.stringify({ ...allow, cachedAt: Date.now() })
    );
  } catch {
    // Cache failure must never block login.
  }
}

function withLoginTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), timeoutMs);
  });

  // إذا تأخر Firestore ثم فشل بعد انتهاء المهلة لا نريد Unhandled Promise في Console.
  promise.catch(() => undefined);

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

async function fetchAllowlist(email: string): Promise<AllowlistDoc | null> {
  const key = String(email || "").trim().toLowerCase();
  if (!key) return null;

  const ref = doc(db, "allowlist", key);


  try {
    const snap = await withLoginTimeout(getDoc(ref), ALLOWLIST_READ_TIMEOUT_MS, "allowlist-read-timeout");

    if (!snap.exists()) return normalizeAllowlistData(key, null);

    const allow = normalizeAllowlistData(key, snap.data() as Partial<AllowlistDoc>);
    writeCachedAllowlist(key, allow);
    return allow;
  } catch {
    // عند ضعف الاتصال نحاول قراءة نسخة Firestore المحلية ثم كاش البرنامج.
    try {
      const cachedSnap = await getDocFromCache(ref);
      if (cachedSnap.exists()) {
        const allow = normalizeAllowlistData(key, cachedSnap.data() as Partial<AllowlistDoc>);
        writeCachedAllowlist(key, allow);
        return allow;
      }
    } catch {
      // Ignore cache miss.
    }

    return normalizeAllowlistData(key, null);
  }
}

function cleanRoleValue(role: any) {
  return String(role || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
}

function cleanTenantValue(tenantId: any) {
  return String(tenantId || "").trim();
}

function resolveAllowlistHomePath(user: User | null, allow: AllowlistDoc | null): string {
  const role = cleanRoleValue(allow?.role);
  const tenantId = cleanTenantValue(allow?.tenantId);

  if (!allow?.enabled) return "/login";
  if (role === "super_admin") return "/super";
  if (role === "ministry_super") return "/super-system";
  if (role === "super" || role === "governorate_super") return "/super";
  if (role === "exam_super") return tenantId && tenantId !== "default" ? `/t/${tenantId}/dashboard12` : "/dashboard12";
  if (role === "tenant_admin" || role === "admin") return tenantId && tenantId !== "default" ? `/t/${tenantId}` : "/";

  return resolveHomePath(
    buildAuthzSnapshot({
      user,
      profile: allow,
      tenantId: allow?.tenantId ?? null,
      isSuperAdmin: role === "super_admin",
      isSuper: role === "super" || role === "governorate_super",
    })
  );
}

function persistLoginContext(allow: AllowlistDoc | null, loginEmail?: string) {
  if (typeof window === "undefined" || !allow) return;

  const role = cleanRoleValue(allow.role);
  const rawTenantId = cleanTenantValue(allow.tenantId);
  const tenantId = role === "super_admin" || role === "ministry_super" || role === "super" ? "system" : rawTenantId;
  const email = normalizeLoginEmail(loginEmail || allow.email);

  const clearKeys = [
    "governorateSuperReadOnly",
    "viewAsReadOnly",
    "readOnly",
    "governorateSuperViewTenantId",
    "viewAsTenantId",
    "governorateSuperViewExpiresAt",
  ];

  for (const key of clearKeys) {
    try { window.sessionStorage.removeItem(key); } catch {}
    try { window.localStorage.removeItem(key); } catch {}
  }

  const pairs: Array<[string, string]> = [["loginRole", role], ["loginEmail", email]];
  if (tenantId) {
    pairs.push(["tenantId", tenantId]);
    pairs.push(["effectiveTenantId", tenantId]);
    pairs.push(["selectedTenantId", tenantId]);
    pairs.push(["lastTenantId", tenantId]);
  }

  for (const [key, value] of pairs) {
    try { window.localStorage.setItem(key, value); } catch {}
    try { window.sessionStorage.setItem(key, value); } catch {}
  }
}

function hardRedirectToAllowlistHome(user: User | null, allow: AllowlistDoc | null, loginEmail?: string) {
  const path = resolveAllowlistHomePath(user, allow);
  persistLoginContext(allow, loginEmail);
  if (typeof window !== "undefined") window.location.replace(path);
  return path;
}

function translateRoleLabel(label: string, lang: Lang): string {
  const map: Record<string, { ar: string; en: string }> = {
    "مالك المنصة": { ar: "مالك المنصة", en: "Platform Owner" },
    "سوبر الوزارة": { ar: "سوبر الوزارة", en: "Ministry Super" },
    "سوبر المحافظات": { ar: "سوبر المحافظات", en: "Governorates Super" },
    "مشرف نطاق": { ar: "سوبر المحافظات", en: "Governorates Super" },
    "مدير جهة": { ar: "أدمن المدرسة", en: "School Admin" },
    "مدير": { ar: "أدمن المدرسة", en: "School Admin" },
    "سوبر الامتحانات": { ar: "سوبر الامتحانات", en: "Exam Super" },
    "مستخدم تشغيلي": { ar: "مستخدم تشغيلي", en: "Operational User" },
    "مستخدم": { ar: "مستخدم", en: "User" },
  };
  return map[label]?.[lang] || label;
}

const ENABLE_EMAIL_PASSWORD_TOTP_FLOW = true;

const SHOW_DEV_EMAIL_PASSWORD_LOGIN =
  import.meta.env.DEV &&
  String(
    import.meta.env.VITE_ENABLE_DEV_PASSWORD_LOGIN ?? "false"
  ).toLowerCase() === "true";

type MfaRouteRecoveryState = {
  from: string;
  mfaReauthRequired: true;
};

type StoredMfaReturnPath = {
  path: string;
  expiresAt: number;
};

const MFA_RETURN_PATH_STORAGE_KEY =
  "yr:auth:mfa-return-path:v1";

const MFA_RETURN_PATH_TTL_MS = 15 * 60 * 1000;

function normalizeMfaReturnPath(
  value: unknown
): string | null {
  const pathname = String(value ?? "").trim();

  if (!pathname) {
    return null;
  }

  let decodedPathname = pathname;

  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const pathOnly =
    decodedPathname.split(/[?#]/, 1)[0] ?? "";

  if (
    !decodedPathname.startsWith("/") ||
    decodedPathname.startsWith("//") ||
    decodedPathname.includes("\\") ||
    pathOnly === "/login" ||
    pathOnly.startsWith("/login/") ||
    /[\u0000-\u001f\u007f]/.test(decodedPathname)
  ) {
    return null;
  }

  return pathname;
}

function readMfaRouteRecoveryState(
  value: unknown
): MfaRouteRecoveryState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate =
    value as Record<string, unknown>;

  if (candidate.mfaReauthRequired !== true) {
    return null;
  }

  const from =
    normalizeMfaReturnPath(candidate.from);

  if (!from) {
    return null;
  }

  return {
    from,
    mfaReauthRequired: true,
  };
}

function writeStoredMfaReturnPath(
  value: unknown
): void {
  if (typeof window === "undefined") {
    return;
  }

  const path = normalizeMfaReturnPath(value);

  if (!path) {
    return;
  }

  const payload: StoredMfaReturnPath = {
    path,
    expiresAt:
      Date.now() + MFA_RETURN_PATH_TTL_MS,
  };

  try {
    window.localStorage.setItem(
      MFA_RETURN_PATH_STORAGE_KEY,
      JSON.stringify(payload)
    );
  } catch {
    // Storage failure must not weaken authentication decisions.
  }
}

function clearStoredMfaReturnPath(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(
      MFA_RETURN_PATH_STORAGE_KEY
    );
  } catch {
    // Best-effort cleanup only.
  }
}

function readStoredMfaReturnPath(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(
      MFA_RETURN_PATH_STORAGE_KEY
    );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw) as Partial<StoredMfaReturnPath>;

    const expiresAt =
      Number(parsed?.expiresAt ?? 0);

    const path =
      normalizeMfaReturnPath(parsed?.path);

    if (
      !path ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now()
    ) {
      clearStoredMfaReturnPath();
      return null;
    }

    return path;
  } catch {
    clearStoredMfaReturnPath();
    return null;
  }
}

function consumeStoredMfaReturnPath(
  routeState: MfaRouteRecoveryState | null
): string | null {
  const storedPath =
    readStoredMfaReturnPath();

  clearStoredMfaReturnPath();

  return routeState?.from || storedPath;
}

type TotpSessionState = {
  enrolled: boolean;
  satisfied: boolean;
};

async function readTotpSessionState(
  user: User
): Promise<TotpSessionState> {
  const enrolled =
    multiFactor(user).enrolledFactors.some(
      (factor) =>
        factor.factorId ===
        TotpMultiFactorGenerator.FACTOR_ID
    );

  if (!enrolled) {
    return {
      enrolled: false,
      satisfied: false,
    };
  }

  try {
    const tokenResult =
      await user.getIdTokenResult();

    const firebaseClaims =
      (tokenResult.claims as any)?.firebase;

    const satisfied =
      String(
        firebaseClaims?.sign_in_second_factor ?? ""
      ).toLowerCase() === "totp";

    return {
      enrolled: true,
      satisfied,
    };
  } catch {
    return {
      enrolled: true,
      satisfied: false,
    };
  }
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const routeMfaRecoveryState = useMemo(
    () => readMfaRouteRecoveryState(location.state),
    [location.state]
  );

  const mfaRecoveryHandledUidRef =
    useRef("");

  const { lang, setLang } = useI18n();
  const t = STR[lang as Lang] || STR.ar;

  const [fbUser, setFbUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AllowlistDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [totpEnrollmentRequired, setTotpEnrollmentRequired] = useState(false);
  const [totpEnrollmentSecret, setTotpEnrollmentSecret] = useState<TotpSecret | null>(null);
  const [totpEnrollmentQrUri, setTotpEnrollmentQrUri] = useState("");
  const [totpEnrollmentManualKey, setTotpEnrollmentManualKey] = useState("");
  const [totpEnrollmentCode, setTotpEnrollmentCode] = useState("");
  const [totpEnrollmentUid, setTotpEnrollmentUid] = useState("");
  const [totpChallengeRequired, setTotpChallengeRequired] = useState(false);
  const [totpChallengeResolver, setTotpChallengeResolver] = useState<MultiFactorResolver | null>(null);
  const [totpChallengeEnrollmentId, setTotpChallengeEnrollmentId] = useState("");
  const [totpChallengeCode, setTotpChallengeCode] = useState("");
const [deviceTransferRequested, setDeviceTransferRequested] = useState(false);

const [deviceTransferVerified, setDeviceTransferVerified] = useState(false);

const [deviceTransferNewDeviceReady, setDeviceTransferNewDeviceReady] = useState(false);
const [deviceTransferNewDeviceId, setDeviceTransferNewDeviceId] = useState("");
const [deviceTransferRequestId, setDeviceTransferRequestId] = useState("");
  const [totpChallengeEmail, setTotpChallengeEmail] = useState("");
  const [emailLinkStatus, setEmailLinkStatus] = useState("");
  const [pendingEmailLinkUrl, setPendingEmailLinkUrl] = useState("");
  const [debugLines, setDebugLines] = useState<string[]>([]);

  useEffect(() => {
    if (
      !ENABLE_EMAIL_PASSWORD_TOTP_FLOW ||
      !routeMfaRecoveryState
    ) {
      return;
    }

    writeStoredMfaReturnPath(
      routeMfaRecoveryState.from
    );
  }, [routeMfaRecoveryState]);

  const clearTotpEnrollmentState = () => {
    setTotpEnrollmentRequired(false);
    setTotpEnrollmentSecret(null);
    setTotpEnrollmentQrUri("");
    setTotpEnrollmentManualKey("");
    setTotpEnrollmentCode("");
    setTotpEnrollmentUid("");
  };

  const clearTotpChallengeState = () => {
    setTotpChallengeRequired(false);
    setTotpChallengeResolver(null);
    setTotpChallengeEnrollmentId("");
    setTotpChallengeCode("");
    setTotpChallengeEmail("");
  };
  const signOutForTotpReauthentication = async (
    verifiedEmail: string,
    statusMessage: string
  ) => {
    clearTotpEnrollmentState();
    clearTotpChallengeState();

    setEmailAddress(
      normalizeLoginEmail(verifiedEmail)
    );

    setEmailPassword("");

    await signOut(auth);

    setFbUser(null);
    setProfile(null);
    setLoginEmail("");
    setEmailLinkStatus(statusMessage);
  };

  const prepareUnifiedTotpChallengeFoundation = (
    error: unknown,
    expectedEmail?: string
  ): boolean => {
    if (!ENABLE_EMAIL_PASSWORD_TOTP_FLOW) {
      clearTotpChallengeState();
      setError(
        lang === "ar"
          ? "\u0647\u0630\u0627 \u0627\u0644\u062d\u0633\u0627\u0628 \u064a\u062a\u0637\u0644\u0628 \u062a\u062d\u0642\u0642 TOTP. \u0645\u0633\u0627\u0631 \u0627\u0644\u062a\u062d\u062f\u064a \u0645\u0627 \u0632\u0627\u0644 \u0645\u0639\u0637\u0644\u0627\u064b."
          : "This account requires TOTP verification. The challenge flow remains disabled."
      );
      return false;
    }

    try {
      const resolver = getMultiFactorResolver(auth, error as any);

      const totpHint = resolver.hints.find(
        (hint) =>
          hint.factorId ===
          TotpMultiFactorGenerator.FACTOR_ID
      );

      if (!totpHint?.uid) {
        throw new Error("totp-factor-hint-not-found");
      }

      const normalizedExpectedEmail =
        normalizeLoginEmail(expectedEmail);

      clearTotpEnrollmentState();
      clearTotpChallengeState();

      setTotpChallengeRequired(true);
      setTotpChallengeResolver(resolver);
      setTotpChallengeEnrollmentId(totpHint.uid);
      setTotpChallengeCode("");
      setTotpChallengeEmail(normalizedExpectedEmail);
      setEmailPassword("");
      setError("");

      setEmailLinkStatus(
        lang === "ar"
          ? "\u0623\u062f\u062e\u0644 \u0631\u0645\u0632 TOTP \u0627\u0644\u0645\u0643\u0648\u0646 \u0645\u0646 6 \u0623\u0631\u0642\u0627\u0645 \u0644\u0625\u0643\u0645\u0627\u0644 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644."
          : "Enter the 6-digit TOTP code to complete sign-in."
      );

      return true;
    } catch {
      clearTotpChallengeState();
      setError(t.errGeneric);
      return false;
    }
  };

  const enabled = !!profile?.enabled;

  const authzSnapshot = useMemo(
    () =>
      buildAuthzSnapshot({
        user: fbUser,
        profile,
        tenantId: profile?.tenantId ?? null,
        isSuperAdmin: profile?.role === "super_admin",
        isSuper: profile?.role === "super",
      }),
    [fbUser, profile]
  );

  const roleBadgeBase = resolveRoleBadgeStyle(authzSnapshot);
  const roleBadge = {
    ...roleBadgeBase,
    label: translateRoleLabel(roleBadgeBase.label, lang as Lang),
  };

  const tenantId = profile?.tenantId ?? "";

  const isAllowed = useMemo(() => {
    const email = loginEmail || getFirebaseUserEmail(fbUser) || normalizeLoginEmail(profile?.email);
    if (!email) return false;
    return !!profile?.enabled;
  }, [fbUser, loginEmail, profile]);

  const completeEmailLinkLogin = async (rawEmail: string, href: string) => {
    clearTotpChallengeState();
    const email = normalizeLoginEmail(rawEmail);

    if (!email || !email.includes("@")) {
      setError(
        lang === "ar"
          ? "\u0623\u062f\u062e\u0644 \u0628\u0631\u064a\u062f\u064b\u0627 \u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a\u064b\u0627 \u0635\u062d\u064a\u062d\u064b\u0627."
          : "Enter a valid email address."
      );
      return;
    }

    setBusy(true);
    setError("");
    setEmailLinkStatus("");

    try {
      const result = await signInWithEmailLink(auth, email, href);
      const verifiedEmail = normalizeLoginEmail(result.user.email || email);

      if (!verifiedEmail || verifiedEmail !== email) {
        await signOut(auth);
        setError(
          lang === "ar"
            ? "\u0644\u0645 \u0646\u062a\u0645\u0643\u0646 \u0645\u0646 \u062a\u0623\u0643\u064a\u062f \u0645\u0637\u0627\u0628\u0642\u0629 \u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a."
            : "The verified email address did not match."
        );
        return;
      }

      setLoginEmail(verifiedEmail);
      setEmailAddress(verifiedEmail);
      writeStoredProviderEmail(result.user.uid, verifiedEmail);

      const allow = await fetchAllowlist(verifiedEmail);
      setProfile(allow);

      try {
        window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
      } catch {
        // ignore storage cleanup failure
      }

      setPendingEmailLinkUrl("");

      if (!allow?.enabled) {
        setError(t.errNotAllowed);
        await signOut(auth);
        return;
      }

      if (
        await prepareUnifiedTotpEnrollmentGate(
          result.user,
          verifiedEmail,
          allow
        )
      ) {
        return;
      }

      hardRedirectToAllowlistHome(result.user, allow, verifiedEmail);
    } catch (e: any) {
      if (
        e?.code === "auth/multi-factor-auth-required" &&
        ENABLE_EMAIL_PASSWORD_TOTP_FLOW
      ) {
        prepareUnifiedTotpChallengeFoundation(e, email);
      } else {
        setError(
          lang === "ar"
            ? "\u062a\u0639\u0630\u0631 \u0625\u0643\u0645\u0627\u0644 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0628\u0631\u0627\u0628\u0637 \u0627\u0644\u0628\u0631\u064a\u062f. \u062a\u0623\u0643\u062f \u0645\u0646 \u0623\u0646 \u0627\u0644\u0631\u0627\u0628\u0637 \u0644\u0645 \u062a\u0646\u062a\u0647\u0650 \u0635\u0644\u0627\u062d\u064a\u062a\u0647."
            : "Email-link sign-in could not be completed. Make sure the link has not expired."
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSecureEmailLink = async () => {
    clearTotpChallengeState();
    const email = normalizeLoginEmail(emailAddress);

    if (!email || !email.includes("@")) {
      setError(
        lang === "ar"
          ? "\u0623\u062f\u062e\u0644 \u0628\u0631\u064a\u062f\u064b\u0627 \u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a\u064b\u0627 \u0635\u062d\u064a\u062d\u064b\u0627."
          : "Enter a valid email address."
      );
      return;
    }

    if (
      pendingEmailLinkUrl &&
      isSignInWithEmailLink(auth, pendingEmailLinkUrl)
    ) {
      await completeEmailLinkLogin(email, pendingEmailLinkUrl);
      return;
    }

    setBusy(true);
    setError("");
    setEmailLinkStatus("");

    try {
      const returnUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/login`
          : "https://exam-manager-system.com/login";

      await sendSignInLinkToEmail(auth, email, {
        url: returnUrl,
        handleCodeInApp: true,
      });

      try {
        window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, email);
      } catch {
        // ignore storage failure
      }

      setEmailLinkStatus(
        lang === "ar"
          ? "\u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0627\u0628\u0637 \u062f\u062e\u0648\u0644 \u0622\u0645\u0646 \u0625\u0644\u0649 \u0628\u0631\u064a\u062f\u0643. \u0627\u0641\u062a\u062d \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0644\u0625\u0643\u0645\u0627\u0644 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644."
          : "A secure sign-in link was sent to your email. Open it to complete sign-in."
      );
    } catch {
      setError(
        lang === "ar"
          ? "\u062a\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0631\u0627\u0628\u0637 \u0627\u0644\u062f\u062e\u0648\u0644. \u062a\u0623\u0643\u062f \u0645\u0646 \u0625\u0639\u062f\u0627\u062f\u0627\u062a Firebase Authentication \u0648\u0627\u0644\u0646\u0637\u0627\u0642\u0627\u062a \u0627\u0644\u0645\u0635\u0631\u062d\u0629."
          : "Could not send the sign-in link. Check Firebase Authentication and authorized domains."
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const href = window.location.href;
    if (!isSignInWithEmailLink(auth, href)) return;

    setPendingEmailLinkUrl(href);

    let storedEmail = "";
    try {
      storedEmail = normalizeLoginEmail(
        window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY)
      );
    } catch {
      storedEmail = "";
    }

    if (storedEmail) {
      setEmailAddress(storedEmail);
      void completeEmailLinkLogin(storedEmail, href);
      return;
    }

    setEmailLinkStatus(
      lang === "ar"
        ? "\u0623\u062f\u062e\u0644 \u0646\u0641\u0633 \u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0630\u064a \u0627\u0633\u062a\u0644\u0645 \u0631\u0627\u0628\u0637 \u0627\u0644\u062f\u062e\u0648\u0644\u060c \u062b\u0645 \u0627\u0636\u063a\u0637 \u0627\u0644\u0632\u0631 \u0627\u0644\u0623\u062e\u0636\u0631 \u0644\u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u062a\u062d\u0642\u0642."
        : "Enter the same email that received the sign-in link, then press the green button to complete verification."
    );
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      async (u) => {
        setFbUser(u);
        setError("");
        setProfile(null);

        if (!u) {
          mfaRecoveryHandledUidRef.current = "";
          clearTotpEnrollmentState();
          clearTotpChallengeState();
          setLoginEmail("");
          return;
        }

        let currentEmail =
          getFirebaseUserEmail(u);

        if (!currentEmail) {
          currentEmail =
            await getTokenClaimEmail(u);
        }

        if (currentEmail && u.uid) {
          writeStoredProviderEmail(
            u.uid,
            currentEmail
          );
        }

        setLoginEmail(currentEmail);

        if (!currentEmail) {
          return;
        }

        const recoveryReturnPath =
          ENABLE_EMAIL_PASSWORD_TOTP_FLOW
            ? (
                routeMfaRecoveryState?.from ||
                readStoredMfaReturnPath()
              )
            : null;

        try {
          const allow =
            await fetchAllowlist(currentEmail);

          setProfile(allow);

          if (!allow) {
            if (recoveryReturnPath) {
              try {
                await signOut(auth);
              } catch {
                // Best-effort fail-closed cleanup.
              }

              setFbUser(null);
              setProfile(null);
              setLoginEmail("");
            }

            setError(t.errGeneric);
            return;
          }

          if (
            !recoveryReturnPath ||
            mfaRecoveryHandledUidRef.current ===
              u.uid
          ) {
            return;
          }

          writeStoredMfaReturnPath(
            recoveryReturnPath
          );

          if (!allow.enabled) {
            clearStoredMfaReturnPath();

            try {
              await signOut(auth);
            } catch {
              // Best-effort fail-closed cleanup.
            }

            setFbUser(null);
            setProfile(null);
            setLoginEmail("");
            setEmailPassword("");
            setError(t.errNotAllowed);
            return;
          }

          mfaRecoveryHandledUidRef.current =
            u.uid;

          const totpSessionState =
            await readTotpSessionState(u);

          if (
            totpSessionState.enrolled &&
            !totpSessionState.satisfied
          ) {
            await signOutForTotpReauthentication(
              currentEmail,
              lang === "ar"
                ? "\u062a\u062a\u0637\u0644\u0628 \u0647\u0630\u0647 \u0627\u0644\u062c\u0644\u0633\u0629 \u0627\u0644\u062a\u062d\u0642\u0642 \u0628\u0631\u0645\u0632 TOTP. \u0633\u062c\u0651\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649 \u062b\u0645 \u0623\u062f\u062e\u0644 \u0631\u0645\u0632 \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629."
                : "This session requires TOTP verification. Sign in again and enter your authentication code."
            );

            return;
          }

          if (!totpSessionState.enrolled) {
            const enrollmentRequired =
              await prepareUnifiedTotpEnrollmentGate(
                u,
                currentEmail,
                allow
              );

            if (enrollmentRequired) {
              return;
            }
          }
        } catch {
          mfaRecoveryHandledUidRef.current =
            "";

          if (recoveryReturnPath) {
            try {
              await signOut(auth);
            } catch {
              // Best-effort fail-closed cleanup.
            }

            setFbUser(null);
            setProfile(null);
            setLoginEmail("");
            setEmailPassword("");
          }

          setError(t.errGeneric);
        }
      }
    );

    return () => unsub();
  }, [
    lang,
    routeMfaRecoveryState,
    t.errGeneric,
    t.errNotAllowed,
  ]);  const prepareTotpEnrollmentFoundation = async (
    authenticatedUser: NonNullable<typeof auth.currentUser>,
    verifiedEmail: string
  ) => {
    const mfaUser = multiFactor(authenticatedUser);

    const hasTotpEnrollment = mfaUser.enrolledFactors.some(
      (factor) =>
        factor.factorId === TotpMultiFactorGenerator.FACTOR_ID
    );

    if (hasTotpEnrollment) {
      clearTotpEnrollmentState();

      return {
        enrollmentRequired: false,
      };
    }

    const multiFactorSession = await mfaUser.getSession();

    const secret = await TotpMultiFactorGenerator.generateSecret(
      multiFactorSession
    );

    const qrUri = secret.generateQrCodeUrl(
      verifiedEmail,
      "YR Exam Manager"
    );

    setTotpEnrollmentRequired(true);
    setTotpEnrollmentSecret(secret);
    setTotpEnrollmentQrUri(qrUri);
    setTotpEnrollmentManualKey(secret.secretKey);
    setTotpEnrollmentCode("");
    setTotpEnrollmentUid(authenticatedUser.uid);

    return {
      enrollmentRequired: true,
    };
  };

  const prepareUnifiedTotpEnrollmentGate = async (
    authenticatedUser: NonNullable<typeof auth.currentUser>,
    verifiedEmail: string,
    allow: AllowlistDoc | null
  ): Promise<boolean> => {
    if (!ENABLE_EMAIL_PASSWORD_TOTP_FLOW) {
      return false;
    }

    const normalizedEmail = normalizeLoginEmail(verifiedEmail);

    if (!normalizedEmail || !allow?.enabled) {
      throw new Error("invalid-unified-totp-enrollment-context");
    }

    const pendingEnrollmentMatchesUser =
      totpEnrollmentRequired &&
      !!totpEnrollmentSecret &&
      !!totpEnrollmentQrUri &&
      !!totpEnrollmentManualKey &&
      totpEnrollmentUid === authenticatedUser.uid;

    if (!pendingEnrollmentMatchesUser) {
      clearTotpEnrollmentState();

      const enrollmentState =
        await prepareTotpEnrollmentFoundation(
          authenticatedUser,
          normalizedEmail
        );

      if (!enrollmentState.enrollmentRequired) {
        return false;
      }
    }

    setFbUser(authenticatedUser);
    setLoginEmail(normalizedEmail);
    setEmailAddress(normalizedEmail);
    setProfile(allow);
    setEmailPassword("");
    setError("");

    setEmailLinkStatus(
      lang === "ar"
        ? "\u062a\u0645 \u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u062d\u0633\u0627\u0628. \u064a\u062c\u0628 \u0625\u0639\u062f\u0627\u062f TOTP \u0642\u0628\u0644 \u0641\u062a\u062d \u0627\u0644\u0646\u0638\u0627\u0645."
        : "Account verified. TOTP setup is required before system access is allowed."
    );

    return true;
  };

  function createNewDeviceIdentity() {
  const deviceId =
    `device_${crypto.randomUUID()}`;

  const platform =
    navigator.platform || "unknown";

  const browser =
    navigator.userAgent || "unknown";

  return {
    deviceId,
    platform,
    browser,
    createdAt: new Date().toISOString(),
  };
}
const handleNewDeviceRegistration = async () => {
  if (!deviceTransferVerified) {
    setError(
      lang === "ar"
        ? "يجب التحقق من الهاتف الحالي أولاً."
        : "Current phone verification is required first."
    );
    return;
  }

  const currentUser = auth.currentUser;

  if (!currentUser?.uid || !deviceTransferRequestId) {
    setError(
      lang === "ar"
        ? "تعذر إكمال ربط الهاتف الجديد."
        : "Unable to complete new device linking."
    );
    return;
  }

  const device = createNewDeviceIdentity();

  const trustedDevice = {
    deviceId: device.deviceId,
    deviceName: "New phone",
    platform: device.platform,
    browser: device.browser,
    status: "active" as const,
    authMethod: "totp" as const,
    linkedAt: new Date(),
    createdBy: currentUser.uid,
  };

  await registerVerifiedNewDevice(
    {
      requestId: deviceTransferRequestId,
      userId: currentUser.uid,
      newDeviceId: device.deviceId,
      status: "verified",
      createdAt: new Date(),
    },
    trustedDevice
  );

  setDeviceTransferNewDeviceId(device.deviceId);
  setDeviceTransferNewDeviceReady(true);

  setEmailLinkStatus(
    lang === "ar"
      ? `تم ربط الهاتف الجديد بنجاح. معرف الجهاز: ${device.deviceId}`
      : `New phone linked successfully. Device ID: ${device.deviceId}`
  );};
const handleTotpChallengeConfirm = async () => {
    if (!ENABLE_EMAIL_PASSWORD_TOTP_FLOW || busy) {
      return;
    }

    const verificationCode = String(totpChallengeCode || "")
      .replace(/\D/g, "")
      .slice(0, 6);

    setError("");
    setEmailLinkStatus("");

    if (verificationCode.length !== 6) {
      setError(
        lang === "ar"
          ? "\u0623\u062f\u062e\u0644 \u0631\u0645\u0632\u0627\u064b \u0635\u062d\u064a\u062d\u0627\u064b \u0645\u0643\u0648\u0646\u0627\u064b \u0645\u0646 6 \u0623\u0631\u0642\u0627\u0645."
          : "Enter a valid 6-digit authentication code."
      );
      return;
    }

    if (
      !totpChallengeRequired ||
      !totpChallengeResolver ||
      !totpChallengeEnrollmentId
    ) {
      clearTotpChallengeState();
      setError(t.errGeneric);
      return;
    }

    setBusy(true);

    try {
      const assertion =
        TotpMultiFactorGenerator.assertionForSignIn(
          totpChallengeEnrollmentId,
          verificationCode
        );

      const result = await totpChallengeResolver.resolveSignIn(
        assertion
      );

      const resolvedUser = result.user;

      let verifiedEmail = getFirebaseUserEmail(resolvedUser);

      if (!verifiedEmail) {
        verifiedEmail = await getTokenClaimEmail(resolvedUser);
      }

      verifiedEmail = normalizeLoginEmail(verifiedEmail);

      if (
        !verifiedEmail ||
        (totpChallengeEmail &&
          verifiedEmail !== totpChallengeEmail)
      ) {
        throw new Error("totp-challenge-email-mismatch");
      }

      const tokenResult = await resolvedUser.getIdTokenResult();
      const firebaseClaims =
        (tokenResult.claims as any)?.firebase;

      const satisfiedFactor = String(
        firebaseClaims?.sign_in_second_factor ?? ""
      ).toLowerCase();

      if (satisfiedFactor !== "totp") {
        throw new Error("totp-second-factor-not-satisfied");
      }

      const allow = await fetchAllowlist(verifiedEmail);

      if (!allow?.enabled) {
        clearTotpChallengeState();
        clearTotpEnrollmentState();
        await signOut(auth);
        setFbUser(null);
        setProfile(null);
        setLoginEmail("");
        setEmailPassword("");
        setError(t.errNotAllowed);
        return;
      }

      clearTotpChallengeState();
      clearTotpEnrollmentState();
      setFbUser(resolvedUser);
      setProfile(allow);
      setLoginEmail(verifiedEmail);
      setEmailAddress(verifiedEmail);
      setEmailPassword("");

      setEmailLinkStatus(
        lang === "ar"
          ? "\u062a\u0645 \u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0631\u0645\u0632 TOTP \u0628\u0646\u062c\u0627\u062d. \u062c\u0627\u0631\u064d \u0641\u062a\u062d \u0627\u0644\u0646\u0638\u0627\u0645."
          : "TOTP verification succeeded. Opening the system."
      );

      if (deviceTransferRequested) {
        setDeviceTransferVerified(true);
        setEmailLinkStatus(
          lang === "ar"
            ? "تم التحقق من الهاتف الحالي. يمكنك الآن إضافة الهاتف الجديد."
            : "Current phone verified. You can now add the new phone."
        );
        return;
      }
      const mfaReturnPath =
        consumeStoredMfaReturnPath(
          routeMfaRecoveryState
        ) ||
        resolveAllowlistHomePath(
          resolvedUser,
          allow
        );

      navigate(mfaReturnPath, {
        replace: true,
      });
    } catch {
      clearTotpChallengeState();
      clearTotpEnrollmentState();

      try {
        await signOut(auth);
      } catch {
        // Best-effort cleanup only.
      }

      setFbUser(null);
      setProfile(null);
      setLoginEmail("");
      setEmailPassword("");

      setError(
        lang === "ar"
          ? "\u062a\u0639\u0630\u0631 \u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0631\u0645\u0632 TOTP. \u0633\u062c\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649 \u0648\u062d\u0627\u0648\u0644 \u0645\u062c\u062f\u062f\u0627\u064b."
          : "TOTP verification failed. Sign in again and retry."
      );
    } finally {
      setBusy(false);
    }
  };
  const handleTotpEnrollmentConfirm = async () => {
    if (!ENABLE_EMAIL_PASSWORD_TOTP_FLOW || busy) {
      return;
    }

    const authenticatedUser = auth.currentUser;
    const verificationCode = String(totpEnrollmentCode || "")
      .replace(/\D/g, "")
      .slice(0, 6);

    setError("");
    setEmailLinkStatus("");

    if (verificationCode.length !== 6) {
      setError(
        lang === "ar"
          ? "\u0623\u062f\u062e\u0644 \u0631\u0645\u0632\u0627\u064b \u0635\u062d\u064a\u062d\u0627\u064b \u0645\u0643\u0648\u0646\u0627\u064b \u0645\u0646 6 \u0623\u0631\u0642\u0627\u0645."
          : "Enter a valid 6-digit authentication code."
      );
      return;
    }

    if (
      !authenticatedUser ||
      !fbUser ||
      authenticatedUser.uid !== fbUser.uid ||
      totpEnrollmentUid !== authenticatedUser.uid ||
      !profile?.enabled ||
      !totpEnrollmentRequired ||
      !totpEnrollmentSecret
    ) {
      clearTotpEnrollmentState();
      setError(t.errGeneric);
      return;
    }

    setBusy(true);

    try {
      let verifiedEmail = getFirebaseUserEmail(
        authenticatedUser
      );

      if (!verifiedEmail) {
        verifiedEmail = await getTokenClaimEmail(
          authenticatedUser
        );
      }

      verifiedEmail = normalizeLoginEmail(verifiedEmail);

      if (!verifiedEmail) {
        throw new Error("missing-verified-firebase-email");
      }

      const allow = await fetchAllowlist(verifiedEmail);

      if (!allow?.enabled) {
        clearTotpEnrollmentState();
        await signOut(auth);
        setFbUser(null);
        setProfile(null);
        setLoginEmail("");
        setError(t.errNotAllowed);
        return;
      }

      const mfaUser = multiFactor(authenticatedUser);

      const alreadyEnrolled = mfaUser.enrolledFactors.some(
        (factor) =>
          factor.factorId ===
          TotpMultiFactorGenerator.FACTOR_ID
      );

      if (alreadyEnrolled) {
        await signOutForTotpReauthentication(
          verifiedEmail,
          lang === "ar"
            ? "\u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629 \u0627\u0644\u062b\u0646\u0627\u0626\u064a\u0629 TOTP \u0645\u0641\u0639\u0644\u0629 \u0628\u0627\u0644\u0641\u0639\u0644. \u0633\u062c\u0651\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649 \u0648\u0623\u062f\u062e\u0644 \u0631\u0645\u0632 TOTP \u0644\u0625\u0643\u0645\u0627\u0644 \u0641\u062a\u062d \u0627\u0644\u0646\u0638\u0627\u0645."
            : "TOTP is already enabled. Sign in again and enter your TOTP code to open the system."
        );

        return;
      }      const assertion =
        TotpMultiFactorGenerator.assertionForEnrollment(
          totpEnrollmentSecret,
          verificationCode
        );

      await mfaUser.enroll(
        assertion,
        "YR Exam Manager TOTP"
      );

      await authenticatedUser.getIdToken(true);

      await signOutForTotpReauthentication(
        verifiedEmail,
        lang === "ar"
          ? "\u062a\u0645 \u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629 \u0627\u0644\u062b\u0646\u0627\u0626\u064a\u0629 \u0628\u0646\u062c\u0627\u062d. \u0633\u062c\u0651\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649 \u0648\u0623\u062f\u062e\u0644 \u0631\u0645\u0632 TOTP \u0644\u0625\u0646\u0634\u0627\u0621 \u062c\u0644\u0633\u0629 \u0645\u062d\u0645\u064a\u0629."
          : "Two-factor authentication was enabled successfully. Sign in again and enter your TOTP code to create a protected session."
      );
    } catch {
      clearTotpEnrollmentState();

      try {
        await signOut(auth);
      } catch {
        // Best-effort cleanup only.
      }

      setFbUser(null);
      setProfile(null);
      setLoginEmail("");
      setEmailPassword("");

      setError(
        lang === "ar"
          ? "\u062a\u0639\u0630\u0631 \u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629 \u0627\u0644\u062b\u0646\u0627\u0626\u064a\u0629. \u0633\u062c\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649 \u0648\u062d\u0627\u0648\u0644 \u0645\u062c\u062f\u062f\u0627\u064b."
          : "Two-factor authentication could not be enabled. Sign in again and retry."
      );
    } finally {
      setBusy(false);
    }
  };
  const handleEmailPasswordSignIn = async () => {
    const enteredEmail = normalizeLoginEmail(emailAddress);
    const enteredPassword = String(emailPassword || "");

    setBusy(true);
    setError("");
    setProfile(null);
    setDebugLines([]);
    setEmailLinkStatus("");
    clearTotpEnrollmentState();
    clearTotpChallengeState();

    let authenticatedUid = "";

    try {
      if (!enteredEmail || !enteredPassword) {
        setError(t.errGeneric);
        return;
      }

      const result = await signInWithEmailAndPassword(
        auth,
        enteredEmail,
        enteredPassword
      );

      authenticatedUid = String(result.user.uid || "");

      const verifiedEmail = normalizeLoginEmail(result.user.email);

      if (!verifiedEmail || verifiedEmail !== enteredEmail) {
        await signOut(auth);
        setError(t.errGeneric);
        return;
      }

      const allow = await fetchAllowlist(verifiedEmail);

      if (!allow?.enabled) {
        await signOut(auth);
        setError(t.errNotAllowed);
        return;
      }


      if (
        await prepareUnifiedTotpEnrollmentGate(
          result.user,
          verifiedEmail,
          allow
        )
      ) {
        return;
      }
      setFbUser(result.user);
      setLoginEmail(verifiedEmail);
      setProfile(allow);
      setEmailPassword("");

      setEmailLinkStatus(
        lang === "ar"
          ? "\u062a\u0645 \u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0628\u0631\u064a\u062f \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0628\u0646\u062c\u0627\u062d. \u0633\u064a\u0628\u0642\u0649 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u0627\u0631 \u0645\u0639\u0637\u0644\u0627\u064b \u062d\u062a\u0649 \u0627\u0643\u062a\u0645\u0627\u0644 \u062d\u0645\u0627\u064a\u0629 TOTP \u0628\u0627\u0644\u0643\u0627\u0645\u0644."
          : "Email and password were verified successfully. This flow will remain disabled until full TOTP protection is complete."
      );
    } catch (e: any) {
      if (e?.code === "auth/multi-factor-auth-required") {
        prepareUnifiedTotpChallengeFoundation(
          e,
          enteredEmail
        );

        return;
      }
      if (
        authenticatedUid &&
        auth.currentUser?.uid === authenticatedUid
      ) {
        try {
          await signOut(auth);
        } catch {
          // Best-effort cleanup only.
        }
      }

      clearTotpChallengeState();

      // Keep the public error generic to reduce account enumeration signals.
      setError(t.errGeneric);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    clearTotpChallengeState();
    setBusy(true);
    setError("");
    setProfile(null);
    setDebugLines([]);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const res = await signInWithPopup(auth, provider);
      const email = normalizeLoginEmail(res.user.email);
      setLoginEmail(email);

      if (!email) {
        setError(t.errGeneric);
        await signOut(auth);
        setBusy(false);
        return;
      }

      
      

      const allow = await fetchAllowlist(email);
      setProfile(allow);

      if (!DISABLE_FUNCTIONS) {
        try {
          const sync = callFn<any, any>("syncMyClaims");
          await sync({});
          await res.user.getIdToken(true);
        } catch {
          // ignore
        }
      }

      const effectiveAllow = allow;

      if (!effectiveAllow?.enabled) {
        try {
          await signOut(auth);
        } catch {
          // Best-effort Firebase cleanup; local auth state still fails closed below.
        }
        setFbUser(null);
        setProfile(null);
        setLoginEmail("");
        setDebugLines([]);
        setError(t.errNotAllowed);
        return;
      } else {
        if (
          await prepareUnifiedTotpEnrollmentGate(
            res.user,
            email,
            effectiveAllow
          )
        ) {
          return;
        }

        navigate(resolveAllowlistHomePath(res.user, effectiveAllow), { replace: true });
      }
    } catch (e: any) {
      if (
        e?.code === "auth/multi-factor-auth-required" &&
        ENABLE_EMAIL_PASSWORD_TOTP_FLOW
      ) {
        prepareUnifiedTotpChallengeFoundation(e);
      } else if (e?.code === "auth/popup-closed-by-user") {
        setError(t.errPopupClosed);
      } else {
        setError(t.errGeneric);
      }
    } finally {
      setBusy(false);
    }
  };


  const buildMicrosoftDebugLines = async (result: UserCredential): Promise<string[]> => {
    const credential = OAuthProvider.credentialFromResult(result) as any;
    const profile = (getAdditionalUserInfo(result)?.profile || {}) as Record<string, any>;
    const tokenResponse = (result as any)?._tokenResponse || {};
    const rawUserInfo = safeJsonParse(tokenResponse.rawUserInfo) || {};
    const idTokenClaims = decodeJwtPayload(credential?.idToken || credential?.oauthIdToken || tokenResponse.oauthIdToken || tokenResponse.idToken);
    const graphEmail = await fetchMicrosoftGraphEmail(credential?.accessToken || credential?.oauthAccessToken || tokenResponse.oauthAccessToken || tokenResponse.accessToken);
    const candidates = collectEmailCandidates({ user: result.user, profile, tokenResponse, rawUserInfo, idTokenClaims, graphEmail });
    return [
      `firebase user.email: ${normalizeLoginEmail(result.user.email) || "—"}`,
      `providerData.email: ${normalizeLoginEmail(result.user.providerData?.find((p) => p?.email)?.email) || "—"}`,
      `profile email fields: ${getEmailFromObject(profile) || "—"}`,
      `rawUserInfo email fields: ${getEmailFromObject(rawUserInfo) || "—"}`,
      `idToken email fields: ${getEmailFromObject(idTokenClaims) || "—"}`,
      `Graph /me email: ${graphEmail || "—"}`,
      `all candidates: ${candidates.length ? candidates.join(" | ") : "—"}`,
      `firebase uid: ${result.user.uid || "—"}`,
    ];
  };

  const handleMicrosoft = async () => {
    clearTotpChallengeState();
    setBusy(true);
    setError("");
    setProfile(null);
    setDebugLines([]);

    try {
      const provider = new OAuthProvider("microsoft.com");
      provider.addScope("openid");
      provider.addScope("email");
      provider.addScope("profile");
      // لا نطلب User.Read حتى لا تظهر شاشة موافقة المسؤول.
      // البريد سيُقرأ من ID Token claims: email / preferred_username / upn.
      provider.setCustomParameters({
        // مهم جدًا: تطبيق Microsoft داخل الوزارة Single-tenant،
        // لذلك يجب إجبار Firebase على استخدام tenant الوزارة بدل endpoint الافتراضي /common.
        // بدون هذا يظهر خطأ AADSTS50194: not configured as a multi-tenant application.
        tenant: "04b4cb5d-cc41-401f-bd9d-4ca8a31a5c2f",
        prompt: "select_account",
        domain_hint: "moe.om",
      });

      const res = await signInWithPopup(auth, provider);
      setDebugLines(await buildMicrosoftDebugLines(res));
      const email = await getMicrosoftLoginEmail(res);
      setLoginEmail(email);
      if (email) writeStoredProviderEmail(res.user.uid, email);

      if (!email) {
        setError(t.errMicrosoftEmailMissing);
        await signOut(auth);
        setBusy(false);
        return;
      }

      if (!isMoeEmail(email)) {
        setError(t.errMoeOnly);
        await signOut(auth);
        setBusy(false);
        return;
      }

      
      

      const allow = await fetchAllowlist(email);
      setProfile(allow);

      if (!DISABLE_FUNCTIONS) {
        try {
          const sync = callFn<any, any>("syncMyClaims");
          await sync({});
          await res.user.getIdToken(true);
        } catch {
          // ignore
        }
      }

      const effectiveAllow = allow;

      if (!effectiveAllow?.enabled) {
        try {
          await signOut(auth);
        } catch {
          // Best-effort Firebase cleanup; local auth state still fails closed below.
        }
        setFbUser(null);
        setProfile(null);
        setLoginEmail("");
        setDebugLines([]);
        setError(t.errNotAllowed);
        return;
      } else {
        if (
          await prepareUnifiedTotpEnrollmentGate(
            res.user,
            email,
            effectiveAllow
          )
        ) {
          return;
        }

        hardRedirectToAllowlistHome(res.user, effectiveAllow, email);
      }
    } catch (e: any) {
      if (
        e?.code === "auth/multi-factor-auth-required" &&
        ENABLE_EMAIL_PASSWORD_TOTP_FLOW
      ) {
        prepareUnifiedTotpChallengeFoundation(e);
      } else if (e?.code === "auth/popup-closed-by-user") {
        setError(t.errPopupClosed);
      } else {
        setError(t.errGeneric);
      }
    } finally {
      setBusy(false);
    }
  };

  const refreshPermissions = async () => {
    let currentEmail = loginEmail || getFirebaseUserEmail(fbUser);
    if (!currentEmail) currentEmail = await getTokenClaimEmail(fbUser);
    if (!fbUser || !currentEmail) return;
    setLoginEmail(currentEmail);

    setBusy(true);
    setError("");

    try {
      
      

      const allow = await fetchAllowlist(currentEmail);
      setProfile(allow);

      if (!DISABLE_FUNCTIONS) {
        try {
          try {
            const bootstrap = callFn<any, any>("bootstrapOwner");
            await bootstrap({});
          } catch {
            // ignore
          }

          const sync = callFn<any, any>("syncMyClaims");
          await sync({});
          await fbUser.getIdToken(true);
        } catch {
          // ignore
        }
      }

      const effectiveAllow = allow;

      if (effectiveAllow?.enabled) {
        if (
          await prepareUnifiedTotpEnrollmentGate(
            fbUser,
            currentEmail,
            effectiveAllow
          )
        ) {
          return;
        }

        navigate(resolveAllowlistHomePath(fbUser, effectiveAllow), { replace: true });
      }
    } catch {
      setError(t.errGeneric);
    } finally {
      setBusy(false);
    }
  };

  const handleWebAuthn = async () => {
    clearTotpChallengeState();
    setBusy(true);
    setError("");
    setProfile(null);
    setDebugLines([]);

    try {
      const begin = await callFn(
        "webauthnBeginAuthentication"
      )({});

      const credential =
        await startAuthentication({
          optionsJSON: begin,
        });

      await callFn(
        "webauthnVerifyAuthentication"
      )({
        credential,
      });

      const user = auth.currentUser;

      if (!user) {
        setError(t.errGeneric);
        return;
      }

      await user.reload();

      const email =
        normalizeLoginEmail(user.email);

      setLoginEmail(email);

      if (!email) {
        setError(t.errGeneric);
        await signOut(auth);
        return;
      }

      const allow =
        await fetchAllowlist(email);

      setProfile(allow);

      if (!DISABLE_FUNCTIONS) {
        try {
          const sync =
            callFn<any, any>("syncMyClaims");

          await sync({});
          await user.getIdToken(true);
        } catch {
          // fail closed below if allowlist denies access
        }
      }

      if (!allow?.enabled) {
        await signOut(auth);

        setFbUser(null);
        setProfile(null);
        setLoginEmail("");

        setError(t.errNotAllowed);
        return;
      }

      if (
        await prepareUnifiedTotpEnrollmentGate(
          user,
          email,
          allow
        )
      ) {
        return;
      }

      navigate(
        resolveAllowlistHomePath(
          user,
          allow
        ),
        { replace: true }
      );

    } catch (error) {
      console.error(
        "WEBAUTHN_AUTHENTICATION_FAILED",
        error
      );

      setError(
        String(
          error instanceof Error
            ? error.message
            : error
        )
      );

    } finally {
      setBusy(false);
    }
  };
  const handleOpenAllowedHome = async () => {
    const allowedUser = fbUser;
    const allowedProfile = profile;

    if (
      !allowedUser ||
      !allowedProfile?.enabled ||
      busy
    ) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      let verifiedEmail =
        loginEmail ||
        getFirebaseUserEmail(allowedUser) ||
        normalizeLoginEmail(
          allowedProfile.email
        );

      if (!verifiedEmail) {
        verifiedEmail =
          await getTokenClaimEmail(
            allowedUser
          );
      }

      verifiedEmail =
        normalizeLoginEmail(verifiedEmail);

      if (!verifiedEmail) {
        setError(t.errGeneric);
        return;
      }

      if (ENABLE_EMAIL_PASSWORD_TOTP_FLOW) {
        const totpSessionState =
          await readTotpSessionState(
            allowedUser
          );

        if (
          totpSessionState.enrolled &&
          !totpSessionState.satisfied
        ) {
          await signOutForTotpReauthentication(
            verifiedEmail,
            lang === "ar"
              ? "\u062a\u062a\u0637\u0644\u0628 \u0647\u0630\u0647 \u0627\u0644\u062c\u0644\u0633\u0629 \u0627\u0644\u062a\u062d\u0642\u0642 \u0628\u0631\u0645\u0632 TOTP. \u0633\u062c\u0651\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649 \u062b\u0645 \u0623\u062f\u062e\u0644 \u0631\u0645\u0632 \u0627\u0644\u0645\u0635\u0627\u062f\u0642\u0629."
              : "This session requires TOTP verification. Sign in again and enter your authentication code."
          );

          return;
        }
      }

      if (
        await prepareUnifiedTotpEnrollmentGate(
          allowedUser,
          verifiedEmail,
          allowedProfile
        )
      ) {
        return;
      }

      const homePath =
        resolveAllowlistHomePath(
          allowedUser,
          allowedProfile
        );

      const destinationPath =
        ENABLE_EMAIL_PASSWORD_TOTP_FLOW
          ? (
              consumeStoredMfaReturnPath(
                routeMfaRecoveryState
              ) ||
              homePath
            )
          : homePath;

      navigate(destinationPath, {
        replace: true,
      });
    } catch {
      setError(t.errGeneric);
    } finally {
      setBusy(false);
    }
  };  const logout = async () => {
    setBusy(true);
    setError("");

    try {
      await signOut(auth);
    } finally {
      clearStoredMfaReturnPath();
      clearTotpEnrollmentState();
      clearTotpChallengeState();
      setFbUser(null);
      setProfile(null);
      setLoginEmail("");
      setEmailPassword("");
      setDebugLines([]);
      setBusy(false);
    }
  };  const renderDeveloperWithHighlight = () => {
    if (lang === "ar") {
      const parts = t.developer.split("المطور");
      if (parts.length === 2) {
        return (
          <>
            <span
              style={{
                color: "#f6e05e",
                background: "linear-gradient(90deg, #f6e05e, #f6ad55)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 900,
              }}
            >
              المطور
            </span>
            {parts[1]}
          </>
        );
      }
      return t.developer;
    }

    const parts = t.developer.split("Developer");
    if (parts.length === 2) {
      return (
        <>
          {parts[0]}
          <span
            style={{
              color: "#f6e05e",
              background: "linear-gradient(90deg, #f6e05e, #f6ad55)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontWeight: 900,
            }}
          >
            Developer
          </span>
        </>
      );
    }
    return t.developer;
  };

  const renderSubtitleWithRedText = () => {
    if (lang === "ar") {
      const parts = t.subtitle.split("فقط");
      if (parts.length === 2) {
        return (
          <>
            {parts[0]}
            <span
              style={{
                color: "#f56565",
                fontWeight: 900,
                fontSize: "18px",
                marginInline: "4px",
              }}
            >
              فقط
            </span>
            {parts[1]}
          </>
        );
      }
      return t.subtitle;
    }

    const parts = t.subtitle.split("only");
    if (parts.length === 2) {
      return (
        <>
          {parts[0]}
          <span
            style={{
              color: "#f56565",
              fontWeight: 900,
              fontSize: "18px",
              marginInline: "4px",
            }}
          >
            only
          </span>
          {parts[1]}
        </>
      );
    }
    return t.subtitle;
  };

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      background:
        "radial-gradient(circle at top right, rgba(201, 162, 57, 0.18), transparent 34%), linear-gradient(135deg, #f8f1df 0%, #efe2bf 48%, #fbf7ed 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      direction: lang === "ar" ? "rtl" : "ltr",
      fontFamily: "'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      color: "#111827",
      position: "relative",
      overflow: "hidden",
    },
    backgroundPattern: {
      position: "absolute",
      inset: 0,
      background: `
        linear-gradient(90deg, rgba(151,116,28,0.10) 1px, transparent 1px),
        linear-gradient(180deg, rgba(151,116,28,0.08) 1px, transparent 1px)
      `,
      backgroundSize: "44px 44px",
      opacity: 0.35,
      zIndex: 0,
      pointerEvents: "none",
    },
    card: {
      width: "100%",
      maxWidth: "620px",
      borderRadius: "26px",
      background: "linear-gradient(180deg, rgba(255, 252, 244, 0.98), rgba(246, 237, 214, 0.98))",
      boxShadow: "0 24px 55px rgba(92, 64, 0, 0.18), inset 0 1px 0 rgba(255,255,255,0.86)",
      border: "2px solid rgba(180, 138, 24, 0.55)",
      padding: "42px 38px 34px",
      position: "relative",
      overflow: "hidden",
      backdropFilter: "blur(10px)",
      zIndex: 1,
    },
    cardGlow: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "7px",
      background: "linear-gradient(90deg, #8a6a00, #d4af37, #8a6a00)",
      borderRadius: "26px 26px 0 0",
      zIndex: 2,
    },
    header: {
      textAlign: "center",
      marginBottom: "30px",
    },
    logoContainer: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: "18px",
    },
    logo: {
      width: "116px",
      height: "116px",
      borderRadius: "28px",
      background: "linear-gradient(180deg, #fffaf0, #ead9a8)",
      border: "2px solid rgba(180, 138, 24, 0.65)",
      padding: "12px",
      boxShadow: "0 14px 30px rgba(92, 64, 0, 0.18)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    logoImage: {
      width: "100%",
      height: "100%",
      borderRadius: "18px",
      objectFit: "contain",
    },
    title: {
      fontSize: "30px",
      fontWeight: 1000,
      margin: "0 0 10px 0",
      color: "#111827",
      lineHeight: 1.35,
      letterSpacing: "-0.3px",
    },
    ministryText: {
      fontSize: "16px",
      color: "#4b5563",
      margin: "0 0 14px 0",
      fontWeight: 800,
      position: "relative",
      paddingBottom: "12px",
    },
    ministryUnderline: {
      position: "absolute",
      bottom: 0,
      left: "28%",
      right: "28%",
      height: "3px",
      background: "linear-gradient(90deg, transparent, #b8870b, transparent)",
      borderRadius: "999px",
    },
    subtitle: {
      fontSize: "15px",
      color: "#374151",
      margin: 0,
      fontWeight: 700,
      lineHeight: 1.6,
      padding: "0 10px",
    },
    googleBtn: {
      width: "100%",
      border: "2px solid rgba(138, 106, 0, 0.45)",
      borderRadius: "18px",
      padding: "17px 24px",
      cursor: busy ? "not-allowed" : "pointer",
      fontWeight: 900,
      fontSize: "18px",
      color: "#111827",
      background: "linear-gradient(180deg, #ffe9a6, #d4af37)",
      boxShadow: "0 12px 26px rgba(151, 116, 28, 0.24)",
      opacity: busy ? 0.72 : 1,
      transition: "all 0.2s ease",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "14px",
    },
    googleIcon: {
      fontSize: "24px",
      fontWeight: 1000,
      color: "#111827",
      background: "#ffffff",
      width: "34px",
      height: "34px",
      borderRadius: "50%",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      border: "1px solid rgba(138, 106, 0, 0.25)",
    },
    microsoftBtn: {
      width: "100%",
      marginTop: "14px",
      border: "2px solid rgba(59, 130, 246, 0.48)",
      borderRadius: "18px",
      padding: "17px 24px",
      cursor: busy ? "not-allowed" : "pointer",
      fontWeight: 900,
      fontSize: "18px",
      color: "#111827",
      background: "linear-gradient(180deg, #e0f2fe, #bfdbfe)",
      boxShadow: "0 12px 26px rgba(59, 130, 246, 0.18)",
      opacity: busy ? 0.72 : 1,
      transition: "all 0.2s ease",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "14px",
    },
    microsoftIcon: {
      width: "34px",
      height: "34px",
      borderRadius: "9px",
      background: "#ffffff",
      display: "inline-grid",
      gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: "1fr 1fr",
      gap: "2px",
      padding: "5px",
      border: "1px solid rgba(37, 99, 235, 0.25)",
    },
    infoBox: {
      marginTop: "24px",
      borderRadius: "20px",
      padding: "22px",
      border: "1.5px solid rgba(180, 138, 24, 0.38)",
      background: "rgba(255, 255, 255, 0.62)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85)",
      backdropFilter: "blur(5px)",
    },
    infoSection: {
      marginBottom: "20px",
    },
    infoRow: {
      display: "flex",
      alignItems: "flex-start",
      marginBottom: "14px",
      paddingBottom: "14px",
      borderBottom: "1px solid rgba(151, 116, 28, 0.18)",
      flexWrap: "wrap",
      gap: "8px",
    },
    infoLabel: {
      color: "#374151",
      fontSize: "14px",
      fontWeight: 800,
      minWidth: "110px",
      textAlign: lang === "ar" ? "right" : "left",
      marginBottom: "5px",
    },
    infoValue: {
      color: "#111827",
      fontSize: "14px",
      fontWeight: 800,
      flex: 1,
      wordBreak: "break-word",
    },
    badge: {
      padding: "7px 14px",
      borderRadius: "999px",
      fontSize: "13px",
      fontWeight: 900,
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      border: "1px solid rgba(255,255,255,0.55)",
    },
    badgeActive: {
      background: "linear-gradient(90deg, #15803d, #16a34a)",
      color: "#ffffff",
    },
    badgeInactive: {
      background: "linear-gradient(90deg, #991b1b, #dc2626)",
      color: "#ffffff",
    },
    hintText: {
      fontSize: "12px",
      color: "#7f1d1d",
      fontStyle: "normal",
      marginTop: "7px",
      fontWeight: 700,
      paddingLeft: lang === "ar" ? "0" : "110px",
      paddingRight: lang === "ar" ? "110px" : "0",
    },
    actions: {
      display: "flex",
      gap: "12px",
      flexWrap: "wrap",
      marginTop: "20px",
    },
    actionBtn: {
      flex: 1,
      minWidth: "138px",
      borderRadius: "14px",
      padding: "13px 18px",
      cursor: busy ? "not-allowed" : "pointer",
      fontWeight: 900,
      fontSize: "14px",
      border: "none",
      transition: "all 0.2s ease",
      textAlign: "center",
    },
    primaryBtn: {
      background: "linear-gradient(180deg, #14532d, #166534)",
      color: "#ffffff",
      boxShadow: "0 8px 18px rgba(20, 83, 45, 0.22)",
    },
    secondaryBtn: {
      background: "linear-gradient(180deg, #fffaf0, #f0dfad)",
      color: "#111827",
      border: "1.5px solid rgba(151, 116, 28, 0.42)",
      boxShadow: "0 5px 14px rgba(92, 64, 0, 0.10)",
    },
    footer: {
      marginTop: "32px",
      textAlign: "center",
      borderTop: "1px solid rgba(151, 116, 28, 0.22)",
      paddingTop: "20px",
    },
    copyright: {
      fontSize: "14px",
      color: "#4b5563",
      margin: "0 0 10px 0",
      fontWeight: 700,
    },
    developerInfo: {
      fontSize: "14px",
      color: "#111827",
      margin: "8px 0",
      lineHeight: 1.6,
      fontWeight: 700,
    },
    teacherName: {
      fontWeight: 1000,
      color: "#8a6a00",
      fontSize: "15px",
    },
    error: {
      marginTop: "18px",
      padding: "14px",
      borderRadius: "14px",
      background: "#fff1f2",
      border: "1.5px solid rgba(190, 18, 60, 0.28)",
      color: "#7f1d1d",
      fontSize: "13px",
      textAlign: "center",
      fontWeight: 800,
    },
    langSwitch: {
      position: "absolute",
      top: "24px",
      [lang === "ar" ? "left" : "right"]: "24px",
      background: "linear-gradient(180deg, #fffaf0, #ead9a8)",
      border: "1.5px solid rgba(151, 116, 28, 0.42)",
      color: "#111827",
      padding: "10px 20px",
      borderRadius: "999px",
      fontSize: "14px",
      fontWeight: 900,
      cursor: "pointer",
      transition: "all 0.2s ease",
      boxShadow: "0 8px 18px rgba(92, 64, 0, 0.12)",
      zIndex: 3,
    },
    loading: {
      display: "inline-block",
      width: "22px",
      height: "22px",
      border: "3px solid rgba(17, 24, 39, 0.20)",
      borderTop: "3px solid #111827",
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
    },
  };

  async function handleDeviceTransferStart() {
  const user = auth.currentUser;

  if (!user?.uid) {
    setError(
      lang === "ar"
        ? "يجب تسجيل الدخول أولاً."
        : "You must sign in first."
    );
    return;
  }

  const requestId =
    crypto.randomUUID();
  setDeviceTransferRequestId(requestId);

  const device = createNewDeviceIdentity();

  const request = {
    requestId,
    userId: user.uid,
    newDeviceId: device.deviceId,
    status: "pending" as const,
    createdAt: new Date(),
  };

  await startDeviceTransfer(request);

  setDeviceTransferNewDeviceId(device.deviceId);
  setDeviceTransferNewDeviceReady(true);

  setDeviceTransferNewDeviceId(device.deviceId);
  setDeviceTransferNewDeviceReady(true);

  setDeviceTransferRequested(true);
}
return (
    <main
      className="login-approved-page"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <div className="login-approved-pattern" aria-hidden="true" />

      <button
        type="button"
        className="login-approved-language"
        onClick={() => setLang(lang === "ar" ? "en" : "ar")}
        aria-label={lang === "ar" ? "Switch to English" : "Switch to Arabic"}
      >
        <span
          className={
            lang === "en"
              ? "login-approved-language-part active"
              : "login-approved-language-part"
          }
        >
          English
        </span>

        <span
          className={
            lang === "ar"
              ? "login-approved-language-part active"
              : "login-approved-language-part"
          }
        >
          {"\u0627\u0644\u0639\u0631\u0628\u064a\u0629"}
        </span>
      </button>

      <section className="login-approved-shell">
        <header className="login-approved-header">
          <div className="login-approved-arch">
            <div className="login-approved-arch-inner">
              <img
                className="login-approved-logo"
                src="https://i.imgur.com/vdDhSMh.png"
                alt={lang === "ar" ? "\u0634\u0639\u0627\u0631 \u0633\u0644\u0637\u0646\u0629 \u0639\u0645\u0627\u0646" : "Sultanate of Oman logo"}
              />

              <div className="login-approved-ministry">
                <strong>
                  {lang === "ar" ? "\u0633\u0644\u0637\u0646\u0629 \u0639\u0645\u0627\u0646" : "Sultanate of Oman"}
                </strong>
                <span>
                  {lang === "ar" ? "\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u062a\u0639\u0644\u064a\u0645" : "Ministry of Education"}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="login-approved-title-block">
          <h1>{t.title}</h1>

          <div className="login-approved-secure-badge">
            <span aria-hidden="true">\u2713</span>
            {lang === "ar" ? "\u062a\u0633\u062c\u064a\u0644 \u062f\u062e\u0648\u0644 \u0622\u0645\u0646" : "Secure sign-in"}
          </div>
        </div>

        <section className="login-approved-cards" aria-label={t.title}>
          <article className="login-approved-card login-approved-card-google">
            <div className="login-approved-provider-icon login-approved-google-icon" aria-hidden="true">
              <span className="login-approved-google-g">
                <span className="login-approved-google-blue">G</span>
              </span>
            </div>

            <h2>
              {lang === "ar"
                ? "تسجيل الدخول بواسطة Google"
                : "Sign in with Google"}
            </h2>

            <p>
              {lang === "ar"
                ? "\u0627\u0633\u062a\u062e\u062f\u0645 \u062d\u0633\u0627\u0628 Google \u0627\u0644\u0645\u0635\u0631\u062d"
                : "Use your authorized Google account"}
            </p>

            <button
              type="button"
              className="login-approved-action login-approved-google-button"
              onClick={handleGoogle}
              disabled={busy}
            >
              {busy ? <span style={styles.loading} /> : t.signIn}
            </button>

        </article>

          <article className="login-approved-card login-approved-card-email">
            <div className="login-approved-provider-icon login-approved-microsoft-icon" aria-hidden="true">
              <span style={{ background: "#f25022" }} />
              <span style={{ background: "#7fba00" }} />
              <span style={{ background: "#00a4ef" }} />
              <span style={{ background: "#ffb900" }} />
            </div>

            <h2>
              {lang === "ar"
                ? "الدخول بالحساب الوزاري المعتمد"
                : "Sign in with approved ministry account"}
            </h2>

            <p>
              {lang === "ar"
                ? "\u0644\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0648\u0632\u0627\u0631\u064a @moe.om"
                : "For approved ministry accounts"}
            </p>

            <button
              type="button"
              className="login-approved-action login-approved-microsoft-button"
              onClick={handleEmailPasswordSignIn}
              disabled={busy}
            >
              {busy ? <span style={styles.loading} /> : t.microsoftSignIn}
            </button>

        </article>

          <article className="login-approved-card login-approved-card-webauthn">
            <div
              className="login-approved-provider-icon"
              aria-hidden="true"
            >
              <span>🔐</span>
            </div>

            <h2>
              {lang === "ar"
                ? "الدخول بمفتاح أمان"
                : "Sign in with Passkey"}
            </h2>

            <p>
              {lang === "ar"
                ? "استخدم بصمة الجهاز أو مفتاح الأمان المسجل"
                : "Use your registered device passkey"}
            </p>

            <button
              type="button"
              className="login-approved-action login-approved-webauthn-button"
              onClick={handleWebAuthn}
              disabled={busy}
            >
              {busy ? <span style={styles.loading} /> : "🔐 Passkey"}
            </button>

        </article>

          <article className="login-approved-card login-approved-card-email">
            <div
              className="login-approved-provider-icon login-approved-email-icon"
              aria-hidden="true"
            >
              <span className="login-approved-email-envelope">QR</span>
              <span className="login-approved-email-shield">✓</span>
            </div>

            <h2>
              {lang === "ar"
                ? "المصادقة الثنائية TOTP"
                : "TOTP two-factor authentication"}
            </h2>

            <p>
              {lang === "ar"
                ? "يظهر رمز QR هنا للمستخدم الجديد بعد تسجيل الدخول عبر Google أو Microsoft"
                : "The QR code appears here for a new user after signing in with Google or Microsoft"}
            </p>

            {/* FORCED_DEV_EMAIL_PASSWORD_PANEL */}
            {SHOW_DEV_EMAIL_PASSWORD_LOGIN &&
              !totpChallengeRequired &&
              !totpEnrollmentRequired && (

              <section
                className="login-approved-dev-password-login"
                dir={lang === "ar" ? "rtl" : "ltr"}
                style={{
                  marginTop: 16,
                  padding: 16,
                  borderRadius: 14,
                  border: "1px solid #cbd5e1",
                  background: "#f8fbff",
                  display: "grid",
                  gap: 10,
                }}
              >

                <strong
                  style={{
                    color: "#17345f",
                    fontSize: 16,
                    fontWeight: 900,
                    textAlign: "center",
                  }}
                >
                  {lang === "ar"
                    ? "الدخول التجريبي بالبريد وكلمة المرور"
                    : "Development email/password sign-in"}
                </strong>

                <span
                  style={{
                    color: "#64748b",
                    fontSize: 12,
                    fontWeight: 700,
                    textAlign: "center",
                  }}
                >
                  {lang === "ar"
                    ? "مخصص لحسابات Firebase Emulator"
                    : "For Firebase Emulator accounts"}
                </span>

                <input
                  type="email"
                  dir="ltr"
                  value={emailAddress}
                  onChange={(e) =>
                    setEmailAddress(e.target.value)
                  }
                  placeholder={
                    lang === "ar"
                      ? "البريد الإلكتروني"
                      : "Email address"
                  }
                  disabled={busy}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    minHeight: 44,
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    padding: "0 12px",
                    background: "#ffffff",
                    color: "#17345f",
                    WebkitTextFillColor: "#17345f",
                    fontFamily: "inherit",
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                />

                <input
                  type="password"
                  dir="ltr"
                  value={emailPassword}
                  onChange={(e) =>
                    setEmailPassword(e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !busy &&
                      emailAddress.trim() &&
                      emailPassword
                    ) {
                      void handleEmailPasswordSignIn();
                    }
                  }}
                  placeholder={
                    lang === "ar"
                      ? "كلمة المرور"
                      : "Password"
                  }
                  disabled={busy}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    minHeight: 44,
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    padding: "0 12px",
                    background: "#ffffff",
                    color: "#17345f",
                    WebkitTextFillColor: "#17345f",
                    fontFamily: "inherit",
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                />

                <button
                  type="button"
                  onClick={() =>
                    void handleEmailPasswordSignIn()
                  }
                  disabled={
                    busy ||
                    !emailAddress.trim() ||
                    !emailPassword
                  }
                  style={{
                    minHeight: 44,
                    border: 0,
                    borderRadius: 10,
                    background: "#17345f",
                    color: "#ffffff",
                    fontFamily: "inherit",
                    fontSize: 14,
                    fontWeight: 900,
                    cursor: busy
                      ? "not-allowed"
                      : "pointer",
                  }}
                >
                  {busy
                    ? (
                        lang === "ar"
                          ? "جارٍ التحقق..."
                          : "Verifying..."
                      )
                    : (
                        lang === "ar"
                          ? "تسجيل الدخول التجريبي"
                          : "Development sign in"
                      )}
                </button>

              </section>

            )}


            {ENABLE_EMAIL_PASSWORD_TOTP_FLOW && (
              <>
                {!(
                  totpChallengeRequired &&
                  totpChallengeResolver &&
                  totpChallengeEnrollmentId
                ) &&
                  !(
                    totpEnrollmentRequired &&
                    totpEnrollmentSecret &&
                    totpEnrollmentQrUri &&
                    totpEnrollmentManualKey
                  ) && (
                    <section
                      className="login-approved-totp-enrollment"
                      aria-labelledby="totp-ready-title"
                    >
                      <div className="login-approved-totp-heading">
                        <strong id="totp-ready-title">
                          {lang === "ar"
                            ? "جاهز لإعداد المصادقة"
                            : "Ready for authentication setup"}
                        </strong>

                        <span>
                          {lang === "ar"
                            ? "ابدأ بتسجيل الدخول عبر Google أو Microsoft. سيظهر رمز QR هنا للمستخدم الجديد، أو تظهر خانة رمز TOTP للحساب الذي سبق تفعيله."
                            : "Start by signing in with Google or Microsoft. A QR code will appear here for a new user, or a TOTP code field will appear for an enrolled account."}
                        </span>
                      </div>
                    </section>
                  )}

                {totpChallengeRequired &&
                  totpChallengeResolver &&
                  totpChallengeEnrollmentId && (
                    <section
                      className="login-approved-totp-enrollment login-approved-totp-challenge"
                      aria-labelledby="totp-challenge-title"
                    >
                      <div className="login-approved-totp-heading">
                        <strong id="totp-challenge-title">
                          {lang === "ar"
                            ? "التحقق برمز TOTP"
                            : "Verify your TOTP code"}
                        </strong>

                        <span>
                          {lang === "ar"
                            ? "افتح تطبيق المصادقة وأدخل الرمز الحالي المكون من 6 أرقام."
                            : "Open your authenticator app and enter the current 6-digit code."}
                        </span>
                      </div>

                      <input
                        className="login-approved-email-input login-approved-totp-code-input"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={totpChallengeCode}
                        onChange={(event) => {
                          setTotpChallengeCode(
                            event.target.value
                              .replace(/\D/g, "")
                              .slice(0, 6)
                          );
                          setError("");
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            void handleTotpChallengeConfirm();
                          }
                        }}
                        placeholder={
                          lang === "ar"
                            ? "أدخل رمز TOTP"
                            : "Enter the TOTP code"
                        }
                        disabled={busy}
                      />

                      <button type="button" className="login-approved-device-transfer" onClick={() => handleNewDeviceRegistration()} disabled={busy}>
                    {lang === "ar" ? "إضافة هاتف جديد" : "Add new phone"}
                  </button>
                  {deviceTransferNewDeviceReady && (
                    <div className="login-approved-message login-approved-message-success">
                      <strong>
                        {lang === "ar"
                          ? "تم تجهيز الهاتف الجديد بنجاح."
                          : "New phone prepared successfully."}
                      </strong>

                      <div dir="ltr">
                        {deviceTransferNewDeviceId}
                      </div>

                      <small>
                        {lang === "ar"
                          ? "الحالة: جاهز للربط"
                          : "Status: Ready for linking"}
                      </small>
                    </div>
                  )}


                  <button
                        type="button"
                        className="login-approved-totp-confirm"
                        onClick={() =>
                          void handleTotpChallengeConfirm()
                        }
                        disabled={
                          busy ||
                          totpChallengeCode.length !== 6
                        }
                      >
                        {busy ? (
                          <span style={styles.loading} />
                        ) : lang === "ar" ? (
                          "تأكيد رمز TOTP"
                        ) : (
                          "Confirm TOTP code"
                        )}
                      </button>
                    </section>
                  )}

                {totpEnrollmentRequired &&
                  totpEnrollmentSecret &&
                  totpEnrollmentQrUri &&
                  totpEnrollmentManualKey && (
                    <section
                      className="login-approved-totp-enrollment"
                      aria-labelledby="totp-enrollment-title"
                    >
                      <div className="login-approved-totp-heading">
                        <strong id="totp-enrollment-title">
                          {lang === "ar"
                            ? "إعداد المصادقة الثنائية"
                            : "Set up two-factor authentication"}
                        </strong>

                        <span>
                          {lang === "ar"
                            ? "امسح رمز QR باستخدام تطبيق المصادقة، أو أدخل المفتاح اليدوي."
                            : "Scan the QR code with your authenticator app, or enter the manual key."}
                        </span>
                      </div>

                      <div className="login-approved-totp-qr">
                        <QRCodeSVG
                          value={totpEnrollmentQrUri}
                          size={184}
                          level="M"
                        />
                      </div>

                      <div className="login-approved-totp-manual">
                        <span>
                          {lang === "ar"
                            ? "المفتاح اليدوي"
                            : "Manual setup key"}
                        </span>

                        <code dir="ltr">
                          {totpEnrollmentManualKey}
                        </code>
                      </div>

                      <input
                        className="login-approved-email-input login-approved-totp-code-input"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={totpEnrollmentCode}
                        onChange={(event) => {
                          setTotpEnrollmentCode(
                            event.target.value
                              .replace(/\D/g, "")
                              .slice(0, 6)
                          );
                          setError("");
                        }}
                        placeholder={
                          lang === "ar"
                            ? "أدخل الرمز المكون من 6 أرقام"
                            : "Enter the 6-digit code"
                        }
                        disabled={busy}
                      />

                      <button
                        type="button"
                        className="login-approved-totp-confirm"
                        onClick={() =>
                          void handleTotpEnrollmentConfirm()
                        }
                        disabled={
                          busy ||
                          totpEnrollmentCode.length !== 6
                        }
                      >
                        {busy ? (
                          <span style={styles.loading} />
                        ) : lang === "ar" ? (
                          "تأكيد وتفعيل TOTP"
                        ) : (
                          "Confirm and enable TOTP"
                        )}
                      </button>
                    </section>
                  )}
              </>
            )}
          {deviceTransferRequested && (
          <section className="login-approved-totp-enrollment login-approved-totp-challenge">
            <div className="login-approved-totp-heading">
              <strong>
                {lang === "ar"
                  ? "تغيير الهاتف"
                  : "Change phone"}
              </strong>

              <span>
               {deviceTransferVerified
                 ? (
                     lang === "ar"
                       ? "تم التحقق من الهاتف الحالي بنجاح. يمكنك الآن إضافة الهاتف الجديد."
                       : "Current phone verified successfully. You can now add the new phone."
                   )
                 : (
                     lang === "ar"
                       ? "تم إنشاء طلب تغيير الهاتف. يرجى تأكيد ملكية الحساب من الهاتف الحالي."
                       : "A phone change request was created. Verify ownership using your current phone."
                   )}
             </span>
            </div>
          </section>
        )}

        </article>
        </section>

        {emailLinkStatus && (
          <div className="login-approved-message login-approved-message-success">
            {emailLinkStatus}
          </div>
        )}

        {error && (
          <div className="login-approved-message login-approved-message-error">
            {error}
          </div>
        )}

        {(fbUser || profile) && (
          <section className="login-approved-status-panel">
            {(loginEmail || fbUser?.email) && (
              <div className="login-approved-status-row">
                <span>{t.signedInAs}</span>
                <strong>{loginEmail || fbUser?.email}</strong>
              </div>
            )}

            <div className="login-approved-status-row">
              <span>{t.status}</span>
              <strong>{enabled ? t.active : t.inactive}</strong>
            </div>

            {tenantId && tenantId !== "default" && (
              <div className="login-approved-status-row">
                <span>{t.tenant}</span>
                <strong>{tenantId}</strong>
              </div>
            )}

            {profile?.role && (
              <div className="login-approved-status-row">
                <span>{t.role}</span>
                <strong>{roleBadge.label}</strong>
              </div>
            )}

            {debugLines.length > 0 && (
              <details className="login-approved-debug">
                <summary>Microsoft Debug</summary>
                {debugLines.map((line, index) => (
                  <div key={index}>{line}</div>
                ))}
              </details>
            )}

            {fbUser && (
              <div className="login-approved-status-actions">
                <button type="button" onClick={refreshPermissions} disabled={busy}>
                  {t.refresh}
                </button>

                <button type="button" onClick={logout} disabled={busy}>
                  {t.logout}
                </button>

                {isAllowed && (
                  <button
                    type="button"
                    onClick={() => void handleOpenAllowedHome()}
                    disabled={busy}
                  >
                    {t.okGo}
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        <div className="login-approved-security-note">
          <span aria-hidden="true">◇</span>
          <strong>
            {lang === "ar"
              ? "\u0648\u0635\u0648\u0644 \u0645\u062d\u0645\u064a \u0648\u0645\u0648\u062b\u0648\u0642"
              : "Protected and trusted access"}
          </strong>
          <span>
            {lang === "ar"
              ? "\u0646\u0638\u0627\u0645 \u0631\u0633\u0645\u064a \u0645\u062e\u0635\u0635 \u0644\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646 \u0627\u0644\u0645\u0635\u0631\u062d \u0644\u0647\u0645 \u0641\u0642\u0637"
              : "Official system for authorized users only"}
          </span>
        </div>

        <footer className="login-approved-footer">
          <div
            className="login-approved-footer-rule"
            aria-hidden="true"
          />

          <div className="login-approved-footer-row login-approved-footer-row-final">
            <span className="login-approved-footer-final-item login-approved-footer-rights">
              {lang === "ar"
                ? "\u062c\u0645\u064a\u0639 \u0627\u0644\u062d\u0642\u0648\u0642 \u0645\u062d\u0641\u0648\u0638\u0629"
                : "All rights reserved"}
            </span>

            <span className="login-approved-footer-final-item login-approved-footer-oman">
              {lang === "ar"
                ? "\u0633\u0644\u0637\u0646\u0629 \u0639\u0645\u0627\u0646"
                : "Sultanate of Oman"}
            </span>

            <span className="login-approved-footer-final-logo-wrap">
              <img
                className="login-approved-footer-logo"
                src="https://i.imgur.com/vdDhSMh.png"
                alt={
                  lang === "ar"
                    ? "\u0634\u0639\u0627\u0631 \u0633\u0644\u0637\u0646\u0629 \u0639\u0645\u0627\u0646"
                    : "Sultanate of Oman logo"
                }
              />
            </span>

            <span className="login-approved-footer-final-item login-approved-footer-ministry">
              {lang === "ar"
                ? "\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u062a\u0639\u0644\u064a\u0645"
                : "Ministry of Education"}
            </span>

            <span className="login-approved-footer-final-item login-approved-footer-designer">
              {lang === "ar"
                ? "\u0645\u0635\u0645\u0645 \u0627\u0644\u0628\u0631\u0646\u0627\u0645\u062c : \u064a\u0648\u0633\u0641 \u0627\u0644\u0646\u0639\u0645\u0627\u0646\u064a"
                : "Program Designer: Youssef Al-Numani"}
            </span>
          </div>
        </footer>
      </section>
    </main>
  );
}
