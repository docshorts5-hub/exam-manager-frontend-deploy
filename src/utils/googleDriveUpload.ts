import { googleDriveLogin } from "./googleDriveAuth";

export async function uploadBackupToDrive(data: unknown, tenantId: string): Promise<void> {
  const token = await googleDriveLogin();
  const fileName = `exam-backup-${tenantId}-${Date.now()}.json`;

  const file = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });

  const metadata = {
    name: fileName,
    mimeType: "application/json",
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", file);

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Google Drive upload failed: ${res.status}`);
  }
}
