import React from "react";

type Props = {
  busy: boolean;
  onRunBackup: () => void;
  onToggleAutoBackup: () => void;
};

const card: React.CSSProperties = {
  border: "1px solid rgba(212,175,55,0.25)",
  borderRadius: 14,
  padding: 14,
  background: "rgba(255,255,255,0.03)",
};

export default function SuperAdminCenterBackupSection({ busy, onRunBackup, onToggleAutoBackup }: Props) {
  return (
    <div style={card}>
      <div style={{ fontWeight: 950, fontSize: 16 }}>النسخ السحابية</div>
      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <button disabled={busy} onClick={onRunBackup} style={{ padding: "10px 12px", borderRadius: 12, cursor: "pointer" }}>
          نسخ سحابي الآن (Super Admin)
        </button>
        <button disabled={busy} onClick={onToggleAutoBackup} style={{ padding: "10px 12px", borderRadius: 12, cursor: "pointer" }}>
          تشغيل/إيقاف النسخ التلقائي (هذا الجهاز)
        </button>
      </div>
    </div>
  );
}
