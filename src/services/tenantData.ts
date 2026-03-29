/**
 * Tenant-scoped array helpers for Firestore.
 * Used by pages like Teachers/Rooms/Exams/Distributions.
 *
 * All data is stored under:
 *   tenants/{tenantId}/{subCollection}/{docId}
 */
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { writeActivityLog } from "./activityLog.service";

export async function loadTenantArray<T>(
  tenantId: string,
  subCollection: string,
): Promise<(T & { id: string })[]> {
  if (!tenantId) return [];
  const colRef = collection(db, "tenants", tenantId, subCollection);

  const snap = await getDocs(colRef);
  const out: any[] = [];
  snap.forEach((d) => out.push({ id: d.id, ...(d.data() as any) }));
  return out as (T & { id: string })[];
}



export function subscribeTenantArray<T>(
  tenantId: string,
  subCollection: string,
  onChange: (items: (T & { id: string })[]) => void,
  onError?: (error: unknown) => void,
) {
  if (!tenantId) {
    onChange([]);
    return () => undefined;
  }

  const colRef = collection(db, "tenants", tenantId, subCollection);
  return onSnapshot(
    colRef,
    (snap) => {
      const out: any[] = [];
      snap.forEach((d) => out.push({ id: d.id, ...(d.data() as any) }));
      onChange(out as (T & { id: string })[]);
    },
    (error) => {
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
  if (!tenantId) return;

  await writeActivityLog(tenantId, {
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

export async function replaceTenantArray<T extends { id: string }>(
  tenantId: string,
  subCollection: string,
  rows: T[],
  options?: ReplaceOptions,
): Promise<void> {
  if (!tenantId) return;
  const colRef = collection(db, "tenants", tenantId, subCollection);

  const existingSnap = await getDocs(colRef);
  const existingIds = new Set<string>();
  const existingMap = new Map<string, any>();
  existingSnap.forEach((d) => {
    existingIds.add(d.id);
    existingMap.set(d.id, { id: d.id, ...(d.data() as any) });
  });

  const nextIds = new Set<string>((rows || []).map((r) => String(r.id)));

  const batch = writeBatch(db);

  for (const id of existingIds) {
    if (!nextIds.has(id)) {
      batch.delete(doc(db, "tenants", tenantId, subCollection, id));
    }
  }

  for (const r of rows || []) {
    const id = String(r.id);

    const meta =
      options?.by
        ? { updatedBy: options.by, updatedAt: serverTimestamp() }
        : { updatedAt: serverTimestamp() };

    batch.set(
      doc(db, "tenants", tenantId, subCollection, id),
      { ...r, id, ...meta },
      { merge: true },
    );
  }

  await batch.commit();

  const auditEntity = options?.audit?.entity || subCollection;
  const auditMeta = options?.audit?.meta;
  const auditJobs: Promise<void>[] = [];

  for (const id of existingIds) {
    if (!nextIds.has(id)) {
      auditJobs.push(writeTenantAudit(tenantId, {
        action: "DELETE",
        entity: auditEntity,
        by: options?.by,
        entityId: id,
        meta: { summary: `deleted ${auditEntity}`, before: normalizeAuditRow(existingMap.get(id)), ...(auditMeta || {}) },
      }));
    }
  }

  for (const r of rows || []) {
    const id = String(r.id);
    const before = existingMap.get(id);
    if (!before) {
      auditJobs.push(writeTenantAudit(tenantId, {
        action: "CREATE",
        entity: auditEntity,
        by: options?.by,
        entityId: id,
        meta: { summary: `created ${auditEntity}`, after: normalizeAuditRow(r), ...(auditMeta || {}) },
      }));
      continue;
    }

    const changed = JSON.stringify(normalizeAuditRow(before)) !== JSON.stringify(normalizeAuditRow(r));
    if (changed) {
      auditJobs.push(writeTenantAudit(tenantId, {
        action: "UPDATE",
        entity: auditEntity,
        by: options?.by,
        entityId: id,
        meta: { summary: `updated ${auditEntity}`, before: normalizeAuditRow(before), after: normalizeAuditRow(r), ...(auditMeta || {}) },
      }));
    }
  }

  await Promise.allSettled(auditJobs);
}
