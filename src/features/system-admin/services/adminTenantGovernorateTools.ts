
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../../firebase/firebase";
import { isValidTenantId, slugifyTenantId, stripUndefined } from "./adminSystemShared";
import { logActivity } from "../../../services/activityLog.service";
import { writeSecurityAudit } from "../../../services/securityAudit";

const SUBCOLLECTIONS = [
  "teachers",
  "exams",
  "rooms",
  "roomBlocks",
  "examRoomAssignments",
  "unavailability",
  "archive",
  "realtime",
  "logs",
  "backups",
] as const;

const norm = (v: any) => String(v || "").trim().toLowerCase();

function isSchoolAdminRole(role: string) {
  const r = norm(role);
  return r === "tenant_admin" || r === "admin";
}

function isGovernorateSuperRole(role: string) {
  const r = norm(role);
  return r === "super" || r === "super_regional" || r === "regional_super";
}

async function copySubcollection(oldTenantId: string, newTenantId: string, name: string) {
  const snap = await getDocs(collection(db, "tenants", oldTenantId, name));
  if (snap.empty) return;

  let batch = writeBatch(db);
  let ops = 0;

  for (const d of snap.docs) {
    batch.set(doc(db, "tenants", newTenantId, name, d.id), d.data(), { merge: true });
    ops += 1;
    if (ops >= 350) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();
}

export async function listTenantsGroupedByGovernorateAction() {
  const tenantsSnap = await getDocs(collection(db, "tenants"));
  const rows = await Promise.all(
    tenantsSnap.docs.map(async (d) => {
      const root = (d.data() as any) || {};
      const cfgSnap = await getDoc(doc(db, "tenants", d.id, "meta", "config"));
      const cfg = cfgSnap.exists() ? ((cfgSnap.data() as any) || {}) : {};
      const deleted = root?.deleted === true || cfg?.deleted === true;
      const governorate = String(cfg?.governorate || cfg?.regionAr || root?.governorate || "").trim();
      const schoolName = String(cfg?.schoolNameAr || root?.name || d.id).trim();
      return {
        tenantId: d.id,
        schoolName,
        governorate,
        enabled: root?.enabled !== false && cfg?.enabled !== false,
        deleted,
      };
    }),
  );

  return rows
    .filter((row) => row.deleted !== true)
    .sort((a, b) => {
      const x = String(a.governorate || "").localeCompare(String(b.governorate || ""), "ar");
      if (x !== 0) return x;
      return String(a.schoolName || "").localeCompare(String(b.schoolName || ""), "ar");
    });
}

export async function getTenantManagerDetailsAction(tenantId: string) {
  const tid = String(tenantId || "").trim();
  if (!tid) throw new Error("MISSING_TENANT_ID");

  const [tenantSnap, configSnap, allowSnap, linkSnap] = await Promise.all([
    getDoc(doc(db, "tenants", tid)),
    getDoc(doc(db, "tenants", tid, "meta", "config")),
    getDocs(query(collection(db, "allowlist"), where("tenantId", "==", tid))),
    getDoc(doc(db, "tenantAdminLinks", tid)),
  ]);

  if (!tenantSnap.exists()) throw new Error("TENANT_NOT_FOUND");

  const root = (tenantSnap.data() as any) || {};
  const cfg = configSnap.exists() ? ((configSnap.data() as any) || {}) : {};
  const linkedRow = allowSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .find((row: any) => isSchoolAdminRole(row?.role || ""));

  return {
    tenantId: tid,
    schoolName: String(cfg?.schoolNameAr || root?.name || tid).trim(),
    governorate: String(cfg?.governorate || cfg?.regionAr || root?.governorate || "").trim(),
    enabled: root?.enabled !== false && cfg?.enabled !== false,
    linkedEmail: String(linkedRow?.email || (linkSnap.exists() ? (linkSnap.data() as any)?.email : "") || "").trim(),
    root,
    cfg,
  };
}

export async function migrateTenantIdAction(args: { user: any; oldTenantId: string; newTenantId: string }) {
  const { user, oldTenantId, newTenantId } = args;
  const oldId = String(oldTenantId || "").trim();
  const newId = slugifyTenantId(String(newTenantId || "").trim());

  if (!oldId) throw new Error("MISSING_OLD_TENANT_ID");
  if (!newId) throw new Error("MISSING_NEW_TENANT_ID");
  if (!isValidTenantId(newId)) throw new Error("INVALID_NEW_TENANT_ID");
  if (oldId === newId) throw new Error("SAME_TENANT_ID");

  const [oldRootSnap, oldCfgSnap, newRootSnap, allowSnap, oldLinkSnap] = await Promise.all([
    getDoc(doc(db, "tenants", oldId)),
    getDoc(doc(db, "tenants", oldId, "meta", "config")),
    getDoc(doc(db, "tenants", newId)),
    getDocs(query(collection(db, "allowlist"), where("tenantId", "==", oldId))),
    getDoc(doc(db, "tenantAdminLinks", oldId)),
  ]);

  if (!oldRootSnap.exists()) throw new Error("OLD_TENANT_NOT_FOUND");
  if (newRootSnap.exists()) throw new Error("NEW_TENANT_ALREADY_EXISTS");

  const oldRoot = (oldRootSnap.data() as any) || {};
  const oldCfg = oldCfgSnap.exists() ? ((oldCfgSnap.data() as any) || {}) : {};
  const schoolName = String(oldCfg?.schoolNameAr || oldRoot?.name || oldId).trim();
  const governorate = String(oldCfg?.governorate || oldCfg?.regionAr || oldRoot?.governorate || "").trim();

  await setDoc(
    doc(db, "tenants", newId),
    stripUndefined({
      ...oldRoot,
      deleted: false,
      enabled: oldRoot?.enabled !== false,
      updatedAt: serverTimestamp(),
      updatedBy: user?.email || "",
      migratedFromTenantId: oldId,
    }),
    { merge: true },
  );

  await setDoc(
    doc(db, "tenants", newId, "meta", "config"),
    stripUndefined({
      ...oldCfg,
      deleted: false,
      enabled: oldCfg?.enabled !== false,
      governorate,
      regionAr: governorate,
      schoolNameAr: schoolName,
      updatedAt: serverTimestamp(),
      updatedBy: user?.email || "",
      migratedFromTenantId: oldId,
    }),
    { merge: true },
  );

  for (const sub of SUBCOLLECTIONS) {
    await copySubcollection(oldId, newId, sub);
  }

  const batch = writeBatch(db);

  for (const d of allowSnap.docs) {
    const data = (d.data() as any) || {};
    const role = norm(data?.role || "");

    if (isSchoolAdminRole(role) || role === "user") {
      batch.set(
        d.ref,
        {
          tenantId: newId,
          schoolName,
          tenantName: schoolName,
          governorate,
          tenantGovernorate: governorate,
          updatedAt: serverTimestamp(),
          updatedBy: user?.email || "",
        },
        { merge: true },
      );
    } else {
      // مهم: أي دور غير مدرسي لا يجب أن يبقى مربوطًا بـ Tenant بعد النقل
      batch.set(
        d.ref,
        {
          tenantId: "",
          schoolName: "",
          tenantName: "",
          tenantGovernorate: "",
          updatedAt: serverTimestamp(),
          updatedBy: user?.email || "",
        },
        { merge: true },
      );
    }
  }

  const oldLinkData = oldLinkSnap.exists() ? ((oldLinkSnap.data() as any) || {}) : {};
  const linkedEmail = String(oldLinkData?.email || "").trim().toLowerCase();
  if (linkedEmail) {
    batch.set(
      doc(db, "tenantAdminLinks", newId),
      {
        tenantId: newId,
        email: linkedEmail,
        schoolName,
        governorate,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || "",
      },
      { merge: true },
    );
  }

  batch.set(
    doc(db, "tenants", oldId),
    {
      deleted: true,
      enabled: false,
      migratedToTenantId: newId,
      updatedAt: serverTimestamp(),
      updatedBy: user?.email || "",
    },
    { merge: true },
  );

  batch.set(
    doc(db, "tenants", oldId, "meta", "config"),
    {
      deleted: true,
      enabled: false,
      migratedToTenantId: newId,
      updatedAt: serverTimestamp(),
      updatedBy: user?.email || "",
    },
    { merge: true },
  );

  batch.delete(doc(db, "tenantAdminLinks", oldId));
  await batch.commit();

  await writeSecurityAudit({
    type: "TENANT_UPDATE",
    tenantId: newId,
    actorUid: user?.uid || "",
    actorEmail: user?.email || "",
    details: { action: "TENANT_ID_MIGRATED", oldTenantId: oldId, newTenantId: newId },
  });

  await logActivity(newId, {
    actorUid: user?.uid || "",
    actorEmail: user?.email || "",
    action: "TENANT_ID_MIGRATED",
    entity: "tenant",
    entityId: newId,
    meta: { oldTenantId: oldId, newTenantId: newId },
  });

  return { oldTenantId: oldId, newTenantId: newId };
}

export async function listRegionalSupersAction() {
  const snap = await getDocs(collection(db, "allowlist"));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((row: any) => isGovernorateSuperRole(row?.role || ""))
    .sort((a: any, b: any) => String(a?.governorate || "").localeCompare(String(b?.governorate || ""), "ar"));
}

export async function updateRegionalSuperGovernorateAction(args: { user: any; email: string; governorate: string }) {
  const { user, email, governorate } = args;
  const em = String(email || "").trim().toLowerCase();
  const gov = String(governorate || "").trim();
  if (!em) throw new Error("MISSING_EMAIL");
  if (!gov) throw new Error("MISSING_GOVERNORATE");

  const snap = await getDoc(doc(db, "allowlist", em));
  if (!snap.exists()) throw new Error("USER_NOT_FOUND");
  const data = (snap.data() as any) || {};
  if (!isGovernorateSuperRole(data?.role || "")) throw new Error("NOT_REGIONAL_SUPER");

  await setDoc(
    doc(db, "allowlist", em),
    {
      governorate: gov,
      tenantId: "",
      schoolName: "",
      tenantName: "",
      tenantGovernorate: "",
      updatedAt: serverTimestamp(),
      updatedBy: user?.email || "",
    },
    { merge: true },
  );
}

export async function clearRegionalSuperTenantBindingAction(args: { user: any; email: string }) {
  const { user, email } = args;
  const em = String(email || "").trim().toLowerCase();
  if (!em) throw new Error("MISSING_EMAIL");
  const snap = await getDoc(doc(db, "allowlist", em));
  if (!snap.exists()) throw new Error("USER_NOT_FOUND");
  const data = (snap.data() as any) || {};
  if (!isGovernorateSuperRole(data?.role || "")) throw new Error("NOT_REGIONAL_SUPER");

  await setDoc(
    doc(db, "allowlist", em),
    {
      tenantId: "",
      schoolName: "",
      tenantName: "",
      tenantGovernorate: "",
      updatedAt: serverTimestamp(),
      updatedBy: user?.email || "",
    },
    { merge: true },
  );
}
