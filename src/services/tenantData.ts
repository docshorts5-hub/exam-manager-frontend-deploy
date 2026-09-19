/**
 * Tenant-scoped data helpers for Firestore.
 *
 * Commercial cloud-first version:
 * - Firestore is the source of truth.
 * - localStorage is only a cache/fallback.
 * - Existing functions are preserved:
 *   loadTenantArray
 *   subscribeTenantArray
 *   writeTenantAudit
 *   replaceTenantArray
 *
 * Firestore structure:
 *   tenants/{tenantId}/{subCollection}/{docId}
 *   tenants/{tenantId}/settings/{docId}
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { writeActivityLog } from "./activityLog.service";
import { assertTenantWritable } from "../features/cloud-storage/readOnlyTenantGuard";

type AnyRecord = Record<string, any>;

const CACHE_PREFIX = "exam-manager:cloud-cache:v1";
const MAX_BATCH_WRITES = 450;
const CLOUD_CACHE_BYPASS_FLAG = "__examManagerCloudLocalStorageBridgeBypass";
const CLOUD_READ_SOFT_TIMEOUT_MS = 2200;
const BACKGROUND_REFRESH_COOLDOWN_MS = 4500;

const backgroundRefreshLastStartedAt = new Map<string, number>();

function withSoftTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  if (typeof window === "undefined") return promise;

  let timeoutId = 0;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`${label}-soft-timeout`)), timeoutMs);
  });

  promise.catch(() => undefined);

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) window.clearTimeout(timeoutId);
  }) as Promise<T>;
}

function shouldHideCloudReadError(error: unknown) {
  const anyError = error as { code?: unknown; message?: unknown };
  const code = String(anyError?.code || "").toLowerCase();
  const message = String(anyError?.message || "").toLowerCase();

  return (
    code.includes("permission-denied") ||
    code.includes("unavailable") ||
    message.includes("missing or insufficient permissions") ||
    message.includes("timed out") ||
    message.includes("deadline") ||
    message.includes("offline") ||
    message.includes("soft-timeout")
  );
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function safeTenantId(tenantId: string | undefined | null) {
  return clean(tenantId) || "default";
}

function safeSubCollection(subCollection: string) {
  const value = clean(subCollection);
  if (!value) throw new Error("subCollection is required.");
  if (value.includes("/") || value.includes("\\")) {
    throw new Error(`Invalid subCollection name: ${value}`);
  }
  return value;
}

function safeDocId(docId: string) {
  const value = clean(docId);
  if (!value) throw new Error("docId is required.");
  if (value.includes("/") || value.includes("\\")) {
    throw new Error(`Invalid docId: ${value}`);
  }
  return value;
}

function cacheKey(tenantId: string, subCollection: string) {
  return `${CACHE_PREFIX}:${safeTenantId(tenantId)}:${safeSubCollection(subCollection)}`;
}

function settingsCacheKey(tenantId: string, docId: string) {
  return `${CACHE_PREFIX}:${safeTenantId(tenantId)}:settings:${safeDocId(docId)}`;
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function withCloudCacheBypass<T>(fn: () => T): T {
  if (typeof window === "undefined") return fn();
  const anyWindow = window as unknown as Record<string, unknown>;
  const previous = anyWindow[CLOUD_CACHE_BYPASS_FLAG];
  anyWindow[CLOUD_CACHE_BYPASS_FLAG] = true;
  try {
    return fn();
  } finally {
    if (previous === undefined) {
      delete anyWindow[CLOUD_CACHE_BYPASS_FLAG];
    } else {
      anyWindow[CLOUD_CACHE_BYPASS_FLAG] = previous;
    }
  }
}

function hasCache(tenantId: string, subCollection: string): boolean {
  if (typeof localStorage === "undefined") return false;

  if (isSensitiveTenantArrayCache(subCollection)) {
    removeCache(tenantId, subCollection);
    return false;
  }

  try {
    return localStorage.getItem(cacheKey(tenantId, subCollection)) !== null;
  } catch {
    return false;
  }
}

function hasUsableArrayCache(value: unknown): boolean {
  // Empty/stale cache is a common reason why a second device shows no data.
  // Only use cache as an immediate response when it actually contains rows.
  return Array.isArray(value) && value.length > 0;
}

function isSensitiveTenantArrayCache(subCollection: string) {
  const sub = clean(subCollection).toLowerCase();
  return sub === "teachers" || sub === "teachers12";
}

function removeCache(tenantId: string, subCollection: string) {
  if (typeof localStorage === "undefined") return;

  try {
    withCloudCacheBypass(() => {
      localStorage.removeItem(cacheKey(tenantId, subCollection));
    });
  } catch {
    // Cache cleanup failure must not break the app.
  }
}

function readCache<T>(tenantId: string, subCollection: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;

  if (isSensitiveTenantArrayCache(subCollection)) {
    removeCache(tenantId, subCollection);
    return fallback;
  }

  return safeJsonParse<T>(localStorage.getItem(cacheKey(tenantId, subCollection)), fallback);
}

export function readTenantArrayCache<T extends AnyRecord = AnyRecord>(
  tenantId: string,
  subCollection: string,
): (T & { id: string })[] {
  return readCache<(T & { id: string })[]>(safeTenantId(tenantId), safeSubCollection(subCollection), []);
}

function writeCache<T>(tenantId: string, subCollection: string, value: T) {
  if (typeof localStorage === "undefined") return;
  try {
    withCloudCacheBypass(() => {
      if (isSensitiveTenantArrayCache(subCollection)) {
        localStorage.removeItem(cacheKey(tenantId, subCollection));
        return;
      }

      localStorage.setItem(cacheKey(tenantId, subCollection), JSON.stringify(value));
    });
  } catch {
    // Cache failure must not break the app.
  }
}

function hasSettingsCache(tenantId: string, docId: string): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(settingsCacheKey(tenantId, docId)) !== null;
  } catch {
    return false;
  }
}

function readSettingsCache<T>(tenantId: string, docId: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  return safeJsonParse<T>(localStorage.getItem(settingsCacheKey(tenantId, docId)), fallback);
}

function writeSettingsCache<T>(tenantId: string, docId: string, value: T) {
  if (typeof localStorage === "undefined") return;
  try {
    withCloudCacheBypass(() => {
      localStorage.setItem(settingsCacheKey(tenantId, docId), JSON.stringify(value));
    });
  } catch {
    // Cache failure must not break the app.
  }
}

function normalizeRow<T extends AnyRecord>(snapId: string, data: DocumentData): T & { id: string } {
  const row = { ...(data || {}) } as T & { id?: string };
  return {
    ...(row as T),
    id: clean(row.id) || snapId,
  };
}

function cryptoRandomId() {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    // ignore
  }

  return `row_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeWriteRow<T extends AnyRecord>(row: T, fallbackId?: string): T & { id: string } {
  const id = clean((row as any)?.id) || clean(fallbackId) || cryptoRandomId();
  return {
    ...(row || ({} as T)),
    id,
  };
}

function tenantCollectionRef(tenantId: string, subCollection: string) {
  return collection(db, "tenants", safeTenantId(tenantId), safeSubCollection(subCollection));
}

function tenantDocRef(tenantId: string, subCollection: string, rowId: string) {
  return doc(db, "tenants", safeTenantId(tenantId), safeSubCollection(subCollection), safeDocId(rowId));
}

async function fetchTenantArrayFromCloud<T extends AnyRecord = AnyRecord>(
  tenantId: string,
  subCollection: string,
  constraints: QueryConstraint[],
): Promise<(T & { id: string })[]> {
  const colRef = tenantCollectionRef(tenantId, subCollection);
  const snap = constraints.length ? await getDocs(query(colRef, ...constraints)) : await getDocs(colRef);
  return snap.docs.map((d) => normalizeRow<T>(d.id, d.data()));
}

function refreshTenantArrayCacheInBackground<T extends AnyRecord = AnyRecord>(
  tenantId: string,
  subCollection: string,
  constraints: QueryConstraint[],
) {
  const key = `${safeTenantId(tenantId)}:${safeSubCollection(subCollection)}`;
  const now = Date.now();
  const lastStartedAt = backgroundRefreshLastStartedAt.get(key) || 0;

  if (now - lastStartedAt < BACKGROUND_REFRESH_COOLDOWN_MS) return;
  backgroundRefreshLastStartedAt.set(key, now);

  void fetchTenantArrayFromCloud<T>(tenantId, subCollection, constraints)
    .then((out) => {
      writeCache(tenantId, subCollection, out);
      notifyTenantDataChanged(tenantId, subCollection);
    })
    .catch((error) => {
      if (!shouldHideCloudReadError(error)) {
        console.warn(`[tenantData] background refresh failed ${subCollection}`, error);
      }
    });
}

async function commitBatchOperations(
  operations: Array<(batch: ReturnType<typeof writeBatch>) => void>
): Promise<void> {
  for (let i = 0; i < operations.length; i += MAX_BATCH_WRITES) {
    const batch = writeBatch(db);
    operations.slice(i, i + MAX_BATCH_WRITES).forEach((op) => op(batch));
    await batch.commit();
  }
}

/**
 * Load tenant collection as array.
 *
 * Compatible with old usage:
 *   loadTenantArray<any>(tenantId, "teachers")
 *
 * New features:
 * - optional ordering
 * - optional maxRows
 * - localStorage cache fallback
 */
export async function loadTenantArray<T extends AnyRecord = AnyRecord>(
  tenantId: string,
  subCollection: string,
  options?: {
    orderByField?: string;
    orderDirection?: "asc" | "desc";
    maxRows?: number;
    cacheFallback?: boolean;
    fastCache?: boolean;
    timeoutMs?: number;
  },
): Promise<(T & { id: string })[]> {
  const tid = safeTenantId(tenantId);
  const sub = safeSubCollection(subCollection);
  const constraints: QueryConstraint[] = [];

  if (options?.orderByField) {
    constraints.push(orderBy(options.orderByField, options.orderDirection || "asc"));
  }

  if (options?.maxRows && options.maxRows > 0) {
    constraints.push(limit(options.maxRows));
  }

  const cached = readCache<(T & { id: string })[]>(tid, sub, []);
  const canUseCache = options?.cacheFallback !== false && hasCache(tid, sub);

  // Cloud-first by default:
  // - We no longer return local cache immediately unless the caller explicitly asks for fastCache.
  // - Never use an empty local cache as a fast answer; otherwise another device may show no rows
  //   even though Firestore already has data.
  const fastCache = options?.fastCache === true;
  const canReturnFastCache = fastCache && canUseCache && hasUsableArrayCache(cached);

  if (canReturnFastCache) {
    refreshTenantArrayCacheInBackground<T>(tid, sub, constraints);
    return cached;
  }

  try {
    const out = await withSoftTimeout(
      fetchTenantArrayFromCloud<T>(tid, sub, constraints),
      options?.timeoutMs || CLOUD_READ_SOFT_TIMEOUT_MS,
      `tenant-array-${sub}`,
    );
    writeCache(tid, sub, out);
    return out;
  } catch (error) {
    if (options?.cacheFallback === false) throw error;
    if (!shouldHideCloudReadError(error)) {
      console.warn(`[tenantData] load failed ${sub}`, error);
    }
    return cached;
  }
}

/**
 * Subscribe to tenant collection in real time.
 *
 * Preserved from the old file.
 */
export function subscribeTenantArray<T extends AnyRecord = AnyRecord>(
  tenantId: string,
  subCollection: string,
  onChange: (items: (T & { id: string })[]) => void,
  onError?: (error: unknown) => void,
) {
  const tid = safeTenantId(tenantId);
  const sub = safeSubCollection(subCollection);
  const colRef = tenantCollectionRef(tid, sub);

  // ط·آ·ط¢آ·ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¶ ط·آ·ط¢آ·ط·آ¢ط¢آ§ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬أ¢â‚¬ع†ط·آ·ط¢آ¸ط·آ¦أ¢â‚¬â„¢ط·آ·ط¢آ·ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ´ ط·آ·ط¢آ¸ط·آ¸ط¢آ¾ط·آ·ط¢آ¸ط·آ«أ¢â‚¬آ ط·آ·ط¢آ·ط·آ¢ط¢آ±ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ§ ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬ط¹â€کط·آ·ط¢آ·ط·آ¢ط¢آ¨ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬أ¢â‚¬ع† ط·آ·ط¢آ·ط·آ¢ط¢آ§ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¹ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ·ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ± onSnapshot ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬ط¢آ¦ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬ط¢آ  Firestore.
  // ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬ط·إ’ط·آ·ط¢آ·ط·آ¢ط¢آ°ط·آ·ط¢آ·ط·آ¢ط¢آ§ ط·آ·ط¢آ¸ط·آ¸ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ¹ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬أ¢â‚¬ع† ط·آ·ط¢آ·ط·آ¢ط¢آ§ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬أ¢â‚¬ع†ط·آ·ط¢آ·ط·آ¢ط¢آµط·آ·ط¢آ¸ط·آ¸ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¹ط¢آ¾ ط·آ·ط¢آ·ط·آ¹ط¢آ¾ط·آ·ط¢آ¸ط·آ¸ط¢آ¾ط·آ·ط¢آ·ط·آ¹ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ­ ط·آ·ط¢آ·ط·آ¢ط¢آ³ط·آ·ط¢آ·ط·آ¢ط¢آ±ط·آ·ط¢آ¸ط·آ¸ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¹ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ§ ط·آ·ط¢آ·ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¹ط¢آ¾ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬ط¢آ° ط·آ·ط¢آ·ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ°ط·آ·ط¢آ·ط·آ¢ط¢آ§ ط·آ·ط¢آ¸ط·آ¦أ¢â‚¬â„¢ط·آ·ط¢آ·ط·آ¢ط¢آ§ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬ط¢آ  ط·آ·ط¢آ·ط·آ¢ط¢آ§ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬أ¢â‚¬ع†ط·آ·ط¢آ·ط·آ¢ط¢آ¥ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¹ط¢آ¾ط·آ·ط¢آ·ط·آ¢ط¢آ±ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¹ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ·ط·آ·ط¢آ¸ط·آ¸ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¦ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ§.
  const cached = readCache<(T & { id: string })[]>(tid, sub, []);
  if (hasCache(tid, sub)) {
    try {
      onChange(cached);
    } catch {
      // ignore UI callback errors
    }
  }

  return onSnapshot(
    colRef,
    (snap) => {
      const out = snap.docs.map((d) => normalizeRow<T>(d.id, d.data()));
      writeCache(tid, sub, out);
      onChange(out);
    },
    (error) => {
      const cached = readCache<(T & { id: string })[]>(tid, sub, []);
      if (cached.length) onChange(cached);
      onError?.(error);
    },
  );
}

export type ReplaceOptions = {
  by?: string;
  audit?: {
    action?: string;
    entity?: string;
    meta?: any;
  };
};

/**
 * Audit log.
 *
 * Preserved behavior:
 * uses writeActivityLog service.
 */
function normalizeAuditAction(value: unknown) {
  const raw = clean(value).toUpperCase().replace(/[\s\-]+/g, "_");
  return raw || "SYSTEM";
}

function normalizeAuditActor(by?: string) {
  const value = clean(by);
  if (!value) return { actorUid: undefined as string | undefined, actorEmail: undefined as string | undefined };
  if (value.includes("@")) return { actorUid: undefined, actorEmail: value };
  return { actorUid: value, actorEmail: undefined };
}

function normalizeAuditMeta(meta: any) {
  if (!meta || typeof meta !== "object") return meta ?? null;

  // Avoid accidentally sending very large objects to the audit function.
  // Full records are still supported, but huge arrays are summarized.
  const out: AnyRecord = { ...meta };
  for (const key of Object.keys(out)) {
    const value = out[key];
    if (Array.isArray(value) && value.length > 40) {
      out[key] = {
        type: "array-summary",
        count: value.length,
        sample: value.slice(0, 5),
      };
    }
  }
  return out;
}

export async function writeTenantAudit(
  tenantId: string,
  payload: {
    action: string;
    entity: string;
    by?: string;
    entityId?: string;
    meta?: any;
  },
) {
  const tid = safeTenantId(tenantId);
  if (!tid) return;

  const action = normalizeAuditAction(payload.action);
  const entity = clean(payload.entity) || "system";
  const meta = normalizeAuditMeta(payload.meta);
  const actor = normalizeAuditActor(payload.by);

  await writeActivityLog(tid, {
    level: action.includes("DELETE") || action.includes("RESTORE") ? "warning" : "info",
    action: (action as any) || "SYSTEM",
    entityType: entity,
    entityId: clean(payload.entityId) || undefined,
    message: meta?.summary || `${action} ${entity}`,
    actorUid: actor.actorUid,
    actorEmail: actor.actorEmail,
    after: meta ?? null,
  });
}

function normalizeAuditRow(value: any) {
  if (!value || typeof value !== "object") return value;
  const clone = { ...value };
  delete clone.updatedAt;
  delete clone.createdAt;
  delete clone.updatedBy;
  delete clone.createdBy;
  return clone;
}

/**
 * Replace a whole tenant collection.
 *
 * Preserved from the old file, with cache update added.
 * Useful for Excel import and full-page array saves.
 */
export async function replaceTenantArray<T extends { id: string }>(
  tenantId: string,
  subCollection: string,
  rows: T[],
  options?: ReplaceOptions,
): Promise<void> {
  const tid = safeTenantId(tenantId);
  const sub = safeSubCollection(subCollection);
  assertTenantWritable(tid, "save tenant array");

  const colRef = tenantCollectionRef(tid, sub);

  const existingSnap = await getDocs(colRef);
  const existingIds = new Set<string>();
  const existingMap = new Map<string, any>();

  existingSnap.forEach((d) => {
    existingIds.add(d.id);
    existingMap.set(d.id, { id: d.id, ...(d.data() as any) });
  });

  const normalizedRows = (Array.isArray(rows) ? rows : []).map((row, index) =>
    normalizeWriteRow(row as AnyRecord, String(index + 1)) as T & { id: string },
  );

  const nextIds = new Set<string>(normalizedRows.map((r) => String(r.id)));
  const operations: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  for (const id of existingIds) {
    if (!nextIds.has(id)) {
      operations.push((batch) => batch.delete(tenantDocRef(tid, sub, id)));
    }
  }

  for (const r of normalizedRows) {
    const id = String(r.id);
    const meta =
      options?.by
        ? { updatedBy: options.by, updatedAt: serverTimestamp() }
        : { updatedAt: serverTimestamp() };

    operations.push((batch) =>
      batch.set(
        tenantDocRef(tid, sub, id),
        { ...r, id, ...meta },
        { merge: true },
      )
    );
  }

  await commitBatchOperations(operations);
  writeCache(tid, sub, normalizedRows);
  notifyTenantDataChanged(tid, sub);

  const auditEntity = options?.audit?.entity || subCollection;
  const auditMeta = options?.audit?.meta;
  const auditJobs: Promise<void>[] = [];

  for (const id of existingIds) {
    if (!nextIds.has(id)) {
      auditJobs.push(
        writeTenantAudit(tid, {
          action: "DELETE",
          entity: auditEntity,
          by: options?.by,
          entityId: id,
          meta: {
            summary: `deleted ${auditEntity}`,
            before: normalizeAuditRow(existingMap.get(id)),
            ...(auditMeta || {}),
          },
        }),
      );
    }
  }

  for (const r of normalizedRows) {
    const id = String(r.id);
    const before = existingMap.get(id);

    if (!before) {
      auditJobs.push(
        writeTenantAudit(tid, {
          action: "CREATE",
          entity: auditEntity,
          by: options?.by,
          entityId: id,
          meta: {
            summary: `created ${auditEntity}`,
            after: normalizeAuditRow(r),
            ...(auditMeta || {}),
          },
        }),
      );
      continue;
    }

    const changed = JSON.stringify(normalizeAuditRow(before)) !== JSON.stringify(normalizeAuditRow(r));
    if (changed) {
      auditJobs.push(
        writeTenantAudit(tid, {
          action: "UPDATE",
          entity: auditEntity,
          by: options?.by,
          entityId: id,
          meta: {
            summary: `updated ${auditEntity}`,
            before: normalizeAuditRow(before),
            after: normalizeAuditRow(r),
            ...(auditMeta || {}),
          },
        }),
      );
    }
  }

  await Promise.allSettled(auditJobs);
}

/**
 * New alias for commercial naming.
 * Uses replaceTenantArray internally.
 */
export async function saveTenantArray<T extends AnyRecord = AnyRecord>(
  tenantId: string,
  subCollection: string,
  rows: (T & { id?: string })[],
  options?: {
    replace?: boolean;
    by?: string;
    audit?: ReplaceOptions["audit"];
  },
): Promise<(T & { id: string })[]> {
  const normalizedRows = (Array.isArray(rows) ? rows : []).map((row, index) =>
    normalizeWriteRow(row as AnyRecord, String(index + 1)) as T & { id: string },
  );

  // Current implementation always writes the full collection safely.
  // The replace flag is kept for API readability.
  await replaceTenantArray(tenantId, subCollection, normalizedRows, {
    by: options?.by,
    audit: options?.audit,
  });

  return normalizedRows;
}

/**
 * Add/update one row.
 */
export async function upsertTenantRow<T extends AnyRecord = AnyRecord>(
  tenantId: string,
  subCollection: string,
  row: T,
  options?: {
    by?: string;
    audit?: {
      entity?: string;
      meta?: any;
    };
  },
): Promise<T & { id: string }> {
  const tid = safeTenantId(tenantId);
  const sub = safeSubCollection(subCollection);
  assertTenantWritable(tid, "save tenant row");
  const normalized = normalizeWriteRow(row);

  const existing = await getDoc(tenantDocRef(tid, sub, normalized.id));
  const before = existing.exists() ? { id: existing.id, ...(existing.data() as any) } : null;

  await setDoc(
    tenantDocRef(tid, sub, normalized.id),
    {
      ...normalized,
      updatedAt: serverTimestamp(),
      updatedBy: clean(options?.by) || null,
    },
    { merge: true },
  );

  const cached = readCache<any[]>(tid, sub, []);
  const withoutOld = cached.filter((item) => clean(item?.id) !== normalized.id);
  writeCache(tid, sub, [normalized, ...withoutOld]);
  notifyTenantDataChanged(tid, sub);

  const auditEntity = options?.audit?.entity || sub;
  await writeTenantAudit(tid, {
    action: before ? "UPDATE" : "CREATE",
    entity: auditEntity,
    by: options?.by,
    entityId: normalized.id,
    meta: {
      summary: before ? `updated ${auditEntity}` : `created ${auditEntity}`,
      before: normalizeAuditRow(before),
      after: normalizeAuditRow(normalized),
      ...(options?.audit?.meta || {}),
    },
  }).catch(() => undefined);

  return normalized as T & { id: string };
}

/**
 * Delete one row.
 */
export async function deleteTenantRow(
  tenantId: string,
  subCollection: string,
  rowId: string,
  options?: {
    by?: string;
    audit?: {
      entity?: string;
      meta?: any;
    };
  },
): Promise<void> {
  const tid = safeTenantId(tenantId);
  const sub = safeSubCollection(subCollection);
  assertTenantWritable(tid, "delete tenant row");
  const id = safeDocId(rowId);

  const existing = await getDoc(tenantDocRef(tid, sub, id));
  const before = existing.exists() ? { id: existing.id, ...(existing.data() as any) } : null;

  await deleteDoc(tenantDocRef(tid, sub, id));

  const cached = readCache<any[]>(tid, sub, []);
  writeCache(
    tid,
    sub,
    cached.filter((item) => clean(item?.id) !== id),
  );
  notifyTenantDataChanged(tid, sub);

  const auditEntity = options?.audit?.entity || sub;
  await writeTenantAudit(tid, {
    action: "DELETE",
    entity: auditEntity,
    by: options?.by,
    entityId: id,
    meta: {
      summary: `deleted ${auditEntity}`,
      before: normalizeAuditRow(before),
      ...(options?.audit?.meta || {}),
    },
  }).catch(() => undefined);
}

/**
 * Clear collection.
 */
export async function clearTenantCollection(tenantId: string, subCollection: string): Promise<void> {
  const tid = safeTenantId(tenantId);
  const sub = safeSubCollection(subCollection);
  assertTenantWritable(tid, "clear tenant collection");
  const snap = await getDocs(tenantCollectionRef(tid, sub));

  const operations = snap.docs.map((d) => (batch: ReturnType<typeof writeBatch>) => batch.delete(d.ref));
  await commitBatchOperations(operations);

  writeCache(tid, sub, []);
  notifyTenantDataChanged(tid, sub);
}

/**
 * Load settings document:
 * tenants/{tenantId}/settings/{docId}
 */
export async function loadTenantSettings<T extends AnyRecord = AnyRecord>(
  tenantId: string,
  docId: string,
  fallback: T,
): Promise<T & { id?: string }> {
  const tid = safeTenantId(tenantId);
  const id = safeDocId(docId);

  const localFallback = readSettingsCache<T & { id?: string }>(tid, id, fallback);

  // ط·آ·ط¢آ·ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ°ط·آ·ط¢آ·ط·آ¢ط¢آ§ ط·آ·ط¢آ¸ط·آ¦أ¢â‚¬â„¢ط·آ·ط¢آ·ط·آ¢ط¢آ§ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¹ط¢آ¾ ط·آ·ط¢آ·ط·آ¢ط¢آ§ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬أ¢â‚¬ع†ط·آ·ط¢آ·ط·آ¢ط¢آ¥ط·آ·ط¢آ·ط·آ¢ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¹ط¢آ¾ ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬ط¢آ¦ط·آ·ط¢آ·ط·آ¢ط¢آ­ط·آ·ط¢آ¸ط·آ¸ط¢آ¾ط·آ·ط¢آ¸ط·آ«أ¢â‚¬آ ط·آ·ط¢آ·ط·آ¢ط¢آ¸ط·آ·ط¢آ·ط·آ¢ط¢آ© ط·آ·ط¢آ·ط·آ¢ط¢آ¨ط·آ·ط¢آ·ط·آ¢ط¢آ§ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬أ¢â‚¬ع†ط·آ·ط¢آ¸ط·آ¦أ¢â‚¬â„¢ط·آ·ط¢آ·ط·آ¢ط¢آ§ط·آ·ط¢آ·ط·آ¢ط¢آ´ط·آ·ط¢آ·ط·آ¥أ¢â‚¬â„¢ ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ±ط·آ·ط¢آ·ط·آ¢ط¢آ¬ط·آ·ط¢آ·ط·آ¢ط¢آ¹ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬ط·إ’ط·آ·ط¢آ·ط·آ¢ط¢آ§ ط·آ·ط¢آ¸ط·آ¸ط¢آ¾ط·آ·ط¢آ¸ط·آ«أ¢â‚¬آ ط·آ·ط¢آ·ط·آ¢ط¢آ±ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ§ ط·آ·ط¢آ¸ط·آ«أ¢â‚¬آ ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬ط¢آ ط·آ·ط¢آ·ط·آ¢ط¢آ­ط·آ·ط¢آ·ط·آ¢ط¢آ¯ط·آ·ط¢آ·ط·آ¢ط¢آ«ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬ط·إ’ط·آ·ط¢آ·ط·آ¢ط¢آ§ ط·آ·ط¢آ¸ط·آ¸ط¢آ¾ط·آ·ط¢آ¸ط·آ¸ط¢آ¹ ط·آ·ط¢آ·ط·آ¢ط¢آ§ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬أ¢â‚¬ع†ط·آ·ط¢آ·ط·آ¢ط¢آ®ط·آ·ط¢آ¸ط£آ¢أ¢â€ڑآ¬أ¢â‚¬ع†ط·آ·ط¢آ¸ط·آ¸ط¢آ¾ط·آ·ط¢آ¸ط·آ¸ط¢آ¹ط·آ·ط¢آ·ط·آ¢ط¢آ©.
  if (hasSettingsCache(tid, id)) {
    void getDoc(tenantDocRef(tid, "settings", id))
      .then((snap) => {
        if (!snap.exists()) return;
        const data = normalizeRow<T>(snap.id, snap.data());
        writeSettingsCache(tid, id, data);
      })
      .catch((error) => {
        if (!shouldHideCloudReadError(error)) {
          console.warn(`[tenantData] settings background refresh failed ${id}`, error);
        }
      });

    return localFallback;
  }

  try {
    const snap = await withSoftTimeout(
      getDoc(tenantDocRef(tid, "settings", id)),
      CLOUD_READ_SOFT_TIMEOUT_MS,
      `tenant-settings-${id}`,
    );
    if (!snap.exists()) return localFallback;

    const data = normalizeRow<T>(snap.id, snap.data());
    writeSettingsCache(tid, id, data);
    return data;
  } catch (error) {
    if (!shouldHideCloudReadError(error)) {
      console.warn(`[tenantData] settings load failed ${id}`, error);
    }
    return localFallback;
  }
}

/**
 * Save settings document:
 * tenants/{tenantId}/settings/{docId}
 */
export async function saveTenantSettings<T extends AnyRecord = AnyRecord>(
  tenantId: string,
  docId: string,
  data: T,
  options?: {
    by?: string;
  },
): Promise<T & { id: string }> {
  const tid = safeTenantId(tenantId);
  const id = safeDocId(docId);
  assertTenantWritable(tid, "save tenant settings");

  const payload = {
    ...(data || {}),
    id,
    updatedAt: serverTimestamp(),
    updatedBy: clean(options?.by) || null,
  };

  await setDoc(tenantDocRef(tid, "settings", id), payload, { merge: true });

  const cached = { ...(data || {}), id } as T & { id: string };
  writeSettingsCache(tid, id, cached);

  await writeTenantAudit(tid, {
    action: "SAVE_SETTINGS",
    entity: `settings/${id}`,
    by: options?.by,
    entityId: id,
    meta: {
      summary: `saved settings/${id}`,
      after: normalizeAuditRow(cached),
    },
  }).catch(() => undefined);

  return cached;
}

const APPROVED_LEGACY_LOCAL_STORAGE_MIGRATIONS = {
  "exam-manager:teachers:v1": {
    subCollection: "teachers",
  },
  "exam-manager:exams:v1": {
    subCollection: "exams",
  },
} as const;

type ApprovedLegacyLocalStorageKey =
  keyof typeof APPROVED_LEGACY_LOCAL_STORAGE_MIGRATIONS;

const LEGACY_MIGRATION_ADOPTION_PERMIT:
  unique symbol = Symbol(
    "legacy-migration-adoption-permit"
  );

type LegacyMigrationAdoptionPermit = {
  readonly [LEGACY_MIGRATION_ADOPTION_PERMIT]: true;
  readonly source: "quarantine";
  readonly quarantineId: string;
  readonly targetTenantId: string;
};

export type LegacyLocalStorageMigrationRequest = {
  tenantId: string;
  localStorageKey: ApprovedLegacyLocalStorageKey;
  adoptionPermit: LegacyMigrationAdoptionPermit;
  replace?: boolean;
  by?: string;
  removeLocalAfterSuccess?: boolean;
};

const MAX_LEGACY_MIGRATION_ROWS = 20_000;
const MAX_LEGACY_MIGRATION_TOTAL_CHARS =
  25_000_000;
const MAX_LEGACY_MIGRATION_DEPTH = 20;
const MAX_LEGACY_MIGRATION_NODES = 200_000;

const LEGACY_MIGRATION_DANGEROUS_KEYS =
  new Set([
    "__proto__",
    "prototype",
    "constructor",
  ]);

function isLegacyMigrationPlainRecord(
  value: unknown
): value is Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return (
    prototype === Object.prototype ||
    prototype === null
  );
}

function requireLegacyMigrationTenantId(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error(
      "LEGACY_MIGRATION_TENANT_ID_MUST_BE_STRING"
    );
  }

  const tenantId = safeTenantId(value);

  if (tenantId.toLowerCase() === "default") {
    throw new Error(
      "LEGACY_MIGRATION_DEFAULT_TENANT_PROHIBITED"
    );
  }

  return tenantId;
}

function assertLegacyMigrationJsonValue(
  value: unknown,
  path: string,
  depth: number,
  state: { nodes: number },
  seen: WeakSet<object>
): void {
  state.nodes += 1;

  if (state.nodes > MAX_LEGACY_MIGRATION_NODES) {
    throw new Error(
      "LEGACY_MIGRATION_NODE_LIMIT_EXCEEDED"
    );
  }

  if (depth > MAX_LEGACY_MIGRATION_DEPTH) {
    throw new Error(
      "LEGACY_MIGRATION_DEPTH_LIMIT_EXCEEDED"
    );
  }

  if (value === null) return;

  if (
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(
        `LEGACY_MIGRATION_NON_FINITE_NUMBER:${path}`
      );
    }

    return;
  }

  if (typeof value !== "object") {
    throw new Error(
      `LEGACY_MIGRATION_NON_JSON_VALUE:${path}`
    );
  }

  if (seen.has(value)) {
    throw new Error(
      `LEGACY_MIGRATION_CYCLIC_VALUE:${path}`
    );
  }

  seen.add(value);

  try {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        assertLegacyMigrationJsonValue(
          item,
          `${path}[${index}]`,
          depth + 1,
          state,
          seen
        );
      });

      return;
    }

    if (!isLegacyMigrationPlainRecord(value)) {
      throw new Error(
        `LEGACY_MIGRATION_NON_PLAIN_OBJECT:${path}`
      );
    }

    for (const [key, nestedValue] of Object.entries(
      value
    )) {
      if (
        LEGACY_MIGRATION_DANGEROUS_KEYS.has(key)
      ) {
        throw new Error(
          `LEGACY_MIGRATION_DANGEROUS_KEY:${path}.${key}`
        );
      }

      assertLegacyMigrationJsonValue(
        nestedValue,
        `${path}.${key}`,
        depth + 1,
        state,
        seen
      );
    }
  } finally {
    seen.delete(value);
  }
}

function validateLegacyMigrationRows(
  value: unknown,
  targetTenantId: string
): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error(
      "LEGACY_MIGRATION_PAYLOAD_MUST_BE_ARRAY"
    );
  }

  if (value.length > MAX_LEGACY_MIGRATION_ROWS) {
    throw new Error(
      "LEGACY_MIGRATION_ROW_LIMIT_EXCEEDED"
    );
  }

  let totalChars = 0;
  const state = { nodes: 0 };

  return value.map((row, index) => {
    if (!isLegacyMigrationPlainRecord(row)) {
      throw new Error(
        `LEGACY_MIGRATION_INVALID_ROW:${index}`
      );
    }

    const rowId = row.id;

    if (
      !(
        typeof rowId === "string" ||
        typeof rowId === "number"
      ) ||
      String(rowId).trim() === ""
    ) {
      throw new Error(
        `LEGACY_MIGRATION_INVALID_ROW_ID:${index}`
      );
    }

    const rowTenantId = row.tenantId;

    if (
      rowTenantId !== undefined &&
      rowTenantId !== null &&
      String(rowTenantId).trim() !== ""
    ) {
      if (typeof rowTenantId !== "string") {
        throw new Error(
          `LEGACY_MIGRATION_ROW_TENANT_TYPE:${index}`
        );
      }

      const normalizedRowTenantId =
        requireLegacyMigrationTenantId(
          rowTenantId
        );

      if (
        normalizedRowTenantId !== targetTenantId
      ) {
        throw new Error(
          `LEGACY_MIGRATION_ROW_TENANT_MISMATCH:${index}`
        );
      }
    }

    assertLegacyMigrationJsonValue(
      row,
      `rows[${index}]`,
      0,
      state,
      new WeakSet<object>()
    );

    let serialized: string;

    try {
      serialized = JSON.stringify(row);
    } catch {
      throw new Error(
        `LEGACY_MIGRATION_ROW_SERIALIZATION_FAILED:${index}`
      );
    }

    totalChars += serialized.length;

    if (
      totalChars >
      MAX_LEGACY_MIGRATION_TOTAL_CHARS
    ) {
      throw new Error(
        "LEGACY_MIGRATION_PAYLOAD_SIZE_LIMIT_EXCEEDED"
      );
    }

    return row;
  });
}

function validateLegacyMigrationAdoptionPermit(
  permit: LegacyMigrationAdoptionPermit,
  targetTenantId: string
): string {
  if (
    !isLegacyMigrationPlainRecord(permit) ||
    permit[LEGACY_MIGRATION_ADOPTION_PERMIT] !==
      true ||
    permit.source !== "quarantine"
  ) {
    throw new Error(
      "LEGACY_MIGRATION_VERIFIED_ADOPTION_REQUIRED"
    );
  }

  const permitTenantId =
    requireLegacyMigrationTenantId(
      permit.targetTenantId
    );

  if (permitTenantId !== targetTenantId) {
    throw new Error(
      "LEGACY_MIGRATION_ADOPTION_TENANT_MISMATCH"
    );
  }

  const quarantineId = String(
    permit.quarantineId || ""
  ).trim();

  if (
    !quarantineId ||
    quarantineId.length > 300 ||
    !/^[A-Za-z0-9:._-]+$/.test(quarantineId)
  ) {
    throw new Error(
      "LEGACY_MIGRATION_INVALID_QUARANTINE_ID"
    );
  }

  return quarantineId;
}

/**
 * Migrates only explicitly approved legacy data.
 *
 * No adoption-permit creator is exported yet.
 * The API therefore remains fail-closed until a verified
 * quarantine workflow creates the private runtime permit.
 */
export async function migrateLocalStorageArrayToTenant(
  request: LegacyLocalStorageMigrationRequest
): Promise<{ migrated: number }> {
  if (!isLegacyMigrationPlainRecord(request)) {
    throw new Error(
      "LEGACY_MIGRATION_INVALID_REQUEST"
    );
  }

  const targetTenantId =
    requireLegacyMigrationTenantId(
      request.tenantId
    );

  const localStorageKey =
    request.localStorageKey;

  if (
    typeof localStorageKey !== "string" ||
    !Object.prototype.hasOwnProperty.call(
      APPROVED_LEGACY_LOCAL_STORAGE_MIGRATIONS,
      localStorageKey
    )
  ) {
    throw new Error(
      "LEGACY_MIGRATION_KEY_NOT_APPROVED"
    );
  }

  const approved =
    APPROVED_LEGACY_LOCAL_STORAGE_MIGRATIONS[
      localStorageKey
    ];

  const quarantineId =
    validateLegacyMigrationAdoptionPermit(
      request.adoptionPermit,
      targetTenantId
    );

  if (typeof localStorage === "undefined") {
    throw new Error(
      "LEGACY_MIGRATION_LOCAL_STORAGE_UNAVAILABLE"
    );
  }

  const raw = localStorage.getItem(
    localStorageKey
  );

  if (!raw) {
    return { migrated: 0 };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "LEGACY_MIGRATION_INVALID_JSON"
    );
  }

  const rows = validateLegacyMigrationRows(
    parsed,
    targetTenantId
  );

  if (!rows.length) {
    return { migrated: 0 };
  }

  await saveTenantArray(
    targetTenantId,
    approved.subCollection,
    rows,
    {
      replace: request.replace ?? false,
      by: request.by,
      audit: {
        entity: approved.subCollection,
        meta: {
          summary:
            `adopted ${approved.subCollection} ` +
            "from verified quarantine",
          localStorageKey,
          quarantineId,
          targetTenantId,
          adoptionSource: "quarantine",
        },
      },
    }
  );

  if (request.removeLocalAfterSuccess) {
    localStorage.removeItem(localStorageKey);
  }

  return { migrated: rows.length };
}

/**
 * Notify open pages/tabs that a cloud collection changed.
 */
export function notifyTenantDataChanged(tenantId: string, subCollection: string) {
  try {
    window.dispatchEvent(
      new CustomEvent("exam-manager:tenant-data-changed", {
        detail: {
          tenantId: safeTenantId(tenantId),
          subCollection: safeSubCollection(subCollection),
          atISO: new Date().toISOString(),
        },
      }),
    );
  } catch {
    // ignore
  }
}
