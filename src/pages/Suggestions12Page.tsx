import React, { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useI18n } from "../i18n/I18nProvider";
import { auth, db, functions } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";

type SuggestionForm = {
  title: string;
  schoolName: string;
  schoolEmail: string;
  notes: string;
};

type SendSuggestionEmailRequest = {
  title: string;
  schoolName: string;
  schoolEmail: string;
  notes: string;
};

type SendSuggestionEmailResponse = {
  ok?: boolean;
  message?: string;
};

const initialForm: SuggestionForm = {
  title: "",
  schoolName: "",
  schoolEmail: "",
  notes: "",
};

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function getFirebaseErrorMessage(error: any) {
  const code = cleanText(error?.code);
  const message = cleanText(error?.message);

  if (code) return `${code}${message ? `: ${message}` : ""}`;
  return message || "";
}

export default function SuggestionsPage() {
  const authContext = useAuth() as any;
  const tenantId = cleanText(
    authContext?.tenantId ||
      authContext?.effectiveTenantId ||
      authContext?.profile?.tenantId ||
      authContext?.userProfile?.tenantId ||
      ""
  );

  const contextUser = authContext?.user || authContext?.profile || authContext?.userProfile || null;

  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const [form, setForm] = useState<SuggestionForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "warning" | "">("");
  const [errors, setErrors] = useState<Partial<Record<keyof SuggestionForm, string>>>({});

  const currentFirebaseUser = auth.currentUser;
  const displayEmail =
    cleanText(currentFirebaseUser?.email) ||
    cleanText(contextUser?.email) ||
    tr("غير معروف", "Unknown");

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const validate = () => {
    const nextErrors: Partial<Record<keyof SuggestionForm, string>> = {};

    if (!form.title.trim()) {
      nextErrors.title = tr("يرجى إدخال عنوان المقترح", "Please enter the suggestion title");
    }

    if (!form.schoolName.trim()) {
      nextErrors.schoolName = tr("يرجى إدخال اسم المدرسة", "Please enter the school name");
    }

    if (!form.schoolEmail.trim()) {
      nextErrors.schoolEmail = tr("يرجى إدخال إيميل المدرسة", "Please enter the school email");
    } else if (!isValidEmail(form.schoolEmail)) {
      nextErrors.schoolEmail = tr("يرجى إدخال بريد إلكتروني صحيح", "Please enter a valid email address");
    }

    if (!form.notes.trim()) {
      nextErrors.notes = tr("يرجى كتابة الملاحظات والاقتراحات", "Please write the notes and suggestions");
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange =
    (field: keyof SuggestionForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: "" }));
      setMessage("");
      setMessageType("");
    };

  const handleReset = () => {
    setForm(initialForm);
    setErrors({});
    setMessage("");
    setMessageType("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setMessageType("");

    if (!validate()) return;

    const firebaseUser = auth.currentUser;

    if (!firebaseUser?.uid) {
      setMessage(tr("يجب تسجيل الدخول قبل إرسال المقترح.", "You must sign in before sending a suggestion."));
      setMessageType("error");
      return;
    }

    const emailPayload: SendSuggestionEmailRequest = {
      title: form.title.trim(),
      schoolName: form.schoolName.trim(),
      schoolEmail: form.schoolEmail.trim(),
      notes: form.notes.trim(),
    };

    try {
      setLoading(true);

      const firestorePayload = {
        ...emailPayload,
        tenantId: tenantId || null,
        senderUid: firebaseUser.uid,
        senderEmail: firebaseUser.email || contextUser?.email || null,
        senderDisplayName: firebaseUser.displayName || contextUser?.displayName || contextUser?.name || null,
        status: "new",
        source: "suggestions12page",
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "systemSuggestions"), firestorePayload);

      try {
        const sendSuggestionEmail = httpsCallable<
          SendSuggestionEmailRequest,
          SendSuggestionEmailResponse
        >(functions, "sendSuggestionEmailCallable");

        await sendSuggestionEmail(emailPayload);

        setMessage(
          tr(
            "تم حفظ المقترح وإرساله بنجاح إلى السوبر أدمن.",
            "The suggestion was saved and emailed successfully to the super admin."
          )
        );
        setMessageType("success");
      } catch (emailError: any) {
        console.error("send suggestion email error:", emailError);

        const detail = getFirebaseErrorMessage(emailError);
        setMessage(
          tr(
            `تم حفظ المقترح بنجاح، لكن تعذر إرسال الإيميل. التفاصيل: ${detail || "غير متوفرة"}`,
            `The suggestion was saved successfully, but the email could not be sent. Details: ${detail || "Not available"}`
          )
        );
        setMessageType("warning");
      }

      setForm(initialForm);
    } catch (error: any) {
      console.error("save suggestion error:", error);

      const code = cleanText(error?.code);
      const fallbackMessage =
        code === "permission-denied"
          ? tr(
              "تعذر إرسال المقترح بسبب صلاحيات Firestore. تأكد من نشر firestore.rules بعد آخر تعديل.",
              "Unable to send the suggestion because of Firestore permissions. Make sure firestore.rules was deployed after the latest update."
            )
          : tr("حدث خطأ أثناء حفظ المقترح.", "An error occurred while saving the suggestion.");

      setMessage(error?.message || fallbackMessage);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const messageBackground =
    messageType === "success"
      ? "#e8f5e9"
      : messageType === "warning"
        ? "#fff7ed"
        : "#fef2f2";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at top right, rgba(212,175,55,0.18), transparent 34%), linear-gradient(180deg, #f8f1df 0%, #efe1bd 100%)",
        padding: 22,
        direction: isRTL ? "rtl" : "ltr",
      }}
    >
      <div
        style={{
          maxWidth: 980,
          margin: "0 auto",
          background: "#fffaf0",
          border: "1.5px solid #c9a646",
          borderRadius: 22,
          overflow: "hidden",
          boxShadow: "0 18px 42px rgba(92, 64, 0, 0.16)",
        }}
      >
        <div
          style={{
            padding: "26px 28px",
            background:
              "linear-gradient(135deg, #fff8e8 0%, #f0dfae 48%, #fffaf0 100%)",
            borderBottom: "1px solid rgba(151, 116, 28, 0.32)",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 999,
              background: "#e8f5e9",
              border: "1px solid rgba(22, 101, 52, 0.28)",
              color: "#14532d",
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            {tr("قناة مباشرة إلى السوبر أدمن", "Direct channel to the super admin")}
          </div>

          <h1 style={{ margin: "16px 0 0", color: "#111827", fontSize: 30, fontWeight: 850 }}>
            {tr("صفحة الاقتراحات الذكية", "Smart suggestions page")}
          </h1>

          <p style={{ marginTop: 12, color: "#374151", lineHeight: 1.9, fontSize: 15 }}>
            {tr(
              "اكتب المقترحات والملاحظات بصورة واضحة ومنظمة، وسيتم حفظها في Firebase وإرسالها إلى السوبر أدمن عند توفر إعدادات الإيميل.",
              "Write suggestions and notes clearly. They will be saved in Firebase and emailed to the super admin when email settings are available."
            )}
          </p>

          <div
            style={{
              marginTop: 18,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            {[
              { label: tr("الجهة الحالية", "Current tenant"), value: tenantId || tr("غير مرتبطة", "Not linked") },
              { label: tr("المستخدم", "User"), value: displayEmail },
              { label: tr("نوع الرسالة", "Message type"), value: tr("اقتراح / ملاحظة", "Suggestion / Note") },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  borderRadius: 18,
                  padding: "14px 16px",
                  background: "#fffdf8",
                  border: "1px solid rgba(151, 116, 28, 0.20)",
                }}
              >
                <div style={{ color: "#6b5a23", fontSize: 12, fontWeight: 800 }}>
                  {item.label}
                </div>
                <div style={{ color: "#111827", marginTop: 8, fontWeight: 800, fontSize: 15 }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 28 }}>
          <div style={{ display: "grid", gap: 18 }}>
            <div>
              <label style={labelStyle}>{tr("عنوان المقترح", "Suggestion title")}</label>
              <input
                type="text"
                value={form.title}
                onChange={handleChange("title")}
                placeholder={tr("اكتب عنوان المقترح", "Enter the suggestion title")}
                style={inputStyle}
              />
              {errors.title ? <div style={errorStyle}>{errors.title}</div> : null}
            </div>

            <div>
              <label style={labelStyle}>{tr("اسم المدرسة", "School name")}</label>
              <input
                type="text"
                value={form.schoolName}
                onChange={handleChange("schoolName")}
                placeholder={tr("اكتب اسم المدرسة", "Enter the school name")}
                style={inputStyle}
              />
              {errors.schoolName ? <div style={errorStyle}>{errors.schoolName}</div> : null}
            </div>

            <div>
              <label style={labelStyle}>{tr("إيميل المدرسة", "School email")}</label>
              <input
                type="email"
                value={form.schoolEmail}
                onChange={handleChange("schoolEmail")}
                placeholder="school@example.com"
                style={inputStyle}
              />
              {errors.schoolEmail ? <div style={errorStyle}>{errors.schoolEmail}</div> : null}
            </div>

            <div>
              <label style={labelStyle}>{tr("الملاحظات والاقتراحات", "Notes and suggestions")}</label>
              <textarea
                rows={8}
                value={form.notes}
                onChange={handleChange("notes")}
                placeholder={tr("اكتب هنا الملاحظات والاقتراحات بالتفصيل", "Write the notes and suggestions here in detail")}
                style={{ ...inputStyle, resize: "vertical", minHeight: 180 }}
              />
              {errors.notes ? <div style={errorStyle}>{errors.notes}</div> : null}
            </div>

            {message ? (
              <div
                style={{
                  borderRadius: 16,
                  padding: "14px 16px",
                  background: messageBackground,
                  color: "#111827",
                  border: "1.5px solid #c9a646",
                  boxShadow: "0 8px 20px rgba(92, 64, 0, 0.10)",
                  fontWeight: 800,
                  whiteSpace: "pre-wrap",
                }}
              >
                {message}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button type="submit" disabled={loading} style={sendButtonStyle}>
                {loading ? tr("جارٍ الإرسال...", "Sending...") : tr("إرسال", "Send")}
              </button>

              <button type="button" onClick={handleReset} disabled={loading} style={cancelButtonStyle}>
                {tr("إلغاء", "Cancel")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  color: "#111827",
  fontWeight: 800,
  fontSize: 14,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "15px 16px",
  borderRadius: 16,
  border: "1.5px solid rgba(151, 116, 28, 0.34)",
  background: "#ffffff",
  color: "#111827",
  fontSize: 15,
  outline: "none",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85), 0 6px 16px rgba(92, 64, 0, 0.07)",
};

const errorStyle: React.CSSProperties = {
  marginTop: 8,
  color: "#b91c1c",
  fontSize: 13,
  fontWeight: 700,
};

const sendButtonStyle: React.CSSProperties = {
  minWidth: 160,
  padding: "14px 22px",
  borderRadius: 16,
  border: "none",
  cursor: "pointer",
  background: "linear-gradient(180deg,#d4af37,#a67c00)",
  color: "#111827",
  fontWeight: 800,
  fontSize: 15,
  boxShadow: "0 10px 20px rgba(92, 64, 0, 0.16)",
};

const cancelButtonStyle: React.CSSProperties = {
  minWidth: 140,
  padding: "13px 20px",
  borderRadius: 14,
  border: "1.5px solid rgba(151, 116, 28, 0.34)",
  cursor: "pointer",
  background: "#fffdf7",
  color: "#111827",
  fontWeight: 800,
  fontSize: 15,
};
