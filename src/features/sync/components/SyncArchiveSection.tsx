import React from "react";
import { useI18n } from "../../../i18n/I18nProvider";

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
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  return (
    <div style={{ ...card, marginTop: 12 }}>
      <div style={{ fontWeight: 950, fontSize: 16 }}>
        {tr("مزامنة الأرشيف (Local ↔ Cloud)", "Archive Sync (Local ↔ Cloud)")}
      </div>
      <div style={{ marginTop: 8, color: "rgba(245,231,178,0.78)", fontWeight: 800, fontSize: 12, lineHeight: 1.7 }}>
        {tr("• يرفع كل الأرشيف المحلي إلى السحابة.", "• Uploads the entire local archive to the cloud.")}
        <br />
        {tr("• ثم ينزل أي نسخ ناقصة من السحابة ويعمل Merge بدون حذف.", "• Then downloads any missing cloud copies and merges them without deletion.")}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <button style={btn("brand")} onClick={onSyncArchive} disabled={!!busy}>
          {busy === "sync" ? tr("جاري المزامنة…", "Syncing…") : tr("مزامنة الأرشيف", "Archive Sync")}
        </button>
      </div>
    </div>
  );
}
