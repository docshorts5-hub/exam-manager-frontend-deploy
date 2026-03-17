import { uploadBackupToDrive } from "./googleDriveUpload";

export function startAutoBackup<T>(getData: () => Promise<T> | T, tenantId: string): void {
  const HOURS = 6;
  const interval = HOURS * 60 * 60 * 1000;

  async function backup() {
    try {
      const data = await getData();
      await uploadBackupToDrive(data, tenantId);
      console.log("Auto backup saved");
    } catch (e) {
      console.error("Backup error", e);
    }
  }

  setTimeout(() => {
    void backup();
  }, 15000);
  setInterval(() => {
    void backup();
  }, interval);
}
