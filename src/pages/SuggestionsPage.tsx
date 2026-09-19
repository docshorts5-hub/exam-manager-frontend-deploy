import React, { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useI18n } from "../i18n/I18nProvider";
import { db } from "../firebase/firebase";
import { useAuth } from "../auth/AuthContext";

type SuggestionForm = {
  title: string;
  schoolName: string;
  schoolEmail: string;
  notes: string;
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

export default function SuggestionsPage() {
  const authContext = useAuth() as any;
  const tenantId = cleanText(
    authContext?.tenantId ||
      authContext?.effectiveTenantId ||
      authContext?.profile?.tenantId ||
      authContext?.userProfile?.tenantId ||
      ""
  );
  const user = authContext?.user || authContext?.profile || authContext?.userProfile || null;

  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const [form, setForm] = useState<SuggestionForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [errors, setErrors] = useState<Partial<Record<keyof SuggestionForm, string>>>({});

  const userEmail = cleanText(user?.email) || tr("غير معروف", "Unknown");
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const validate = () => {
    const nextErrors: Partial<Record<keyof SuggestionForm, string>> = {};

    if (!form.title.trim()) nextErrors.title = tr("يرجى إدخال عنوان المقترح", "Please enter the suggestion title");
    if (!form.schoolName.trim()) nextErrors.schoolName = tr("يرجى إدخال اسم المدرسة", "Please enter the school name");

    if (!form.schoolEmail.trim()) {
      nextErrors.schoolEmail = tr("يرجى إدخال إيميل المدرسة", "Please enter the school email");
    } else if (!isValidEmail(form.schoolEmail)) {
      nextErrors.schoolEmail = tr("يرجى إدخال بريد إلكتروني صحيح", "Please enter a valid email address");
    }

    if (!form.notes.trim()) nextErrors.notes = tr("يرجى كتابة الملاحظات والاقتراحات", "Please write the notes and suggestions");

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

    try {
      setLoading(true);

      await addDoc(collection(db, "systemSuggestions"), {
        title: form.title.trim(),
        schoolName: form.schoolName.trim(),
        schoolEmail: form.schoolEmail.trim(),
        notes: form.notes.trim(),
        tenantId: tenantId || null,
        senderUid: user?.uid || null,
        senderEmail: user?.email || null,
        status: "new",
        source: "suggestions",
        createdAt: serverTimestamp(),
      });

      setMessage(tr("تم إرسال المقترح بنجاح إلى السوبر أدمن.", "The suggestion was sent successfully to the super admin."));
      setMessageType("success");
      setForm(initialForm);
    } catch (error: any) {
      console.error("save suggestion error:", error);
      setMessage(error?.message || tr("حدث خطأ أثناء حفظ المقترح.", "An error occurred while saving the suggestion."));
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      dir={isRTL ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        width: "100%",
        padding: "28px 20px",
        background: "linear-gradient(180deg, #fbf6e8 0%, #f1e4c2 100%)",
        color: "#111827",
      }}
    >
      <section
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          border: "1.5px solid #c9a646",
          borderRadius: 24,
          overflow: "hidden",
          background: "#fffaf0",
          boxShadow: "0 16px 34px rgba(93, 64, 0, 0.12)",
        }}
      >
        <header
          style={{
            padding: "26px 30px",
            background: "linear-gradient(135deg, #fffdf6 0%, #f5e7bd 100%)",
            borderBottom: "1px solid rgba(151, 116, 28, 0.28)",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 999,
              background: "#ecfdf3",
              border: "1px solid rgba(22, 101, 52, 0.28)",
              color: "#14532d",
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            {tr("قناة مباشرة إلى السوبر أدمن", "Direct channel to the super admin")}
          </div>

          <h1 style={{ margin: "18px 0 0", color: "#111827", fontSize: 32, fontWeight: 900 }}>
            {tr("صفحة الاقتراحات الذكية", "Smart suggestions page")}
          </h1>

          <p style={{ marginTop: 12, color: "#374151", lineHeight: 1.9, fontSize: 15, fontWeight: 600 }}>
            {tr(
              "اكتب المقترحات والملاحظات بصورة واضحة ومنظمة، وسيتم إرسالها إلى صفحة السوبر أدمن مع ربطها ببيانات الجهة الحالية والمستخدم عند التوفر.",
              "Write suggestions and notes clearly. They will be sent to the super admin and linked to the current tenant and user data when available."
            )}
          </p>

          <div
            style={{
              marginTop: 20,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 12,
            }}
          >
            {[
              { label: tr("الجهة الحالية", "Current tenant"), value: tenantId || tr("غير مرتبطة", "Not linked") },
              { label: tr("المستخدم", "User"), value: userEmail },
              { label: tr("نوع الرسالة", "Message type"), value: tr("اقتراح / ملاحظة", "Suggestion / Note") },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  borderRadius: 18,
                  padding: "14px 16px",
                  background: "#ffffff",
                  border: "1px solid rgba(151, 116, 28, 0.24)",
                  boxShadow: "0 6px 14px rgba(93, 64, 0, 0.06)",
                }}
              >
                <div style={{ color: "#6b5a23", fontSize: 12, fontWeight: 850 }}>{item.label}</div>
                <div style={{ color: "#111827", marginTop: 8, fontWeight: 850, fontSize: 15 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </header>

        <form onSubmit={handleSubmit} style={{ padding: 30, background: "#fffaf0" }}>
          <div style={{ display: "grid", gap: 18 }}>
            <Field label={tr("عنوان المقترح", "Suggestion title")} error={errors.title}>
              <input type="text" value={form.title} onChange={handleChange("title")} placeholder={tr("اكتب عنوان المقترح", "Enter the suggestion title")} style={inputStyle} />
            </Field>

            <Field label={tr("اسم المدرسة", "School name")} error={errors.schoolName}>
              <input type="text" value={form.schoolName} onChange={handleChange("schoolName")} placeholder={tr("اكتب اسم المدرسة", "Enter the school name")} style={inputStyle} />
            </Field>

            <Field label={tr("إيميل المدرسة", "School email")} error={errors.schoolEmail}>
              <input type="email" value={form.schoolEmail} onChange={handleChange("schoolEmail")} placeholder="school@example.com" style={inputStyle} />
            </Field>

            <Field label={tr("الملاحظات والاقتراحات", "Notes and suggestions")} error={errors.notes}>
              <textarea rows={8} value={form.notes} onChange={handleChange("notes")} placeholder={tr("اكتب هنا الملاحظات والاقتراحات بالتفصيل", "Write the notes and suggestions here in detail")} style={{ ...inputStyle, resize: "vertical", minHeight: 180 }} />
            </Field>

            {message ? (
              <div
                style={{
                  borderRadius: 16,
                  padding: "14px 16px",
                  background: messageType === "success" ? "#ecfdf3" : "#fef2f2",
                  color: "#111827",
                  border: messageType === "success" ? "1.5px solid rgba(22, 101, 52, 0.28)" : "1.5px solid rgba(185, 28, 28, 0.28)",
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
      </section>
    </main>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
      {error ? <div style={errorStyle}>{error}</div> : null}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  color: "#111827",
  fontWeight: 850,
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
  WebkitTextFillColor: "#111827",
  fontSize: 15,
  fontWeight: 700,
  outline: "none",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85), 0 6px 16px rgba(92, 64, 0, 0.06)",
};

const errorStyle: React.CSSProperties = {
  marginTop: 8,
  color: "#b91c1c",
  fontSize: 13,
  fontWeight: 750,
};

const sendButtonStyle: React.CSSProperties = {
  minWidth: 160,
  padding: "14px 22px",
  borderRadius: 16,
  border: "none",
  cursor: "pointer",
  background: "linear-gradient(180deg,#d4af37,#a67c00)",
  color: "#111827",
  fontWeight: 850,
  fontSize: 15,
  boxShadow: "0 12px 24px rgba(212,175,55,0.22)",
};

const cancelButtonStyle: React.CSSProperties = {
  minWidth: 140,
  padding: "13px 20px",
  borderRadius: 14,
  border: "1.5px solid rgba(151, 116, 28, 0.34)",
  cursor: "pointer",
  background: "#fffdf7",
  color: "#111827",
  fontWeight: 850,
  fontSize: 15,
};
