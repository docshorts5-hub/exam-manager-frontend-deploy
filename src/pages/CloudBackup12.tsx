import { getAccessWorkerUrl } from "../lib/accessWorkerUrl";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import CloudBackup from "./CloudBackup";

function normalizeEmailAccessCode(value: string): string {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, 6);
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
  return String(value || "")
    .trim()
    .toLowerCase();
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

const EMAIL_CODE_LOCK_MS = 5 * 60 * 1000;

function formatEmailGateCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.ceil(Number(totalSeconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getStoredEmailGateLockUntil(storageKey: string): string {
  if (typeof window === "undefined") return "";
  try {
    const stored = window.localStorage.getItem(storageKey) || "";
    if (!stored) return "";
    const time = Date.parse(stored);
    if (!Number.isFinite(time) || time <= Date.now()) {
      window.localStorage.removeItem(storageKey);
      return "";
    }
    return new Date(time).toISOString();
  } catch {
    return "";
  }
}

function storeEmailGateLockUntil(
  storageKey: string,
  lockedUntilISO: string,
): void {
  if (typeof window === "undefined") return;
  try {
    if (!lockedUntilISO) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, lockedUntilISO);
  } catch {
    // Ignore localStorage failures; Firestore/server lock still protects sending and verification.
  }
}

function clearEmailGateLock(storageKey: string): void {
  storeEmailGateLockUntil(storageKey, "");
}

function extractEmailGateLockedUntil(error: any): string {
  const details = error?.details || error?.customData?._tokenResponse || {};
  const direct =
    details?.lockedUntilISO ||
    details?.lockUntilISO ||
    details?.retryAtISO ||
    "";
  if (direct && Number.isFinite(Date.parse(String(direct))))
    return String(direct);

  const retryAfterSeconds = Number(
    details?.retryAfterSeconds || details?.retryAfter || 0,
  );
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return new Date(Date.now() + retryAfterSeconds * 1000).toISOString();
  }

  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "");
  if (
    code.includes("resource-exhausted") ||
    message.includes("محاولات") ||
    message.includes("القفل")
  ) {
    return new Date(Date.now() + EMAIL_CODE_LOCK_MS).toISOString();
  }

  return "";
}

function EmailCodeGate({
  tenantId,
  currentUserEmail,
  sessionKey,
  lockKey,
  page,
  pageLabel,
  onVerified,
}: {
  tenantId: string;
  currentUserEmail: string;
  sessionKey: string;
  lockKey: string;
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
  const [lockedUntilISO, setLockedUntilISO] = useState("");
  const [remainingLockSeconds, setRemainingLockSeconds] = useState(0);

  const auth = useAuth() as any;
  const firebaseUser = auth?.user;

  const maskedEmail = useMemo(
    () => maskEmailForAccess(currentUserEmail),
    [currentUserEmail],
  );
  const isLocked = remainingLockSeconds > 0;

  const activateLock = useCallback(
    (untilISO: string) => {
      const fallbackISO = new Date(
        Date.now() + EMAIL_CODE_LOCK_MS,
      ).toISOString();
      const nextISO =
        untilISO && Number.isFinite(Date.parse(untilISO))
          ? untilISO
          : fallbackISO;
      const nextSeconds = Math.max(
        1,
        Math.ceil((Date.parse(nextISO) - Date.now()) / 1000),
      );
      setLockedUntilISO(nextISO);
      setRemainingLockSeconds(nextSeconds);
      setEmailConfirmed(false);
      setCodeSent(false);
      setCode("");
      setMessage("");
      setError(
        `تم تجاوز عدد محاولات التحقق. يمكنك طلب رمز جديد بعد ${formatEmailGateCountdown(nextSeconds)}.`,
      );
      storeEmailGateLockUntil(lockKey, nextISO);
    },
    [lockKey],
  );

  const clearLock = useCallback(() => {
    setLockedUntilISO("");
    setRemainingLockSeconds(0);
    clearEmailGateLock(lockKey);
  }, [lockKey]);

  useEffect(() => {
    const storedLock = getStoredEmailGateLockUntil(lockKey);
    if (storedLock) {
      const seconds = Math.max(
        1,
        Math.ceil((Date.parse(storedLock) - Date.now()) / 1000),
      );
      setLockedUntilISO(storedLock);
      setRemainingLockSeconds(seconds);
      setEmailConfirmed(false);
      setCodeSent(false);
      setCode("");
      setMessage("");
      setError(
        `تم تجاوز عدد محاولات التحقق. يمكنك طلب رمز جديد بعد ${formatEmailGateCountdown(seconds)}.`,
      );
    }
  }, [lockKey]);

  useEffect(() => {
    if (!lockedUntilISO) return;
    const tick = () => {
      const seconds = Math.max(
        0,
        Math.ceil((Date.parse(lockedUntilISO) - Date.now()) / 1000),
      );
      setRemainingLockSeconds(seconds);
      if (seconds <= 0) {
        setLockedUntilISO("");
        setError("");
        clearEmailGateLock(lockKey);
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [lockKey, lockedUntilISO]);

  const sendCode = useCallback(async () => {
    if (!tenantId) {
      setError("معرف المركز غير متوفر.");
      return;
    }

    if (isLocked) {
      setError(
        `تم تجاوز عدد محاولات التحقق. يمكنك طلب رمز جديد بعد ${formatEmailGateCountdown(remainingLockSeconds)}.`,
      );
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
      setError(
        "البريد الإلكتروني غير مطابق للحساب الحالي. لن يتم إرسال رمز الدخول.",
      );
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
      clearLock();
      setCodeSent(true);
      setMessage(
        data?.message ||
          "تم إرسال رمز الدخول إلى البريد الإلكتروني المسجل للحساب.",
      );
    } catch (err: any) {
      console.error(`send ${page} access code failed:`, err);
      const lockISO = extractEmailGateLockedUntil(err);
      if (lockISO) {
        activateLock(lockISO);
      } else {
        setError(
          err?.message || "تعذر إرسال رمز الدخول إلى البريد الإلكتروني.",
        );
      }
    } finally {
      setSending(false);
    }
  }, [
    activateLock,
    clearLock,
    confirmEmail,
    currentUserEmail,
    isLocked,
    page,
    pageLabel,
    remainingLockSeconds,
    tenantId,
  ]);

  const verifyCode = useCallback(async () => {
    if (isLocked) {
      setError(
        `تم تجاوز عدد محاولات التحقق. يمكنك طلب رمز جديد بعد ${formatEmailGateCountdown(remainingLockSeconds)}.`,
      );
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
      clearLock();
      try {
        window.localStorage.setItem(
          sessionKey,
          JSON.stringify({ expiresAt: Date.now() + EMAIL_GATE_ACCESS_SESSION_DURATION_MS })
        );
      } catch {
        // Ignore storage failures; the current state still unlocks the page.
      }
      setCode("");
      setMessage("تم التحقق بنجاح.");
      onVerified();
    } catch (err: any) {
      console.error(`verify ${page} access code failed:`, err);
      const lockISO = extractEmailGateLockedUntil(err);
      if (lockISO) {
        activateLock(lockISO);
      } else {
        setError(err?.message || "رمز الدخول غير صحيح أو انتهت صلاحيته.");
      }
    } finally {
      setVerifying(false);
    }
  }, [
    activateLock,
    clearLock,
    code,
    isLocked,
    onVerified,
    page,
    remainingLockSeconds,
    sessionKey,
    tenantId,
  ]);

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

        <h1
          style={{
            margin: "0 0 10px",
            fontSize: 30,
            color: "#000",
            fontWeight: 900,
          }}
        >
          رمز دخول عبر البريد الإلكتروني
        </h1>
        <p
          style={{
            margin: "0 0 18px",
            lineHeight: 1.9,
            color: "#000",
            fontWeight: 900,
          }}
        >
          لحماية صفحة {pageLabel}، أدخل البريد الإلكتروني الصحيح للحساب أولًا،
          ثم اطلب رمز الدخول.
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
          البريد المسجل:{" "}
          <span style={{ color: "#000", fontWeight: 900 }}>
            {maskedEmail || "غير متوفر"}
          </span>
        </div>

        {isLocked ? (
          <div
            style={{
              border: "2px solid rgba(185, 28, 28, 0.35)",
              borderRadius: 20,
              background: "#fff1f2",
              color: "#000",
              fontWeight: 900,
              padding: 18,
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 18, marginBottom: 8 }}>
              تم إيقاف التحقق مؤقتًا بسبب استنفاد المحاولات.
            </div>
            <div style={{ fontSize: 34, letterSpacing: 2 }}>
              {formatEmailGateCountdown(remainingLockSeconds)}
            </div>
            <div style={{ marginTop: 8 }}>
              لا يمكن طلب رمز جديد أو إدخال رمز حتى انتهاء العد التنازلي.
            </div>
          </div>
        ) : null}

        {!isLocked ? (
          <>
            <label
              style={{
                display: "block",
                marginBottom: 8,
                color: "#000",
                fontWeight: 900,
              }}
            >
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
          name="cloud_backup12_email_gate_no_autofill"
          id="cloud_backup12_email_gate_no_autofill"
              placeholder="example@domain.com"
              style={emailInputStyle}
            />

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                marginTop: 16,
                marginBottom: 16,
              }}
            >
              <button
                type="button"
                onClick={sendCode}
                disabled={sending || verifying || isLocked}
                style={buttonStyle}
              >
                {sending
                  ? "جاري إرسال الرمز..."
                  : codeSent
                    ? "إعادة إرسال الرمز"
                    : "تأكيد البريد وإرسال رمز الدخول"}
              </button>
            </div>

            {emailConfirmed && codeSent ? (
              <>
                <label
                  style={{
                    display: "block",
                    marginBottom: 8,
                    color: "#000",
                    fontWeight: 900,
                  }}
                >
                  رمز التحقق
                </label>
                <input
                  value={code}
                  onChange={(event) =>
                    setCode(normalizeEmailAccessCode(event.target.value))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void verifyCode();
                  }}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  style={inputStyle}
                />

                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    marginTop: 16,
                  }}
                >
                  <button
                    type="button"
                    onClick={verifyCode}
                    disabled={verifying || sending || isLocked}
                    style={buttonStyle}
                  >
                    {verifying ? "جاري التحقق..." : "تأكيد الرمز وفتح الصفحة"}
                  </button>
                </div>
              </>
            ) : null}
          </>
        ) : null}

        {message ? (
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

        {error ? (
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
export default function CloudBackup12() {
  const auth = useAuth() as any;
  const tenantId = useMemo(
    () =>
      String(
        auth?.effectiveTenantId || auth?.tenantId || auth?.user?.tenantId || "",
      ).trim(),
    [auth?.effectiveTenantId, auth?.tenantId, auth?.user?.tenantId],
  );
  const currentUserEmail = useMemo(
    () =>
      String(
        auth?.user?.email ||
          auth?.profile?.email ||
          auth?.userProfile?.email ||
          "",
      ).trim(),
    [auth?.user?.email, auth?.profile?.email, auth?.userProfile?.email],
  );
  const sessionKey = useMemo(
    () => `exam-manager:cloudbackup12-email-code-access:${tenantId}`,
    [tenantId],
  );
  const lockKey = useMemo(
    () =>
      `exam-manager:cloudbackup12-email-code-lock:${tenantId}:${normalizeEmailForAccessCheck(currentUserEmail)}`,
    [currentUserEmail, tenantId],
  );
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
        lockKey={lockKey}
        page="CloudBackup12"
        pageLabel="النسخ السحابي"
        onVerified={() => setVerified(true)}
      />
    );
  }

  return <CloudBackup />;
}
