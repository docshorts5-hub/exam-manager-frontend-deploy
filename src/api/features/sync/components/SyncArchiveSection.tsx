import React from "react";

type BtnFn = (kind?: "brand" | "soft" | "danger") => React.CSSProperties;

export default function SyncArchiveSection({
  card,
  btn,
  busy,
  onSyncArchive,
}: {
  card: React.CSSProperties;
  btn: BtnFn;
  busy: string;
  onSyncArchive: () => void;
}) {
  return (
    <div style={{ ...card, marginTop: 12 }}>
      <div style={{ fontWeight: 950, fontSize: 16 }}>مزامنة الأرشيف (Local ↔ Cloud)</div>
      <div style={{ marginTop: 8, color: "rgba(245,231,178,0.78)", fontWeight: 800, fontSize: 12, lineHeight: 1.7 }}>
        • يرفع كل الأرشيف المحلي إلى السحابة.
        <br />• ثم ينزل أي نسخ ناقصة من السحابة ويعمل Merge بدون حذف.
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <button style={btn("brand")} onClick={onSyncArchive} disabled={!!busy}>
          {busy === "sync" ? "جاري المزامنة…" : "مزامنة الأرشيف"}
        </button>
      </div>
    </div>
  );
}
