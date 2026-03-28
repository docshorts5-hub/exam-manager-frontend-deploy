// src/pages/Gallery.tsx
import React, { useEffect, useRef, useState } from "react";
import { useCan } from "../auth/permissions";

const LOGO_KEY = "exam-manager:app-logo";
const DEFAULT_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

function isProbablyUrl(s: string) {
  return /^https?:\/\//i.test(s);
}

export default function Gallery() {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const { can } = useCan();
  const canEdit = can("SETTINGS_MANAGE");

  const [logo, setLogo] = useState<string>("");

  useEffect(() => {
    const saved = localStorage.getItem(LOGO_KEY);
    if (saved) setLogo(saved);
    else setLogo(DEFAULT_LOGO_URL);
  }, []);

  function persist(v: string) {
    localStorage.setItem(LOGO_KEY, v);
    setLogo(v);
    window.dispatchEvent(new Event("exam-manager:changed"));
  }

  function onPickFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("الملف يجب أن يكون صورة");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result || "");
      if (!base64) return;
      persist(base64);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div
      style={{
        direction: "rtl",
        minHeight: "calc(100vh - 64px)",
        padding: "24px 16px",
        background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
        color: "#e2e8f0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "860px",           // ← الحد الأقصى للعرض (يمكنك تعديله)
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* عنوان الصفحة */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>مكتبة الصور والشعار</h1>
          <p style={{ marginTop: 6, opacity: 0.75, fontSize: 14 }}>
            إدارة الشعار الرسمي للنظام والتقارير
          </p>
        </div>

        {/* اللوحة الرئيسية – رفع + معاينة */}
        <div
          style={{
            background: "rgba(30, 41, 59, 0.75)",
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 20px 70px rgba(0,0,0,0.35)",
            padding: "28px",
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {/* قسم الرفع */}
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12, color: "#e2e8f0" }}>
                رفع الشعار الجديد
              </h2>

              <div
                style={{
                  border: "2px dashed rgba(96, 165, 250, 0.4)",
                  borderRadius: 16,
                  padding: "32px 20px",
                  textAlign: "center",
                  background: "rgba(59, 130, 246, 0.05)",
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>⬆️</div>
                <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 6 }}>
                  اضغط أو اسحب صورة الشعار هنا
                </div>
                <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>
                  PNG / JPG — يُفضّل خلفية شفافة • الحد الأقصى 2 ميجابايت
                </div>

                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => fileRef.current?.click()}
                  style={{
                    padding: "12px 32px",
                    borderRadius: 12,
                    border: "none",
                    background: canEdit
                      ? "linear-gradient(135deg, #3b82f6, #8b5cf6)"
                      : "rgba(255,255,255,0.08)",
                    color: canEdit ? "white" : "rgba(255,255,255,0.4)",
                    fontWeight: 800,
                    fontSize: 15,
                    cursor: canEdit ? "pointer" : "not-allowed",
                    boxShadow: canEdit ? "0 8px 25px rgba(59,130,246,0.3)" : "none",
                  }}
                >
                  {canEdit ? "اختيار صورة" : "التعديل للمدير فقط"}
                </button>

                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    e.currentTarget.value = "";
                    onPickFile(f);
                  }}
                />
              </div>

              {/* زر الافتراضي */}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => persist(DEFAULT_LOGO_URL)}
                  style={{
                    marginTop: 16,
                    width: "100%",
                    padding: "11px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.06)",
                    color: "#cbd5e1",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  استعادة الشعار الافتراضي
                </button>
              )}
            </div>

            {/* قسم المعاينة */}
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12, color: "#e2e8f0" }}>
                المعاينة الحالية
              </h2>

              <div
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  borderRadius: 16,
                  padding: 20,
                  border: "1px solid rgba(255,255,255,0.07)",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    margin: "0 auto",
                    width: 280,
                    maxWidth: "100%",
                    borderRadius: 14,
                    background: "#ffffff",
                    padding: 16,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
                  }}
                >
                  {logo ? (
                    <img
                      src={logo}
                      alt="الشعار الحالي"
                      style={{
                        width: "100%",
                        height: "auto",
                        maxHeight: 220,
                        objectFit: "contain",
                        borderRadius: 8,
                      }}
                    />
                  ) : (
                    <div style={{ padding: "60px 0", opacity: 0.5 }}>
                      لا يوجد شعار بعد
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 16, fontSize: 13, opacity: 0.7 }}>
                  الحالة: {logo ? (isProbablyUrl(logo) ? "رابط خارجي" : "محفوظ محلياً (Base64)") : "غير محدد"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ملاحظة سفلية اختيارية */}
        <div
          style={{
            textAlign: "center",
            fontSize: 13,
            opacity: 0.6,
            padding: "16px 0",
          }}
        >
          • يُفضل استخدام صور PNG بخلفية شفافة للحصول على أفضل نتيجة في التقارير والطباعة
        </div>
      </div>
    </div>
  );
}