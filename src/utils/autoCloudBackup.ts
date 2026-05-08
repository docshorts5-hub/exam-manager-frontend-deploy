import { buildBackupFile, uploadBackupToCloud, lastBackupKey } from "./dbBackupManager";

const LOCK_KEY = (tenantId: string) => `exam-manager:cloud-backup:lock:${tenantId}`;
const AUTO_ENABLED_KEY = (tenantId: string) => `exam-manager:cloud-backup:auto-enabled:${tenantId}`;

function tryLock(tenantId: string, ttlMs = 3 * 60 * 1000) {
  const now = Date.now();
  const raw = localStorage.getItem(LOCK_KEY(tenantId));
  if (raw) {
    const ts = Number(raw) || 0;
    if (now - ts < ttlMs) return false;
  }
  localStorage.setItem(LOCK_KEY(tenantId), String(now));
  return true;
}

function unlock(tenantId: string) {
  try { localStorage.removeItem(LOCK_KEY(tenantId)); } catch {}
}

export function isAutoBackupEnabled(tenantId: string) {
  return localStorage.getItem(AUTO_ENABLED_KEY(tenantId)) === "true";
}

export function setAutoBackupEnabled(tenantId: string, enabled: boolean) {
  localStorage.setItem(AUTO_ENABLED_KEY(tenantId), enabled ? "true" : "false");
}

export async function backupNow(args: {
  tenantId: string;
  byUid?: string;
  byEmail?: string;
  note?: string;
}) {
  if (!args.tenantId) throw new Error("Missing tenantId");
  if (!navigator.onLine) throw new Error("Offline");
  if (!tryLock(args.tenantId)) throw new Error("Backup already running");

  try {
    const file = buildBackupFile({
      tenantId: args.tenantId,
      byUid: args.byUid,
      byEmail: args.byEmail,
      note: args.note,
    });
    const id = await uploadBackupToCloud({ tenantId: args.tenantId, file });
    try { localStorage.setItem(lastBackupKey(args.tenantId), new Date().toISOString()); } catch {}
    return id;
  } finally {
    unlock(args.tenantId);
  }
}

export function startAutoBackup(args: {
  tenantId: string;
  byUid?: string;
  byEmail?: string;
  intervalMs?: number; // default 10 min
  enabled?: boolean; // initial
  note?: string;
  onStatus?: (s: { state: "idle" | "running" | "ok" | "error"; message?: string; backupId?: string }) => void;
}) {
  const intervalMs = args.intervalMs ?? 10 * 60 * 1000;
  if (!args.tenantId) return () => {};

  if (typeof args.enabled === "boolean") {
    setAutoBackupEnabled(args.tenantId, args.enabled);
  }

  let timer: any = null;

  const tick = async () => {
    if (!isAutoBackupEnabled(args.tenantId)) return;
    if (!navigator.onLine) return;
    try {
      args.onStatus?.({ state: "running", message: "Backup running..." });
      const id = await backupNow({
        tenantId: args.tenantId,
        byUid: args.byUid,
        byEmail: args.byEmail,
        note: args.note || "auto-10min",
      });
      args.onStatus?.({ state: "ok", backupId: id, message: "Backup uploaded" });
    } catch (e: any) {
      args.onStatus?.({ state: "error", message: e?.message || "Backup failed" });
    }
  };

  timer = setInterval(tick, intervalMs);
  // optional: do not run immediately to avoid noise. Uncomment if needed:
  // tick();

  return () => {
    if (timer) clearInterval(timer);
  };
}
