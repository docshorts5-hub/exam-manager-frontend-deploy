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
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../../../firebase/firebase";
import { callFn } from "../../../services/functionsClient";
import type { SuperSystemAllowDoc, SuperSystemTenant } from "../types";
import { MINISTRY_SCOPE } from "../../../constants/directorates";
import { safeTenantId } from "./superSystemShared";

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

export function subscribeSuperTenants(
  onData: (rows: SuperSystemTenant[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const qTenants = query(collection(db, "tenants"), orderBy("updatedAt", "desc"), limit(500));

  return onSnapshot(
    qTenants,
    async (snap) => {
      const rows = await Promise.all(
        snap.docs.map(async (d) => {
          const base = (d.data() as Record<string, unknown>) || {};
          const id = d.id;

          let governorate = "";
          try {
            const cfg = await getDoc(doc(db, "tenants", id, "meta", "config"));
            governorate = String(
              (cfg.data() as Record<string, unknown> | undefined)?.governorate ?? "",
            ).trim();
          } catch {
            governorate = "";
          }

          return {
            id,
            name: String(base?.name ?? id),
            enabled: base?.enabled !== false,
            updatedAt: base?.updatedAt,
            governorate,
          } satisfies SuperSystemTenant;
        }),
      );

      onData(rows);
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
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  batch.set(
    doc(db, "tenants", tenantId, "meta", "config"),
    {
      governorate: gov,
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

export async function archiveAndDeleteTenant(input: { tenantId: string; deletedBy?: string }) {
  const id = String(input.tenantId || "").trim();
  if (!id) throw new Error("MISSING_TENANT_ID");

  const tRef = doc(db, "tenants", id);
  const tSnap = await getDoc(tRef);
  const data = tSnap.exists() ? (tSnap.data() as Record<string, unknown>) : {};

  await setDoc(
    doc(db, "archiveTenants", id),
    {
      ...data,
      id,
      deletedAt: serverTimestamp(),
      deletedBy: String(input.deletedBy || ""),
    },
    { merge: true },
  );

  const batch = writeBatch(db);
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
