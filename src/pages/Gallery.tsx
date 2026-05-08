// src/pages/Gallery.tsx
import React, { useEffect, useRef, useState } from "react";
import { useCan } from "../auth/permissions";
import { useI18n } from "../i18n/I18nProvider";

const LOGO_KEY = "exam-manager:app-logo";
const DEFAULT_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const MAX_FILE_SIZE = 2 * 1024 * 1024;

function isProbablyUrl(s: string) {
  return /^https?:\/\//i.test(s);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function buildGlassCard(border = "rgba(255,255,255,0.08)"): React.CSSProperties {
  return {
    background: "linear-gradient(180deg, rgba(15,23,42,0.78), rgba(15,23,42,0.58))",
    border: `1px solid ${border}`,
    borderRadius: 28,
    boxShadow: "0 24px 80px rgba(0,0,0,0.38)",
    backdropFilter: "blur(14px)",
  };
}

function StatTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div
      style={{
        ...buildGlassCard("rgba(148,163,184,0.12)"),
        padding: 18,
        minHeight: 118,
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ color: "rgba(226,232,240,0.72)", fontSize: 13, fontWeight: 700 }}>{label}</div>
      <div style={{ color: "#f8fafc", fontWeight: 900, fontSize: 30, lineHeight: 1.15 }}>{value}</div>
      <div style={{ color: "rgba(226,232,240,0.62)", fontSize: 12, lineHeight: 1.8 }}>{hint}</div>
    </div>
  );
}

function FeatureBadge({ text, tone = "blue" }: { text: string; tone?: "blue" | "violet" | "green" | "gold" }) {
  const palette = {
    blue: { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.22)", color: "#bfdbfe" },
    violet: { bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.22)", color: "#ddd6fe" },
    green: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.22)", color: "#a7f3d0" },
    gold: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.22)", color: "#fde68a" },
  } as const;
  const current = palette[tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "10px 14px",
        borderRadius: 999,
        background: current.bg,
        border: `1px solid ${current.border}`,
        color: current.color,
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

export default function Gallery() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { can } = useCan();
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const canEdit = can("SETTINGS_MANAGE");

  const [logo, setLogo] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [selectedFileSize, setSelectedFileSize] = useState<number>(0);
  const [previewMode, setPreviewMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem(LOGO_KEY);
    if (saved) setLogo(saved);
    else setLogo(DEFAULT_LOGO_URL);
  }, []);

  function persist(v: string) {
    localStorage.setItem(LOGO_KEY, v);
    setLogo(v);
    setMessage(tr("تم تحديث الشعار الرسمي بنجاح، ويمكن لبقية الواجهات التقاط التغيير مباشرة.", "The official logo was updated successfully, and the rest of the interfaces can pick up the change immediately."));
    window.dispatchEvent(new Event("exam-manager:changed"));
  }

  function onPickFile(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage(tr("الملف المحدد ليس صورة. يرجى اختيار ملف PNG أو JPG أو أي صورة مدعومة.", "The selected file is not an image. Please choose a PNG, JPG, or another supported image format."));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setMessage(lang === "ar" ? `حجم الملف أكبر من الحد المسموح. الحد الأقصى هو 2 ميجابايت، بينما الملف الحالي ${formatBytes(file.size)}.` : `The file exceeds the allowed size. The maximum is 2 MB, while the current file is ${formatBytes(file.size)}.`);
      return;
    }

    setSelectedFileName(file.name);
    setSelectedFileSize(file.size);
    setMessage(tr("جاري تجهيز الشعار الجديد للمعاينة والحفظ...", "Preparing the new logo for preview and saving..."));

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result || "");
      if (!base64) {
        setMessage(tr("تعذر قراءة الصورة المختارة. حاول مرة أخرى بصورة أخرى.", "The selected image could not be read. Please try again with another image."));
        return;
      }
      persist(base64);
    };
    reader.onerror = () => setMessage(tr("حدث خطأ أثناء قراءة الصورة. حاول مجددًا.", "An error occurred while reading the image. Please try again."));
    reader.readAsDataURL(file);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (!canEdit) return;
    const file = event.dataTransfer.files?.[0] || null;
    onPickFile(file);
  }

  const logoStatus = !logo ? tr("غير محدد", "Not set") : isProbablyUrl(logo) ? tr("رابط خارجي", "External URL") : tr("محفوظ محلياً (Base64)", "Stored locally (Base64)");

  return (
    <div
      style={{
        direction: isRTL ? "rtl" : "ltr",
        minHeight: "calc(100vh - 64px)",
        padding: "26px 18px 42px",
        background:
          "radial-gradient(circle at top, rgba(59,130,246,0.22), transparent 22%), radial-gradient(circle at 20% 80%, rgba(139,92,246,0.18), transparent 28%), linear-gradient(180deg, #020617 0%, #0f172a 48%, #111827 100%)",
        color: "#e2e8f0",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -140,
          insetInlineStart: -120,
          width: 360,
          height: 360,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.26), rgba(59,130,246,0) 68%)",
          filter: "blur(18px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -160,
          insetInlineEnd: -120,
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.22), rgba(139,92,246,0) 68%)",
          filter: "blur(24px)",
          pointerEvents: "none",
        }}
      />

      <div style={{ width: "100%", maxWidth: 1320, margin: "0 auto", display: "grid", gap: 22, position: "relative", zIndex: 1 }}>
        <div
          style={{
            ...buildGlassCard("rgba(148,163,184,0.14)"),
            padding: 28,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              insetInlineEnd: -50,
              top: -60,
              width: 220,
              height: 220,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(245,158,11,0.18), rgba(245,158,11,0) 70%)",
              filter: "blur(8px)",
            }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(280px,0.8fr)", gap: 22, position: "relative" }}>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <FeatureBadge text={tr("هوية بصرية رسمية", "Official visual identity")} tone="gold" />
                <FeatureBadge text={tr("مرتبطة بصلاحيات الإدارة", "Linked to admin permissions")} tone="green" />
                <FeatureBadge text={tr("معاينة فورية للشعار", "Instant logo preview")} tone="blue" />
              </div>

              <div>
                <div style={{ color: "#93c5fd", fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Advanced Brand Control</div>
                <h1 style={{ margin: 0, fontSize: "clamp(30px, 4.8vw, 56px)", lineHeight: 1.05, fontWeight: 900, color: "#f8fafc" }}>
                  {tr("مكتبة الشعار والهوية البصرية", "Logo and Visual Identity Library")}
                </h1>
                <p style={{ margin: "14px 0 0", fontSize: 15, lineHeight: 2, color: "rgba(226,232,240,0.82)", maxWidth: 860 }}>
                  {tr("صفحة أنيقة لإدارة الشعار الرسمي للنظام والتقارير، مع تجربة رفع ومعاينة أكثر فخامة ووضوحًا، وتحديث مباشر للشعار المستخدم داخل الواجهات.", "A polished page for managing the official system and report logo, with a more premium upload and preview experience and instant updates across interfaces.")}
                </p>
              </div>
            </div>

            <div
              style={{
                ...buildGlassCard("rgba(255,255,255,0.08)"),
                padding: 20,
                display: "grid",
                gap: 12,
                alignContent: "start",
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 900, color: "#f8fafc" }}>{tr("لوحة الحالة السريعة", "Quick status panel")}</div>
              <div style={{ color: "rgba(226,232,240,0.72)", lineHeight: 1.8, fontSize: 13 }}>
                {tr("ملخص فوري لحالة الشعار الحالي، مصدره، وصلاحية المستخدم في التعديل.", "An instant summary of the current logo state, its source, and the user’s edit permission.")}
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <FeatureBadge text={canEdit ? tr("التعديل متاح للمستخدم الحالي", "Editing is available for the current user") : tr("التعديل محصور بمدير الإعدادات", "Editing is restricted to the settings manager")} tone={canEdit ? "green" : "gold"} />
                <FeatureBadge text={`${tr("المصدر الحالي", "Current source")}: ${logoStatus}`} tone="violet" />
                <FeatureBadge text={logo === DEFAULT_LOGO_URL ? tr("الشعار الافتراضي مفعل", "Default logo is active") : tr("شعار مخصص مفعل", "Custom logo is active")} tone="blue" />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <StatTile label={tr("وضع الإدارة", "Admin mode")} value={canEdit ? tr("قابل للتعديل", "Editable") : tr("عرض فقط", "View Only")} hint={tr("يعتمد على صلاحية SETTINGS_MANAGE داخل النظام", "Depends on the SETTINGS_MANAGE permission in the system")} />
          <StatTile label={tr("مصدر الشعار", "Logo source")} value={logoStatus} hint={tr("يحدد هل الشعار رابط خارجي أو محفوظ محليًا", "Indicates whether the logo is an external URL or stored locally")} />
          <StatTile label={tr("آخر ملف تم اختياره", "Last selected file")} value={selectedFileName || "—"} hint={selectedFileName ? (lang === "ar" ? `الحجم: ${formatBytes(selectedFileSize)}` : `Size: ${formatBytes(selectedFileSize)}`) : tr("لم يتم اختيار ملف جديد في هذه الجلسة", "No new file has been selected in this session")} />
          <StatTile label={tr("وضع المعاينة", "Preview mode")} value={previewMode === "light" ? tr("فاتح", "Light") : tr("داكن", "Dark")} hint={tr("يمكن تبديل خلفية المعاينة لاختبار وضوح الشعار", "You can switch the preview background to test logo clarity")} />
        </div>

        {message ? (
          <div
            style={{
              ...buildGlassCard("rgba(52,211,153,0.22)"),
              padding: "16px 18px",
              color: "#d1fae5",
              fontWeight: 700,
              lineHeight: 1.9,
            }}
          >
            {message}
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 0.95fr) minmax(360px, 1.1fr)", gap: 20, alignItems: "start" }}>
          <div style={{ ...buildGlassCard(), padding: 28, display: "grid", gap: 24 }}>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: "#f8fafc" }}>{tr("رفع الشعار الجديد", "Upload a new logo")}</h2>
              <p style={{ marginTop: 8, color: "rgba(226,232,240,0.72)", lineHeight: 1.9, fontSize: 14 }}>
                {tr("ارفع شعارًا جديدًا ليتم حفظه محليًا واستخدامه في التقارير والواجهات. يفضّل استخدام صورة بخلفية شفافة للحصول على أفضل نتيجة.", "Upload a new logo to save it locally and use it in reports and interfaces. A transparent-background image is recommended for the best result.")}
              </p>
            </div>

            <div
              onDragEnter={(e) => {
                e.preventDefault();
                if (canEdit) setDragActive(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (canEdit) setDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragActive(false);
              }}
              onDrop={handleDrop}
              style={{
                border: dragActive ? "2px solid rgba(96,165,250,0.85)" : "2px dashed rgba(96,165,250,0.35)",
                borderRadius: 24,
                padding: "34px 22px",
                textAlign: "center",
                background: dragActive ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.05)",
                boxShadow: dragActive ? "0 0 0 6px rgba(59,130,246,0.08)" : "none",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ fontSize: 46, marginBottom: 14 }}>{dragActive ? "✨" : "⬆️"}</div>
              <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 8, color: "#f8fafc" }}>
                {tr("اضغط أو اسحب صورة الشعار هنا", "Click or drag the logo image here")}
              </div>
              <div style={{ fontSize: 13, opacity: 0.78, marginBottom: 18, lineHeight: 1.8 }}>
                {tr("PNG / JPG — الحد الأقصى الفعلي 2 ميجابايت — يفضّل شعار بخلفية شفافة لنتائج أفضل في التقارير والطباعة", "PNG / JPG — actual maximum 2 MB — a transparent-background logo is recommended for better results in reports and printing")}
              </div>

              <button
                type="button"
                disabled={!canEdit}
                onClick={() => fileRef.current?.click()}
                style={{
                  padding: "13px 34px",
                  borderRadius: 14,
                  border: "none",
                  background: canEdit ? "linear-gradient(135deg, #3b82f6, #8b5cf6)" : "rgba(255,255,255,0.08)",
                  color: canEdit ? "white" : "rgba(255,255,255,0.42)",
                  fontWeight: 900,
                  fontSize: 15,
                  cursor: canEdit ? "pointer" : "not-allowed",
                  boxShadow: canEdit ? "0 12px 32px rgba(59,130,246,0.28)" : "none",
                }}
              >
                {canEdit ? tr("اختيار صورة الشعار", "Choose logo image") : tr("التعديل للمدير فقط", "Editing for admin only")}
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

            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ color: "#f8fafc", fontWeight: 800, fontSize: 16 }}>{tr("إجراءات سريعة", "Quick actions")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => persist(DEFAULT_LOGO_URL)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.06)",
                    color: canEdit ? "#e2e8f0" : "rgba(255,255,255,0.38)",
                    fontWeight: 800,
                    cursor: canEdit ? "pointer" : "not-allowed",
                  }}
                >
                  {tr("استعادة الشعار الافتراضي", "Restore default logo")}
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewMode((prev) => (prev === "light" ? "dark" : "light"))}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.06)",
                    color: "#e2e8f0",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  تبديل خلفية المعاينة
                </button>
              </div>
            </div>
          </div>

          <div style={{ ...buildGlassCard(), padding: 28, display: "grid", gap: 18 }}>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: "#f8fafc" }}>{tr("المعاينة الحالية", "Current preview")}</h2>
              <p style={{ marginTop: 8, color: "rgba(226,232,240,0.72)", lineHeight: 1.9, fontSize: 14 }}>
                {tr("معاينة فورية للشعار الحالي كما سيظهر بصريًا، مع إمكانية اختبار وضوحه فوق خلفية فاتحة أو داكنة.", "An instant preview of the current logo as it will appear visually, with the ability to test its clarity on light or dark backgrounds.")}
              </p>
            </div>

            <div
              style={{
                borderRadius: 24,
                padding: 22,
                border: "1px solid rgba(255,255,255,0.08)",
                background: previewMode === "light"
                  ? "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(241,245,249,0.94))"
                  : "linear-gradient(180deg, rgba(2,6,23,0.98), rgba(15,23,42,0.94))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ display: "grid", gap: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <FeatureBadge text={previewMode === "light" ? tr("معاينة على خلفية فاتحة", "Preview on light background") : tr("معاينة على خلفية داكنة", "Preview on dark background")} tone={previewMode === "light" ? "gold" : "violet"} />
                  <FeatureBadge text={`${tr("الحالة", "Status")}: ${logoStatus}`} tone="blue" />
                </div>

                <div
                  style={{
                    margin: "0 auto",
                    width: "100%",
                    minHeight: 300,
                    borderRadius: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: previewMode === "light"
                      ? "radial-gradient(circle at top, rgba(226,232,240,0.9), rgba(255,255,255,1))"
                      : "radial-gradient(circle at top, rgba(30,41,59,0.9), rgba(2,6,23,1))",
                    border: previewMode === "light"
                      ? "1px solid rgba(15,23,42,0.08)"
                      : "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.22)",
                    padding: 24,
                    boxSizing: "border-box",
                  }}
                >
                  {logo ? (
                    <img
                      src={logo}
                      alt={tr("الشعار الحالي", "Current logo")}
                      style={{
                        width: "100%",
                        maxWidth: 420,
                        height: "auto",
                        maxHeight: 240,
                        objectFit: "contain",
                        filter: previewMode === "dark" ? "drop-shadow(0 18px 36px rgba(0,0,0,0.45))" : "drop-shadow(0 16px 30px rgba(15,23,42,0.14))",
                      }}
                    />
                  ) : (
                    <div style={{ padding: "60px 0", opacity: 0.5, color: previewMode === "light" ? "#0f172a" : "#e2e8f0" }}>{tr("لا يوجد شعار بعد", "No logo yet")}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            ...buildGlassCard("rgba(148,163,184,0.10)"),
            padding: 18,
            textAlign: "center",
            fontSize: 13,
            color: "rgba(226,232,240,0.68)",
            lineHeight: 1.9,
          }}
        >
          {tr("• يُفضل استخدام صور PNG بخلفية شفافة وشعار واضح الحواف للحصول على أفضل نتيجة في الواجهات والتقارير والطباعة الرسمية", "• It is recommended to use PNG images with a transparent background and clear logo edges for the best result in interfaces, reports, and official printing.")}
        </div>
      </div>
    </div>
  );
}
