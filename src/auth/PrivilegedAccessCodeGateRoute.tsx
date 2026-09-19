import { getAccessWorkerUrl } from "../lib/accessWorkerUrl";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

type PrivilegedAccessPage = "GovernorateSuperSystem" | "MinistrySuperSystem";

type Props = {
  children: React.ReactNode;
  page: PrivilegedAccessPage;
  tenantId?: string;
  title?: string;
};

const ACCESS_WORKER_URL = getAccessWorkerUrl();
const PREFIX = "yr:privileged-signed-access-grant";

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeCode(value: unknown): string {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function maskEmail(value: unknown): string {
  const email = normalizeEmail(value);
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  if (name.length <= 2) return `${name.slice(0, 1)}***@${domain}`;
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

function workerErrorMessage(data: any, fallback: string): string {
  const error = String(data?.error || "");

  if (error === "PAGE_NOT_ALLOWED") return "هذه البوابة غير مفعلة داخل خدمة التحقق.";
  if (error === "TOO_MANY_ATTEMPTS") return "تم تجاوز عدد محاولات التحقق. اطلب رمزًا جديدًا لاحقًا.";
  if (error === "CODE_EXPIRED_OR_NOT_FOUND") return "انتهت صلاحية الرمز أو لم يعد موجودًا. اطلب رمزًا جديدًا.";
  if (error === "INVALID_CODE") return "رمز التحقق غير صحيح.";
  if (error === "EMAIL_MUST_MATCH_AUTHENTICATED_FIREBASE_ACCOUNT") return "بريد الحساب لا يطابق البريد الموثق في جلسة Firebase الحالية.";
  if (error === "ACCESS_GRANT_SECRET_NOT_CONFIGURED") return "خدمة جلسة التحقق الموقعة لم يتم تفعيلها بعد على الخادم.";
  if (error === "ACCESS_GRANT_EXPIRED") return "انتهت صلاحية جلسة التحقق. أدخل رمزًا جديدًا.";
  if (error === "ACCESS_GRANT_CONTEXT_MISMATCH") return "جلسة التحقق لا تطابق الحساب أو البوابة الحالية.";
  if (error === "UNAUTHORIZED" || error.includes("FIREBASE_TOKEN")) return "جلسة تسجيل الدخول غير صالحة. سجّل الدخول مرة أخرى.";

  return String(data?.message || fallback);
}

async function callAccessWorker(
  endpoint: "/api/teachers12/request-code" | "/api/teachers12/verify-code" | "/api/privileged-access/verify-grant",
  firebaseUser: any,
  payload: Record<string, unknown>
) {
  const token = await firebaseUser?.getIdToken?.();

  if (!token) {
    throw new Error("تعذر الحصول على جلسة Firebase الحالية. سجّل الدخول مرة أخرى.");
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
        endpoint.includes("request-code")
          ? "تعذر إرسال رمز الدخول."
          : endpoint.includes("verify-code")
            ? "تعذر التحقق من رمز الدخول."
            : "تعذر التحقق من الجلسة الموقعة."
      )
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export default function PrivilegedAccessCodeGateRoute({
  children,
  page,
  tenantId = "system",
  title,
}: Props) {
  const auth = useAuth() as any;
  const navigate = useNavigate();
  const user = auth?.user;

  // LOCAL UI REVIEW ONLY.
  // Vite DEV + localhost + Auth Emulator + Firestore Emulator are all required.
  // SuperRoute authorization has already run before this gate.
  // Production privileged-access verification remains unchanged.
  const localUiReviewMode =
    Boolean((import.meta as any).env?.DEV) &&
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
    String((import.meta as any).env?.VITE_LOCAL_UI_REVIEW_MODE ?? "").toLowerCase() === "true" &&
    String((import.meta as any).env?.VITE_USE_AUTH_EMULATOR ?? "").toLowerCase() === "true" &&
    String((import.meta as any).env?.VITE_USE_FIRESTORE_EMULATOR ?? "").toLowerCase() === "true";

  const expectedEmail = useMemo(() => normalizeEmail(user?.email || ""), [user?.email]);
  const safeTenantId = useMemo(() => String(tenantId || "system").trim() || "system", [tenantId]);
  const sessionKey = useMemo(
    () => `${PREFIX}:${page}:${safeTenantId}:${expectedEmail || "unknown"}`,
    [page, safeTenantId, expectedEmail]
  );

  const resolvedTitle =
    title ||
    (page === "GovernorateSuperSystem"
      ? "التحقق الأمني لمشرف المحافظة"
      : "التحقق الأمني لمشرف الوزارة");

  const [checking, setChecking] = useState(true);
  const [verified, setVerified] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const verifyStoredGrant = async () => {
      if (localUiReviewMode) return;
      setChecking(true);
      setVerified(false);

      if (!user || !expectedEmail) {
        if (active) setChecking(false);
        return;
      }

      let accessGrant = "";

      try {
        accessGrant = window.sessionStorage.getItem(sessionKey) || "";
      } catch {
        accessGrant = "";
      }

      if (!accessGrant) {
        if (active) setChecking(false);
        return;
      }

      try {
        const data = await callAccessWorker("/api/privileged-access/verify-grant", user, {
          tenantId: safeTenantId,
          page,
          to: expectedEmail,
          accessGrant,
        });

        if (!data?.accessGranted) throw new Error("الجلسة الموقعة غير صالحة.");

        if (active) {
          setVerified(true);
          setError("");
        }
      } catch {
        try {
          window.sessionStorage.removeItem(sessionKey);
        } catch {
          // Ignore storage cleanup failure.
        }

        if (active) setVerified(false);
      } finally {
        if (active) setChecking(false);
      }
    };

    void verifyStoredGrant();

    return () => {
      active = false;
    };
  }, [expectedEmail, localUiReviewMode, page, safeTenantId, sessionKey, user]);

  const sendCode = async () => {
    if (!expectedEmail) {
      setError("تعذر تحديد بريد حساب Firebase الحالي. سجّل الدخول مرة أخرى.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await callAccessWorker("/api/teachers12/request-code", user, {
        tenantId: safeTenantId,
        page,
        to: expectedEmail,
      });

      setCode("");
      setCodeSent(true);
      setMessage("تم إرسال رمز التحقق إلى بريد الحساب الموثق.");
    } catch (err: any) {
      setError(err?.message || "تعذر إرسال رمز الدخول.");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    const cleanCode = normalizeCode(code);

    if (cleanCode.length !== 6) {
      setError("أدخل رمز التحقق المكون من 6 أرقام.");
      return;
    }

    if (!expectedEmail) {
      setError("بريد حساب Firebase الحالي غير متوفر.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await callAccessWorker("/api/teachers12/verify-code", user, {
        tenantId: safeTenantId,
        page,
        to: expectedEmail,
        code: cleanCode,
      });

      const accessGrant = String(result?.accessGrant || "").trim();

      if (!accessGrant) {
        throw new Error("لم يتم إصدار جلسة تحقق موقعة.");
      }

      const verifiedGrant = await callAccessWorker("/api/privileged-access/verify-grant", user, {
        tenantId: safeTenantId,
        page,
        to: expectedEmail,
        accessGrant,
      });

      if (!verifiedGrant?.accessGranted) {
        throw new Error("تعذر اعتماد جلسة التحقق الموقعة.");
      }

      window.sessionStorage.setItem(sessionKey, accessGrant);

      setVerified(true);
      setCode("");
      setCodeSent(false);
      setMessage("تم التحقق بنجاح.");
    } catch (err: any) {
      try {
        window.sessionStorage.removeItem(sessionKey);
      } catch {
        // Ignore storage cleanup failure.
      }

      setVerified(false);
      setError(err?.message || "رمز الدخول غير صحيح أو انتهت صلاحيته.");
    } finally {
      setBusy(false);
    }
  };

  const logoutToLogin = async () => {
    setBusy(true);

    try {
      window.sessionStorage.removeItem(sessionKey);
    } catch {
      // Ignore storage cleanup failure.
    }

    try {
      if (typeof auth?.logout === "function") await auth.logout();
    } finally {
      setVerified(false);
      navigate("/login", { replace: true });
    }
  };

  if (localUiReviewMode || verified) return <>{children}</>;

  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 620,
    background: "#fffaf0",
    border: "4px solid #15803d",
    borderRadius: 26,
    padding: 28,
    boxShadow: "0 18px 45px rgba(0,0,0,0.18)",
  };

  if (checking) {
    return (
      <div dir="rtl" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "linear-gradient(180deg, #f4fbf6 0%, #e8f5ec 100%)", fontFamily: "Tahoma, Arial, sans-serif" }}>
        <div style={{ ...cardStyle, textAlign: "center", fontWeight: 1000, fontSize: 20 }}>
          جارٍ التحقق من جلسة الدخول الآمنة...
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "linear-gradient(180deg, #f4fbf6 0%, #e8f5ec 100%)", fontFamily: "Tahoma, Arial, sans-serif", color: "#111827" }}>
      <div style={cardStyle}>
        <h1 style={{ margin: "0 0 10px", textAlign: "center", fontSize: 28, fontWeight: 1000 }}>
          {resolvedTitle}
        </h1>

        <p style={{ margin: "0 0 12px", textAlign: "center", lineHeight: 1.9, fontWeight: 900 }}>
          سيتم إرسال رمز مكون من 6 أرقام إلى بريد الحساب الموثق. بعد التحقق تصدر جلسة موقعة قصيرة العمر لمدة 10 دقائق.
        </p>

        <div style={{ marginBottom: 16, textAlign: "center", fontWeight: 1000, color: "#14532d" }}>
          {maskEmail(expectedEmail)}
        </div>

        {codeSent ? (
          <input
            value={code}
            onChange={(event) => { setCode(normalizeCode(event.target.value)); setError(""); }}
            onKeyDown={(event) => { if (event.key === "Enter") void verifyCode(); }}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="أدخل رمز التحقق المكون من 6 أرقام"
            style={{ width: "100%", boxSizing: "border-box", minHeight: 58, border: "3px solid #15803d", borderRadius: 16, padding: "12px 15px", fontSize: 22, fontWeight: 1000, textAlign: "center", direction: "ltr", letterSpacing: 5, color: "#17351f", WebkitTextFillColor: "#17351f", caretColor: "#17351f", textShadow: "none", background: "#fff" }}
          />
        ) : null}

        {message ? (
          <div style={{ marginTop: 12, padding: 12, border: "2px solid #16a34a", borderRadius: 14, background: "#f0fdf4", textAlign: "center", fontWeight: 1000 }}>{message}</div>
        ) : null}

        {error ? (
          <div style={{ marginTop: 12, padding: 12, border: "2px solid #dc2626", borderRadius: 14, background: "#fef2f2", textAlign: "center", fontWeight: 1000 }}>{error}</div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
          <button type="button" disabled={busy} onClick={() => void sendCode()} style={{ minWidth: 170, minHeight: 50, border: "3px solid #15803d", borderRadius: 16, padding: "10px 16px", fontWeight: 1000, cursor: busy ? "not-allowed" : "pointer", background: "#dcfce7", color: "#111827" }}>
            {busy ? "جارٍ التنفيذ..." : codeSent ? "إعادة إرسال الرمز" : "إرسال رمز الدخول"}
          </button>

          <button type="button" disabled={busy || !codeSent} onClick={() => void verifyCode()} style={{ minWidth: 170, minHeight: 50, border: "3px solid #14532d", borderRadius: 16, padding: "10px 16px", fontWeight: 1000, cursor: busy || !codeSent ? "not-allowed" : "pointer", background: codeSent ? "#bbf7d0" : "#e5e7eb", color: "#111827" }}>
            {busy ? "جارٍ التحقق..." : "تحقق وافتح البوابة"}
          </button>

          <button type="button" disabled={busy} onClick={() => void logoutToLogin()} style={{ minWidth: 170, minHeight: 50, border: "3px solid #6b7280", borderRadius: 16, padding: "10px 16px", fontWeight: 1000, cursor: busy ? "not-allowed" : "pointer", background: "#f3f4f6", color: "#111827" }}>
            تسجيل خروج والعودة للدخول
          </button>
        </div>
      </div>
    </div>
  );
}
