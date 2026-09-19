// src/pages/ChangePhoneRequest.tsx
import React, { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function digitsOnly(value: string) {
  return clean(value).replace(/[^0-9]/g, "");
}

function maskPhoneFirstLast(value: string) {
  const digits = digitsOnly(value);
  if (!digits) return "";
  if (digits.length === 1) return digits;
  if (digits.length === 2) return `${digits[0]}x`;
  return `${digits[0]}${"x".repeat(Math.max(1, digits.length - 2))}${digits[digits.length - 1]}`;
}

type CompletePhoneChangeResponse = {
  ok?: boolean;
  message?: string;
  maskedPhone?: string;
  sourcePage?: string;
  returnPath?: string;
  tenantKind?: string;
};

export default function ChangePhoneRequest() {
  const { tenantId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const requestId = clean(searchParams.get("requestId"));
  const token = clean(searchParams.get("token"));
  const safeTenantId = clean(tenantId);

  const [newPhone, setNewPhone] = useState("");
  const [confirmPhone, setConfirmPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [returnPath, setReturnPath] = useState("");
  const [returnLabel, setReturnLabel] = useState("");

  const previewMasked = useMemo(() => maskPhoneFirstLast(newPhone), [newPhone]);
  const canSubmit = Boolean(safeTenantId && requestId && token && digitsOnly(newPhone) && digitsOnly(confirmPhone));

  async function submitChange() {
    setError("");
    setSuccess("");

    const phoneA = digitsOnly(newPhone);
    const phoneB = digitsOnly(confirmPhone);

    if (!safeTenantId || !requestId || !token) {
      setError("رابط تغيير رقم الهاتف غير مكتمل. افتح الرابط المرسل إلى البريد مرة أخرى.");
      return;
    }

    if (!phoneA || phoneA.length < 6 || phoneA.length > 15) {
      setError("أدخل رقم هاتف صحيح من 6 إلى 15 رقمًا.");
      return;
    }

    if (phoneA !== phoneB) {
      setError("رقم الهاتف وتأكيد الرقم غير متطابقين.");
      return;
    }

    setBusy(true);
    try {
      const functions = getFunctions(undefined, "us-central1");
      const completePhoneChangeRequest = httpsCallable(functions, "completePhoneChangeRequest");
      const result = await completePhoneChangeRequest({
        tenantId: safeTenantId,
        requestId,
        token,
        newPhone: phoneA,
      });

      const data = (result.data || {}) as CompletePhoneChangeResponse;
      const nextMasked = clean(data.maskedPhone) || maskPhoneFirstLast(phoneA);
      const nextReturnPath = clean(data.returnPath);
      const nextSourcePage = clean(data.sourcePage).toLowerCase();
      setMaskedPhone(nextMasked);
      setReturnPath(nextReturnPath);
      setReturnLabel(nextSourcePage === "settings1" ? "العودة لإعدادات المدرسة" : "العودة لإعدادات الدبلوم");
      setSuccess(clean(data.message) || `تم تغيير رقم الهاتف بنجاح إلى ${nextMasked}.`);

      try {
        const schoolRaw = window.localStorage.getItem("exam-manager:school-data:v1");
        if (schoolRaw) {
          const schoolData = JSON.parse(schoolRaw);
          window.localStorage.setItem(
            "exam-manager:school-data:v1",
            JSON.stringify({ ...(schoolData || {}), phone: phoneA })
          );
        }

        const centerRaw = window.localStorage.getItem("exam-manager:exam-center-data:v1");
        if (centerRaw) {
          const centerData = JSON.parse(centerRaw);
          window.localStorage.setItem(
            "exam-manager:exam-center-data:v1",
            JSON.stringify({ ...(centerData || {}), phone: phoneA })
          );
        }

        window.dispatchEvent(new Event("exam-manager:changed"));
      } catch {
        // تحديث التخزين المحلي اختياري، والحفظ الأساسي تم في السحابة.
      }
    } catch (err: any) {
      const message = clean(err?.message || err?.details || err?.code || "فشل تغيير رقم الهاتف.");
      if (message.includes("TOKEN_EXPIRED")) {
        setError("انتهت صلاحية رابط تغيير رقم الهاتف. أرسل طلب تغيير جديد من صفحة الإعدادات.");
      } else if (message.includes("TOKEN_INVALID")) {
        setError("رابط تغيير رقم الهاتف غير صحيح أو تم تعديله.");
      } else if (message.includes("REQUEST_ALREADY_COMPLETED")) {
        setError("تم استخدام هذا الرابط سابقًا ولا يمكن استخدامه مرة أخرى.");
      } else if (message.includes("REQUEST_NOT_FOUND")) {
        setError("طلب تغيير رقم الهاتف غير موجود.");
      } else if (message.includes("AUTH_EMAIL_MISMATCH")) {
        setError("يجب تسجيل الدخول بنفس البريد الذي استقبل رابط تغيير رقم الهاتف.");
      } else {
        setError(message || "فشل تغيير رقم الهاتف. حاول مرة أخرى.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir="rtl" style={pageStyle}>
      <style>{`
        .change-phone-input,
        .change-phone-input:focus,
        .change-phone-input:active {
          color: #000 !important;
          -webkit-text-fill-color: #000 !important;
          font-weight: 900 !important;
          caret-color: #000 !important;
        }
        .change-phone-input::placeholder {
          color: #000 !important;
          opacity: 0.72 !important;
          font-weight: 900 !important;
        }
        .change-phone-input:-webkit-autofill,
        .change-phone-input:-webkit-autofill:hover,
        .change-phone-input:-webkit-autofill:focus {
          -webkit-text-fill-color: #000 !important;
          color: #000 !important;
          font-weight: 900 !important;
          caret-color: #000 !important;
          box-shadow: 0 0 0 1000px #fff inset !important;
          transition: background-color 9999s ease-in-out 0s !important;
        }
      `}</style>
      <div style={shellStyle}>
        <div style={headerStyle}>
          <div style={badgeStyle}>تغيير رقم الهاتف</div>
          <h1 style={titleStyle}>رابط آمن لتغيير رقم الهاتف المسجل</h1>
          <p style={subtitleStyle}>
            أدخل رقم الهاتف الجديد مرتين. لا يمكن استخدام هذا الرابط إلا مرة واحدة وخلال مدة صلاحيته.
          </p>
        </div>

        <div style={infoGridStyle}>
          <div style={infoCardStyle}>
            <span style={infoLabelStyle}>معرف المدرسة / المركز</span>
            <strong style={infoValueStyle}>{safeTenantId || "غير متوفر"}</strong>
          </div>
          <div style={infoCardStyle}>
            <span style={infoLabelStyle}>رقم الطلب</span>
            <strong style={infoValueStyle}>{requestId || "غير متوفر"}</strong>
          </div>
        </div>

        {!safeTenantId || !requestId || !token ? (
          <div style={errorStyle}>الرابط غير مكتمل. افتح الرابط الكامل من البريد الإلكتروني.</div>
        ) : null}

        {error ? <div style={errorStyle}>{error}</div> : null}
        {success ? (
          <div style={successStyle}>
            <strong>تم بنجاح</strong>
            <span>{success}</span>
            {maskedPhone ? <span>الرقم الجديد: {maskedPhone}</span> : null}
          </div>
        ) : null}

        {!success ? (
          <div style={formStyle}>
            <label style={labelStyle}>رقم الهاتف الجديد</label>
            <input
              value={newPhone}
              onChange={(e) => setNewPhone(digitsOnly(e.target.value))}
              placeholder="أدخل رقم الهاتف الجديد"
              inputMode="numeric"
              className="change-phone-input"
              style={inputStyle}
              disabled={busy}
            />

            <label style={labelStyle}>تأكيد رقم الهاتف الجديد</label>
            <input
              value={confirmPhone}
              onChange={(e) => setConfirmPhone(digitsOnly(e.target.value))}
              placeholder="أعد إدخال رقم الهاتف الجديد"
              inputMode="numeric"
              className="change-phone-input"
              style={inputStyle}
              disabled={busy}
            />

            {previewMasked ? <div style={hintStyle}>سيظهر الرقم بعد الحفظ بهذا الشكل: {previewMasked}</div> : null}

            <button type="button" onClick={submitChange} disabled={!canSubmit || busy} style={{ ...buttonStyle, opacity: !canSubmit || busy ? 0.55 : 1 }}>
              {busy ? "جاري تغيير الرقم..." : "تأكيد تغيير رقم الهاتف"}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
            <button
              type="button"
              onClick={() => navigate(returnPath || `/t/${safeTenantId}/settings12`)}
              style={secondaryButtonStyle}
            >
              {returnLabel || "العودة للإعدادات"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #fffaf0 0%, #f8ecd0 45%, #fffaf0 100%)",
  padding: "48px 18px",
  boxSizing: "border-box",
  color: "#000",
  fontWeight: 900,
};

const shellStyle: React.CSSProperties = {
  maxWidth: 820,
  margin: "0 auto",
  background: "rgba(255,255,255,0.9)",
  border: "2px solid rgba(180, 133, 35, 0.45)",
  borderRadius: 28,
  boxShadow: "0 24px 60px rgba(70, 52, 20, 0.18)",
  padding: 28,
};

const headerStyle: React.CSSProperties = {
  borderBottom: "2px solid rgba(180,133,35,0.32)",
  paddingBottom: 18,
  marginBottom: 20,
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "8px 14px",
  borderRadius: 999,
  background: "#fef3c7",
  color: "#000",
  fontWeight: 900,
  border: "1px solid #d4af37",
};

const titleStyle: React.CSSProperties = {
  margin: "16px 0 8px",
  fontSize: 30,
  fontWeight: 1000,
  color: "#000",
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#000",
  lineHeight: 1.9,
  fontWeight: 900,
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginBottom: 18,
};

const infoCardStyle: React.CSSProperties = {
  border: "1px solid rgba(180,133,35,0.35)",
  borderRadius: 18,
  padding: 14,
  background: "#fffdf7",
};

const infoLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#000",
  fontWeight: 900,
  marginBottom: 6,
};

const infoValueStyle: React.CSSProperties = {
  fontSize: 16,
  color: "#000",
  fontWeight: 900,
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const labelStyle: React.CSSProperties = {
  fontWeight: 900,
  color: "#000",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "2px solid rgba(180,133,35,0.45)",
  borderRadius: 16,
  padding: "14px 16px",
  fontSize: 18,
  fontWeight: 900,
  outline: "none",
  background: "#fff",
  color: "#000",
  WebkitTextFillColor: "#000",
  caretColor: "#000",
  fontFamily: "inherit",
};

const hintStyle: React.CSSProperties = {
  color: "#000",
  fontWeight: 900,
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 12,
};

const buttonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 18,
  padding: "14px 18px",
  background: "#fef3c7",
  color: "#000",
  fontWeight: 1000,
  fontSize: 16,
  cursor: "pointer",
  boxShadow: "0 14px 28px rgba(21,128,61,0.24)",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #d4af37",
  borderRadius: 14,
  padding: "12px 14px",
  background: "#fffdf7",
  color: "#000",
  fontWeight: 900,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#000",
  borderRadius: 18,
  padding: 14,
  fontWeight: 900,
  marginBottom: 14,
};

const successStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#000",
  borderRadius: 18,
  padding: 14,
  fontWeight: 900,
  marginBottom: 14,
};
