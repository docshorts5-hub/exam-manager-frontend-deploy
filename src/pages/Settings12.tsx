import { getAccessWorkerUrl } from "../lib/accessWorkerUrl";
import React, {useEffect, useMemo, useRef, useState} from "react";
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { useI18n } from "../i18n/I18nProvider";
import { useAuth } from "../auth/AuthContext";
import { db } from "../firebase/firebase";
import { loadTenantSettings, saveTenantSettings } from "../services/tenantData";

const EXAM_CENTER_DATA_KEY = "exam-manager:exam-center-data:v1";
const EXAM_CENTER_LOGO_KEY = "exam-manager:exam-center-logo:v1";
const CONTROL_HEAD_NAME_KEY = "exam-manager:control-head-name:v1";
const PHONE_CHANGE_REQUEST_KEY = "exam-manager:diploma-phone-change-request:v1";

const SETTINGS12_ACCESS_WORKER_URL = getAccessWorkerUrl();
const SETTINGS12_ACCESS_SESSION_DURATION_MS = 10 * 60 * 1000;
const SETTINGS12_ACCESS_LOCK_MINUTES = 5;

/**
 * Cloud document for Diploma Exam Center settings.
 * This separates Diploma Center settings from regular school Settings.tsx.
 */
const DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID = "diplomaExamCenter";
const LEGACY_EXAM_CENTER_SETTINGS_DOC_ID = "examCenter";
const DEFAULT_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

type SaveNotice = {
  kind: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
};

const GOVERNORATES = {
  ar: [
    "المديرية العامة للتعليم بمحافظة مسقط",
    "المديرية العامة للتعليم بمحافظة ظفار",
    "المديرية العامة للتعليم بمحافظة الداخلية",
    "المديرية العامة للتعليم بمحافظة الظاهرة",
    "المديرية العامة للتعليم بمحافظة البريمي",
    "المديرية العامة للتعليم بمحافظة شمال الشرقية",
    "المديرية العامة للتعليم بمحافظة جنوب الشرقية",
    "المديرية العامة للتعليم بمحافظة الوسطى",
    "المديرية العامة للتعليم بمحافظة شمال الباطنة",
    "المديرية العامة للتعليم بمحافظة جنوب الباطنة",
    "المديرية العامة للتعليم بمحافظة مسندم",
  ],
  en: [
    "Directorate General of Education in Muscat Governorate",
    "Directorate General of Education in Dhofar Governorate",
    "Directorate General of Education in Al Dakhiliyah Governorate",
    "Directorate General of Education in Al Dhahirah Governorate",
    "Directorate General of Education in Al Buraimi Governorate",
    "Directorate General of Education in North Al Sharqiyah Governorate",
    "Directorate General of Education in South Al Sharqiyah Governorate",
    "Directorate General of Education in Al Wusta Governorate",
    "Directorate General of Education in North Al Batinah Governorate",
    "Directorate General of Education in South Al Batinah Governorate",
    "Directorate General of Education in Musandam Governorate",
  ],
} as const;

const SEMESTERS = {
  ar: ["الفصل الدراسي الأول", "الفصل الدراسي الثاني"],
  en: ["First Semester", "Second Semester"],
} as const;

type ExamCenterData = {
  name: string;
  examCenterCode: string;
  centerCode?: string;
  governorate: string;
  semester: string;
  phone: string;
  phoneMasked?: string;
  phoneLocked?: boolean;
  phoneLockedAtISO?: string;
  phoneChangeRequestedAtISO?: string;
  address: string;
  controlHeadName: string;
  academicYear?: string;
};

type ExamCenterCloudSettings = Partial<ExamCenterData> & {
  logo?: string;
  updatedAtISO?: string;
};

type AccentTone = {
  border: string;
  soft: string;
  field: string;
  label: string;
};

const ACCENT_TONES: AccentTone[] = [
  { border: "#d4af37", soft: "#fff8e1", field: "#fffdf7", label: "#6b4f00" },
  { border: "#2563eb", soft: "#eef4ff", field: "#f8fbff", label: "#1d4ed8" },
  { border: "#16a34a", soft: "#effcf4", field: "#f7fff9", label: "#15803d" },
  { border: "#dc2626", soft: "#fff1f2", field: "#fff8f8", label: "#b91c1c" },
  { border: "#7c3aed", soft: "#f5f1ff", field: "#fbf8ff", label: "#6d28d9" },
  { border: "#ea580c", soft: "#fff3eb", field: "#fffaf6", label: "#c2410c" },
  { border: "#0ea5e9", soft: "#ecfbff", field: "#f7fdff", label: "#0369a1" },
  { border: "#10b981", soft: "#ecfdf5", field: "#f7fffb", label: "#047857" },
];

function withAlpha(hex: string, alpha: number) {
  const safe = hex.replace("#", "").trim();
  if (safe.length !== 6) return `rgba(15, 23, 42, ${alpha})`;
  const num = Number.parseInt(safe, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function toneInputStyles(base: React.CSSProperties, tone: AccentTone): React.CSSProperties {
  return {
    ...base,
    border: `3px solid ${tone.border}`,
    background: tone.field,
    boxShadow: `0 8px 18px ${withAlpha(tone.border, 0.10)}`,
  };
}

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getTenantIdFromAuth(auth: any) {
  return (
    String(
      auth?.effectiveTenantId ||
        auth?.profile?.tenantId ||
        auth?.userProfile?.tenantId ||
        auth?.user?.tenantId ||
        "default"
    ).trim() || "default"
  );
}

function normalizeExamCenterData(value: Partial<ExamCenterData> | null | undefined): ExamCenterData {
  const examCenterCode = String(value?.examCenterCode || value?.centerCode || "").trim();

  return {
    name: String(value?.name || "").trim(),
    examCenterCode,
    centerCode: examCenterCode,
    governorate: String(value?.governorate || "").trim(),
    semester: String(value?.semester || "").trim(),
    phone: normalizePhoneForStorage(value?.phone),
    phoneMasked: String(value?.phoneMasked || maskPhoneNumber(value?.phone) || "").trim(),
    phoneLocked: Boolean(value?.phoneLocked && normalizePhoneForStorage(value?.phone)),
    phoneLockedAtISO: String(value?.phoneLockedAtISO || "").trim(),
    phoneChangeRequestedAtISO: String(value?.phoneChangeRequestedAtISO || "").trim(),
    address: String(value?.address || "").trim(),
    controlHeadName: String(value?.controlHeadName || localStorage.getItem(CONTROL_HEAD_NAME_KEY) || "").trim(),
    academicYear: String(value?.academicYear || "").trim(),
  };
}


function normalizePhoneForStorage(value: unknown) {
  return String(value ?? "")
    .replace(/[^\d+]/g, "")
    .trim();
}

function maskPhoneNumber(value: unknown) {
  const normalized = normalizePhoneForStorage(value);
  if (!normalized) return "";
  const hasPlus = normalized.startsWith("+");
  const body = hasPlus ? normalized.slice(1) : normalized;
  if (body.length <= 2) return hasPlus ? `+${body}` : body;
  const masked = `${body.slice(0, 1)}${"x".repeat(Math.max(body.length - 2, 1))}${body.slice(-1)}`;
  return hasPlus ? `+${masked}` : masked;
}

function isPhoneLockedValue(value: Partial<ExamCenterData> | null | undefined) {
  return Boolean(value?.phoneLocked && normalizePhoneForStorage(value?.phone));
}

function maskEmail(value: unknown) {
  const email = cleanText(value).toLowerCase();
  const [name, domain] = email.split("@");
  if (!name || !domain) return email || "—";
  if (name.length <= 2) return `${name.slice(0, 1)}***@${domain}`;
  return `${name.slice(0, 1)}${"*".repeat(Math.min(Math.max(name.length - 2, 3), 12))}${name.slice(-1)}@${domain}`;
}

function normalizeSettings12AccessEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeSettings12AccessCode(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 6);
}

function getSettings12WorkerErrorMessage(data: any, fallback: string) {
  const error = String(data?.error || "").trim();
  if (error === "PAGE_NOT_ALLOWED") return "Settings12 is not allowed by the access Worker.";
  if (error === "TENANT_ID_REQUIRED") return "Tenant ID is required.";
  if (error === "VALID_TO_EMAIL_REQUIRED") return "A valid email is required.";
  if (error === "CODE_REQUIRED") return "Enter the 6-digit verification code.";
  if (error === "ACCESS_CODE_NOT_FOUND") return "The code is expired or was not found. Request a new code.";
  if (error === "ACCESS_CODE_EXPIRED") return "The code has expired. Request a new code.";
  if (error === "INVALID_CODE") return "The code is incorrect.";
  if (error === "MAX_ATTEMPTS_REACHED") return "Too many incorrect attempts. Request a new code later.";
  if (error === "UNAUTHORIZED" || error === "INVALID_FIREBASE_TOKEN") return "Your login session could not be verified. Sign out and sign in again.";
  return String(data?.message || fallback || "Access check failed.");
}

async function callSettings12AccessWorker(
  endpoint: "/api/teachers12/request-code" | "/api/teachers12/verify-code",
  firebaseUser: any,
  payload: Record<string, unknown>
) {
  const token =
    firebaseUser && typeof firebaseUser.getIdToken === "function"
      ? await firebaseUser.getIdToken()
      : "";

  if (!token) {
    throw new Error("Firebase ID token is missing. Sign out and sign in again.");
  }

  const response = await fetch(`${SETTINGS12_ACCESS_WORKER_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.ok === false) {
    const err: any = new Error(
      getSettings12WorkerErrorMessage(
        data,
        endpoint.includes("verify-code") ? "Invalid or expired code." : "Failed to send access code."
      )
    );
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

function formatSettings12AccessCountdown(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getSettings12AccessLockFromError(error: any) {
  const data = error?.data || {};
  const numericCandidates = [
    data.lockedUntilMs,
    data.lockUntilMs,
    data.lockedUntil,
    data.lockUntil,
  ]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > Date.now());

  if (numericCandidates.length) return numericCandidates[0];

  const retryAfterSeconds = Number(data.retryAfterSeconds || data.retryAfter || 0);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Date.now() + retryAfterSeconds * 1000;
  }

  if (error?.status === 429) {
    return Date.now() + SETTINGS12_ACCESS_LOCK_MINUTES * 60 * 1000;
  }

  return 0;
}

function clearSettings12SensitiveLocalCache() {
  try {
    localStorage.removeItem(EXAM_CENTER_DATA_KEY);
    localStorage.removeItem(EXAM_CENTER_LOGO_KEY);
    localStorage.removeItem(CONTROL_HEAD_NAME_KEY);
    localStorage.removeItem(PHONE_CHANGE_REQUEST_KEY);
  } catch {
    // ignore unavailable browser storage
  }
}

type Settings12EmailCodeGateProps = {
  lang: string;
  isRTL: boolean;
  tenantId: string;
  expectedEmail: string;
  firebaseUser: any;
  sessionKey: string;
  lockStorageKey: string;
  onVerified: () => void;
};

function Settings12EmailCodeGate(props: Settings12EmailCodeGateProps) {
  const { lang, isRTL, tenantId, expectedEmail, firebaseUser, sessionKey, lockStorageKey, onVerified } = props;
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const [emailInput, setEmailInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [lockRemainingSeconds, setLockRemainingSeconds] = useState(0);

  useEffect(() => {
    const updateLock = () => {
      try {
        const until = Number(localStorage.getItem(lockStorageKey) || "0");
        const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
        setLockRemainingSeconds(remaining);
        if (remaining <= 0) localStorage.removeItem(lockStorageKey);
      } catch {
        setLockRemainingSeconds(0);
      }
    };

    updateLock();
    const timer = window.setInterval(updateLock, 1000);
    return () => window.clearInterval(timer);
  }, [lockStorageKey]);

  const applyLock = (untilMs: number) => {
    if (!untilMs || untilMs <= Date.now()) return;
    try {
      localStorage.setItem(lockStorageKey, String(untilMs));
    } catch {
      // ignore unavailable browser storage
    }
    setLockRemainingSeconds(Math.ceil((untilMs - Date.now()) / 1000));
  };

  const sendCode = async () => {
    const typedEmail = normalizeSettings12AccessEmail(emailInput);
    const requiredEmail = normalizeSettings12AccessEmail(expectedEmail);

    setError("");
    setMessage("");

    if (lockRemainingSeconds > 0) return;

    if (!requiredEmail) {
      setError(tr("تعذر تحديد بريد الحساب الحالي. سجل الخروج ثم ادخل مرة أخرى.", "The current account email could not be resolved. Sign out and sign in again."));
      return;
    }

    if (typedEmail !== requiredEmail) {
      setError(tr("البريد الإلكتروني غير مطابق لبريد الحساب الحالي.", "The email does not match the current account email."));
      return;
    }

    setIsBusy(true);
    try {
      await callSettings12AccessWorker("/api/teachers12/request-code", firebaseUser, {
        tenantId,
        page: "Settings12",
        to: requiredEmail,
      });

      setCodeSent(true);
      setEmailConfirmed(true);
      setCodeInput("");
      setMessage(tr("تم إرسال كود الدخول إلى بريد الحساب.", "The access code was sent to the account email."));
    } catch (err: any) {
      const untilMs = getSettings12AccessLockFromError(err);
      applyLock(untilMs);
      setError(err?.message || tr("تعذر إرسال كود الدخول.", "Failed to send the access code."));
    } finally {
      setIsBusy(false);
    }
  };

  const verifyCode = async () => {
    const requiredEmail = normalizeSettings12AccessEmail(expectedEmail);
    const code = normalizeSettings12AccessCode(codeInput);

    setError("");
    setMessage("");

    if (!requiredEmail) {
      setError(tr("تعذر تحديد بريد الحساب الحالي.", "The current account email could not be resolved."));
      return;
    }

    if (code.length !== 6) {
      setError(tr("أدخل كود التحقق المكون من 6 أرقام.", "Enter the 6-digit verification code."));
      return;
    }

    setIsBusy(true);
    try {
      await callSettings12AccessWorker("/api/teachers12/verify-code", firebaseUser, {
        tenantId,
        page: "Settings12",
        to: requiredEmail,
        code,
      });

      try {
        localStorage.setItem(
          sessionKey,
          JSON.stringify({ expiresAt: Date.now() + SETTINGS12_ACCESS_SESSION_DURATION_MS })
        );
      } catch {
        // parent state still grants access for this render
      }

      onVerified();
    } catch (err: any) {
      const untilMs = getSettings12AccessLockFromError(err);
      applyLock(untilMs);
      setError(err?.message || tr("كود التحقق غير صحيح أو منتهي.", "The code is incorrect or expired."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, direction: isRTL ? "rtl" : "ltr", background: "linear-gradient(180deg, #ead7b5 0%, #f6ead4 48%, #fff7e6 100%)" }}>
      <div style={{ width: "min(560px, 94vw)", borderRadius: 28, border: "3px solid #d4af37", background: "linear-gradient(180deg,#fffdf7,#fff7e5)", boxShadow: "0 28px 80px rgba(15,23,42,0.22)", padding: 26, color: "#111827", textAlign: "center" }}>
        <div style={{ fontSize: 42, marginBottom: 10 }}>🔐</div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 1000 }}>{tr("حماية إعدادات مركز الدبلوم", "Diploma Center Settings Protection")}</h2>
        <p style={{ margin: "12px 0 0", lineHeight: 1.9, fontWeight: 800, color: "#334155" }}>
          {tr("أدخل بريد الحساب الحالي ثم كود التحقق لفتح الصفحة لمدة 10 دقائق.", "Enter the current account email and verification code to open this page for 10 minutes.")}
        </p>

        <input
          value={emailInput}
          onChange={(event) => {
            setEmailInput(event.target.value);
            setCodeSent(false);
            setEmailConfirmed(false);
            setCodeInput("");
            setError("");
            setMessage("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") void sendCode();
          }}
          type="text"
          inputMode="email"
          autoComplete="new-password"
          name="settings12_email_gate_no_autofill"
          id="settings12_email_gate_no_autofill"
          placeholder={tr("أدخل بريد الحساب", "Enter account email")}
          style={{ width: "100%", boxSizing: "border-box", marginTop: 18, border: "3px solid #d4af37", borderRadius: 16, padding: "14px 16px", fontSize: 17, fontWeight: 900, textAlign: "center", background: "#fff", color: "#111827" }}
        />

        {codeSent && emailConfirmed && (
          <input
            value={codeInput}
            onChange={(event) => setCodeInput(normalizeSettings12AccessCode(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === "Enter") void verifyCode();
            }}
            type="text"
            inputMode="numeric"
            autoComplete="new-password"
            name="settings12_code_gate_no_autofill"
            id="settings12_code_gate_no_autofill"
            maxLength={6}
            placeholder={tr("أدخل كود التحقق من 6 أرقام", "Enter the 6-digit code")}
            style={{ width: "100%", boxSizing: "border-box", marginTop: 12, border: "3px solid #d4af37", borderRadius: 16, padding: "14px 16px", fontSize: 20, fontWeight: 1000, textAlign: "center", background: "#fff", color: "#111827", letterSpacing: 2 }}
          />
        )}

        {lockRemainingSeconds > 0 && (
          <div style={{ marginTop: 14, color: "#b91c1c", fontWeight: 1000 }}>
            {tr("انتظر", "Wait")} {formatSettings12AccessCountdown(lockRemainingSeconds)}
          </div>
        )}

        {error && <div style={{ marginTop: 14, color: "#b91c1c", fontWeight: 900, lineHeight: 1.7 }}>{error}</div>}
        {message && <div style={{ marginTop: 14, color: "#166534", fontWeight: 900, lineHeight: 1.7 }}>{message}</div>}

        <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={() => void sendCode()} disabled={isBusy || lockRemainingSeconds > 0} style={{ border: "1px solid #a98322", background: isBusy || lockRemainingSeconds > 0 ? "#e5e7eb" : "linear-gradient(135deg,#b88718,#f7d56b)", color: "#111827", borderRadius: 14, padding: "12px 18px", fontWeight: 1000, cursor: isBusy || lockRemainingSeconds > 0 ? "not-allowed" : "pointer" }}>
            {codeSent ? tr("إعادة إرسال الكود", "Resend code") : tr("إرسال الكود", "Send code")}
          </button>
          {codeSent && (
            <button type="button" onClick={() => void verifyCode()} disabled={isBusy} style={{ border: "1px solid #166534", background: isBusy ? "#e5e7eb" : "linear-gradient(135deg,#16a34a,#86efac)", color: "#052e16", borderRadius: 14, padding: "12px 18px", fontWeight: 1000, cursor: isBusy ? "wait" : "pointer" }}>
              {tr("تحقق وادخل", "Verify and enter")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function getAcademicYearFromSystemDate(now = new Date()) {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const startYear = month >= 9 ? year : year - 1;
  const endYear = startYear + 1;
  return `${startYear} - ${endYear}`;
}


function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeGovernorateText(value: unknown) {
  return cleanText(value).replace(/\s+/g, " ").trim();
}

function resolveGovernorateDisplay(
  rawValue: unknown,
  lang: "ar" | "en",
  arOptions: readonly string[],
  enOptions: readonly string[]
) {
  const raw = normalizeGovernorateText(rawValue);
  if (!raw) return "";

  const activeOptions = lang === "ar" ? arOptions : enOptions;
  const oppositeOptions = lang === "ar" ? enOptions : arOptions;

  const exactActive = activeOptions.find((x) => normalizeGovernorateText(x) === raw);
  if (exactActive) return exactActive;

  const oppositeIndex = oppositeOptions.findIndex((x) => normalizeGovernorateText(x) === raw);
  if (oppositeIndex >= 0) return activeOptions[oppositeIndex] || raw;

  const hints: string[][] = [
    ["مسقط", "muscat"],
    ["ظفار", "dhofar"],
    ["الداخلية", "dakhiliyah", "al dakhiliyah"],
    ["الظاهرة", "dhahirah", "al dhahirah"],
    ["البريمي", "buraimi", "al buraimi"],
    ["شمال الشرقية", "north al sharqiyah", "north sharqiyah"],
    ["جنوب الشرقية", "south al sharqiyah", "south sharqiyah"],
    ["الوسطى", "wusta", "al wusta"],
    ["شمال الباطنة", "north al batinah", "north batinah"],
    ["جنوب الباطنة", "south al batinah", "south batinah"],
    ["مسندم", "musandam"],
  ];

  const lowered = raw.toLowerCase();
  for (const needles of hints) {
    if (!needles.some((needle) => lowered.includes(needle.toLowerCase()))) continue;

    const option = activeOptions.find((x) => {
      const optionText = x.toLowerCase();
      return needles.some((needle) => optionText.includes(needle.toLowerCase()));
    });

    if (option) return option;
  }

  return raw;
}

async function resolveGovernorateFromAllowlist(email: string) {
  const safeEmail = cleanText(email).toLowerCase();
  if (!safeEmail) return "";

  try {
    const ownDoc = await getDoc(doc(db, "allowlist", safeEmail));
    if (ownDoc.exists()) {
      const data = (ownDoc.data() as Record<string, unknown>) || {};
      const gov = cleanText(data.governorate || data.directorate || data.scope);
      if (gov) return gov;
    }
  } catch {
    // continue to email query fallback
  }

  try {
    const byEmail = await getDocs(
      query(collection(db, "allowlist"), where("email", "==", safeEmail))
    );
    const first = byEmail.docs[0];
    if (first) {
      const data = (first.data() as Record<string, unknown>) || {};
      const gov = cleanText(data.governorate || data.directorate || data.scope);
      if (gov) return gov;
    }
  } catch {
    // no permission or offline; keep auth/local fallback only
  }

  return "";
}


export default function Settings12() {
  const { lang, isRTL } = useI18n();
  const auth = useAuth() as any;
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const tenantId = useMemo(() => getTenantIdFromAuth(auth), [auth]);
  const currentUserId = String(auth?.user?.email || auth?.user?.uid || "").trim();

  const currentEmail = cleanText(
    auth?.allow?.email ||
      auth?.profile?.email ||
      auth?.userProfile?.email ||
      auth?.user?.email ||
      auth?.currentUser?.email ||
      currentUserId ||
      ""
  ).toLowerCase();

  const governorateFromAuth = cleanText(
    auth?.allow?.governorate ||
      auth?.allow?.directorate ||
      auth?.profile?.governorate ||
      auth?.profile?.directorate ||
      auth?.userProfile?.governorate ||
      auth?.userProfile?.directorate ||
      auth?.tenant?.governorate ||
      auth?.tenant?.directorate ||
      ""
  );

  const governorates = GOVERNORATES[lang];
  const semesters = SEMESTERS[lang];

  const [data, setData] = useState<ExamCenterData>({
    name: "",
    examCenterCode: "",
    centerCode: "",
    governorate: "",
    semester: "",
    phone: "",
    phoneMasked: "",
    phoneLocked: false,
    phoneLockedAtISO: "",
    phoneChangeRequestedAtISO: "",
    address: "",
    controlHeadName: "",
    academicYear: "",
  });

  const isPhoneLocked = Boolean(data.phoneLocked && normalizePhoneForStorage(data.phone));
  const displayedPhone = isPhoneLocked ? maskPhoneNumber(data.phone) : data.phone;
  const phoneChangeRequested = Boolean(data.phoneChangeRequestedAtISO);
  const [isPhoneChangeDialogOpen, setIsPhoneChangeDialogOpen] = useState(false);
  const [phoneChangeEmailInput, setPhoneChangeEmailInput] = useState("");
  const [isSubmittingPhoneChangeRequest, setIsSubmittingPhoneChangeRequest] = useState(false);

  const governorateOptions = useMemo<string[]>(() => {
    const options: string[] = Array.from(governorates, (item) => String(item));
    const currentGov = cleanText(data.governorate);
    if (currentGov && !options.some((item) => item === currentGov)) {
      options.unshift(currentGov);
    }
    return options;
  }, [governorates, data.governorate]);
  const [logo, setLogo] = useState<string>(DEFAULT_LOGO_URL);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<SaveNotice | null>(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [autoGovernorate, setAutoGovernorate] = useState("");
  const [autoGovernorateSource, setAutoGovernorateSource] = useState("");

  
    const settings12CloudLoadedRef = useRef(false);
  const settings12LastSavedSignatureRef = useRef("");
  const settings12AccessExpectedEmail = normalizeSettings12AccessEmail(currentEmail);
  const settings12AccessSessionKey = useMemo(
    () => `yr:settings12:email-code-session:${tenantId}:${settings12AccessExpectedEmail || "unknown"}`,
    [tenantId, settings12AccessExpectedEmail]
  );
  const settings12AccessLockStorageKey = useMemo(
    () => `yr:settings12:email-code-lock:${tenantId}:${settings12AccessExpectedEmail || "unknown"}`,
    [tenantId, settings12AccessExpectedEmail]
  );
  const [settings12EmailAccessGranted, setSettings12EmailAccessGranted] = useState(false);

  useEffect(() => {
    clearSettings12SensitiveLocalCache();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(settings12AccessSessionKey);
      const parsed = safeParseJson<{ expiresAt?: number }>(raw, {});
      const expiresAt = Number(parsed?.expiresAt || 0);

      if (expiresAt && expiresAt > Date.now()) {
        setSettings12EmailAccessGranted(true);
        return;
      }

      localStorage.removeItem(settings12AccessSessionKey);
    } catch {
      // keep locked if storage is unavailable
    }

    setSettings12EmailAccessGranted(false);
  }, [settings12AccessSessionKey]);

  const grantSettings12EmailAccess = () => {
    try {
      localStorage.setItem(
        settings12AccessSessionKey,
        JSON.stringify({ expiresAt: Date.now() + SETTINGS12_ACCESS_SESSION_DURATION_MS })
      );
    } catch {
      // state still grants access for this render
    }

    setSettings12EmailAccessGranted(true);
  };

  const showSettings12AccessRequiredNotice = () => {
    setSaveNotice({
      kind: "error",
      title: tr("التحقق مطلوب", "Verification required"),
      message: tr(
        "يجب إدخال كود البريد قبل تحميل أو حفظ إعدادات مركز الدبلوم.",
        "Enter the email code before loading or saving diploma center settings."
      ),
    });
    window.setTimeout(() => setSaveNotice(null), 5600);
  };
useEffect(() => {
    if (!settings12EmailAccessGranted) {
      setIsCloudLoading(false);
      setSyncMessage("");
      return;
    }

    let mounted = true;

    const savedLocalData: Partial<ExamCenterData> = {};
    const savedLocalLogo = "";

    async function loadCloudSettings() {
      setIsCloudLoading(true);
      setSyncMessage(tr("جاري تحميل بيانات مركز الدبلوم من السحابة...", "Loading diploma center data from cloud..."));

      try {
        let cloud = await loadTenantSettings<ExamCenterCloudSettings>(
          tenantId,
          DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID,
          {}
        );

        let loadedFromLegacyDoc = false;

        const hasDiplomaCloudData = Boolean(
          cloud?.name ||
            cloud?.examCenterCode ||
            cloud?.centerCode ||
            cloud?.governorate ||
            cloud?.semester ||
            cloud?.phone ||
            cloud?.address ||
            cloud?.controlHeadName ||
            cloud?.logo
        );

        if (!hasDiplomaCloudData) {
          const legacyCloud = await loadTenantSettings<ExamCenterCloudSettings>(
            tenantId,
            LEGACY_EXAM_CENTER_SETTINGS_DOC_ID,
            {}
          );

          const hasLegacyCloudData = Boolean(
            legacyCloud?.name ||
              legacyCloud?.examCenterCode ||
              legacyCloud?.centerCode ||
              legacyCloud?.governorate ||
              legacyCloud?.semester ||
              legacyCloud?.phone ||
              legacyCloud?.address ||
              legacyCloud?.controlHeadName ||
              legacyCloud?.logo
          );

          if (hasLegacyCloudData) {
            cloud = legacyCloud;
            loadedFromLegacyDoc = true;
          }
        }

        if (!mounted) return;

        const hasCloudData = Boolean(
          cloud?.name ||
            cloud?.examCenterCode ||
            cloud?.centerCode ||
            cloud?.governorate ||
            cloud?.semester ||
            cloud?.phone ||
            cloud?.address ||
            cloud?.controlHeadName ||
            cloud?.logo
        );

        if (hasCloudData) {
          const nextData = normalizeExamCenterData(cloud);
          const nextLogo = String(cloud.logo || savedLocalLogo || DEFAULT_LOGO_URL);

          setData(nextData);
          setLogo(nextLogo);

          clearSettings12SensitiveLocalCache();

          window.dispatchEvent(new Event("exam-manager:changed"));
          window.dispatchEvent(new Event("exam-manager:control-head-changed"));

          if (loadedFromLegacyDoc) {
            await saveTenantSettings(
              tenantId,
              DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID,
              {
                ...nextData,
                centerCode: nextData.examCenterCode,
                academicYear: nextData.academicYear || getAcademicYearFromSystemDate(new Date()),
                logo: nextLogo,
                updatedAtISO: new Date().toISOString(),
              },
              { by: currentUserId || undefined }
            );

            setSyncMessage(
              tr(
                "تم تحميل بيانات المركز القديمة وترحيلها إلى مسار مركز الدبلوم.",
                "Legacy center data loaded and migrated to the diploma center path."
              )
            );
          } else {
            setSyncMessage(tr("تم تحميل بيانات مركز الدبلوم من السحابة.", "Diploma center data loaded from cloud."));
          }
        } else if (Object.keys(savedLocalData || {}).length || savedLocalLogo) {
          const localData = normalizeExamCenterData(savedLocalData);
          const localLogo = String(savedLocalLogo || DEFAULT_LOGO_URL);

          await saveTenantSettings(
            tenantId,
            DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID,
            {
              ...localData,
              centerCode: localData.examCenterCode,
              academicYear: localData.academicYear || getAcademicYearFromSystemDate(new Date()),
              logo: localLogo,
              updatedAtISO: new Date().toISOString(),
            },
            { by: currentUserId || undefined }
          );

          setSyncMessage(tr("تم ترحيل بيانات هذا الجهاز إلى السحابة.", "Local center data migrated to cloud."));
        } else {
          setSyncMessage(tr("لا توجد بيانات مركز محفوظة بعد.", "No saved center data yet."));
        }
      } catch (error) {
        if (!mounted) return;
        setSyncMessage(tr("تعذر تحميل بيانات مركز الدبلوم من السحابة.", "Could not load diploma center data from cloud."));
      } finally {
        if (mounted) setIsCloudLoading(false);
      }
    }

    void loadCloudSettings();

    return () => {
      mounted = false;
    };
  }, [tenantId, currentUserId, lang, settings12EmailAccessGranted]);

  useEffect(() => {
    if (!settings12EmailAccessGranted) return;

    let cancelled = false;

    async function applyLinkedGovernorate() {
      const fromAuth = resolveGovernorateDisplay(
        governorateFromAuth,
        lang,
        GOVERNORATES.ar,
        GOVERNORATES.en
      );

      let finalGovernorate = fromAuth;
      let sourceLabel = fromAuth
        ? tr("تم تحديد المحافظة تلقائيًا من صلاحيات الحساب الحالي.", "Governorate was automatically detected from the current account permissions.")
        : "";

      if (!finalGovernorate && currentEmail) {
        const fromAllowlist = await resolveGovernorateFromAllowlist(currentEmail);
        if (cancelled) return;

        finalGovernorate = resolveGovernorateDisplay(
          fromAllowlist,
          lang,
          GOVERNORATES.ar,
          GOVERNORATES.en
        );

        if (finalGovernorate) {
          sourceLabel = tr(
            "تم تحديد المحافظة تلقائيًا من ربط البريد الإلكتروني / مسؤول مركز الدبلوم.",
            "Governorate was automatically detected from the email / diploma center supervisor binding."
          );
        }
      }

      if (!finalGovernorate || cancelled) return;

      setAutoGovernorate(finalGovernorate);
      setAutoGovernorateSource(sourceLabel);

      setData((prev) => {
        if (prev.governorate === finalGovernorate) return prev;

        const next = normalizeExamCenterData({ ...prev, governorate: finalGovernorate });

        window.dispatchEvent(new Event("exam-manager:changed"));

        return next;
      });
    }

    void applyLinkedGovernorate();

    return () => {
      cancelled = true;
    };
  }, [currentEmail, governorateFromAuth, lang, isCloudLoading, settings12EmailAccessGranted]);

  const handleChange = (field: keyof ExamCenterData, value: string) => {
    if (!settings12EmailAccessGranted) return;
    if (field === "governorate" && autoGovernorate) return;
    if (field === "phone" && isPhoneLocked) return;
    const nextValue = field === "phone" ? normalizePhoneForStorage(value) : value;
    setData((prev) => ({ ...prev, [field]: nextValue }));
  };

  const requestPhoneChange = () => {
    if (!settings12EmailAccessGranted) {
      showSettings12AccessRequiredNotice();
      return;
    }
    setPhoneChangeEmailInput("");
    setIsPhoneChangeDialogOpen(true);
  };

  const submitPhoneChangeRequest = async () => {
    if (!settings12EmailAccessGranted) {
      showSettings12AccessRequiredNotice();
      return;
    }

    const typedEmail = cleanText(phoneChangeEmailInput).toLowerCase();
    const expectedEmail = cleanText(currentEmail).toLowerCase();

    if (!expectedEmail) {
      setSaveNotice({
        kind: "error",
        title: tr("تعذر تحديد البريد", "Email could not be resolved"),
        message: tr(
          "لم يتم العثور على بريد الحساب الحالي. سجل الخروج ثم ادخل مرة أخرى وحاول مجددًا.",
          "The current account email could not be found. Sign out, sign in again, and try again."
        ),
      });
      window.setTimeout(() => setSaveNotice(null), 5600);
      return;
    }

    if (typedEmail !== expectedEmail) {
      setSaveNotice({
        kind: "error",
        title: tr("البريد غير مطابق", "Email does not match"),
        message: tr(
          "البريد الإلكتروني المدخل غير مطابق لبريد الحساب الحالي، لذلك لم يتم إرسال طلب تغيير رقم الهاتف.",
          "The entered email does not match the current account email, so the phone change request was not submitted."
        ),
      });
      window.setTimeout(() => setSaveNotice(null), 5600);
      return;
    }

    const requestedAt = new Date().toISOString();
    const requestPayload = {
      tenantId,
      page: "Settings12",
      requestType: "phone_change",
      status: "pending",
      requesterEmail: expectedEmail,
      maskedPhone: maskPhoneNumber(data.phone),
      centerName: cleanText(data.name),
      governorate: cleanText(data.governorate),
      createdAtISO: requestedAt,
    };

    setIsSubmittingPhoneChangeRequest(true);
    try {
      await addDoc(collection(db, "tenants", tenantId, "phoneChangeRequests"), {
        ...requestPayload,
        createdAt: serverTimestamp(),
      });
      clearSettings12SensitiveLocalCache();
      setData((prev) => ({ ...prev, phoneChangeRequestedAtISO: requestedAt }));
      setIsPhoneChangeDialogOpen(false);
      setPhoneChangeEmailInput("");
      setSaveNotice({
        kind: "success",
        title: tr("تم إرسال طلب تغيير الرقم", "Phone change request submitted"),
        message: tr(
          "تم إرسال طلب تغيير رقم الهاتف إلى السحابة بنجاح. ستتم إضافة إرسال البريد الحقيقي في المرحلة التالية.",
          "The phone change request was submitted to the cloud successfully. Real email sending will be added in the next phase."
        ),
      });
      window.setTimeout(() => setSaveNotice(null), 5600);
    } catch (error) {
      setSaveNotice({
        kind: "error",
        title: tr("تعذر إرسال الطلب", "Request could not be submitted"),
        message: tr(
          "تعذر تسجيل طلب تغيير رقم الهاتف في السحابة. تحقق من الاتصال والصلاحيات ثم حاول مرة أخرى.",
          "The phone change request could not be saved to the cloud. Check connection and permissions, then try again."
        ),
      });
      window.setTimeout(() => setSaveNotice(null), 5600);
    } finally {
      setIsSubmittingPhoneChangeRequest(false);
    }
  };

  const saveData = async () => {
    if (!settings12EmailAccessGranted) {
      showSettings12AccessRequiredNotice();
      return;
    }

    const phoneValue = normalizePhoneForStorage(data.phone);
    const shouldLockPhone = Boolean(phoneValue);
    const normalizedData = normalizeExamCenterData({
      ...data,
      phone: phoneValue,
      phoneMasked: shouldLockPhone ? maskPhoneNumber(phoneValue) : "",
      phoneLocked: shouldLockPhone,
      phoneLockedAtISO: shouldLockPhone ? data.phoneLockedAtISO || new Date().toISOString() : "",
      centerCode: data.examCenterCode || data.centerCode,
      academicYear,
    });

    const payload: ExamCenterCloudSettings = {
      ...normalizedData,
      centerCode: normalizedData.examCenterCode,
      academicYear,
      logo,
      updatedAtISO: new Date().toISOString(),
    };

    setIsSaving(true);
    setSyncMessage(tr("جاري حفظ بيانات مركز الدبلوم في السحابة...", "Saving diploma center data to cloud..."));

    clearSettings12SensitiveLocalCache();

    window.dispatchEvent(new Event("exam-manager:changed"));
    window.dispatchEvent(new Event("exam-manager:control-head-changed"));

    try {
      await saveTenantSettings(tenantId, DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID, payload, { by: currentUserId || undefined });
      setSyncMessage(tr("تم حفظ بيانات مركز الدبلوم في السحابة بنجاح.", "Diploma center data saved to cloud successfully."));
      setSaveNotice({
        kind: "success",
        title: tr("تم الحفظ في السحابة", "Saved to cloud"),
        message: tr(
          "تم حفظ بيانات مركز الدبلوم وتحديث الترويسة الرسمية بنجاح.",
          "Diploma center data and the official header were saved successfully."
        ),
      });
      window.setTimeout(() => setSaveNotice(null), 5600);
    } catch (error) {
      setSyncMessage(tr("تعذر حفظ بيانات مركز الدبلوم في السحابة.", "Could not save diploma center data to cloud."));
      setSaveNotice({
        kind: "error",
        title: tr("تعذر الحفظ في السحابة", "Cloud save failed"),
        message: tr(
          "لم يتم حفظ بيانات مركز الدبلوم. تحقق من الاتصال والصلاحيات ثم حاول مرة أخرى.",
          "Diploma center data was not saved. Check connection and permissions, then try again."
        ),
      });
      window.setTimeout(() => setSaveNotice(null), 7200);
    } finally {
      setIsSaving(false);
    }
  };

  const academicYear = useMemo(() => data.academicYear || getAcademicYearFromSystemDate(new Date()), [data.academicYear]);

  const previewGov = data.governorate?.trim() || tr("المحافظة / المديرية", "Governorate / Directorate");
  const previewCenter = data.name?.trim() || tr("اسم مركز الامتحانات", "Exam Center Name");
  const previewCenterCode = data.examCenterCode?.trim() || data.centerCode?.trim() || tr("رمز مركز الامتحان", "Exam Center Code");
  const previewSemester = data.semester?.trim() || tr("الفصل الدراسي", "Semester");
  const previewPhone = (isPhoneLocked ? maskPhoneNumber(data.phone) : data.phone?.trim()) || tr("رقم الهاتف", "Phone Number");
  const previewAddress = data.address?.trim() || tr("العنوان", "Address");
  const previewControlHead = data.controlHeadName?.trim() || tr("اسم رئيس الكنترول", "Control Head Name");

  const centerInfoRows = [
    { label: tr("اسم المركز", "Center Name"), value: previewCenter, border: "#d4af37" },
    { label: tr("رمز المركز", "Center Code"), value: previewCenterCode, border: "#2563eb" },
    { label: tr("المحافظة / المديرية", "Governorate / Directorate"), value: previewGov, border: "#16a34a" },
    { label: tr("الفصل الدراسي", "Semester"), value: previewSemester, border: "#dc2626" },
    { label: tr("العام الدراسي", "Academic Year"), value: academicYear, border: "#7c3aed" },
    { label: tr("الهاتف", "Phone"), value: previewPhone, border: "#ea580c" },
    { label: tr("رئيس الكنترول", "Control Head"), value: previewControlHead, border: "#0ea5e9" },
    { label: tr("العنوان", "Address"), value: previewAddress, border: "#10b981" },
  ];

  const headerTones = [ACCENT_TONES[0], ACCENT_TONES[1], ACCENT_TONES[2]];
  const fieldTones = ACCENT_TONES;
  const previewTones = [ACCENT_TONES[0], ACCENT_TONES[1], ACCENT_TONES[2], ACCENT_TONES[5], ACCENT_TONES[4]];

  const uploadLogo = (file: File | null) => {
    if (!settings12EmailAccessGranted) {
      showSettings12AccessRequiredNotice();
      return;
    }
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      setLogo(value);
    };
    reader.readAsDataURL(file);
  };

  if (!settings12EmailAccessGranted) {
    return (
      <Settings12EmailCodeGate
        lang={lang}
        isRTL={isRTL}
        tenantId={tenantId}
        expectedEmail={settings12AccessExpectedEmail}
        firebaseUser={auth?.user || auth?.currentUser || null}
        sessionKey={settings12AccessSessionKey}
        lockStorageKey={settings12AccessLockStorageKey}
        onVerified={grantSettings12EmailAccess}
      />
    );
  }

  return (
    
    <div className="settings12PageRoot" style={{ ...pageWrap, direction: isRTL ? "rtl" : "ltr" }}>
      {isPhoneChangeDialogOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "grid", placeItems: "center", padding: 20, background: "rgba(15,23,42,0.34)", backdropFilter: "blur(4px)" }}>
          <div role="dialog" aria-modal="true" style={{ width: "min(560px, 96vw)", borderRadius: 24, border: "2px solid rgba(212,175,55,0.55)", background: "linear-gradient(180deg,#fffdf7,#fff7e5)", boxShadow: "0 30px 90px rgba(15,23,42,0.28)", padding: 24, color: "#000", direction: isRTL ? "rtl" : "ltr" }}>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 1000 }}>{tr("تأكيد طلب تغيير رقم الهاتف", "Confirm phone change request")}</h3>
            <p style={{ margin: "12px 0 0", lineHeight: 1.9, fontWeight: 800, color: "#334155" }}>
              {tr("لإرسال طلب تغيير رقم الهاتف، أدخل البريد الإلكتروني المرتبط بالحساب الحالي. لن يتم إرسال الطلب إذا كان البريد غير مطابق.", "To submit a phone change request, enter the email address linked to the current account. The request will not be submitted if the email does not match.")}
            </p>
            <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", fontWeight: 900 }}>
              {tr("البريد المسجل:", "Registered email:")} {maskEmail(currentEmail)}
            </div>
            <input value={phoneChangeEmailInput} onChange={(event) => setPhoneChangeEmailInput(event.target.value)} placeholder={tr("اكتب البريد الإلكتروني للتأكيد", "Enter email for confirmation")} style={{ marginTop: 14, width: "100%", boxSizing: "border-box", border: "2px solid #d4af37", borderRadius: 14, padding: "12px 14px", fontWeight: 900, color: "#000", background: "#fff" }} autoFocus />
            <div style={{ marginTop: 18, display: "flex", gap: 10, justifyContent: isRTL ? "flex-start" : "flex-end", flexWrap: "wrap" }}>
              <button type="button" onClick={() => { if (isSubmittingPhoneChangeRequest) return; setIsPhoneChangeDialogOpen(false); setPhoneChangeEmailInput(""); }} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 12, padding: "10px 16px", fontWeight: 900, cursor: "pointer" }}>{tr("إلغاء", "Cancel")}</button>
              <button type="button" onClick={submitPhoneChangeRequest} disabled={isSubmittingPhoneChangeRequest} style={{ border: "1px solid #a98322", background: isSubmittingPhoneChangeRequest ? "#e2e8f0" : "linear-gradient(135deg,#b88718,#f7d56b)", color: "#111827", borderRadius: 12, padding: "10px 16px", fontWeight: 1000, cursor: isSubmittingPhoneChangeRequest ? "wait" : "pointer" }}>{isSubmittingPhoneChangeRequest ? tr("جاري الإرسال...", "Submitting...") : tr("إرسال الطلب", "Submit request")}</button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        html,
        body,
        #root {
          margin: 0 !important;
          min-height: 100% !important;
          background:
            radial-gradient(1200px 520px at 50% -10%, rgba(180, 126, 40, 0.22), transparent 62%),
            linear-gradient(180deg, #ead7b5 0%, #f6ead4 48%, #fff7e6 100%) !important;
        }

        body {
          background-color: #ead7b5 !important;
        }

        .settings12PageRoot {
          position: relative;
          z-index: 1;
          background:
            radial-gradient(1200px 520px at 50% -10%, rgba(180, 126, 40, 0.22), transparent 62%),
            linear-gradient(180deg, #ead7b5 0%, #f6ead4 48%, #fff7e6 100%) !important;
        }

        .settingsFixedLightBg {
          position: fixed;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background:
            radial-gradient(1200px 520px at 50% -10%, rgba(180, 126, 40, 0.22), transparent 62%),
            linear-gradient(180deg, #ead7b5 0%, #f6ead4 48%, #fff7e6 100%) !important;
        }

        .settings12-auto-governorate-note {
          margin-top: 8px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(15, 122, 70, 0.30);
          background: linear-gradient(180deg, #ecfdf3, #dcfce7);
          color: #065f46 !important;
          -webkit-text-fill-color: #065f46 !important;
          font-size: 13px;
          font-weight: 850;
          line-height: 1.7;
          box-shadow: 0 8px 18px rgba(15, 122, 70, 0.08);
        }

        .settings12-select:disabled {
          cursor: not-allowed !important;
          color: #111827 !important;
          -webkit-text-fill-color: #111827 !important;
          box-shadow:
            0 0 0 4px rgba(15, 122, 70, 0.08),
            inset 0 1px 0 rgba(255,255,255,0.92),
            0 8px 18px rgba(75,56,8,0.08) !important;
        }

        @media (max-width: 1080px) {
          .settings12PageRoot [data-settings12-official-header="true"] {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }
        }

      `}</style>
      <div className="settingsFixedLightBg" aria-hidden="true" />

      {saveNotice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            ...floatingNoticeStyle,
            ...(saveNotice.kind === "success"
              ? floatingNoticeSuccessStyle
              : saveNotice.kind === "warning"
                ? floatingNoticeWarningStyle
                : saveNotice.kind === "error"
                  ? floatingNoticeErrorStyle
                  : floatingNoticeInfoStyle),
          }}
        >
          <div style={floatingNoticeIconStyle}>{saveNotice.kind === "warning" ? "!" : "✓"}</div>
          <div style={{ display: "grid", gap: 4, flex: 1 }}>
            <strong style={floatingNoticeTitleStyle}>{saveNotice.title}</strong>
            <span style={floatingNoticeMessageStyle}>{saveNotice.message}</span>
          </div>
          <button type="button" onClick={() => setSaveNotice(null)} style={floatingNoticeCloseStyle}>
            ×
          </button>
        </div>
      )}

      <div style={shellStyle}>
        <section style={officialHeaderCardStyle}>
          <div style={officialHeaderGridStyle} data-settings12-official-header="true">
            <div style={officialHeaderTextBlockStyle}>
              <div style={officialGovTitleStyle}>{tr("سلطنة عمان", "Sultanate of Oman")}</div>
              <div style={officialGovLineStyle}>{tr("وزارة التعليم", "Ministry of Education")}</div>
              <div style={officialGovLineStyle}>{previewGov}</div>
              <div style={officialSchoolLineStyle}>{previewCenter}</div>
            </div>

            <div style={officialHeaderLogoWrapStyle}>
              <img src={logo || DEFAULT_LOGO_URL} alt="official logo" style={officialHeaderLogoStyle} />
            </div>

            <div style={officialHeaderMetaStripStyle}>
              <MiniInfoPill label={tr("رمز المركز", "Center Code")} value={previewCenterCode} tone={headerTones[0]} />
              <MiniInfoPill label={tr("الفصل", "Semester")} value={previewSemester} tone={headerTones[1]} />
              <MiniInfoPill label={tr("العام الدراسي", "Academic Year")} value={academicYear} tone={headerTones[2]} />
            </div>
          </div>
        </section>

        <section style={heroCardStyle}>
          <div style={heroGridStyle}>
            <div style={previewPanelStyle}>
              <div style={innerPreviewPanelStyle}>
                <div style={topBadgeStyle}>{tr("واجهة تشغيل مخصصة", "Dedicated Operating View")}</div>

                <div style={heroTitleWrapStyle}>
                  <h1 style={heroTitleStyle}>
                    {tr("مركز امتحانات الدبلوم", "Diploma Examination Center")}
                  </h1>
                  <div style={heroSubTitleStyle}>{tr("لوحة ضبط البيانات الرسمية", "Official Data Configuration Panel")}</div>
                </div>

                <p style={heroTextStyle}>
                  {tr(
                    "واجهة منظمة لضبط بيانات مركز الامتحانات الرسمية بشكل أوضح، مع ترويسة الدبلوم، وخطوط أصغر، وحدود ملونة، حتى تظهر جميع البيانات بسهولة داخل الصفحة.",
                    "An organized interface for configuring the official exam center data with the diploma header, smaller typography, and colored borders so all information is displayed clearly."
                  )}
                </p>
              </div>

              <div style={statsShellStyle}>
                {[
                  { label: tr("اسم المركز", "Center Name"), value: previewCenter },
                  { label: tr("رمز المركز", "Center Code"), value: previewCenterCode },
                  { label: tr("المحافظة", "Governorate"), value: previewGov },
                ].map((item, index) => (
                  <div key={item.label} style={{ ...statCardStyle, borderColor: fieldTones[index].border, background: fieldTones[index].soft, boxShadow: `0 12px 28px ${withAlpha(fieldTones[index].border, 0.14)}` }}>
                    <div style={statLabelStyle}>{item.label}</div>
                    <div style={statValueStyle}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section style={contentCardStyle}>
          <div style={sectionTitleWrapStyle}>
            <div style={greenPillStyle}>{tr("إعداد البيانات الرسمية", "Official Data Setup")}</div>
            <h2 style={sectionTitleStyle}>{tr("بيانات مركز الامتحانات", "Exam Center Information")}</h2>
            <p style={sectionDescriptionStyle}>
              {tr(
                "أدخل البيانات الرسمية التي ستظهر في الترويسة والتقارير والمخرجات المطبوعة الخاصة بمركز الامتحانات.",
                "Enter the official data that will appear in the header, reports, and printed outputs for the exam center."
              )}
            </p>
          </div>

          <div style={formGridStyle}>
            <FieldCard label={tr("اسم مركز الامتحانات", "Exam Center Name")} accent={fieldTones[0]}>
              <input
                value={data.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder={tr("اكتب اسم المركز", "Enter exam center name")}
                style={toneInputStyles(inputStyle, fieldTones[0])}
                className="settings12-field"
              />
            </FieldCard>

            <FieldCard label={tr("رمز مركز الامتحان", "Exam Center Code")} accent={fieldTones[1]}>
              <input
                value={data.examCenterCode}
                onChange={(e) => handleChange("examCenterCode", e.target.value)}
                placeholder={tr("اكتب رمز مركز الامتحان", "Enter exam center code")}
                style={toneInputStyles(inputStyle, fieldTones[1])}
                className="settings12-field"
              />
            </FieldCard>

            <FieldCard label={tr("المحافظة / المديرية", "Governorate / Directorate")} accent={fieldTones[2]}>
              <select
                value={data.governorate}
                disabled={Boolean(autoGovernorate)}
                onChange={(e) => handleChange("governorate", e.target.value)}
                title={
                  autoGovernorate
                    ? tr("هذه المحافظة مرتبطة تلقائيًا بالحساب الحالي.", "This governorate is automatically linked to the current account.")
                    : undefined
                }
                style={{
                  ...toneInputStyles(selectStyle, fieldTones[2]),
                  opacity: autoGovernorate ? 1 : undefined,
                  background: autoGovernorate ? "#f0fdf4" : fieldTones[2].field,
                  borderColor: autoGovernorate ? "rgba(15,122,70,0.65)" : fieldTones[2].border,
                }}
                className="settings12-field settings12-select"
              >
                <option value="">{tr("اختر المحافظة / المديرية", "Select governorate / directorate")}</option>
                {governorateOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              {autoGovernorate && (
                <div className="settings12-auto-governorate-note">
                  {autoGovernorateSource ||
                    tr(
                      "تم ربط المحافظة تلقائيًا بالحساب الحالي.",
                      "The governorate has been linked automatically to the current account."
                    )}
                </div>
              )}
            </FieldCard>

            <FieldCard label={tr("الفصل الدراسي", "Semester")} accent={fieldTones[3]}>
              <select
                value={data.semester}
                onChange={(e) => handleChange("semester", e.target.value)}
                style={toneInputStyles(selectStyle, fieldTones[3])}
                className="settings12-field settings12-select"
              >
                <option value="">{tr("اختر الفصل الدراسي", "Select semester")}</option>
                {semesters.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </FieldCard>

            <FieldCard label={tr("رقم الهاتف", "Phone Number")} accent={fieldTones[4]}>
              <input
                value={displayedPhone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder={tr("اكتب رقم الهاتف", "Enter phone number")}
                style={{
                  ...toneInputStyles(inputStyle, fieldTones[4]),
                  letterSpacing: isPhoneLocked ? "0.08em" : undefined,
                  background: isPhoneLocked ? "#f8fafc" : toneInputStyles(inputStyle, fieldTones[4]).background,
                  cursor: isPhoneLocked ? "not-allowed" : "text",
                }}
                className="settings12-field"
                disabled={isPhoneLocked}
                inputMode="tel"
              />
              {isPhoneLocked ? (
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", lineHeight: 1.8 }}>
                    {tr(
                      "تم حفظ رقم الهاتف مرة واحدة، لذلك يظهر مخفيًا ولا يمكن تعديله مباشرة.",
                      "The phone number was saved once, so it is masked and cannot be edited directly."
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={requestPhoneChange}
                    disabled={phoneChangeRequested}
                    style={{
                      border: "1px solid #d4af37",
                      background: phoneChangeRequested ? "#f1f5f9" : "linear-gradient(135deg,#fff7ed,#fef3c7)",
                      color: phoneChangeRequested ? "#64748b" : "#7c2d12",
                      borderRadius: 14,
                      padding: "10px 14px",
                      fontWeight: 1000,
                      cursor: phoneChangeRequested ? "not-allowed" : "pointer",
                    }}
                  >
                    {phoneChangeRequested
                      ? tr("تم إرسال طلب تغيير الرقم", "Phone change request sent")
                      : tr("طلب تغيير رقم الهاتف", "Request phone number change")}
                  </button>
                </div>
              ) : null}
            </FieldCard>

            <FieldCard label={tr("اسم رئيس الكنترول", "Control Head Name")} accent={fieldTones[5]}>
              <input
                value={data.controlHeadName}
                onChange={(e) => handleChange("controlHeadName", e.target.value)}
                placeholder={tr("اكتب اسم رئيس الكنترول", "Enter control head name")}
                style={toneInputStyles(inputStyle, fieldTones[5])}
                className="settings12-field"
              />
            </FieldCard>

            <FieldCard label={tr("العنوان", "Address")} fullWidth accent={fieldTones[6]}>
              <textarea
                value={data.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder={tr("اكتب العنوان الرسمي لمركز الامتحانات", "Enter the official exam center address")}
                style={toneInputStyles(textAreaStyle, fieldTones[6])}
                className="settings12-field"
              />
            </FieldCard>

            <FieldCard label={tr("شعار المركز", "Center Logo")} fullWidth accent={fieldTones[7]}>
              <div style={logoUploadWrapStyle}>
                <div style={logoPreviewBoxStyle}>
                  <img src={logo || DEFAULT_LOGO_URL} alt="logo" style={logoImageStyle} />
                </div>

                <div style={{ display: "grid", gap: 12, flex: 1 }}>
                  <label style={uploadButtonStyle}>
                    {tr("اختيار شعار", "Choose Logo")}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => uploadLogo(e.target.files?.[0] || null)}
                      style={{ display: "none" }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setLogo(DEFAULT_LOGO_URL)}
                    style={secondaryButtonStyle}
                  >
                    {tr("استعادة الشعار الافتراضي", "Restore Default Logo")}
                  </button>
                </div>
              </div>
            </FieldCard>
          </div>

          <div style={sectionTitleWrapStyle}>
            <div style={greenPillStyle}>{tr("معاينة فورية", "Instant Preview")}</div>
            <h2 style={sectionTitleStyle}>{tr("شكل البيانات بعد الحفظ", "How the Data Looks After Saving")}</h2>
          </div>

          <div style={previewDocumentShellStyle}>
            <div style={previewHeaderStyle}>
              <div style={previewHeaderTextStyle}>
                <div style={previewGovTitleStyle}>سلطنة عمان</div>
                <div style={previewGovLineStyle}>وزارة التعليم</div>
                <div style={previewGovLineStyle}>{previewGov}</div>
                <div style={previewSchoolTitleStyle}>{previewCenter}</div>
              </div>
              <img src={logo || DEFAULT_LOGO_URL} alt="preview logo" style={previewLogoStyle} />
            </div>

            <div style={previewMetaGridStyle}>
              <MetaCard label={tr("رمز مركز الامتحان", "Exam Center Code")} value={previewCenterCode} accent={previewTones[0]} />
              <MetaCard label={tr("الفصل الدراسي", "Semester")} value={previewSemester} accent={previewTones[1]} />
              <MetaCard label={tr("العام الدراسي", "Academic Year")} value={academicYear} accent={previewTones[2]} />
              <MetaCard label={tr("الهاتف", "Phone")} value={previewPhone} accent={previewTones[3]} />
              <MetaCard label={tr("اسم رئيس الكنترول", "Control Head Name")} value={previewControlHead} accent={previewTones[4]} />
            </div>

            <div style={previewTextCardStyle}>
              <div style={metaLabelStyle}>{tr("العنوان الرسمي", "Official Address")}</div>
              <div style={metaValueStyle}>{previewAddress}</div>
            </div>
          </div>

          <div style={centerInfoTableShellStyle}>
            <div style={centerInfoTableTitleStyle}>
              {tr("جدول ملخص بيانات المركز", "Center Data Summary Table")}
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={beigeTableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...beigeTableHeaderCellStyle, borderColor: "#d4af37" }}>
                      {tr("البيان", "Field")}
                    </th>
                    <th style={{ ...beigeTableHeaderCellStyle, borderColor: "#2563eb" }}>
                      {tr("القيمة", "Value")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {centerInfoRows.map((row, index) => (
                    <tr key={row.label}>
                      <td
                        style={{
                          ...beigeTableCellStyle,
                          borderColor: row.border,
                          background: index % 2 === 0 ? "#f4e2bf" : "#f8ecd4",
                          fontWeight: 1000,
                        }}
                      >
                        {row.label}
                      </td>
                      <td
                        style={{
                          ...beigeTableCellStyle,
                          borderColor: centerInfoRows[(index + 1) % centerInfoRows.length].border,
                          background: index % 2 === 0 ? "#fff3da" : "#f7e6c6",
                        }}
                      >
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={syncStatusStyle}>
            {isCloudLoading ? tr("تحميل من السحابة...", "Loading from cloud...") : syncMessage}
          </div>

          <div style={actionRowStyle}>
            <button type="button" onClick={saveData} style={primaryButtonStyle} disabled={isSaving}>
              {isSaving
                ? tr("جاري الحفظ...", "Saving...")
                : tr("حفظ بيانات مركز الامتحانات", "Save Exam Center Data")}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function FieldCard({
  label,
  children,
  fullWidth = false,
  accent = ACCENT_TONES[0],
}: {
  label: string;
  children: React.ReactNode;
  fullWidth?: boolean;
  accent?: AccentTone;
}) {
  return (
    <div
      style={{
        ...fieldCardStyle,
        borderColor: accent.border,
        background: accent.soft,
        boxShadow: `0 12px 26px ${withAlpha(accent.border, 0.14)}`,
        gridColumn: fullWidth ? "1 / -1" : undefined,
      }}
    >
      <div style={{ ...fieldLabelStyle, color: accent.label }}>{label}</div>
      {children}
    </div>
  );
}

function MetaCard({ label, value, accent = ACCENT_TONES[0] }: { label: string; value: string; accent?: AccentTone }) {
  return (
    <div style={{ ...metaCardStyle, borderColor: accent.border, background: accent.soft, boxShadow: `0 10px 22px ${withAlpha(accent.border, 0.12)}` }}>
      <div style={{ ...metaLabelStyle, color: accent.label }}>{label}</div>
      <div style={metaValueStyle}>{value}</div>
    </div>
  );
}

function MiniInfoPill({ label, value, tone = ACCENT_TONES[0] }: { label: string; value: string; tone?: AccentTone }) {
  return (
    <div
      style={{
        minWidth: 150,
        padding: "10px 14px",
        borderRadius: 18,
        border: `2px solid ${tone.border}`,
        background: tone.soft,
        boxShadow: `0 8px 18px ${withAlpha(tone.border, 0.10)}`,
        display: "grid",
        gap: 3,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 900, color: tone.label }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 1000, color: "#0f172a", lineHeight: 1.4 }}>{value}</div>
    </div>
  );
}

const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  padding: "14px",
  background: "linear-gradient(180deg, #ead7b5 0%, #f6ead4 50%, #fff7e6 100%)",
  boxSizing: "border-box",
};

const shellStyle: React.CSSProperties = {
  maxWidth: 1680,
  margin: "0 auto",
  display: "grid",
  gap: 18,
};

const sharedCardBase: React.CSSProperties = {
  background: "linear-gradient(180deg, #fcfaf2 0%, #f4efdf 100%)",
  border: "3px solid #d4af37",
  borderRadius: 30,
  boxShadow: "0 0 0 6px rgba(212,175,55,0.09) inset, 0 12px 22px rgba(150,120,20,0.10)",
};

const officialHeaderCardStyle: React.CSSProperties = {
  ...sharedCardBase,
  padding: 16,
};

const officialHeaderGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 0.95fr) 120px minmax(420px, 1.45fr)",
  alignItems: "center",
  gap: 16,
};

const officialHeaderTextBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  alignContent: "center",
};

const officialGovTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 1000,
  fontSize: "clamp(18px, 2.2vw, 24px)",
  lineHeight: 1.35,
};

const officialGovLineStyle: React.CSSProperties = {
  color: "#374151",
  fontWeight: 900,
  fontSize: "clamp(13px, 1.4vw, 17px)",
  lineHeight: 1.55,
};

const officialSchoolLineStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 1000,
  fontSize: "clamp(20px, 2vw, 24px)",
  lineHeight: 1.45,
};

const officialHeaderLogoWrapStyle: React.CSSProperties = {
  width: 106,
  height: 106,
  borderRadius: 24,
  border: "3px solid #d4af37",
  background: "#fffef9",
  display: "grid",
  placeItems: "center",
  justifySelf: "center",
  boxShadow: "0 8px 18px rgba(150,120,20,0.10)",
};

const officialHeaderLogoStyle: React.CSSProperties = {
  width: "72%",
  height: "72%",
  objectFit: "contain",
};

const officialHeaderMetaStripStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(130px, 1fr))",
  gap: 10,
  alignItems: "stretch",
};

const heroCardStyle: React.CSSProperties = {
  ...sharedCardBase,
  padding: 18,
};

const heroGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const previewPanelStyle: React.CSSProperties = {
  ...sharedCardBase,
  padding: 18,
};

const innerPreviewPanelStyle: React.CSSProperties = {
  ...sharedCardBase,
  borderWidth: 3,
  padding: 20,
  display: "grid",
  gap: 16,
};

const topBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "fit-content",
  marginInlineStart: "auto",
  padding: "10px 20px",
  borderRadius: 999,
  background: "linear-gradient(180deg, #ebf3ff 0%, #dce9ff 100%)",
  border: "3px solid #d4af37",
  color: "#0f172a",
  fontWeight: 1000,
  fontSize: 16,
  boxShadow: "0 8px 18px rgba(40,70,120,0.08)",
};

const heroTitleWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const heroTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontWeight: 1000,
  fontSize: "clamp(30px, 4.2vw, 52px)",
  lineHeight: 1.28,
  textShadow: "0 8px 18px rgba(212,175,55,0.08)",
};

const heroSubTitleStyle: React.CSSProperties = {
  color: "#111827",
  fontWeight: 1000,
  fontSize: 18,
};

const heroTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#374151",
  fontWeight: 800,
  fontSize: 15,
  lineHeight: 1.9,
};

const statsShellStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 20,
};

const statCardStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #fefcf5 0%, #f6f0e2 100%)",
  border: "3px solid #d4af37",
  borderRadius: 24,
  padding: "18px 20px",
  boxShadow: "0 10px 22px rgba(150,120,20,0.08)",
  display: "grid",
  gap: 6,
};

const statLabelStyle: React.CSSProperties = {
  color: "#374151",
  fontWeight: 900,
  fontSize: 15,
};

const statValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 1000,
  fontSize: 20,
  lineHeight: 1.5,
};

const contentCardStyle: React.CSSProperties = {
  ...sharedCardBase,
  padding: 22,
  display: "grid",
  gap: 22,
};

const sectionTitleWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const greenPillStyle: React.CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  padding: "9px 16px",
  borderRadius: 999,
  border: "2px solid rgba(16,185,129,0.28)",
  background: "rgba(16,185,129,0.10)",
  color: "#065f46",
  fontWeight: 1000,
  fontSize: 13,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontWeight: 1000,
  fontSize: "clamp(22px, 2.8vw, 34px)",
};

const sectionDescriptionStyle: React.CSSProperties = {
  margin: 0,
  color: "#374151",
  fontWeight: 800,
  fontSize: 15,
  lineHeight: 1.85,
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 18,
};

const fieldCardStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #faf7ee 0%, #f5f0e1 100%)",
  border: "3px solid #d4af37",
  borderRadius: 24,
  padding: 18,
  boxShadow: "0 10px 24px rgba(150,120,20,0.08)",
  display: "grid",
  gap: 10,
};

const fieldLabelStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 1000,
  fontSize: 16,
  lineHeight: 1.5,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 56,
  borderRadius: 18,
  border: "3px solid #d4af37",
  background: "#fffdf7",
  color: "#0f172a",
  fontWeight: 900,
  fontSize: 16,
  padding: "12px 16px",
  outline: "none",
  boxSizing: "border-box",
  WebkitTextFillColor: "#0f172a",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none" as const,
  WebkitAppearance: "none" as const,
  MozAppearance: "none" as const,
  cursor: "pointer",
};

const textAreaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 130,
  borderRadius: 18,
  border: "3px solid #d4af37",
  background: "#fffdf7",
  color: "#0f172a",
  fontWeight: 900,
  fontSize: 16,
  padding: "14px 16px",
  outline: "none",
  boxSizing: "border-box",
  resize: "vertical" as const,
  WebkitTextFillColor: "#0f172a",
  lineHeight: 1.8,
};

const logoUploadWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 20,
  alignItems: "center",
  flexWrap: "wrap",
};

const logoPreviewBoxStyle: React.CSSProperties = {
  width: 130,
  height: 130,
  borderRadius: 30,
  background: "#fff",
  border: "4px solid #d4af37",
  display: "grid",
  placeItems: "center",
  boxShadow: "0 10px 20px rgba(150,120,20,0.10)",
};

const logoImageStyle: React.CSSProperties = {
  width: "78%",
  height: "78%",
  objectFit: "contain",
};

const uploadButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 50,
  width: "fit-content",
  padding: "0 22px",
  borderRadius: 16,
  border: "3px solid #2563eb",
  background: "linear-gradient(180deg, #e9f1ff 0%, #d8e7ff 100%)",
  color: "#1d4ed8",
  fontWeight: 1000,
  fontSize: 15,
  cursor: "pointer",
  boxShadow: "0 10px 20px rgba(40,70,120,0.08)",
};

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 50,
  width: "fit-content",
  padding: "0 22px",
  borderRadius: 16,
  border: "3px solid #dc2626",
  background: "#fff5f5",
  color: "#b91c1c",
  fontWeight: 1000,
  fontSize: 15,
  cursor: "pointer",
};

const previewDocumentShellStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #fffdf7 0%, #f7f1e2 100%)",
  border: "4px solid #d4af37",
  borderRadius: 28,
  padding: 22,
  display: "grid",
  gap: 18,
  boxShadow: "0 12px 28px rgba(150,120,20,0.10)",
};

const previewHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
};

const previewHeaderTextStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const previewGovTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 1000,
  fontSize: 20,
};

const previewGovLineStyle: React.CSSProperties = {
  color: "#1f2937",
  fontWeight: 900,
  fontSize: 15,
  lineHeight: 1.7,
};

const previewSchoolTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 1000,
  fontSize: 24,
  lineHeight: 1.55,
};

const previewLogoStyle: React.CSSProperties = {
  width: 88,
  height: 88,
  objectFit: "contain",
};

const previewMetaGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 14,
};

const metaCardStyle: React.CSSProperties = {
  background: "#fffdf7",
  border: "3px solid #d4af37",
  borderRadius: 20,
  padding: 16,
  display: "grid",
  gap: 6,
};

const metaLabelStyle: React.CSSProperties = {
  color: "#374151",
  fontWeight: 900,
  fontSize: 14,
};

const metaValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 1000,
  fontSize: 17,
  lineHeight: 1.7,
};

const previewTextCardStyle: React.CSSProperties = {
  background: "#fffdf7",
  border: "3px solid #10b981",
  borderRadius: 20,
  padding: 18,
  display: "grid",
  gap: 8,
  boxShadow: "0 10px 22px rgba(16,185,129,0.10)",
};

const centerInfoTableShellStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #ead7b5 0%, #f6ead4 100%)",
  border: "4px solid #c49a35",
  borderRadius: 28,
  padding: 18,
  display: "grid",
  gap: 14,
  boxShadow: "0 14px 30px rgba(120, 84, 28, 0.16)",
};

const centerInfoTableTitleStyle: React.CSSProperties = {
  color: "#111827",
  fontWeight: 1000,
  fontSize: 20,
  lineHeight: 1.5,
};

const beigeTableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 720,
  borderCollapse: "separate",
  borderSpacing: 8,
  background: "#ead7b5",
  color: "#000",
};

const beigeTableHeaderCellStyle: React.CSSProperties = {
  background: "#d8bd8b",
  color: "#000",
  border: "4px solid #d4af37",
  borderRadius: 16,
  padding: "14px 16px",
  textAlign: "center",
  fontWeight: 1000,
  fontSize: 16,
  whiteSpace: "nowrap",
};

const beigeTableCellStyle: React.CSSProperties = {
  color: "#000",
  border: "4px solid #d4af37",
  borderRadius: 16,
  padding: "14px 16px",
  textAlign: "center",
  fontWeight: 900,
  fontSize: 15,
  lineHeight: 1.7,
  boxShadow: "0 8px 18px rgba(120, 84, 28, 0.08)",
};

const syncStatusStyle: React.CSSProperties = {
  border: "3px solid #2563eb",
  borderRadius: 18,
  background: "#f8fbff",
  padding: "12px 16px",
  color: "#1d4ed8",
  fontWeight: 1000,
  fontSize: 14,
  textAlign: "center",
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
};

const primaryButtonStyle: React.CSSProperties = {
  minHeight: 56,
  minWidth: 280,
  padding: "0 24px",
  borderRadius: 18,
  border: "4px solid #16a34a",
  background: "linear-gradient(180deg, #dcfce7 0%, #86efac 100%)",
  color: "#065f46",
  fontWeight: 1000,
  fontSize: 18,
  cursor: "pointer",
  boxShadow: "0 14px 30px rgba(22,163,74,0.16)",
};


const floatingNoticeStyle: React.CSSProperties = {
  position: "fixed",
  top: 24,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 9999,
  minWidth: "min(92vw, 540px)",
  maxWidth: "min(92vw, 720px)",
  borderRadius: 24,
  padding: "16px 18px",
  display: "flex",
  alignItems: "center",
  gap: 14,
  border: "3px solid",
  boxShadow: "0 24px 60px rgba(15,23,42,0.24)",
  color: "#0f172a",
  fontFamily: "inherit",
};

const floatingNoticeSuccessStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #ecfdf5 0%, #dcfce7 52%, #f7fee7 100%)",
  borderColor: "#16a34a",
};

const floatingNoticeWarningStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 52%, #fef3c7 100%)",
  borderColor: "#f59e0b",
};

const floatingNoticeErrorStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 52%, #fff1f2 100%)",
  borderColor: "#dc2626",
};

const floatingNoticeInfoStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 52%, #eef2ff 100%)",
  borderColor: "#2563eb",
};

const floatingNoticeIconStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#0f7a46",
  color: "#ffffff",
  fontWeight: 1000,
  fontSize: 22,
  boxShadow: "0 10px 24px rgba(15,122,70,0.22)",
  flex: "0 0 auto",
};

const floatingNoticeTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 1000,
  fontSize: 18,
  lineHeight: 1.3,
};

const floatingNoticeMessageStyle: React.CSSProperties = {
  color: "#1f2937",
  fontWeight: 850,
  fontSize: 14,
  lineHeight: 1.7,
};

const floatingNoticeCloseStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: "50%",
  border: "2px solid rgba(15,23,42,0.18)",
  background: "rgba(255,255,255,0.78)",
  color: "#0f172a",
  fontWeight: 1000,
  fontSize: 20,
  cursor: "pointer",
  lineHeight: 1,
  flex: "0 0 auto",
};
