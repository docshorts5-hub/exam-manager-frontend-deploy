import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebase";
import { backupNow, isAutoBackupEnabled, setAutoBackupEnabled } from "../../../utils/autoCloudBackup";
import { listCloudBackups } from "../../../utils/dbBackupManager";

export async function loadCloudBackupCount(tenantId: string): Promise<number> {
  try {
    const items = await listCloudBackups(tenantId, 10);
    return items.length;
  } catch {
    return 0;
  }
}

export async function saveAllowlistUser(input: {
  email: string;
  enabled: boolean;
  tenantId: string;
  role: string;
  governorate?: string;
}) {
  const ref = doc(db, "allowlist", input.email.trim());
  await setDoc(ref, {
    enabled: input.enabled,
    tenantId: input.tenantId.trim(),
    role: input.role,
    governorate: input.governorate || "",
  }, { merge: true });
}

export async function runOwnerBackupNow(args: { tenantId: string; byUid?: string; byEmail?: string; note?: string; }) {
  return backupNow(args);
}

export function toggleLocalAutoBackup(tenantId: string) {
  const next = !isAutoBackupEnabled(tenantId);
  setAutoBackupEnabled(tenantId, next);
  return next;
}
