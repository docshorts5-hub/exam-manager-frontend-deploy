// src/services/tenantDb.ts
import {
  collection,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { callFn } from "./functionsClient";

export type TenantDoc<T> = T & {
  id: string;
  createdAt?: any;
  updatedAt?: any;
};

function makeId(): string {
  // بدون أي مكتبات إضافية
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

export function tenantCollectionRef(tenantId: string, sub: string) {
  return collection(db, "tenants", tenantId, sub);
}

export async function listTenantDocs<T>(tenantId: string, sub: string): Promise<TenantDoc<T>[]> {
  const colRef = tenantCollectionRef(tenantId, sub);
  // لو ما عندك createdAt قديم، orderBy قد يفشل، لذلك نخليها بدون orderBy كحل آمن:
  const snap = await getDocs(colRef);
  const out: TenantDoc<T>[] = [];
  snap.forEach((d) => out.push({ id: d.id, ...(d.data() as any) }));
  return out;
}

export async function upsertTenantDoc<T extends Record<string, any>>(
  tenantId: string,
  sub: string,
  data: Partial<T> & { id?: string },
  meta?: { by?: string }
) {
  const id = (data.id && String(data.id)) || makeId();

  // Route all writes through Cloud Functions gateway (RBAC + quotas + audit + rate limit)
  const fn = callFn<{ tenantId: string; sub: string; id: string; data: any }, { ok: boolean; id: string }>("tenantUpsertDoc");
  await fn({
    tenantId,
    sub,
    id,
    data: {
      ...data,
      // keep minimal meta for debugging (server will also set updatedBy/createdBy)
      clientUpdatedBy: meta?.by ?? null,
    },
  });

  return id;
}

export async function deleteTenantDoc(path: string) {
  // Prefer server-side deletion to avoid Rules limitations.
  const fn = callFn<{ path: string }, { ok: boolean }>("tenantDeleteDoc");
  return await fn({ path });
}