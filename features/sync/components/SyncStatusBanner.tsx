import React from "react";

export default function SyncStatusBanner({ card, message }: { card: React.CSSProperties; message: string }) {
  const isError = /❌|خطأ|فشل|تعذر|تعذّر/.test(message);
  const isWarning = /⚠️|تحذير|لا يمكن|مطلوب/.test(message);

  const borderColor = isError
    ? "rgba(239,68,68,0.35)"
    : isWarning
      ? "rgba(245,158,11,0.35)"
      : "rgba(34,197,94,0.28)";

  return (
    <div style={{ ...card, marginTop: 12, borderColor }}>
      <div style={{ fontWeight: 950, marginBottom: 6 }}>
        {isError ? "حالة العملية: خطأ" : isWarning ? "حالة العملية: تنبيه" : "حالة العملية"}
      </div>
      <div style={{ color: "rgba(245,231,178,0.9)", fontWeight: 800, lineHeight: 1.8 }}>{message}</div>
    </div>
  );
}
