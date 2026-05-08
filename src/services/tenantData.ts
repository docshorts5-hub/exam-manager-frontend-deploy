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

type AnyRecord = Record<string, any>;

const CACHE_PREFIX = "exam-manager:cloud-cache:v1";
const MAX_BATCH_WRITES = 450;

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

function readCache<T>(tenantId: string, subCollection: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  return safeJsonParse<T>(localStorage.getItem(cacheKey(tenantId, subCollection)), fallback);
}

function writeCache<T>(tenantId: string, subCollection: string, value: T) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(cacheKey(tenantId, subCollection), JSON.stringify(value));
  } catch {
    // Cache failure must not break the app.
  }
}

function readSettingsCache<T>(tenantId: string, docId: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  return safeJsonParse<T>(localStorage.getItem(settingsCacheKey(tenantId, docId)), fallback);
}

function writeSettingsCache<T>(tenantId: string, docId: string, value: T) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(settingsCacheKey(tenantId, docId), JSON.stringify(value));
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
  },
): Promise<(T & { id: string })[]> {
  const tid = safeTenantId(tenantId);
  const sub = safeSubCollection(subCollection);

  try {
    const constraints: QueryConstraint[] = [];

    if (options?.orderByField) {
      constraints.push(orderBy(options.orderByField, options.orderDirection || "asc"));
    }

    if (options?.maxRows && options.maxRows > 0) {
      constraints.push(limit(options.maxRows));
    }

    const colRef = tenantCollectionRef(tid, sub);
    const snap = constraints.length ? await getDocs(query(colRef, ...constraints)) : await getDocs(colRef);

    const out = snap.docs.map((d) => normalizeRow<T>(d.id, d.data()));
    writeCache(tid, sub, out);
    return out;
  } catch (error) {
    if (options?.cacheFallback === false) throw error;
    return readCache<(T & { id: string })[]>(tid, sub, []);
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

  await writeActivityLog(tid, {
    level: "info",
    action: (payload.action?.toUpperCase?.() as any) || "SYSTEM",
    entityType: payload.entity,
    entityId: payload.entityId,
    message: payload.meta?.summary || `${payload.action} ${payload.entity}`,
    actorEmail: payload.by,
    after: payload.meta ?? null,
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
  const snap = await getDocs(tenantCollectionRef(tid, sub));

  const operations = snap.docs.map((d) => (batch: ReturnType<typeof writeBatch>) => batch.delete(d.ref));
  await commitBatchOperations(operations);

  writeCache(tid, sub, []);
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

  try {
    const snap = await getDoc(tenantDocRef(tid, "settings", id));
    if (!snap.exists()) return localFallback;

    const data = normalizeRow<T>(snap.id, snap.data());
    writeSettingsCache(tid, id, data);
    return data;
  } catch {
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

/**
 * Migrate old localStorage array to Firestore.
 */
export async function migrateLocalStorageArrayToTenant(
  tenantId: string,
  localStorageKey: string,
  subCollection: string,
  options?: {
    replace?: boolean;
    by?: string;
    removeLocalAfterSuccess?: boolean;
  },
): Promise<{ migrated: number }> {
  const raw = typeof localStorage !== "undefined" ? localStorage.getItem(localStorageKey) : null;
  const rows = safeJsonParse<any[]>(raw, []);
  if (!Array.isArray(rows) || !rows.length) return { migrated: 0 };

  await saveTenantArray(tenantId, subCollection, rows, {
    replace: options?.replace ?? false,
    by: options?.by,
    audit: {
      entity: subCollection,
      meta: {
        summary: `migrated ${subCollection} from localStorage`,
        localStorageKey,
      },
    },
  });

  if (options?.removeLocalAfterSuccess && typeof localStorage !== "undefined") {
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
