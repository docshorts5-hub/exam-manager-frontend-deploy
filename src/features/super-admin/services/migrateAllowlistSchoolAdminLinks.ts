import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../firebase/firebase";

export type AllowlistSchoolAdminConflict = {
  type: "email_to_many_tenants" | "tenant_to_many_emails";
  email?: string;
  tenantId?: string;
  kept?: string;
  removed?: string[];
};

export type AllowlistSchoolAdminMigrationReport = {
  scanned: number;
  updated: number;
  deleted: number;
  skipped: number;
  conflicts: AllowlistSchoolAdminConflict[];
};

type LinkDoc = {
  docId: string;
  email: string;
  tenantId: string;
  role: string;
  schoolName: string;
  governorate: string;
  existsTenant: boolean;
  tenantDocName: string;
  tenantDocGovernorate: string;
};

async function loadTenantInfo(tenantId: string) {
  const tenantSnap = await getDoc(doc(db, "tenants", tenantId));
  if (!tenantSnap.exists()) {
    return {
      existsTenant: false,
      tenantDocName: "",
      tenantDocGovernorate: "",
    };
  }

  const tenantData = tenantSnap.data() as any;
  let cfgGovernorate = "";
  try {
    const cfgSnap = await getDoc(doc(db, "tenants", tenantId, "meta", "config"));
    const cfgData = cfgSnap.exists() ? (cfgSnap.data() as any) : {};
    cfgGovernorate = String(cfgData?.governorate || "").trim();
  } catch {}

  return {
    existsTenant: true,
    tenantDocName: String(tenantData?.name || tenantId).trim(),
    tenantDocGovernorate: String(tenantData?.governorate || cfgGovernorate || "").trim(),
  };
}

function chooseCanonicalLink(links: LinkDoc[]): LinkDoc {
  const exactTenantAdmin = links.find((x) => x.role === "tenant_admin");
  if (exactTenantAdmin) return exactTenantAdmin;
  return [...links].sort((a, b) => a.tenantId.localeCompare(b.tenantId))[0];
}

export async function migrateAllowlistSchoolAdminLinks(params?: {
  apply?: boolean;
}): Promise<AllowlistSchoolAdminMigrationReport> {
  const apply = params?.apply === true;
  const report: AllowlistSchoolAdminMigrationReport = {
    scanned: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
    conflicts: [],
  };

  const snap = await getDocs(
    query(collection(db, "allowlist"), where("role", "in", ["tenant_admin", "admin"]))
  );

  const links: LinkDoc[] = [];

  for (const row of snap.docs) {
    const data = row.data() as any;
    const email = String(data?.email || row.id || "").trim().toLowerCase();
    const tenantId = String(data?.tenantId || "").trim();
    const role = String(data?.role || "").trim().toLowerCase();
    report.scanned += 1;

    if (!email || !tenantId) {
      report.skipped += 1;
      continue;
    }

    const tenantInfo = await loadTenantInfo(tenantId);

    links.push({
      docId: row.id,
      email,
      tenantId,
      role,
      schoolName: String(data?.schoolName || data?.tenantName || "").trim(),
      governorate: String(data?.governorate || data?.tenantGovernorate || "").trim(),
      ...tenantInfo,
    });
  }

  const byEmail = new Map<string, LinkDoc[]>();
  const byTenant = new Map<string, LinkDoc[]>();

  for (const link of links) {
    if (!byEmail.has(link.email)) byEmail.set(link.email, []);
    byEmail.get(link.email)!.push(link);

    if (!byTenant.has(link.tenantId)) byTenant.set(link.tenantId, []);
    byTenant.get(link.tenantId)!.push(link);
  }

  const toDelete = new Set<string>();
  const toUpsert = new Map<string, any>();

  for (const [email, items] of byEmail.entries()) {
    if (items.length <= 1) continue;

    const keep = chooseCanonicalLink(items);
    const removed = items.filter((x) => x.docId !== keep.docId).map((x) => x.docId);

    removed.forEach((id) => toDelete.add(id));
    report.conflicts.push({
      type: "email_to_many_tenants",
      email,
      kept: keep.tenantId,
      removed,
    });
  }

  const survivingByTenant = new Map<string, LinkDoc[]>();
  for (const link of links) {
    if (toDelete.has(link.docId)) continue;
    if (!survivingByTenant.has(link.tenantId)) survivingByTenant.set(link.tenantId, []);
    survivingByTenant.get(link.tenantId)!.push(link);
  }

  for (const [tenantId, items] of survivingByTenant.entries()) {
    if (items.length <= 1) continue;

    const keep = chooseCanonicalLink(items);
    const removed = items.filter((x) => x.docId !== keep.docId).map((x) => x.docId);

    removed.forEach((id) => toDelete.add(id));
    report.conflicts.push({
      type: "tenant_to_many_emails",
      tenantId,
      kept: keep.email,
      removed,
    });
  }

  for (const link of links) {
    if (toDelete.has(link.docId)) continue;
    if (!link.existsTenant) {
      report.skipped += 1;
      continue;
    }

    const normalized = {
      email: link.email,
      enabled: true,
      role: "tenant_admin",
      tenantId: link.tenantId,
      schoolName: link.tenantDocName || link.schoolName || link.tenantId,
      tenantName: link.tenantDocName || link.schoolName || link.tenantId,
      governorate: link.tenantDocGovernorate || link.governorate,
      tenantGovernorate: link.tenantDocGovernorate || link.governorate,
      updatedAt: serverTimestamp(),
      migrationAt: serverTimestamp(),
    };

    toUpsert.set(link.docId, normalized);
  }

  if (!apply) {
    report.updated = toUpsert.size;
    report.deleted = toDelete.size;
    return report;
  }

  const batch = writeBatch(db);

  for (const [docId, payload] of toUpsert.entries()) {
    batch.set(doc(db, "allowlist", docId), payload, { merge: true });
    report.updated += 1;
  }

  for (const docId of toDelete) {
    batch.delete(doc(db, "allowlist", docId));
    report.deleted += 1;
  }

  await batch.commit();
  return report;
}
