import React from "react";
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
  return (
    <div style={{ ...card, marginTop: 12 }}>
      <div style={{ fontWeight: 950, fontSize: 16 }}>النسخ السحابية (Backups)</div>
      <div style={{ marginTop: 8, color: "rgba(245,231,178,0.78)", fontWeight: 800, fontSize: 12, lineHeight: 1.7 }}>
        يتم حفظ snapshot من localStorage (مفاتيح exam-manager) في:
        <br />
        <b>tenants/{tenantId}/backups</b>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
        <button style={btn("brand")} onClick={onCloudBackupNow} disabled={!!busy}>
          {busy === "cloud" ? "جاري رفع النسخة…" : "نسخ سحابي الآن (يدوي)"}
        </button>

        <button style={btn("soft")} onClick={refreshCloudBackups} disabled={!!busy}>
          تحديث قائمة النسخ
        </button>

        <button style={btn("danger")} onClick={() => pruneCloudBackups(10)} disabled={!!busy}>
          حذف النسخ القديمة (اترك آخر 10)
        </button>

        <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900 }}>
          <input type="checkbox" checked={autoCloud.enabled} onChange={(e) => autoCloud.toggle(e.target.checked)} />
          تفعيل النسخ السحابي التلقائي كل 10 دقائق (لهذا الجهاز)
        </label>

        <div style={{ color: "rgba(245,231,178,0.85)", fontWeight: 800, fontSize: 12 }}>
          آخر نسخة: {autoCloud.lastBackupISO || "—"} • الحالة: {autoCloud.status.state}
          {autoCloud.status.message ? ` (${autoCloud.status.message})` : ""}
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {cloudBackups.length === 0 ? (
          <SyncEmptyState message="لا توجد نسخ سحابية بعد." />
        ) : (
          cloudBackups.map((b: any) => (
            <div key={b.id} style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 950 }}>{b?.meta?.createdAtISO || b.id}</div>
              <div style={{ marginTop: 6, color: "rgba(245,231,178,0.78)", fontWeight: 800, fontSize: 12 }}>
                {b?.meta?.note ? `ملاحظة: ${b.meta.note}` : ""}
                {b?.data?.chunked ? ` • (Chunked: ${b?.data?.chunkCount || "?"})` : ""}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <button style={btn("brand")} onClick={() => onImportFromCloud(b.id)} disabled={!!busy}>
                  {busy === "cloud-import" ? "جاري الاستيراد…" : "استيراد من السحابة"}
                </button>

                <button style={btn("danger")} onClick={() => onDeleteCloudBackup(b.id)} disabled={!!busy}>
                  حذف النسخة
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 10, color: "rgba(245,231,178,0.78)", fontWeight: 800, fontSize: 12 }}>
        ✅ ملاحظة: الاسترجاع التلقائي للأرشيف يعمل “Safe” عند فتح الصفحة (Merge بدون حذف).
      </div>
    </div>
  );
}
