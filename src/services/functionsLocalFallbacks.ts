import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import type { CloudFunctionName } from "./functionsCatalog";

const SYSTEM_TENANT_ID = "system";

type TenantListDocsReq = {
  tenantId: string;
  sub: string;
  limit?: number;
  orderBy?: string;
  orderDir?: "asc" | "desc";
};

async function localTenantListDocs(req: TenantListDocsReq) {
  const tenantId = String(req?.tenantId ?? "").trim();
  const sub = String(req?.sub ?? "").trim();
  if (!tenantId || !sub) throw new Error("tenantId/sub required");

  const lim = Math.min(Math.max(Number(req?.limit ?? 200), 1), 500);
  const field = String(req?.orderBy ?? "createdAt").trim() || "createdAt";
  const dir = (req?.orderDir ?? "desc") === "asc" ? "asc" : "desc";
  const colRef = collection(db, "tenants", tenantId, sub);

  try {
    const q = query(colRef, orderBy(field, dir), limit(lim));
    const snap = await getDocs(q);
    return { items: snap.docs.map((d) => ({ id: d.id, data: d.data() })) };
  } catch {
    const q = query(colRef, limit(lim));
    const snap = await getDocs(q);
    return { items: snap.docs.map((d) => ({ id: d.id, data: d.data() })) };
  }
}

async function localTenantUpsertDoc(data: { tenantId: string; sub: string; id: string; data: Record<string, unknown> }) {
  const tenantId = String(data?.tenantId ?? "").trim();
  const sub = String(data?.sub ?? "").trim();
  const id = String(data?.id ?? "").trim();
  if (!tenantId || !sub || !id) throw new Error("tenantId/sub/id required");

  await setDoc(
    doc(db, "tenants", tenantId, sub, id),
    {
      ...(data?.data ?? {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return { ok: true, id };
}

async function localTenantDeleteDoc(data: { tenantId?: string; sub?: string; id?: string; path?: string }) {
  let tenantId = String(data?.tenantId ?? "").trim();
  let sub = String(data?.sub ?? "").trim();
  let id = String(data?.id ?? "").trim();

  const path = String(data?.path ?? "").trim();
  if (path && (!tenantId || !sub || !id)) {
    const parts = path.split("/").filter(Boolean);
    if (parts.length >= 4 && parts[0] === "tenants") {
      tenantId = tenantId || parts[1];
      sub = sub || parts[2];
      id = id || parts[3];
    }
  }

  if (!tenantId || !sub || !id) throw new Error("tenantId/sub/id required");
  await deleteDoc(doc(db, "tenants", tenantId, sub, id));
  return { ok: true };
}

async function localWriteActivityLog(data: Record<string, unknown>) {
  const tenantId = String(data?.tenantId ?? "").trim();
  if (!tenantId) return { ok: false };
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await setDoc(doc(db, "tenants", tenantId, "auditLogs", id), {
    ...data,
    ts: serverTimestamp(),
  });
  return { ok: true, id };
}

async function localSyncMyClaims() {
  const email = String(auth.currentUser?.email ?? "").trim().toLowerCase();
  if (!email) return { ok: false, reason: "NO_USER" };

  const snap = await getDoc(doc(db, "allowlist", email));
  const allow = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
  return {
    ok: true,
    claims: {
      tenantId: String(allow?.tenantId ?? "").trim() || null,
      role: String(allow?.role ?? "user").trim() || "user",
      enabled: allow?.enabled === true,
    },
    source: allow ? "allowlist" : "none",
  };
}

async function localStartSupportSession(data: { tenantId?: string; durationMinutes?: number }) {
  const tenantId = String(data?.tenantId ?? "").trim();
  const durationMinutes = Math.min(Math.max(Number(data?.durationMinutes ?? 30), 1), 240);
  if (!tenantId) throw new Error("tenantId required");
  return {
    ok: true,
    supportTenantId: tenantId,
    supportUntil: Date.now() + durationMinutes * 60 * 1000,
  };
}

async function localEndSupportSession() {
  return { ok: true, supportTenantId: null, supportUntil: null };
}

async function localAdminUpsertTenant(data: Record<string, unknown>) {
  const tenantId = String(data?.tenantId ?? data?.id ?? "").trim();
  if (!tenantId) throw new Error("tenantId required");

  const baseRef = doc(db, "tenants", tenantId);
  const configRef = doc(db, "tenants", tenantId, "meta", "config");

  await setDoc(baseRef, {
    tenantId,
    name: data?.name ?? data?.schoolName ?? tenantId,
    enabled: data?.enabled !== false,
    governorate: data?.governorate ?? null,
    updatedAt: serverTimestamp(),
    createdAt: data?.createdAt ?? serverTimestamp(),
  }, { merge: true });

  await setDoc(configRef, {
    tenantId,
    schoolName: data?.schoolName ?? data?.name ?? tenantId,
    governorate: data?.governorate ?? null,
    enabled: data?.enabled !== false,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return { ok: true, tenantId };
}

async function localAdminDeleteTenant(data: { tenantId?: string; alsoDeleteUsers?: boolean }) {
  const tenantId = String(data?.tenantId ?? "").trim();
  if (!tenantId) throw new Error("tenantId required");

  await setDoc(doc(db, "tenants", tenantId), {
    enabled: false,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  await setDoc(doc(db, "tenants", tenantId, "meta", "config"), {
    enabled: false,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  if (data?.alsoDeleteUsers) {
    const qs = await getDocs(query(collection(db, "allowlist"), where("tenantId", "==", tenantId)));
    await Promise.all(qs.docs.map((d) => updateDoc(d.ref, { enabled: false, updatedAt: serverTimestamp() })));
  }

  return { ok: true };
}

async function localAdminUpsertAllowlist(data: Record<string, unknown>) {
  const email = String(data?.email ?? "").trim().toLowerCase();
  if (!email) throw new Error("email required");

  await setDoc(doc(db, "allowlist", email), {
    ...data,
    email,
    updatedAt: serverTimestamp(),
    createdAt: data?.createdAt ?? serverTimestamp(),
  }, { merge: true });
  return { ok: true, email };
}

async function localAdminDeleteAllowlist(data: { email?: string }) {
  const email = String(data?.email ?? "").trim().toLowerCase();
  if (!email) throw new Error("email required");
  await deleteDoc(doc(db, "allowlist", email));
  return { ok: true };
}

async function localBootstrapOwner() {
  const email = String(auth.currentUser?.email ?? "").trim().toLowerCase();
  if (!email) throw new Error("NO_USER");

  await setDoc(doc(db, "allowlist", email), {
    email,
    enabled: true,
    role: "super_admin",
    tenantId: SYSTEM_TENANT_ID,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true });

  return { ok: true, email };
}

async function localAdminMigrationCounts(data: { tenantId?: string }) {
  const tenantId = String(data?.tenantId ?? "").trim();
  if (!tenantId) throw new Error("tenantId required");
  const collectionsToCount = ["teachers", "rooms", "exams", "archive", "auditLogs"];
  const counts: Record<string, number> = {};
  for (const sub of collectionsToCount) {
    try {
      const snap = await getDocs(collection(db, "tenants", tenantId, sub));
      counts[sub] = snap.size;
    } catch {
      counts[sub] = 0;
    }
  }
  return { ok: true, tenantId, counts };
}

async function localAdminMigrateRootToTenant(data: { tenantId?: string }) {
  const tenantId = String(data?.tenantId ?? "").trim();
  if (!tenantId) throw new Error("tenantId required");
  return { ok: true, tenantId, migrated: false, note: "Local fallback stub: no root collections were migrated." };
}

export const localFunctionHandlers: Record<CloudFunctionName, (data?: unknown) => Promise<unknown>> = {
  tenantListDocs: (data) => localTenantListDocs((data ?? {}) as TenantListDocsReq),
  tenantUpsertDoc: (data) => localTenantUpsertDoc((data ?? {}) as { tenantId: string; sub: string; id: string; data: Record<string, unknown> }),
  tenantDeleteDoc: (data) => localTenantDeleteDoc((data ?? {}) as { tenantId?: string; sub?: string; id?: string; path?: string }),
  writeActivityLog: (data) => localWriteActivityLog((data ?? {}) as Record<string, unknown>),
  syncMyClaims: () => localSyncMyClaims(),
  startSupportSession: (data) => localStartSupportSession((data ?? {}) as { tenantId?: string; durationMinutes?: number }),
  endSupportSession: () => localEndSupportSession(),
  adminUpsertTenant: (data) => localAdminUpsertTenant((data ?? {}) as Record<string, unknown>),
  adminDeleteTenant: (data) => localAdminDeleteTenant((data ?? {}) as { tenantId?: string; alsoDeleteUsers?: boolean }),
  adminUpsertAllowlist: (data) => localAdminUpsertAllowlist((data ?? {}) as Record<string, unknown>),
  adminDeleteAllowlist: (data) => localAdminDeleteAllowlist((data ?? {}) as { email?: string }),
  adminUpsertAllowlistUser: (data) => localAdminUpsertAllowlist((data ?? {}) as Record<string, unknown>),
  bootstrapOwner: () => localBootstrapOwner(),
  adminMigrationCounts: (data) => localAdminMigrationCounts((data ?? {}) as { tenantId?: string }),
  adminMigrateRootToTenant: (data) => localAdminMigrateRootToTenant((data ?? {}) as { tenantId?: string }),
};
