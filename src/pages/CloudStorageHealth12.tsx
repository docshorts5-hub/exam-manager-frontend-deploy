import { getAccessWorkerUrl } from "../lib/accessWorkerUrl";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import CloudStorageHealth from "./CloudStorageHealth";

const EMAIL_CODE_LOCK_MS = 5 * 60 * 1000;

function normalizeEmailAccessCode(value: string): string {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function maskEmailForAccess(email: string): string {
  const normalized = String(email || "").trim();
  if (!normalized.includes("@")) return normalized ? "****" : "";
  const [name, domain] = normalized.split("@");
  if (!name) return `****@${domain || ""}`;
  if (name.length <= 2) return `${name[0] || "*"}***@${domain || ""}`;
  return `${name[0]}${"*".repeat(Math.max(3, name.length - 2))}${name[name.length - 1]}@${domain || ""}`;
}

function normalizeEmailForAccessCheck(value: string): string {
  return String(value || "").trim().toLowerCase();
}


const UNIFIED_EMAIL_ACCESS_WORKER_URL = getAccessWorkerUrl();
const EMAIL_GATE_ACCESS_SESSION_DURATION_MS = 10 * 60 * 1000;

async function callUnifiedEmailAccessWorker(path: string, firebaseUser: any, payload: Record<string, unknown>) {
  const token = await firebaseUser?.getIdToken?.();

  if (!token) {
    throw new Error("تعذر الحصول على صلاحية المستخدم الحالية. سجّل الدخول مرة أخرى.");
  }

  const response = await fetch(UNIFIED_EMAIL_ACCESS_WORKER_URL + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({} as any));

  if (!response.ok || data?.ok === false) {
    const message =
      data?.message ||
      data?.details?.message ||
      data?.error ||
      "تعذر تنفيذ طلب رمز الدخول.";
    const error: any = new Error(message);
    error.status = response.status;
    error.details = data;
    error.data = data;
    throw error;
  }

  return data;
}

function formatLockCountdown(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function extractLockUntilFromError(err: any): number | null {
  const details = err?.details || {};
  const candidates = [
    details?.lockedUntilISO,
    details?.lockUntilISO,
    details?.lockedUntil,
    err?.lockedUntilISO,
    err?.lockUntilISO,
  ];

  for (const candidate of candidates) {
    const parsed = Date.parse(String(candidate || ""));
    if (Number.isFinite(parsed) && parsed > Date.now()) return parsed;
  }

  const retryAfterSeconds = Number(
    details?.retryAfterSeconds ?? details?.retryAfter ?? err?.retryAfterSeconds ?? err?.retryAfter ?? 0
  );

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Date.now() + retryAfterSeconds * 1000;
  }

  return null;
}

function isLockError(err: any): boolean {
  const code = String(err?.code || "").toLowerCase();
  const message = String(err?.message || "").toLowerCase();
  return (
    code.includes("resource-exhausted") ||
    code.includes("failed-precondition") ||
    message.includes("محاولات") ||
    message.includes("مؤقت") ||
    message.includes("قفل") ||
    message.includes("locked") ||
    message.includes("too many")
  );
}

function EmailCodeGate({
  tenantId,
  currentUserEmail,
  sessionKey,
  page,
  pageLabel,
  onVerified,
}: {
  tenantId: string;
  currentUserEmail: string;
  sessionKey: string;
  page: string;
  pageLabel: string;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [lockedUntilMs, setLockedUntilMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const auth = useAuth() as any;
  const firebaseUser = auth?.user;

  const maskedEmail = useMemo(() => maskEmailForAccess(currentUserEmail), [currentUserEmail]);

  const normalizedCurrentUserEmail = useMemo(
    () => normalizeEmailForAccessCheck(currentUserEmail),
    [currentUserEmail]
  );

  const lockStorageKey = useMemo(
    () =>
      `exam-manager:email-code-lock:${tenantId || "unknown"}:${page || "unknown"}:${
        normalizedCurrentUserEmail || "unknown"
      }`,
    [normalizedCurrentUserEmail, page, tenantId]
  );

  const remainingLockMs = Math.max(0, lockedUntilMs - nowMs);
  const isLocked = remainingLockMs > 0;
  const lockCountdown = formatLockCountdown(remainingLockMs);

  const clearLocalLock = useCallback(() => {
    setLockedUntilMs(0);
    setNowMs(Date.now());
    try {
      window.localStorage.removeItem(lockStorageKey);
    } catch {
      // Ignore local storage failures.
    }
  }, [lockStorageKey]);

  const applyLock = useCallback(
    (lockUntilMaybe?: number | string | null) => {
      let nextLockedUntil = 0;

      if (typeof lockUntilMaybe === "number" && Number.isFinite(lockUntilMaybe)) {
        nextLockedUntil = lockUntilMaybe;
      } else if (typeof lockUntilMaybe === "string") {
        const parsed = Date.parse(lockUntilMaybe);
        if (Number.isFinite(parsed)) nextLockedUntil = parsed;
      }

      if (!nextLockedUntil || nextLockedUntil <= Date.now()) {
        nextLockedUntil = Date.now() + EMAIL_CODE_LOCK_MS;
      }

      setLockedUntilMs(nextLockedUntil);
      setNowMs(Date.now());
      setCode("");
      setCodeSent(false);
      setEmailConfirmed(false);
      setMessage("");
      setError("تم استنفاد عدد محاولات التحقق. يمكنك طلب رمز جديد بعد انتهاء العد التنازلي.");

      try {
        window.localStorage.setItem(lockStorageKey, String(nextLockedUntil));
      } catch {
        // Ignore local storage failures. The server-side lock still applies.
      }
    },
    [lockStorageKey]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = Number(window.localStorage.getItem(lockStorageKey) || "0");
      if (Number.isFinite(stored) && stored > Date.now()) {
        setLockedUntilMs(stored);
        setNowMs(Date.now());
        setCode("");
        setCodeSent(false);
        setEmailConfirmed(false);
      } else {
        window.localStorage.removeItem(lockStorageKey);
      }
    } catch {
      // Ignore local storage failures.
    }
  }, [lockStorageKey]);

  useEffect(() => {
    if (!isLocked) return undefined;

    const interval = window.setInterval(() => {
      const current = Date.now();
      setNowMs(current);

      if (lockedUntilMs <= current) {
        clearLocalLock();
        setError("");
        setMessage("انتهت مدة القفل المؤقت. يمكنك إدخال البريد وطلب رمز جديد الآن.");
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [clearLocalLock, isLocked, lockedUntilMs]);

  const sendCode = useCallback(async () => {
    if (isLocked) {
      setError(`تم إيقاف طلب رمز جديد مؤقتًا. الوقت المتبقي: ${lockCountdown}`);
      return;
    }

    if (!tenantId) {
      setError("معرف المركز غير متوفر.");
      return;
    }

    const expectedEmail = normalizeEmailForAccessCheck(currentUserEmail);
    const enteredEmail = normalizeEmailForAccessCheck(confirmEmail);

    if (!expectedEmail) {
      setEmailConfirmed(false);
      setError("البريد الإلكتروني المسجل للحساب غير متوفر.");
      return;
    }

    if (!enteredEmail || enteredEmail !== expectedEmail) {
      setEmailConfirmed(false);
      setCodeSent(false);
      setCode("");
      setError("البريد الإلكتروني غير مطابق للحساب الحالي. لن يتم إرسال رمز الدخول.");
      return;
    }

    setEmailConfirmed(true);
    setSending(true);
    setError("");
    setMessage("");

    try {
      const data = await callUnifiedEmailAccessWorker("/api/teachers12/request-code", firebaseUser, {
        tenantId,
        page,
        to: expectedEmail,
      });

      clearLocalLock();
      setCodeSent(true);
      setMessage(data?.message || "تم إرسال رمز الدخول إلى البريد الإلكتروني المسجل للحساب.");
    } catch (err: any) {
      console.error(`send ${page} access code failed:`, err);

      if (isLockError(err)) {
        applyLock(extractLockUntilFromError(err));
        return;
      }

      setError(err?.message || "تعذر إرسال رمز الدخول إلى البريد الإلكتروني.");
    } finally {
      setSending(false);
    }
  }, [
    applyLock,
    clearLocalLock,
    confirmEmail,
    currentUserEmail,
    isLocked,
    lockCountdown,
    page,
    pageLabel,
    tenantId,
  ]);

  const verifyCode = useCallback(async () => {
    if (isLocked) {
      setError(`تم إيقاف التحقق مؤقتًا. الوقت المتبقي: ${lockCountdown}`);
      return;
    }

    const normalized = normalizeEmailAccessCode(code);
    if (normalized.length !== 6) {
      setError("أدخل رمزًا مكونًا من 6 أرقام.");
      return;
    }

    setVerifying(true);
    setError("");
    setMessage("");

    try {
      const expectedEmail = normalizeEmailForAccessCheck(currentUserEmail);

      await callUnifiedEmailAccessWorker("/api/teachers12/verify-code", firebaseUser, {
        tenantId,
        page,
        to: expectedEmail,
        code: normalized,
      });
      try {
        window.localStorage.setItem(
          sessionKey,
          JSON.stringify({ expiresAt: Date.now() + EMAIL_GATE_ACCESS_SESSION_DURATION_MS })
        );
      } catch {
        // Ignore storage failures; the current state still unlocks the page.
      }
      clearLocalLock();
      setCode("");
      setMessage("تم التحقق بنجاح.");
      onVerified();
    } catch (err: any) {
      console.error(`verify ${page} access code failed:`, err);

      if (isLockError(err)) {
        applyLock(extractLockUntilFromError(err));
        return;
      }

      setError(err?.message || "رمز الدخول غير صحيح أو انتهت صلاحيته.");
    } finally {
      setVerifying(false);
    }
  }, [applyLock, clearLocalLock, code, isLocked, lockCountdown, onVerified, page, sessionKey, tenantId]);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 16,
    border: "1px solid rgba(180, 137, 37, 0.55)",
    background: "#fffdf5",
    color: "#000",
    fontWeight: 900,
    fontSize: 18,
    outline: "none",
    textAlign: "center",
    letterSpacing: 4,
    boxSizing: "border-box",
  };

  const emailInputStyle: React.CSSProperties = {
    ...inputStyle,
    direction: "ltr",
    textAlign: "center",
    letterSpacing: 0,
  };

  const buttonStyle: React.CSSProperties = {
    border: "1px solid rgba(164, 120, 24, 0.55)",
    borderRadius: 16,
    padding: "12px 18px",
    background: "linear-gradient(135deg, #fff8df, #e5c769)",
    color: "#000",
    fontWeight: 900,
    fontSize: 15,
    cursor: sending || verifying || isLocked ? "not-allowed" : "pointer",
    opacity: sending || verifying || isLocked ? 0.7 : 1,
  };

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(135deg, #fff9e8, #f6edcf)",
        padding: 24,
        color: "#000",
        fontWeight: 900,
      }}
    >
      <section
        style={{
          width: "min(760px, 100%)",
          borderRadius: 28,
          border: "2px solid rgba(201, 164, 70, 0.55)",
          background: "rgba(255, 255, 255, 0.94)",
          boxShadow: "0 22px 55px rgba(94, 64, 8, 0.18)",
          padding: 28,
          color: "#000",
          fontWeight: 900,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            padding: "7px 14px",
            borderRadius: 999,
            border: "1px solid rgba(201, 164, 70, 0.7)",
            background: "#fff7db",
            color: "#000",
            fontWeight: 900,
            marginBottom: 14,
          }}
        >
          تحقق أمني
        </div>

        <h1 style={{ margin: "0 0 10px", fontSize: 30, color: "#000", fontWeight: 900 }}>
          رمز دخول عبر البريد الإلكتروني
        </h1>
        <p style={{ margin: "0 0 18px", lineHeight: 1.9, color: "#000", fontWeight: 900 }}>
          لحماية صفحة {pageLabel}، أدخل البريد الإلكتروني الصحيح للحساب أولًا، ثم اطلب رمز الدخول.
        </p>

        <div
          style={{
            border: "1px solid rgba(201, 164, 70, 0.45)",
            borderRadius: 18,
            padding: 16,
            background: "#fffaf0",
            marginBottom: 16,
            color: "#000",
            fontWeight: 900,
          }}
        >
          البريد المسجل: <span style={{ color: "#000", fontWeight: 900 }}>{maskedEmail || "غير متوفر"}</span>
        </div>

        {isLocked ? (
          <div
            style={{
              border: "2px solid rgba(185, 28, 28, 0.35)",
              borderRadius: 22,
              background: "#fff1f2",
              padding: 22,
              textAlign: "center",
              color: "#000",
              fontWeight: 900,
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 10, color: "#000", fontWeight: 900 }}>
              تم إيقاف التحقق مؤقتًا بعد استنفاد عدد المحاولات.
            </div>
            <div style={{ fontSize: 44, letterSpacing: 3, color: "#000", fontWeight: 900 }}>
              {lockCountdown}
            </div>
            <div style={{ marginTop: 10, lineHeight: 1.8, color: "#000", fontWeight: 900 }}>
              لن يظهر إدخال البريد أو طلب الرمز حتى انتهاء العد التنازلي.
            </div>
          </div>
        ) : (
          <>
            <label style={{ display: "block", marginBottom: 8, color: "#000", fontWeight: 900 }}>
              أدخل البريد الإلكتروني الخاص بالحساب
            </label>
            <input
              value={confirmEmail}
              onChange={(event) => {
                setConfirmEmail(event.target.value);
                setEmailConfirmed(false);
                setCodeSent(false);
                setCode("");
                setMessage("");
                setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void sendCode();
              }}
              inputMode="email"
              autoComplete="new-password"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          name="cloud_storage_health12_email_gate_no_autofill"
          id="cloud_storage_health12_email_gate_no_autofill"
              placeholder="example@domain.com"
              style={emailInputStyle}
            />

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16, marginBottom: 16 }}>
              <button type="button" onClick={sendCode} disabled={sending || verifying || isLocked} style={buttonStyle}>
                {sending
                  ? "جاري إرسال الرمز..."
                  : codeSent
                    ? "إعادة إرسال الرمز"
                    : "تأكيد البريد وإرسال رمز الدخول"}
              </button>
            </div>

            {emailConfirmed && codeSent ? (
              <>
                <label style={{ display: "block", marginBottom: 8, color: "#000", fontWeight: 900 }}>
                  رمز التحقق
                </label>
                <input
                  value={code}
                  onChange={(event) => setCode(normalizeEmailAccessCode(event.target.value))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void verifyCode();
                  }}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  style={inputStyle}
                />

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
                  <button type="button" onClick={verifyCode} disabled={verifying || sending || isLocked} style={buttonStyle}>
                    {verifying ? "جاري التحقق..." : "تأكيد الرمز وفتح الصفحة"}
                  </button>
                </div>
              </>
            ) : null}
          </>
        )}

        {message && !isLocked ? (
          <div
            style={{
              marginTop: 16,
              borderRadius: 16,
              border: "1px solid rgba(22, 101, 52, 0.28)",
              background: "#ecfdf5",
              color: "#000",
              fontWeight: 900,
              padding: 14,
            }}
          >
            {message}
          </div>
        ) : null}

        {error && !isLocked ? (
          <div
            style={{
              marginTop: 16,
              borderRadius: 16,
              border: "1px solid rgba(185, 28, 28, 0.28)",
              background: "#fff1f2",
              color: "#000",
              fontWeight: 900,
              padding: 14,
            }}
          >
            {error}
          </div>
        ) : null}
      </section>
    </main>
  );
}

/**
 * Diploma protected page.
 *
 * This wrapper keeps the diploma route/page explicit and requires
 * an email verification code before the shared page is mounted.
 */
export default function CloudStorageHealth12() {
  const auth = useAuth() as any;
  const tenantId = useMemo(
    () => String(auth?.effectiveTenantId || auth?.tenantId || auth?.user?.tenantId || "").trim(),
    [auth?.effectiveTenantId, auth?.tenantId, auth?.user?.tenantId]
  );
  const currentUserEmail = useMemo(
    () => String(auth?.user?.email || auth?.profile?.email || auth?.userProfile?.email || "").trim(),
    [auth?.user?.email, auth?.profile?.email, auth?.userProfile?.email]
  );
  const sessionKey = useMemo(() => `exam-manager:cloudstoragehealth12-email-code-access:${tenantId}`, [tenantId]);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let hasValidEmailGateSession = false;

    try {
      const rawAccessSession = window.localStorage.getItem(sessionKey) || "";
      const nowMs = Date.now();

      if (rawAccessSession === "1") {
        window.localStorage.setItem(
          sessionKey,
          JSON.stringify({ expiresAt: nowMs + EMAIL_GATE_ACCESS_SESSION_DURATION_MS })
        );
        hasValidEmailGateSession = true;
      } else if (rawAccessSession) {
        const parsedAccessSession = JSON.parse(rawAccessSession) as { expiresAt?: number };
        const expiresAt = Number(parsedAccessSession?.expiresAt || 0);

        if (Number.isFinite(expiresAt) && expiresAt > nowMs) {
          hasValidEmailGateSession = true;
        } else {
          window.localStorage.removeItem(sessionKey);
        }
      }
    } catch {
      window.localStorage.removeItem(sessionKey);
    }

    setVerified(hasValidEmailGateSession);
  }, [sessionKey]);

  if (!verified) {
    return (
      <EmailCodeGate
        tenantId={tenantId}
        currentUserEmail={currentUserEmail}
        sessionKey={sessionKey}
        page="CloudStorageHealth12"
        pageLabel="فحص التخزين السحابي"
        onVerified={() => setVerified(true)}
      />
    );
  }

  return <CloudStorageHealth />;
}
