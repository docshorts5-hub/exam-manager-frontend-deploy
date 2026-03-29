import { useCallback, useEffect, useState } from "react";
import { loadCloudBackupCount, runOwnerBackupNow, saveAllowlistUser, toggleLocalAutoBackup } from "../services/superAdminCenterService";

export function useSuperAdminCenter(tenantId: string, user: any) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [cloudCount, setCloudCount] = useState(0);

  const refreshCloudCount = useCallback(async () => {
    const count = await loadCloudBackupCount(tenantId);
    setCloudCount(count);
  }, [tenantId]);

  useEffect(() => { refreshCloudCount(); }, [refreshCloudCount]);

  const saveAllow = useCallback(async (payload: { email: string; enabled: boolean; tenantId: string; role: string; governorate?: string; }) => {
    if (!payload.email.trim()) return false;
    setBusy("save");
    try {
      await saveAllowlistUser(payload);
      setMsg("✅ تم حفظ المستخدم في allowlist");
      return true;
    } catch (e: any) {
      setMsg(e?.message || "Failed");
      return false;
    } finally {
      setBusy("");
    }
  }, []);

  const runBackup = useCallback(async () => {
    setBusy("backup");
    try {
      const id = await runOwnerBackupNow({ tenantId, byUid: user?.uid, byEmail: user?.email, note: "super-admin-manual" });
      setMsg("✅ تم رفع نسخة: " + id);
      await refreshCloudCount();
    } catch (e: any) {
      setMsg(e?.message || "Backup failed");
    } finally {
      setBusy("");
    }
  }, [tenantId, user, refreshCloudCount]);

  const toggleAutoBackup = useCallback(() => {
    const next = toggleLocalAutoBackup(tenantId);
    setMsg(next ? "✅ تم تفعيل النسخ التلقائي لهذا الجهاز" : "تم إيقاف النسخ التلقائي لهذا الجهاز");
  }, [tenantId]);

  return { busy, msg, cloudCount, saveAllow, runBackup, toggleAutoBackup };
}
