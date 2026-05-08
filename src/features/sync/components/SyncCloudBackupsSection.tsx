import React from "react";
import { useI18n } from "../../../i18n/I18nProvider";
import SyncEmptyState from "./SyncEmptyState";

type BtnFn = (kind?: "brand" | "soft" | "danger") => React.CSSProperties;

type BackupRow = any;

type AutoCloudState = {
  enabled: boolean;
  lastBackupISO?: string;
  status: { state: string; message?: string };
  toggle: (enabled: boolean) => void;
};

export default function SyncCloudBackupsSection({
  card,
  btn,
  tenantId,
  busy,
  autoCloud,
  cloudBackups,
  onCloudBackupNow,
  refreshCloudBackups,
  pruneCloudBackups,
  onImportFromCloud,
  onDeleteCloudBackup,
}: {
  card: React.CSSProperties;
  btn: BtnFn;
  tenantId: string;
  busy: string;
  autoCloud: AutoCloudState;
  cloudBackups: BackupRow[];
  onCloudBackupNow: () => void;
  refreshCloudBackups: () => void;
  pruneCloudBackups: (keepLast: number) => void;
  onImportFromCloud: (backupId: string) => void;
  onDeleteCloudBackup: (backupId: string) => void;
}) {
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  return (
    <div style={{ ...card, marginTop: 12 }}>
      <div style={{ fontWeight: 950, fontSize: 16 }}>
        {tr("النسخ السحابية (Backups)", "Cloud Backups")}
      </div>
      <div style={{ marginTop: 8, color: "rgba(245,231,178,0.78)", fontWeight: 800, fontSize: 12, lineHeight: 1.7 }}>
        {tr("يتم حفظ snapshot من localStorage (مفاتيح exam-manager) في:", "A snapshot from localStorage (exam-manager keys) is stored in:")}
        <br />
        <b>tenants/{tenantId}/backups</b>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
        <button style={btn("brand")} onClick={onCloudBackupNow} disabled={!!busy}>
          {busy === "cloud" ? tr("جاري رفع النسخة…", "Uploading backup…") : tr("نسخ سحابي الآن (يدوي)", "Cloud Backup Now (Manual)")}
        </button>

        <button style={btn("soft")} onClick={refreshCloudBackups} disabled={!!busy}>
          {tr("تحديث قائمة النسخ", "Refresh Backup List")}
        </button>

        <button style={btn("danger")} onClick={() => pruneCloudBackups(10)} disabled={!!busy}>
          {tr("حذف النسخ القديمة (اترك آخر 10)", "Delete Old Backups (Keep Last 10)")}
        </button>

        <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900 }}>
          <input type="checkbox" checked={autoCloud.enabled} onChange={(e) => autoCloud.toggle(e.target.checked)} />
          {tr("تفعيل النسخ السحابي التلقائي كل 10 دقائق (لهذا الجهاز)", "Enable automatic cloud backup every 10 minutes (for this device)")}
        </label>

        <div style={{ color: "rgba(245,231,178,0.85)", fontWeight: 800, fontSize: 12 }}>
          {tr("آخر نسخة", "Last Backup")}: {autoCloud.lastBackupISO || "—"} • {tr("الحالة", "Status")}: {autoCloud.status.state}
          {autoCloud.status.message ? ` (${autoCloud.status.message})` : ""}
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {cloudBackups.length === 0 ? (
          <SyncEmptyState message={tr("لا توجد نسخ سحابية بعد.", "No cloud backups yet.")} />
        ) : (
          cloudBackups.map((b: any) => (
            <div key={b.id} style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 950 }}>{b?.meta?.createdAtISO || b.id}</div>
              <div style={{ marginTop: 6, color: "rgba(245,231,178,0.78)", fontWeight: 800, fontSize: 12 }}>
                {b?.meta?.note ? `${tr("ملاحظة", "Note")}: ${b.meta.note}` : ""}
                {b?.data?.chunked ? ` • (${tr("مجزأ", "Chunked")}: ${b?.data?.chunkCount || "?"})` : ""}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <button style={btn("brand")} onClick={() => onImportFromCloud(b.id)} disabled={!!busy}>
                  {busy === "cloud-import" ? tr("جاري الاستيراد…", "Importing…") : tr("استيراد من السحابة", "Import from Cloud")}
                </button>

                <button style={btn("danger")} onClick={() => onDeleteCloudBackup(b.id)} disabled={!!busy}>
                  {tr("حذف النسخة", "Delete Backup")}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 10, color: "rgba(245,231,178,0.78)", fontWeight: 800, fontSize: 12 }}>
        {tr("✅ ملاحظة: الاسترجاع التلقائي للأرشيف يعمل “Safe” عند فتح الصفحة (Merge بدون حذف).", "✅ Note: automatic archive restore runs in “Safe” mode when opening the page (merge without deletion).")}
      </div>
    </div>
  );
}
