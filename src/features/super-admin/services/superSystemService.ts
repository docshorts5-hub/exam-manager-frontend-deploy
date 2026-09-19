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
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../../../firebase/firebase";
import { callFn } from "../../../services/functionsClient";
import type { SuperSystemAllowDoc, SuperSystemTenant } from "../types";
import { MINISTRY_SCOPE, normalizeText } from "../../../constants/directorates";
import { safeTenantId } from "./superSystemShared";

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

type SubscribeSuperTenantsScope = {
  canSeeAllGovs?: boolean;
  myGov?: string;
};

const SCHOOL_ADMIN_ROLE_VALUES = new Set([
  "tenant_admin",
  "admin",
  "school_admin",
  "school-admin",
  "admin_school",
  "school-admin-user",
  "schooladmin",
  "tenant-admin",
  "مدير المدرسة",
  "مديرة المدرسة",
  "أدمن المدرسة",
  "ادمن المدرسة",
  "مسؤول المدرسة",
  "مسؤولة المدرسة",
  "مشرف المدرسة",
]);

function normalizeRoleValue(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function getRowGovernorate(...items: any[]) {
  for (const item of items) {
    if (!item) continue;
    const value =
      item?.governorate ??
      item?.tenantGovernorate ??
      item?.regionAr ??
      item?.governorateAr ??
      item?.scopeGovernorate ??
      item?.gov ??
      "";
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function timestampToMillis(value: any) {
  try {
    if (value && typeof value.toMillis === "function") return Number(value.toMillis()) || 0;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const ms = Date.parse(value);
      return Number.isFinite(ms) ? ms : 0;
    }
  } catch {}
  return 0;
}

async function readTenantRowFromDocs(tenantId: string, fallback?: Record<string, unknown>): Promise<SuperSystemTenant | null> {
  const id = String(tenantId || "").trim();
  if (!id) return null;

  let base: Record<string, unknown> = {};
  let cfg: Record<string, unknown> = {};

  try {
    const tenantSnap = await getDoc(doc(db, "tenants", id));
    if (tenantSnap.exists()) base = (tenantSnap.data() as Record<string, unknown>) || {};
  } catch {
    base = {};
  }

  try {
    const cfgSnap = await getDoc(doc(db, "tenants", id, "meta", "config"));
    if (cfgSnap.exists()) cfg = (cfgSnap.data() as Record<string, unknown>) || {};
  } catch {
    cfg = {};
  }

  const allowlistSnap = await getTenantAdminAllowlistDocs(
  id,
  getRowGovernorate(base, cfg, fallback),
  false,
);

const hasSchoolSupervisor = allowlistSnap.docs.some((doc) => {
  const data = doc.data() as Record<string, unknown>;

  return (
    data.role === "tenant_admin" ||
    data.role === "school_admin" ||
    data.role === "مشرف المدرسة"
  );
});

const sourceName =
    base?.name ??
    cfg?.schoolNameAr ??
    cfg?.centerNameAr ??
    fallback?.schoolName ??
    fallback?.tenantName ??
    fallback?.name ??
    id;

  return {
    id,
    name: String(sourceName || id),
    role: hasSchoolSupervisor ? "tenant_admin" : undefined,
    deleted: base?.deleted === true || cfg?.deleted === true || fallback?.deleted === true,

    enabled: base?.enabled !== false && fallback?.enabled !== false,

    updatedAt: base?.updatedAt ?? fallback?.updatedAt,
    governorate: getRowGovernorate(base, cfg, fallback),
    tenantType: base?.tenantType ?? cfg?.tenantType ?? fallback?.tenantType,
    type: base?.type ?? cfg?.type ?? fallback?.type,
    entityType: base?.entityType ?? cfg?.entityType ?? fallback?.entityType,
    kind: base?.kind ?? cfg?.kind ?? fallback?.kind,
    category: base?.category ?? cfg?.category ?? fallback?.category,
    mode: base?.mode ?? cfg?.mode ?? fallback?.mode,
    program: base?.program ?? cfg?.program ?? fallback?.program,
    programType: base?.programType ?? cfg?.programType ?? fallback?.programType,
    entryMode: base?.entryMode ?? cfg?.entryMode ?? fallback?.entryMode,
    route: base?.route ?? cfg?.route ?? fallback?.route,
    path: base?.path ?? cfg?.path ?? fallback?.path,
    dashboard: base?.dashboard ?? cfg?.dashboard ?? fallback?.dashboard,
    homePath: base?.homePath ?? cfg?.homePath ?? fallback?.homePath,
    defaultRoute: base?.defaultRoute ?? cfg?.defaultRoute ?? fallback?.defaultRoute,
    centerType: base?.centerType ?? cfg?.centerType ?? fallback?.centerType,
    isExamCenter: base?.isExamCenter ?? cfg?.isExamCenter ?? fallback?.isExamCenter,
    isDiplomaCenter: base?.isDiplomaCenter ?? cfg?.isDiplomaCenter ?? fallback?.isDiplomaCenter,
    examCenter: base?.examCenter ?? cfg?.examCenter ?? fallback?.examCenter,
    diplomaCenter: base?.diplomaCenter ?? cfg?.diplomaCenter ?? fallback?.diplomaCenter,
  } satisfies SuperSystemTenant;
}

async function loadTenantRowsFromGovernorateAllowlist(governorate: string) {
  const gov = String(governorate || "").trim();
  if (!gov) return [] as SuperSystemTenant[];

  const allowRef = collection(db, "allowlist");
  const snaps = await Promise.allSettled([
    getDocs(query(allowRef, where("governorate", "==", gov), limit(500))),
    getDocs(query(allowRef, where("tenantGovernorate", "==", gov), limit(500))),
  ]);

  const linkedByTenant = new Map<string, Record<string, unknown>>();

  for (const result of snaps) {
    if (result.status !== "fulfilled") continue;

    for (const d of result.value.docs) {
      const data = (d.data() as Record<string, unknown>) || {};
      const role = normalizeRoleValue(data.role);
      if (!SCHOOL_ADMIN_ROLE_VALUES.has(role)) continue;

      const tenantId = String(data.tenantId || data.schoolTenantId || "").trim();

      if (!/^[a-zA-Z0-9_-]+$/.test(tenantId)) {
        continue;
      }
      if (!tenantId || linkedByTenant.has(tenantId)) continue;
      linkedByTenant.set(tenantId, data);
    }
  }

  const rows = await Promise.all(
    Array.from(linkedByTenant.entries()).map(([tenantId, fallback]) =>
      readTenantRowFromDocs(tenantId, fallback),
    ),
  );

  return rows.filter(Boolean) as SuperSystemTenant[];
}

function mergeTenantRows(primaryRows: SuperSystemTenant[], extraRows: SuperSystemTenant[]) {
  const map = new Map<string, SuperSystemTenant>();

  for (const row of [...extraRows, ...primaryRows]) {
    if (!row?.id) continue;
    map.set(row.id, { ...(map.get(row.id) || {}), ...row });
  }

  return Array.from(map.values()).sort(
    (a, b) => timestampToMillis((b as any).updatedAt) - timestampToMillis((a as any).updatedAt) || String(a.name || a.id).localeCompare(String(b.name || b.id), "ar"),
  );
}

export function subscribeSuperTenants(
  onData: (rows: SuperSystemTenant[]) => void,
  onError?: (error: unknown) => void,
  scope: SubscribeSuperTenantsScope = {},
): Unsubscribe {
  const scopedGovernorate = !scope.canSeeAllGovs ? String(scope.myGov || "").trim() : "";

  // ✅ بعد تقوية firestore.rules لا يجوز لمشرف المحافظة طلب كل tenants ثم فلترتها في الواجهة.
  // لذلك يكون استعلام سوبر المحافظة مقيدًا بمحافظته، مع fallback من allowlist لإظهار المدارس القديمة
  // التي كان tenant root فيها لا يحتوي governorate لكن ربط الأدمن يحتوي المحافظة.
  const qTenants = scopedGovernorate
    ? query(collection(db, "tenants"), where("governorate", "==", scopedGovernorate), limit(500))
    : query(collection(db, "tenants"), orderBy("updatedAt", "desc"), limit(500));

  return onSnapshot(
    qTenants,
    async (snap) => {
      const primaryRows = await Promise.all(
        snap.docs.map((d) => readTenantRowFromDocs(d.id, (d.data() as Record<string, unknown>) || {})),
      );

      const extraRows = scopedGovernorate ? await loadTenantRowsFromGovernorateAllowlist(scopedGovernorate) : [];
      onData(mergeTenantRows(primaryRows.filter(Boolean) as SuperSystemTenant[], extraRows));
    },
    (error) => onError?.(error),
  );
}

export async function loadTenantEditState(selectedTenantId: string) {
  const tSnap = await getDoc(doc(db, "tenants", selectedTenantId));
  const t = (tSnap.data() as Record<string, unknown>) || {};

  const cfgSnap = await getDoc(doc(db, "tenants", selectedTenantId, "meta", "config"));
  const cfg = (cfgSnap.data() as Record<string, unknown>) || {};

  return {
    name: String(t?.name || selectedTenantId),
    enabled: Boolean(t?.enabled),
    wilayatAr: String(cfg?.wilayatAr || ""),
    logoUrl: String(cfg?.logoUrl || MINISTRY_LOGO_URL),
  };
}


async function getTenantAdminAllowlistDocs(
  tenantId: string,
  governorate?: string,
  restrictGovernorate: boolean = false,
) {
  const constraints: any[] = [
    where("tenantId", "==", tenantId),
    where("role", "in", ["tenant_admin", "admin"]),
  ];

  if (restrictGovernorate && governorate) {
    constraints.push(where("governorate", "==", governorate));
  }

  return getDocs(query(collection(db, "allowlist"), ...constraints));
}

export async function createTenantForScope(input: {
  tenantId: string;
  name: string;
  enabled: boolean;
  governorate?: string;
  canSeeAllGovs: boolean;
  myGov: string;
}) {
  const id = safeTenantId(input.tenantId);
  const name = String(input.name || "").trim();

  if (!id || !name) throw new Error("INVALID_TENANT_INPUT");

  const gov = input.canSeeAllGovs
    ? String(input.myGov || MINISTRY_SCOPE).trim()
    : String(input.myGov || "").trim();

  if (!gov) throw new Error("MISSING_GOVERNORATE");

  const tRef = doc(db, "tenants", id);
  const existing = await getDoc(tRef);
  if (existing.exists()) throw new Error("TENANT_EXISTS");

  const batch = writeBatch(db);

  batch.set(tRef, {
    name,
    enabled: !!input.enabled,
    governorate: gov,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(
    doc(db, "tenants", id, "meta", "config"),
    {
      governorate: gov,
      regionAr: gov,
      ministryAr: "سلطنة عمان - وزارة التعليم",
      schoolNameAr: name,
      systemNameAr: "نظام إدارة الامتحانات الذكي",
      wilayatAr: "",
      logoUrl: MINISTRY_LOGO_URL,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();
  return { tenantId: id };
}

export async function saveTenantForScope(input: {
  tenantId: string;
  name: string;
  enabled: boolean;
  wilayatAr: string;
  logoUrl: string;
  canSeeAllGovs: boolean;
  myGov: string;
}) {
  const tenantId = String(input.tenantId || "").trim();
  const schoolName = String(input.name || "").trim();

  const gov = input.canSeeAllGovs
    ? String(input.myGov || MINISTRY_SCOPE).trim()
    : String(input.myGov || "").trim();

  if (!tenantId || !schoolName) throw new Error("INVALID_TENANT_INPUT");
  if (!input.canSeeAllGovs && !gov) throw new Error("MISSING_GOVERNORATE");

  const batch = writeBatch(db);

  batch.set(
    doc(db, "tenants", tenantId),
    {
      name: schoolName,
      enabled: !!input.enabled,
      governorate: gov,
      tenantType: "school",
      type: "school",
      entityType: "school",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  batch.set(
    doc(db, "tenants", tenantId, "meta", "config"),
    {
      governorate: gov,
      tenantType: "school",
      type: "school",
      entityType: "school",
      regionAr: gov,
      schoolNameAr: schoolName,
      wilayatAr: String(input.wilayatAr || "").trim(),
      logoUrl: String(input.logoUrl || "").trim() || MINISTRY_LOGO_URL,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const allowlistSnap = await getTenantAdminAllowlistDocs(
    tenantId,
    gov,
    !input.canSeeAllGovs,
  );

  for (const allowDoc of allowlistSnap.docs) {
    const allowData = (allowDoc.data() as Record<string, unknown>) || {};
    const existingUserName = String(allowData.userName || "").trim();
    const existingSchoolName = String(allowData.schoolName || allowData.tenantName || "").trim();

    const payload: Record<string, unknown> = {
      schoolName,
      tenantName: schoolName,
      governorate: gov,
      tenantGovernorate: gov,
      enabled: !!input.enabled,
      updatedAt: serverTimestamp(),
    };

    if (!existingUserName || existingUserName === existingSchoolName) {
      payload.userName = schoolName;
    }

    batch.set(allowDoc.ref, payload, { merge: true });
  }

  await batch.commit();
}

function canonicalGovernorateScope(value: unknown): string {
  let normalized = normalizeText(String(value || ""));
  if (!normalized) return "";

  const prefixes = [
    "المديرية العامة للتعليم بمحافظة ",
    "المديرية العامة للتعليم ",
    "بمحافظة ",
    "محافظة ",
  ];

  for (const prefix of prefixes) {
    if (normalized.startsWith(prefix)) {
      normalized = normalizeText(normalized.slice(prefix.length));
      break;
    }
  }

  return normalized;
}

function sameGovernorateScope(left: unknown, right: unknown): boolean {
  const a = canonicalGovernorateScope(left);
  const b = canonicalGovernorateScope(right);
  return Boolean(a && b && a === b);
}

export async function archiveAndDeleteTenant(input: {
  tenantId: string;
  deletedBy?: string;
  isPlatformOwner: boolean;
  myGov: string;
}) {
  const id = String(input.tenantId || "").trim();
  if (!id) throw new Error("MISSING_TENANT_ID");

  const owner = input.isPlatformOwner === true;
  const myGov = normalizeText(String(input.myGov || ""));

  if (!owner && !myGov) {
    throw new Error("MISSING_GOVERNORATE");
  }

  const tRef = doc(db, "tenants", id);
  const tSnap = await getDoc(tRef);

  if (!tSnap.exists()) {
    throw new Error("TENANT_NOT_FOUND");
  }

  const data = (tSnap.data() as Record<string, unknown>) || {};
  const tenantGovernorate = normalizeText(
    String(data.governorate || data.tenantGovernorate || data.regionAr || ""),
  );

  if (!owner) {
    if (!tenantGovernorate) {
      throw new Error("TENANT_GOVERNORATE_MISSING");
    }

    if (!sameGovernorateScope(tenantGovernorate, myGov)) {
      throw new Error("TENANT_OUT_OF_SCOPE");
    }
  }

  const archiveRef = doc(db, "archiveTenants", id);
  const batch = writeBatch(db);

  batch.set(
    archiveRef,
    {
      ...data,
      id,
      deletedAt: serverTimestamp(),
      deletedBy: String(input.deletedBy || ""),
    },
    { merge: true },
  );
  batch.delete(doc(db, "tenants", id, "meta", "config"));
  batch.delete(tRef);

  await batch.commit();
}

export async function saveTenantAdminAssignment(input: {
  email: string;
  enabled: boolean;
  tenantId: string;
  tenantName?: string;
  tenantGovernorate?: string;
  canSeeAllGovs: boolean;
  myGov: string;
  userName?: string;
}) {
  const email = String(input.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("INVALID_EMAIL");

  const tenantId = String(input.tenantId || "").trim();
  if (!tenantId) throw new Error("MISSING_TENANT_ID");

  const tenantSnap = await getDoc(doc(db, "tenants", tenantId));
  if (!tenantSnap.exists()) throw new Error("TENANT_NOT_FOUND");

  const tenantData = (tenantSnap.data() as Record<string, unknown>) || {};
  const tenantEnabled = tenantData.enabled !== false;
  if (!tenantEnabled) throw new Error("TENANT_DISABLED");

  const governorate = input.canSeeAllGovs
    ? String(input.tenantGovernorate || input.myGov || MINISTRY_SCOPE).trim()
    : String(input.myGov || "").trim();

  const schoolName = String(input.tenantName || tenantData.name || "").trim() || tenantId;

  const existingLinkSnap = await getDoc(doc(db, "allowlist", email));
  if (existingLinkSnap.exists()) {
    const existingData = (existingLinkSnap.data() as Record<string, unknown>) || {};
    const existingTenantId = String(existingData.tenantId || "").trim();
    const existingRole = String(existingData.role || "").trim().toLowerCase();

    if (
      existingTenantId &&
      existingTenantId !== tenantId &&
      (existingRole === "tenant_admin" || existingRole === "admin")
    ) {
      const existingTenantSnap = await getDoc(doc(db, "tenants", existingTenantId));
      const existingTenantData = existingTenantSnap.exists()
        ? ((existingTenantSnap.data() as Record<string, unknown>) || {})
        : {};
      const existingTenantEnabled = existingTenantData.enabled !== false;

      if (!existingTenantEnabled) {
        throw new Error("DISABLED_TENANT_LINK_LOCKED");
      }

      throw new Error("EMAIL_ALREADY_LINKED_TO_ANOTHER_TENANT");
    }
  }

  const existingTenantLinks = await getTenantAdminAllowlistDocs(
    tenantId,
    governorate,
    !input.canSeeAllGovs,
  );

  const linkedToOtherEmail = existingTenantLinks.docs.find((d) => {
    const data = (d.data() as Record<string, unknown>) || {};
    const docEmail = String(data.email || d.id || "").trim().toLowerCase();
    return docEmail && docEmail !== email;
  });

  if (linkedToOtherEmail) {
    throw new Error("TENANT_ALREADY_LINKED_TO_ANOTHER_EMAIL");
  }

  const payload: SuperSystemAllowDoc = {
    email,
    enabled: !!input.enabled && tenantEnabled,
    role: "tenant_admin" as any,
    tenantId,
    governorate,
    schoolName,
    tenantName: schoolName,
    tenantGovernorate: governorate || undefined,
    userName: String(input.userName || "").trim() || undefined,
    updatedAt: serverTimestamp(),
  } as SuperSystemAllowDoc;

  await callFn<any, any>("adminUpsertAllowlist")({
    email,
    enabled: payload.enabled,
    role: payload.role,
    tenantId,
    governorate,
    name: String(input.userName || "").trim() || undefined,
    schoolName,
  });

  return { email };
}

export async function deleteTenantAdminAssignment(input: {
  email: string;
  tenantId: string;
}) {
  const email = String(input.email || "").trim().toLowerCase();
  const tenantId = String(input.tenantId || "").trim();

  if (!email) throw new Error("MISSING_EMAIL");
  if (!tenantId) throw new Error("MISSING_TENANT_ID");

  const tenantSnap = await getDoc(doc(db, "tenants", tenantId));
  if (!tenantSnap.exists()) throw new Error("TENANT_NOT_FOUND");

  const tenantData = (tenantSnap.data() as Record<string, unknown>) || {};
  if (tenantData.enabled === false) {
    throw new Error("TENANT_DISABLED_LINK_CHANGE_BLOCKED");
  }

  const linkRef = doc(db, "allowlist", email);
  const linkSnap = await getDoc(linkRef);
  if (!linkSnap.exists()) return;

  const linkData = (linkSnap.data() as Record<string, unknown>) || {};
  const linkedTenantId = String(linkData.tenantId || "").trim();
  const linkRole = String(linkData.role || "").trim().toLowerCase();

  if (
    linkedTenantId &&
    linkedTenantId !== tenantId &&
    (linkRole === "tenant_admin" || linkRole === "admin")
  ) {
    throw new Error("EMAIL_LINKED_TO_ANOTHER_TENANT");
  }

  await callFn<any, any>("adminDeleteAllowlist")({ email });
}

export async function disableAllowlistForTenant(tenantId: string) {
  const qs = await getDocs(query(collection(db, "allowlist"), where("tenantId", "==", tenantId)));

  await Promise.all(
    qs.docs.map((d) =>
      updateDoc(d.ref, {
        enabled: false,
        updatedAt: serverTimestamp(),
      }),
    ),
  );
}

