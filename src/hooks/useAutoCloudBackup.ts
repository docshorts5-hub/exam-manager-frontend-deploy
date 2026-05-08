import { useEffect, useMemo, useState } from "react";
import { startAutoBackup, isAutoBackupEnabled, setAutoBackupEnabled, backupNow } from "../utils/autoCloudBackup";
import { lastBackupKey } from "../utils/dbBackupManager";

export function useAutoCloudBackup(args: {
  tenantId: string;
  uid?: string;
  email?: string;
  intervalMs?: number;
  defaultEnabled?: boolean;
}) {
  const [status, setStatus] = useState<{ state: string; message?: string; backupId?: string }>({ state: "idle" });
  const [enabled, setEnabled] = useState(false);
  const [last, setLast] = useState<string>("");

  useEffect(() => {
    if (!args.tenantId) return;
    const current = isAutoBackupEnabled(args.tenantId);
    const init = typeof args.defaultEnabled === "boolean" ? args.defaultEnabled : current;
    setAutoBackupEnabled(args.tenantId, init);
    setEnabled(init);

    const stop = startAutoBackup({
      tenantId: args.tenantId,
      byUid: args.uid,
      byEmail: args.email,
      intervalMs: args.intervalMs,
      enabled: init,
      onStatus: setStatus,
    });

    const t = setInterval(() => {
      try { setLast(localStorage.getItem(lastBackupKey(args.tenantId)) || ""); } catch {}
    }, 2000);

    return () => { stop(); clearInterval(t); };
  }, [args.tenantId, args.uid, args.email, args.intervalMs, args.defaultEnabled]);

  const toggle = (v: boolean) => {
    if (!args.tenantId) return;
    setAutoBackupEnabled(args.tenantId, v);
    setEnabled(v);
  };

  const runNow = async (note?: string) => {
    const id = await backupNow({ tenantId: args.tenantId, byUid: args.uid, byEmail: args.email, note: note || "manual" });
    try { setLast(localStorage.getItem(lastBackupKey(args.tenantId)) || ""); } catch {}
    return id;
  };

  return { enabled, toggle, status, lastBackupISO: last, runNow };
}
