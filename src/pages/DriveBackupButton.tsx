import React from "react";
import { uploadBackupToDrive } from "../utils/googleDriveUpload";

type DriveBackupButtonProps = {
  tenantId: string;
  data: unknown;
};

export default function DriveBackupButton({ tenantId, data }: DriveBackupButtonProps) {
  async function handleBackup() {
    await uploadBackupToDrive(data, tenantId);
    alert("تم حفظ النسخة الاحتياطية في Google Drive");
  }

  return (
    <button
      style={{
        padding: "12px 18px",
        background: "#c9a227",
        color: "#000",
        borderRadius: "8px",
        border: "none",
        cursor: "pointer",
      }}
      onClick={handleBackup}
    >
      حفظ نسخة احتياطية في Google Drive
    </button>
  );
}
