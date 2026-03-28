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
  existingSnap.forEach((d) => existingIds.add(d.id));

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

  const audit = options?.audit;
  if (audit?.action) {
    await writeTenantAudit(tenantId, {
      action: audit.action,
      entity: audit.entity || subCollection,
      by: options?.by,
      meta: audit.meta,
    });
  }
}
