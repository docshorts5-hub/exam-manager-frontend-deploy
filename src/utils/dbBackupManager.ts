import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { assertTenantWritable } from "../features/cloud-storage/readOnlyTenantGuard";

// =========================
// Full DB backup format (SAFE + Chunked)
// =========================
export type DbBackupMeta = {
  schema: string; // "db:v2"
  createdAtISO: string;
  tenantId: string;
  byUid?: string;
  byEmail?: string;
  note?: string;
};

export type DbBackupFile = {
  meta: DbBackupMeta;
  data: {
    // ✅ We store payload as one string OR chunked strings
    encoding: "json";
    payload?: string;        // when small enough
    chunks?: string[];       // when large
    chunked?: boolean;
    byteLen?: number;
    chunkCount?: number;
  };
};

export const DB_BACKUP_SCHEMA = "db:v2";

export const makeBackupId = () => "b_" + new Date().toISOString().replace(/[:.]/g, "-");

export const lastBackupKey = (tenantId: string) =>
  `exam-manager:cloud-backup:last:${tenantId}`;

// =========================
// Safe localStorage key filter
// =========================
const LOCAL_STORAGE_KEY_DENY_PARTS = [
  "token",
  "auth",
  "firebase",
  "credential",
  "password",
  "secret",
  "session",
  "uid",
  "email",
  "role",
  "permission",
  "readonly",
  "read-only",
  "viewas",
  "governoratesuper",
  "selectedtenantid",
  "effectivetenantid",
  "tenantid",
  "cloud-backup:lock",
  "cloud-storage:last-error",
  "cloud-storage:last-warning",
  "cloud-cache",
  ":cache:",
];

export function shouldBackupLocalStorageKey(rawKey: unknown, tenantId?: string) {
  const key = String(rawKey || "").trim();
  if (!key) return false;

  const lower = key.toLowerCase();
  if (LOCAL_STORAGE_KEY_DENY_PARTS.some((part) => lower.includes(part))) return false;

  const allowedAppKey =
    key.startsWith("exam-manager:") ||
    key.startsWith("school-exam-manager:") ||
    key.startsWith("task-distribution:") ||
    key.includes(":task-distribution:") ||
    key.includes("examRoomAssignments");

  if (!allowedAppKey) return false;

  const targetTenantId = String(tenantId || "").trim();
  if (!targetTenantId) return true;

  // Safe general app keys are allowed. Tenant-specific keys must match the active tenant.
  if (!lower.includes("tenant:") && !lower.includes("tenantid") && !key.includes(targetTenantId)) return true;
  return key.includes(targetTenantId);
}

export function shouldRestoreLocalStorageKey(rawKey: unknown, tenantId?: string) {
  return shouldBackupLocalStorageKey(rawKey, tenantId);
}

// =========================
// Local export as ONE payload
// =========================
export function exportLocalDatabase(prefix = "exam-manager", tenantId?: string) {
  const out: Record<string, string | null> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (!k.startsWith(prefix)) continue;
    if (!shouldBackupLocalStorageKey(k, tenantId)) continue;
    out[k] = localStorage.getItem(k);
  }
  return out;
}

export function buildBackupPayload(args: { prefix?: string; tenantId?: string }) {
  const prefix = args.prefix || "exam-manager";
  const data = exportLocalDatabase(prefix, args.tenantId);
  return JSON.stringify({ prefix, data });
}

export function parseBackupPayload(payload: string): { prefix: string; data: Record<string, string | null> } {
  const obj = JSON.parse(payload || "{}");
  const prefix = String(obj?.prefix || "exam-manager");
  const data = (obj?.data && typeof obj.data === "object") ? (obj.data as Record<string, string | null>) : {};
  return { prefix, data };
}

// =========================
// Chunking helpers
// =========================
/**
 * Firestore doc limit ~1MB.
 * We chunk the payload to avoid exceeding it.
 *
 * We use a conservative chunk size (700KB) to leave room for meta/overhead.
 */
const MAX_CHUNK_BYTES = 700 * 1024;

function strByteLen(s: string) {
  // Accurate byte length in UTF-8
  return new TextEncoder().encode(s).length;
}

function splitToChunks(payload: string, maxBytes = MAX_CHUNK_BYTES): string[] {
  // Split by characters but respect byte length (UTF-8)
  const chunks: string[] = [];
  let start = 0;

  while (start < payload.length) {
    let end = Math.min(payload.length, start + 500_000); // initial guess by chars
    // Adjust end until bytes fit
    while (end > start) {
      const part = payload.slice(start, end);
      if (strByteLen(part) <= maxBytes) {
        chunks.push(part);
        start = end;
        break;
      }
      end = Math.floor((start + end) / 2);
    }
    if (end === start) {
      // fallback (should be rare)
      chunks.push(payload.slice(start, start + 10_000));
      start = start + 10_000;
    }
  }
  return chunks;
}

function joinChunks(chunks: string[]) {
  return (chunks || []).join("");
}

// =========================
// Build / Validate
// =========================
export function buildBackupFile(args: {
  tenantId: string;
  byUid?: string;
  byEmail?: string;
  note?: string;
  prefix?: string;
}): DbBackupFile {
  const payload = buildBackupPayload({ prefix: args.prefix || "exam-manager", tenantId: args.tenantId });
  const bytes = strByteLen(payload);

  // ✅ chunk if too big
  if (bytes > MAX_CHUNK_BYTES) {
    const chunks = splitToChunks(payload, MAX_CHUNK_BYTES);
    return {
      meta: {
        schema: DB_BACKUP_SCHEMA,
        createdAtISO: new Date().toISOString(),
        tenantId: args.tenantId,
        byUid: args.byUid,
        byEmail: args.byEmail,
        note: args.note,
      },
      data: {
        encoding: "json",
        chunked: true,
        chunks,
        chunkCount: chunks.length,
        byteLen: bytes,
      },
    };
  }

  return {
    meta: {
      schema: DB_BACKUP_SCHEMA,
      createdAtISO: new Date().toISOString(),
      tenantId: args.tenantId,
      byUid: args.byUid,
      byEmail: args.byEmail,
      note: args.note,
    },
    data: {
      encoding: "json",
      payload,
      chunked: false,
      chunkCount: 1,
      byteLen: bytes,
    },
  };
}

export function validateBackupFile(file: any) {
  if (!file || typeof file !== "object") throw new Error("Invalid backup file");
  if (!file.meta || typeof file.meta !== "object") throw new Error("Missing meta");
  if (file.meta.schema !== DB_BACKUP_SCHEMA) throw new Error("Schema mismatch");
  if (!file.data || typeof file.data !== "object") throw new Error("Missing data");
  if (file.data.encoding !== "json") throw new Error("Invalid encoding");

  const hasPayload = typeof file.data.payload === "string";
  const hasChunks = Array.isArray(file.data.chunks) && file.data.chunks.every((x: any) => typeof x === "string");
  if (!hasPayload && !hasChunks) throw new Error("Missing payload/chunks");
}

export function getPayloadFromFile(file: DbBackupFile): string {
  validateBackupFile(file);
  if (file.data.payload) return file.data.payload;
  if (file.data.chunks?.length) return joinChunks(file.data.chunks);
  throw new Error("Missing payload");
}

export function previewImport(file: DbBackupFile, prefix = "exam-manager") {
  const payload = getPayloadFromFile(file);
  const parsed = parseBackupPayload(payload);

  const incomingKeys = Object.keys(parsed.data || {}).filter((k) => k.startsWith(prefix));

  const currentKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) currentKeys.push(k);
  }

  return {
    incoming: incomingKeys.length,
    current: currentKeys.length,
    willSet: incomingKeys.length,
  };
}

export function importDatabase(file: DbBackupFile, opts?: { prefix?: string; dryRun?: boolean }) {
  const expectedPrefix = opts?.prefix || "exam-manager";
  const payload = getPayloadFromFile(file);
  const parsed = parseBackupPayload(payload);

  const entries = Object.entries(parsed.data || {}).filter(([k]) => k.startsWith(expectedPrefix) && shouldRestoreLocalStorageKey(k, file.meta?.tenantId));

  if (opts?.dryRun) return { willSet: entries.length };

  for (const [k, v] of entries) {
    if (v === null || v === undefined) localStorage.removeItem(k);
    else localStorage.setItem(k, String(v));
  }

  return { set: entries.length };
}

// =========================
// Cloud (Firestore) backups
// tenants/{tenantId}/backups/{backupId}
// =========================
export async function uploadBackupToCloud(args: {
  tenantId: string;
  backupId?: string;
  file: DbBackupFile;
}) {
  const tenantId = String(args.tenantId || "").trim();
  if (!tenantId || tenantId === "default") {
    throw new Error("Invalid tenantId for cloud backup");
  }

  assertTenantWritable(tenantId, "upload cloud backup");

  const id = args.backupId || makeBackupId();
  const ref = doc(db, "tenants", tenantId, "backups", id);

  validateBackupFile(args.file);

  // Firestore has a hard 1 MiB document limit.
  // Never store the full payload/chunks array inside the parent backup document.
  // Store only metadata in tenants/{tenantId}/backups/{backupId}, then store the payload
  // in tenants/{tenantId}/backups/{backupId}/chunks/{chunkId}.
  const payloadChunks = args.file.data.chunks?.length
    ? args.file.data.chunks
    : typeof args.file.data.payload === "string"
      ? splitToChunks(args.file.data.payload, MAX_CHUNK_BYTES)
      : [];

  if (!payloadChunks.length) throw new Error("Missing backup payload");

  const byteLen = payloadChunks.reduce((sum, part) => sum + strByteLen(part), 0);

  await setDoc(ref, {
    backupId: id,
    tenantId,
    createdAtISO: args.file.meta.createdAtISO,
    createdAtMs: Date.now(),
    backupType: "local-storage-snapshot",
    version: DB_BACKUP_SCHEMA,
    meta: {
      ...args.file.meta,
      tenantId,
    },
    data: {
      encoding: "json",
      chunked: true,
      chunkCount: payloadChunks.length,
      byteLen,
    },
  });

  for (let index = 0; index < payloadChunks.length; index += 1) {
    const payload = payloadChunks[index];
    await setDoc(doc(db, "tenants", tenantId, "backups", id, "chunks", `payload-${String(index + 1).padStart(4, "0")}`), {
      tenantId,
      backupId: id,
      collectionName: "__meta__",
      index: index + 1,
      storageKind: "rows",
      payload,
      payloadBytes: strByteLen(payload),
      createdAtISO: args.file.meta.createdAtISO,
    });
  }

  try {
    localStorage.setItem(lastBackupKey(tenantId), new Date().toISOString());
  } catch {}

  return id;
}

export async function listCloudBackups(tenantId: string, max = 50) {
  const safeTenantId = String(tenantId || "").trim();
  if (!safeTenantId || safeTenantId === "default") return [];

  const ref = collection(db, "tenants", safeTenantId, "backups");
  const q = query(ref, orderBy("meta.createdAtISO", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function fetchCloudBackup(tenantId: string, backupId: string): Promise<DbBackupFile> {
  const safeTenantId = String(tenantId || "").trim();
  if (!safeTenantId || safeTenantId === "default") throw new Error("Invalid tenantId for cloud backup");

  const ref = doc(db, "tenants", safeTenantId, "backups", backupId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Backup not found");
  const data = snap.data() as any;

  // Legacy support: old documents may contain the payload directly in the parent document.
  if (typeof data?.data?.payload === "string" || Array.isArray(data?.data?.chunks)) {
    return { meta: data.meta, data: data.data };
  }

  const chunksRef = collection(db, "tenants", safeTenantId, "backups", backupId, "chunks");
  const chunksSnap = await getDocs(query(chunksRef, orderBy("index", "asc")));
  const chunks = chunksSnap.docs
    .map((item) => item.data() as any)
    .filter((item) => typeof item.payload === "string")
    .sort((a, b) => Number(a.index || 0) - Number(b.index || 0))
    .map((item) => String(item.payload || ""));

  if (!chunks.length) throw new Error("Backup payload chunks were not found");

  return {
    meta: data.meta,
    data: {
      encoding: "json",
      chunked: true,
      chunks,
      chunkCount: chunks.length,
      byteLen: chunks.reduce((sum, part) => sum + strByteLen(part), 0),
    },
  };
}

export async function deleteCloudBackup(tenantId: string, backupId: string) {
  const safeTenantId = String(tenantId || "").trim();
  if (!safeTenantId || safeTenantId === "default") throw new Error("Invalid tenantId for cloud backup");

  assertTenantWritable(safeTenantId, "delete cloud backup");

  const chunksSnap = await getDocs(collection(db, "tenants", safeTenantId, "backups", backupId, "chunks"));
  for (const chunkDoc of chunksSnap.docs) {
    await deleteDoc(doc(db, "tenants", safeTenantId, "backups", backupId, "chunks", chunkDoc.id));
  }
  await deleteDoc(doc(db, "tenants", safeTenantId, "backups", backupId));
}
