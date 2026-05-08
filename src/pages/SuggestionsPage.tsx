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

export default function SuggestionsPage() {
  const { tenantId, user } = useAuth() as any;
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const [form, setForm] = useState<SuggestionForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [errors, setErrors] = useState<Partial<Record<keyof SuggestionForm, string>>>({});

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
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #08101f, #0f172a)",
        padding: 24,
        direction: isRTL ? "rtl" : "ltr",
      }}
    >
      <div
        style={{
          maxWidth: 980,
          margin: "0 auto",
          background: "#111827",
          border: "1px solid rgba(212,175,55,0.28)",
          borderRadius: 28,
          overflow: "hidden",
          boxShadow: "0 0 22px rgba(212,175,55,0.18), 0 22px 50px rgba(0,0,0,0.38)",
        }}
      >
        <div
          style={{
            padding: "28px 28px",
            background:
              "linear-gradient(135deg, rgba(20,25,40,0.98), rgba(46,33,10,0.94), rgba(15,23,42,0.98))",
            borderBottom: "1px solid rgba(212,175,55,0.24)",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 999,
              background: "rgba(34,197,94,0.10)",
              border: "1px solid rgba(34,197,94,0.24)",
              color: "#bbf7d0",
              fontWeight: 900,
              fontSize: 12,
            }}
          >
            {tr("قناة مباشرة إلى السوبر أدمن", "Direct channel to the super admin")}
          </div>

          <h1 style={{ margin: "16px 0 0", color: "#fff", fontSize: 34, fontWeight: 900 }}>
            {tr("صفحة الاقتراحات الذكية", "Smart suggestions page")}
          </h1>
          <p style={{ marginTop: 12, color: "rgba(255,255,255,0.78)", lineHeight: 1.9, fontSize: 15 }}>
            {tr("اكتب المقترحات والملاحظات بصورة واضحة ومنظمة، وسيتم إرسالها مباشرة إلى صفحة السوبر أدمن مع ربطها ببيانات الجهة الحالية والمستخدم عند التوفر.", "Write suggestions and notes clearly and in an organized way. They will be sent directly to the super admin page and linked to the current tenant and user data when available.")}
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
              { label: tr("المستخدم", "User"), value: user?.email || tr("غير معروف", "Unknown") },
              { label: tr("نوع الرسالة", "Message type"), value: tr("اقتراح / ملاحظة", "Suggestion / Note") },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  borderRadius: 18,
                  padding: "14px 16px",
                  background: "rgba(255,255,255,0.035)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 800 }}>{item.label}</div>
                <div style={{ color: "#fff8dc", marginTop: 8, fontWeight: 900, fontSize: 15 }}>{item.value}</div>
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
                  background: messageType === "success" ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.06)",
                  color: "#fff",
                  border: "4px solid #d4af37",
                  boxShadow: "0 0 18px rgba(212,175,55,0.35)",
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
  color: "#fff8dc",
  fontWeight: 800,
  fontSize: 14,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "15px 16px",
  borderRadius: 16,
  border: "1px solid rgba(212,175,55,0.30)",
  background: "#0f172a",
  color: "#fff",
  fontSize: 15,
  outline: "none",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.03), 0 10px 24px rgba(0,0,0,0.12)",
};

const errorStyle: React.CSSProperties = {
  marginTop: 8,
  color: "#f87171",
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
  fontWeight: 900,
  fontSize: 15,
  boxShadow: "0 12px 24px rgba(212,175,55,0.22)",
};

const cancelButtonStyle: React.CSSProperties = {
  minWidth: 140,
  padding: "13px 20px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.15)",
  cursor: "pointer",
  background: "#1f2937",
  color: "#fff",
  fontWeight: 900,
  fontSize: 15,
};