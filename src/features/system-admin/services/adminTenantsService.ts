import { doc, getDoc, getDocs, query, collection, serverTimestamp, setDoc, where, writeBatch } from "firebase/firestore";
import { db } from "../../../firebase/firebase";
import { callFn } from "../../../services/functionsClient";
import { isStrictCloudRuntimeFunction, toCloudRuntimeActionError } from "../../../services/functionsRuntimePolicy";
import { logActivity } from "../../../services/activityLog.service";
import { writeSecurityAudit } from "../../../services/securityAudit";
import type { TenantConfig } from "../types";

const MINISTRY_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const USE_FUNCTIONS = !Boolean((import.meta as any).env?.DEV);

export async function createTenantAction(args: { user: any; tenantId: string; tenantName: string; enabled: boolean }) {
  const { user, tenantId, tenantName, enabled } = args;
  const tenantRef = doc(db, "tenants", tenantId);
  const exist = await getDoc(tenantRef);
  if (exist.exists()) throw new Error("Tenant بهذا الـ ID موجود مسبقاً.");

  if (USE_FUNCTIONS) {
    try {
      await callFn<any, any>("adminUpsertTenant")({ tenantId, name: tenantName.trim(), enabled: !!enabled });
    } catch (error) {
      if (isStrictCloudRuntimeFunction("adminUpsertTenant")) throw toCloudRuntimeActionError(error, "adminUpsertTenant", "إنشاء المدرسة");
      await setDoc(tenantRef, { name: tenantName.trim(), enabled: !!enabled, deleted: false, createdAt: serverTimestamp(), createdBy: user.email || "", updatedAt: serverTimestamp(), updatedBy: user.email || "" }, { merge: true });
    }
  } else {
    await setDoc(tenantRef, { name: tenantName.trim(), enabled: !!enabled, deleted: false, createdAt: serverTimestamp(), createdBy: user.email || "", updatedAt: serverTimestamp(), updatedBy: user.email || "" }, { merge: true });
  }

  await writeSecurityAudit({ type: "TENANT_CREATE", tenantId, actorUid: user.uid, actorEmail: user.email || "", details: { name: tenantName.trim(), enabled: !!enabled } });
  await logActivity(tenantId, { actorUid: user.uid, actorEmail: user.email || "", action: "TENANT_CREATED", entity: "tenant", entityId: tenantId, meta: { name: tenantName.trim(), enabled: !!enabled } });
  await setDoc(doc(db, "tenants", tenantId, "meta", "config"), { ministryAr: "سلطنة عمان - وزارة التعليم", schoolNameAr: tenantName.trim(), systemNameAr: "نظام إدارة الامتحانات الذكي", governorate: "", regionAr: "", wilayatAr: "", logoUrl: MINISTRY_LOGO_URL, updatedAt: serverTimestamp(), updatedBy: user.email || "" }, { merge: true });
  await setDoc(tenantRef, { governorate: "", updatedAt: serverTimestamp(), updatedBy: user.email || "" }, { merge: true });
}

export async function saveTenantConfigAction(args: { user: any; tenantId: string; config: TenantConfig }) {
  const { user, tenantId, config } = args;
  const normalizedGov = (config as any).governorate || (config as any).regionAr || "";
  await setDoc(doc(db, "tenants", tenantId, "meta", "config"), { ...config, governorate: normalizedGov, regionAr: (config as any).regionAr || normalizedGov, updatedAt: serverTimestamp(), updatedBy: user.email || "" }, { merge: true });
  await setDoc(doc(db, "tenants", tenantId), { governorate: normalizedGov, updatedAt: serverTimestamp(), updatedBy: user.email || "" }, { merge: true });
}

export async function toggleTenantEnabledAction(args: { user: any; tenantId: string; enabled: boolean }) {
  const { user, tenantId, enabled } = args;
  if (USE_FUNCTIONS) {
    try {
      await callFn<any, any>("adminUpsertTenant")({ tenantId, enabled });
    } catch (error) {
      if (isStrictCloudRuntimeFunction("adminUpsertTenant")) throw toCloudRuntimeActionError(error, "adminUpsertTenant", "تحديث حالة المدرسة");
      await setDoc(doc(db, "tenants", tenantId), { enabled, updatedAt: serverTimestamp(), updatedBy: user.email || "" }, { merge: true });
    }
  } else {
    await setDoc(doc(db, "tenants", tenantId), { enabled, updatedAt: serverTimestamp(), updatedBy: user.email || "" }, { merge: true });
  }
  await writeSecurityAudit({ type: "TENANT_UPDATE", tenantId, actorUid: user.uid, actorEmail: user.email || "", details: { enabled } });
}

export async function deleteTenantAction(args: { user: any; tenantId: string; alsoDeleteUsers: boolean }) {
  const { user, tenantId, alsoDeleteUsers } = args;
  try {
    await callFn<any, any>("adminDeleteTenant")({ tenantId, alsoDeleteUsers });
    try {
      await setDoc(doc(db, "tenants", tenantId), { deleted: true, enabled: false, deletedAt: serverTimestamp(), deletedBy: user.email || null }, { merge: true });
      await setDoc(doc(db, "tenants", tenantId, "meta", "config"), { deleted: true, enabled: false, updatedAt: serverTimestamp(), updatedBy: user.email || null }, { merge: true });
    } catch {}
  } catch (error) {
    if (USE_FUNCTIONS && isStrictCloudRuntimeFunction("adminDeleteTenant")) throw toCloudRuntimeActionError(error, "adminDeleteTenant", "حذف المدرسة");
    await setDoc(doc(db, "tenants", tenantId), { deleted: true, enabled: false, deletedAt: serverTimestamp(), deletedBy: user.email || null }, { merge: true });
    await setDoc(doc(db, "tenants", tenantId, "meta", "config"), { deleted: true, enabled: false, updatedAt: serverTimestamp(), updatedBy: user.email || null }, { merge: true });
    if (alsoDeleteUsers) {
      const qs = await getDocs(query(collection(db, "allowlist"), where("tenantId", "==", tenantId)));
      const batch = writeBatch(db);
      let n = 0;
      qs.forEach((d) => { batch.delete(d.ref); n++; });
      if (n > 0) await batch.commit();
    }
  }
  await writeSecurityAudit({ type: "TENANT_DELETE", tenantId, actorUid: user.uid, actorEmail: user.email || "", details: { alsoDeleteUsers: !!alsoDeleteUsers, via: "adminDeleteTenant" } });
}
