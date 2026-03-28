import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  limit,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import type { DistributionRun } from "../contracts/taskDistributionContract";
import { loadRun, saveRun } from "../utils/taskDistributionStorage";

export type TenantMemberRole = "tenant_admin" | "manager" | "staff" | "viewer";

export type TenantMemberRecord = {
  email: string;
  displayName?: string;
  roles: TenantMemberRole[];
  enabled: boolean;
  tenantId: string;
  invitedAtISO: string;
  invitedBy?: string;
  updatedAtISO?: string;
  source?: "cloud" | "local" | "both";
};

export type DistributionVersionRecord = {
  versionId: string;
  tenantId: string;
  title: string;
  note?: string;
  createdAtISO: string;
  createdBy?: string;
  run: DistributionRun;
  source?: "cloud" | "local" | "both";
};

export type DistributionApprovalRecord = {
  approvalId: string;
  tenantId: string;
  approvedAtISO: string;
  approvedBy?: string;
  note?: string;
  runId?: string;
  assignmentsCount: number;
  locked: boolean;
  source?: "cloud" | "local" | "both";
};

const MEMBERS_KEY = (tenantId: string) => `exam-manager:tenant-members:${tenantId}:v1`;
const VERSIONS_KEY = (tenantId: string) => `exam-manager:distribution-versions:${tenantId}:v1`;
const APPROVAL_KEY = (tenantId: string) => `exam-manager:distribution-approval:${tenantId}:v1`;

function nowIso() {
  return new Date().toISOString();
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function uniqRoles(input: TenantMemberRole[] | undefined | null): TenantMemberRole[] {
  const allowed: TenantMemberRole[] = ["tenant_admin", "manager", "staff", "viewer"];
  return Array.from(new Set((input || []).filter((r): r is TenantMemberRole => allowed.includes(r as TenantMemberRole))));
}

function mergeById<T extends { source?: any }>(localItems: T[], cloudItems: T[], getId: (x: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of localItems) map.set(getId(item), { ...item, source: "local" } as T);
  for (const item of cloudItems) {
    const id = getId(item);
    const prev = map.get(id);
    map.set(id, { ...(prev || {}), ...item, source: prev ? "both" : "cloud" } as T);
  }
  return Array.from(map.values());
}

export async function listTenantMembers(tenantId: string): Promise<TenantMemberRecord[]> {
  const localItems = readJson<TenantMemberRecord[]>(MEMBERS_KEY(tenantId), []);
  try {
    const snap = await getDocs(collection(db, "tenants", tenantId, "members"));
    const cloudItems = snap.docs.map((d) => ({ ...(d.data() as any), email: d.id })) as TenantMemberRecord[];
    const merged = mergeById(localItems, cloudItems, (x) => String(x.email || "").toLowerCase());
    writeJson(MEMBERS_KEY(tenantId), merged.map(({ source, ...rest }) => rest));
    return merged.sort((a, b) => String(a.displayName || a.email).localeCompare(String(b.displayName || b.email), "ar"));
  } catch {
    return localItems.sort((a, b) => String(a.displayName || a.email).localeCompare(String(b.displayName || b.email), "ar"));
  }
}

export async function upsertTenantMember(args: {
  tenantId: string;
  email: string;
  displayName?: string;
  roles: TenantMemberRole[];
  enabled: boolean;
  actorEmail?: string;
}) {
  const tenantId = String(args.tenantId || "").trim();
  const email = String(args.email || "").trim().toLowerCase();
  if (!tenantId || !email.includes("@")) throw new Error("بيانات العضو غير صحيحة.");
  const next: TenantMemberRecord = {
    tenantId,
    email,
    displayName: String(args.displayName || "").trim() || undefined,
    roles: uniqRoles(args.roles),
    enabled: !!args.enabled,
    invitedAtISO: nowIso(),
    invitedBy: args.actorEmail || "",
    updatedAtISO: nowIso(),
  };

  const localItems = readJson<TenantMemberRecord[]>(MEMBERS_KEY(tenantId), []);
  const merged = [next, ...localItems.filter((x) => String(x.email).toLowerCase() !== email)];
  writeJson(MEMBERS_KEY(tenantId), merged);

  try {
    await setDoc(
      doc(db, "tenants", tenantId, "members", email),
      {
        ...next,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await setDoc(
      doc(db, "allowlist", email),
      {
        email,
        enabled: !!args.enabled,
        tenantId,
        roles: uniqRoles(args.roles),
        role: uniqRoles(args.roles)[0] || "viewer",
        name: String(args.displayName || "").trim() || email,
        updatedAt: serverTimestamp(),
        updatedBy: args.actorEmail || "",
      },
      { merge: true }
    );
  } catch {
    // local fallback only
  }

  return next;
}

export async function deleteTenantMember(tenantId: string, email: string) {
  const safeTenantId = String(tenantId || "").trim();
  const safeEmail = String(email || "").trim().toLowerCase();
  if (!safeTenantId || !safeEmail.includes("@")) throw new Error("بيانات العضو غير صحيحة.");

  const next = readJson<TenantMemberRecord[]>(MEMBERS_KEY(safeTenantId), []).filter((x) => String(x.email).toLowerCase() !== safeEmail);
  writeJson(MEMBERS_KEY(safeTenantId), next);

  try {
    await deleteDoc(doc(db, "tenants", safeTenantId, "members", safeEmail));
  } catch {
    // local fallback only for tenant member document
  }

  try {
    await deleteDoc(doc(db, "allowlist", safeEmail));
  } catch {
    // local fallback only for allowlist document
  }
}

export async function saveDistributionVersion(args: {
  tenantId: string;
  title: string;
  note?: string;
  run: DistributionRun;
  actorEmail?: string;
}) {
  const tenantId = String(args.tenantId || "").trim();
  if (!tenantId) throw new Error("tenantId مفقود");
  const versionId = `${Date.now()}`;
  const record: DistributionVersionRecord = {
    versionId,
    tenantId,
    title: String(args.title || "").trim() || `تشغيل ${new Date().toLocaleString("ar")}`,
    note: String(args.note || "").trim() || undefined,
    createdAtISO: nowIso(),
    createdBy: args.actorEmail || "",
    run: args.run,
  };
  const localItems = readJson<DistributionVersionRecord[]>(VERSIONS_KEY(tenantId), []);
  writeJson(VERSIONS_KEY(tenantId), [record, ...localItems].slice(0, 80));
  try {
    await setDoc(doc(db, "tenants", tenantId, "distributionVersions", versionId), {
      ...record,
      createdAt: serverTimestamp(),
    });
  } catch {
    // local fallback only
  }
  return record;
}

export async function listDistributionVersions(tenantId: string): Promise<DistributionVersionRecord[]> {
  const localItems = readJson<DistributionVersionRecord[]>(VERSIONS_KEY(tenantId), []);
  try {
    const snap = await getDocs(query(collection(db, "tenants", tenantId, "distributionVersions"), orderBy("createdAt", "desc"), limit(80)));
    const cloudItems = snap.docs.map((d) => ({ ...(d.data() as any), versionId: d.id })) as DistributionVersionRecord[];
    const merged = mergeById(localItems, cloudItems, (x) => String(x.versionId));
    writeJson(VERSIONS_KEY(tenantId), merged.map(({ source, ...rest }) => rest));
    return merged.sort((a, b) => String(b.createdAtISO).localeCompare(String(a.createdAtISO)));
  } catch {
    return localItems.sort((a, b) => String(b.createdAtISO).localeCompare(String(a.createdAtISO)));
  }
}

export async function restoreDistributionVersion(tenantId: string, versionId: string): Promise<DistributionRun | null> {
  const local = readJson<DistributionVersionRecord[]>(VERSIONS_KEY(tenantId), []);
  let found = local.find((x) => String(x.versionId) === String(versionId)) || null;
  if (!found) {
    try {
      const snap = await getDoc(doc(db, "tenants", tenantId, "distributionVersions", versionId));
      if (snap.exists()) found = { ...(snap.data() as any), versionId: snap.id } as DistributionVersionRecord;
    } catch {
      // ignore
    }
  }
  if (!found?.run) return null;
  saveRun(tenantId, found.run);
  return found.run;
}

export async function loadDistributionApproval(tenantId: string): Promise<DistributionApprovalRecord | null> {
  const local = readJson<DistributionApprovalRecord | null>(APPROVAL_KEY(tenantId), null);
  try {
    const snap = await getDoc(doc(db, "tenants", tenantId, "distribution", "approval"));
    if (!snap.exists()) return local;
    const cloud = { ...(snap.data() as any), approvalId: "approval", source: local ? "both" : "cloud" } as DistributionApprovalRecord;
    writeJson(APPROVAL_KEY(tenantId), { ...cloud, source: undefined });
    return cloud;
  } catch {
    return local;
  }
}

export async function approveCurrentDistribution(args: {
  tenantId: string;
  note?: string;
  actorEmail?: string;
}) {
  const tenantId = String(args.tenantId || "").trim();
  const run = loadRun(tenantId);
  if (!run) throw new Error("لا يوجد تشغيل حالي لاعتماده.");
  const record: DistributionApprovalRecord = {
    approvalId: "approval",
    tenantId,
    approvedAtISO: nowIso(),
    approvedBy: args.actorEmail || "",
    note: String(args.note || "").trim() || undefined,
    runId: run.runId,
    assignmentsCount: Array.isArray(run.assignments) ? run.assignments.length : 0,
    locked: true,
  };
  writeJson(APPROVAL_KEY(tenantId), record);
  try {
    await setDoc(doc(db, "tenants", tenantId, "distribution", "approval"), {
      ...record,
      approvedAt: serverTimestamp(),
    }, { merge: true });
    await setDoc(doc(db, "tenants", tenantId, "distribution", "currentRun"), {
      tenantId,
      run,
      syncedAt: serverTimestamp(),
      syncedBy: args.actorEmail || "",
    }, { merge: true });
  } catch {
    // local fallback only
  }
  return record;
}

export async function syncCurrentRunToCloud(tenantId: string, actorEmail?: string) {
  const run = loadRun(tenantId);
  if (!run) return false;
  try {
    await setDoc(doc(db, "tenants", tenantId, "distribution", "currentRun"), {
      tenantId,
      run,
      syncedAt: serverTimestamp(),
      syncedBy: actorEmail || "",
    }, { merge: true });
    return true;
  } catch {
    return false;
  }
}
