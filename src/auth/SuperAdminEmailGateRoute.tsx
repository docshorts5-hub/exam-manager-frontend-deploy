import { getAccessWorkerUrl } from "../lib/accessWorkerUrl";
import { callFn } from "../services/functionsClient";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

type Props = {
  children: React.ReactNode;
};

const ACCESS_WORKER_URL = getAccessWorkerUrl();
const ACCESS_LOCK_MINUTES = 5;
const ACCESS_PAGE = "SuperAdminArea";
const ACCESS_TENANT_ID = "system";

function normalizeEmail(value: any) {
  return String(value || "").trim().toLowerCase();
}

function normalizeCode(value: any) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function workerErrorMessage(data: any, fallback: string) {
  const error = String(data?.error || "");
  if (error === "PAGE_NOT_ALLOWED") return "هذه الصفحة غير مفعلة داخل Access Worker.";
  if (error === "TOO_MANY_ATTEMPTS") return "تم تجاوز عدد المحاولات. انتظر ثم حاول مرة أخرى.";
  if (error === "CODE_EXPIRED") return "انتهت صلاحية الرمز. اطلب رمزًا جديدًا.";
  if (error === "INVALID_CODE") return "رمز التحقق غير صحيح.";
  if (error === "UNAUTHORIZED") return "جلسة الدخول غير صالحة. سجّل الدخول مرة أخرى.";
  return fallback;
}

async function callAccessWorker(
  endpoint: "/api/teachers12/request-code" | "/api/teachers12/verify-code",
  firebaseUser: any,
  payload: Record<string, unknown>
) {
  const token = await firebaseUser?.getIdToken?.();

  if (!token) {
    throw new Error("تعذر الحصول على جلسة الدخول. سجّل الدخول مرة أخرى.");
  }

  const response = await fetch(`${ACCESS_WORKER_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.ok) {
    const error: any = new Error(
      workerErrorMessage(
        data,
        endpoint.includes("verify-code")
          ? "تعذر التحقق من الرمز."
          : "تعذر إرسال رمز الدخول."
      )
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function getLockFromError(error: any) {
  const status = Number(error?.status || 0);
  const code = String(error?.data?.error || "");
  const message = String(error?.message || "");

  if (
    status === 429 ||
    code === "TOO_MANY_ATTEMPTS" ||
    message.includes("تجاوز") ||
    message.toLowerCase().includes("too many")
  ) {
    return Date.now() + ACCESS_LOCK_MINUTES * 60 * 1000;
  }

  return 0;
}

export default function SuperAdminEmailGateRoute({ children }: Props) {
  const auth = useAuth() as any;
  const navigate = useNavigate();
  const user = auth?.user;
  const profile = auth?.profile || auth?.userProfile || null;

  // TOTP is already the second authentication factor.
  // Skip the additional email code gate after successful MFA.
  const skipEmailVerification = auth?.mfaSatisfied === true;

  const expectedEmail = normalizeEmail(user?.email || profile?.email || "");
  const lockKey = `yr:super-admin-area:email-code-lock:${expectedEmail || "unknown"}`;

  const emailInputName = useMemo(() => `super_admin_email_gate_${Math.random().toString(36).slice(2)}`, []);
  const codeInputName = useMemo(() => `super_admin_code_gate_${Math.random().toString(36).slice(2)}`, []);

  const [verified, setVerified] = useState(false);
  const [email, setEmail] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [lockedUntilMs, setLockedUntilMs] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    // Successful verification is intentionally memory-only.
    // Every mount, reload, or account change requires a fresh Worker verification.
    setVerified(false);
    setEmail("");
    setEmailConfirmed(false);
    setCodeSent(false);
    setCode("");
    setBusy(false);
    setMessage("");
    setError("");

    const storedLock = Number(
      window.localStorage.getItem(lockKey) || "0"
    );

    if (
      Number.isFinite(storedLock) &&
      storedLock > Date.now()
    ) {
      setLockedUntilMs(storedLock);
      setRemainingSeconds(
        Math.ceil(
          (storedLock - Date.now()) / 1000
        )
      );
    } else {
      window.localStorage.removeItem(lockKey);
      setLockedUntilMs(0);
      setRemainingSeconds(0);
    }
  }, [lockKey]);

  useEffect(() => {
    if (!lockedUntilMs) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntilMs - Date.now()) / 1000));
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        setLockedUntilMs(0);
        setError("");
        setMessage("");
        window.localStorage.removeItem(lockKey);
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [lockedUntilMs, lockKey]);

  const applyLock = (untilMs: number) => {
    setLockedUntilMs(untilMs);
    setRemainingSeconds(Math.ceil((untilMs - Date.now()) / 1000));
    setEmailConfirmed(false);
    setCodeSent(false);
    setCode("");
    setBusy(false);
    setMessage("");
    setError("تم تجاوز عدد المحاولات. انتظر انتهاء العد التنازلي قبل المحاولة مرة أخرى.");
    window.localStorage.setItem(lockKey, String(untilMs));
  };

  const sendCode = async () => {
    if (lockedUntilMs && lockedUntilMs > Date.now()) {
      setError(`انتظر ${remainingSeconds} ثانية قبل المحاولة مرة أخرى.`);
      return;
    }

    const enteredEmail = normalizeEmail(email);

    if (!expectedEmail) {
      setError("تعذر تحديد بريد الحساب الحالي. الرجاء تسجيل الدخول مرة أخرى.");
      return;
    }

    if (!enteredEmail || enteredEmail !== expectedEmail) {
      setEmailConfirmed(false);
      setCodeSent(false);
      setCode("");
      setError("البريد الإلكتروني غير مطابق للحساب الحالي. لن يتم إرسال رمز الدخول.");
      return;
    }

    setBusy(true);
    setEmailConfirmed(true);
    setError("");
    setMessage("");

    try {
      await callAccessWorker("/api/teachers12/request-code", user, {
        tenantId: ACCESS_TENANT_ID,
        page: ACCESS_PAGE,
        to: expectedEmail,
      });

      window.localStorage.removeItem(lockKey);
      setLockedUntilMs(0);
      setRemainingSeconds(0);
      setCodeSent(true);
      setMessage("تم إرسال رمز التحقق إلى بريدك الإلكتروني بنجاح.");
    } catch (err: any) {
      const locked = getLockFromError(err);
      if (locked) applyLock(locked);
      else setError(err?.message || "تعذر إرسال رمز الدخول إلى البريد الإلكتروني.");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (lockedUntilMs && lockedUntilMs > Date.now()) {
      setError("تم تجاوز عدد محاولات التحقق. انتظر انتهاء العد التنازلي.");
      return;
    }

    const cleanCode = normalizeCode(code);
    if (cleanCode.length !== 6) {
      setError("أدخل رمزًا مكونًا من 6 أرقام.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (!expectedEmail) {
        throw new Error("بريد الحساب غير متوفر.");
      }

      await callAccessWorker("/api/teachers12/verify-code", user, {
        tenantId: ACCESS_TENANT_ID,
        page: ACCESS_PAGE,
        to: expectedEmail,
        code: cleanCode,
      });

      window.localStorage.removeItem(lockKey);
      setLockedUntilMs(0);
      setRemainingSeconds(0);

      // Do not persist authorization in localStorage or sessionStorage.
      // The verified state remains valid only for this mounted component.

      setVerified(true);
      setCode("");
      setMessage("تم التحقق بنجاح.");
    } catch (err: any) {
      const locked = getLockFromError(err);
      if (locked) applyLock(locked);
      else setError(err?.message || "رمز الدخول غير صحيح أو انتهت صلاحيته.");
    } finally {
      setBusy(false);
    }
  };

  const logoutToLogin = async () => {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (typeof auth?.logout === "function") {
        await auth.logout();
      }
    } catch (err) {
      console.error("super admin email gate logout failed:", err);
    } finally {
      setVerified(false);
      setEmail("");
      setEmailConfirmed(false);
      setCodeSent(false);
      setCode("");
      setBusy(false);
      navigate("/login", { replace: true });
    }
  };

  // LOCAL UI REVIEW ONLY.
  // Restricted to Vite DEV + localhost + Auth Emulator + Firestore Emulator.
  // Never use this as production authorization.
  const localUiReviewMode =
    Boolean((import.meta as any).env?.DEV) &&
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
    String((import.meta as any).env?.VITE_LOCAL_UI_REVIEW_MODE ?? "").toLowerCase() === "true" &&
    String((import.meta as any).env?.VITE_USE_AUTH_EMULATOR ?? "").toLowerCase() === "true" &&
    String((import.meta as any).env?.VITE_USE_FIRESTORE_EMULATOR ?? "").toLowerCase() === "true";

  if (localUiReviewMode) {
    return <>{children}</>;
  }

  if (verified || skipEmailVerification) {
    return <>{children}</>;
  }

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f7f3e7 0%, #efe4c8 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "Tahoma, Arial, sans-serif",
        color: "#000",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 620,
          background: "#fffaf0",
          border: "4px solid #d4af37",
          borderRadius: 26,
          padding: 28,
          boxShadow: "0 18px 45px rgba(0,0,0,0.18)",
        }}
      >
        <style>{`
          .superAdminEmailGateInput,
          .superAdminEmailGateInput:focus,
          .superAdminEmailGateInput:hover {
            color: #111827 !important;
            -webkit-text-fill-color: #111827 !important;
            caret-color: #111827 !important;
            opacity: 1 !important;
            text-shadow: none !important;
            background: #fffdf7 !important;
            font-weight: 1000 !important;
          }

          .superAdminEmailGateInput::placeholder {
            color: #6b7280 !important;
            -webkit-text-fill-color: #6b7280 !important;
            opacity: 1 !important;
            font-weight: 900 !important;
          }

          .superAdminEmailGateInput:-webkit-autofill,
          .superAdminEmailGateInput:-webkit-autofill:hover,
          .superAdminEmailGateInput:-webkit-autofill:focus {
            color: #111827 !important;
            -webkit-text-fill-color: #111827 !important;
            caret-color: #111827 !important;
            -webkit-box-shadow: 0 0 0 1000px #fffdf7 inset !important;
            box-shadow: 0 0 0 1000px #fffdf7 inset !important;
            transition: background-color 9999s ease-in-out 0s !important;
          }
        `}</style>

        <h1 style={{ margin: "0 0 10px", textAlign: "center", fontSize: 28, fontWeight: 1000 }}>
          تحقق برمز البريد لفتح صفحات مالك المنصة
        </h1>

        <p style={{ margin: "0 0 18px", textAlign: "center", lineHeight: 1.9, fontWeight: 900 }}>
          أدخل بريد الحساب الحالي، ثم رمز التحقق المرسل إلى البريد. الجلسة صالحة لمدة 10 دقائق فقط.
        </p>

        <input
          className="superAdminEmailGateInput"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setEmailConfirmed(false);
            setCodeSent(false);
            setCode("");
            setError("");
            setMessage("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") void sendCode();
          }}
          type="text"
          inputMode="email"
          autoComplete="new-password"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          name={emailInputName}
          id={emailInputName}
          placeholder="أدخل البريد الإلكتروني المرتبط بالحساب"
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "3px solid #d4af37",
            borderRadius: 16,
            padding: "13px 15px",
            marginBottom: 12,
            fontSize: 18,
            fontWeight: 1000,
            color: "#111827",
            background: "#fff",
          }}
        />

        {codeSent && emailConfirmed ? (
          <input
            className="superAdminEmailGateInput"
            value={code}
            onChange={(event) => setCode(normalizeCode(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === "Enter") void verifyCode();
            }}
            type="text"
            inputMode="numeric"
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            name={codeInputName}
            id={codeInputName}
            maxLength={6}
            placeholder="أدخل رمز التحقق المكون من 6 أرقام"
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "3px solid #ef4444",
              borderRadius: 16,
              padding: "13px 15px",
              marginBottom: 12,
              fontSize: 20,
              fontWeight: 1000,
              color: "#111827",
              background: "#fff",
              direction: "ltr",
              textAlign: "center",
              letterSpacing: 4,
            }}
          />
        ) : null}

        {message ? (
          <div style={{ marginTop: 12, color: "#065f46", background: "#ecfdf5", border: "2px solid #34d399", borderRadius: 14, padding: 12, fontWeight: 1000, textAlign: "center" }}>
            {message}
          </div>
        ) : null}

        {error ? (
          <div style={{ marginTop: 12, color: "#000", background: "#fef2f2", border: "2px solid #ef4444", borderRadius: 14, padding: 12, fontWeight: 1000, textAlign: "center" }}>
            {error}
            {lockedUntilMs && remainingSeconds > 0 ? (
              <div style={{ marginTop: 6 }}>المتبقي: {remainingSeconds} ثانية</div>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 18 }}>
          <button
            type="button"
            disabled={busy || Boolean(lockedUntilMs && lockedUntilMs > Date.now())}
            onClick={() => void sendCode()}
            style={{
              minWidth: 160,
              border: "3px solid #22c55e",
              borderRadius: 16,
              padding: "12px 16px",
              fontWeight: 1000,
              cursor: busy ? "not-allowed" : "pointer",
              background: "linear-gradient(180deg, #dcfce7 0%, #bbf7d0 100%)",
            }}
          >
            {busy ? "جارٍ الإرسال..." : "إرسال رمز الدخول"}
          </button>

          <button
            type="button"
            disabled={busy || !codeSent || !emailConfirmed}
            onClick={() => void verifyCode()}
            style={{
              minWidth: 170,
              border: "3px solid #ef4444",
              borderRadius: 16,
              padding: "12px 16px",
              fontWeight: 1000,
              cursor: busy ? "not-allowed" : "pointer",
              background: "linear-gradient(180deg, #fee2e2 0%, #fca5a5 100%)",
            }}
          >
            {busy ? "جارٍ التحقق..." : "تحقق وفتح الصفحات"}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => void logoutToLogin()}
            style={{
              minWidth: 150,
              border: "3px solid #6b7280",
              borderRadius: 16,
              padding: "12px 16px",
              fontWeight: 1000,
              cursor: busy ? "not-allowed" : "pointer",
              background: "linear-gradient(180deg, #f3f4f6 0%, #e5e7eb 100%)",
              color: "#111827",
            }}
          >
            تسجيل خروج والعودة للدخول
          </button>
        </div>
      </div>
    </div>
  );
}





