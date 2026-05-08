import React from "react";
import { useI18n } from "../../../i18n/I18nProvider";

export default function SyncStatusBanner({ card, message }: { card: React.CSSProperties; message: string }) {
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const isError = /❌|خطأ|فشل|تعذر|تعذّر|error|failed|cannot/i.test(message);
  const isWarning = /⚠️|تحذير|لا يمكن|مطلوب|warning|required/i.test(message);

  const borderColor = isError
    ? "rgba(239,68,68,0.35)"
    : isWarning
      ? "rgba(245,158,11,0.35)"
      : "rgba(34,197,94,0.28)";

  return (
    <div style={{ ...card, marginTop: 12, borderColor }}>
      <div style={{ fontWeight: 950, marginBottom: 6 }}>
        {isError ? tr("حالة العملية: خطأ", "Operation Status: Error") : isWarning ? tr("حالة العملية: تنبيه", "Operation Status: Warning") : tr("حالة العملية", "Operation Status")}
      </div>
      <div style={{ color: "rgba(245,231,178,0.9)", fontWeight: 800, lineHeight: 1.8 }}>{message}</div>
    </div>
  );
}
