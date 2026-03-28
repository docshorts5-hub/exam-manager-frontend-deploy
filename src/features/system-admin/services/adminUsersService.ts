import { collection, deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebase";
import { callFn } from "../../../services/functionsClient";
import { isStrictCloudRuntimeFunction, toCloudRuntimeActionError } from "../../../services/functionsRuntimePolicy";
import { logActivity } from "../../../services/activityLog.service";
import { writeSecurityAudit } from "../../../services/securityAudit";
import { isSameDirectorate, MINISTRY_SCOPE, normalizeText, PRIMARY_SUPER_ADMIN_EMAIL } from "../../../constants/directorates";
import { canManageAdminSystemRole } from "../../authz";
import type { AllowUser } from "../types";
import { normalizeRoleClient, resolveTenantGovernorate, stripUndefined } from "./adminSystemShared";

const USE_FUNCTIONS = !Boolean((import.meta as any).env?.DEV);

export async function buildGovernorateForUserRole(roleNorm: AllowUser["role"], tenantId: string, governorateInput: string): Promise<string | undefined> {
  if (roleNorm === "super") return normalizeText(String(governorateInput ?? "")) || undefined;
  if (roleNorm === "admin") return normalizeText(await resolveTenantGovernorate(tenantId)) || undefined;
  return undefined;
}

export async function createAllowUserAction(args: any) {
  const { user, authzSnapshot, isSuper, profile, users, newUserEmail, newUserTenantId, newUserRole, newUserGovernorate, newUserEnabled, newUserName, newUserSchoolName, selectedTenantConfig } = args;
  const email = String(newUserEmail || "").trim().toLowerCase();
  const tenantId = String(newUserTenantId || "").trim();
  const tSnap = await getDoc(doc(db, "tenants", tenantId));
  if (!tSnap.exists()) throw new Error("هذا الـ Tenant غير موجود. أنشئ المدرسة أولاً.");

  const roleNorm = normalizeRoleClient(newUserRole, newUserGovernorate);
  const emailLower = email.toLowerCase().trim();
  const isProtectedOwnerEmail = emailLower === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase();

  if (isSuper && roleNorm !== "admin") throw new Error("السوبر (المديرية) لا يستطيع إنشاء إلا (الأدمن) فقط.");
  if (isProtectedOwnerEmail) throw new Error("لا يمكن تعديل/حذف/تعطيل مالك المنصة الرئيسي.");
  if (!canManageAdminSystemRole(authzSnapshot, roleNorm)) throw new Error("ليست لديك صلاحية لإنشاء هذا النوع من المستخدمين.");

  const superAdminCount = users.filter((u: any) => {
    const r = normalizeRoleClient((u as any).role, (u as any).governorate);
    const em = String((u as any).email ?? "").toLowerCase().trim();
    return r === "super_admin" || em === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase();
  }).length;
  const superCount = users.filter((u: any) => normalizeRoleClient((u as any).role, (u as any).governorate) === "super").length;

  if (roleNorm === "super_admin" && emailLower !== PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase() && superAdminCount >= 2) throw new Error("الحد الأقصى للسوبر أدمن هو 2 فقط.");
  if (roleNorm === "super") {
    if (superCount >= 12) throw new Error("الحد الأقصى للسوبر (المديرية) هو 12 فقط.");
    if (!normalizeText(String(newUserGovernorate ?? ""))) throw new Error("يجب اختيار المديرية للسوبر.");
  }

  if (isSuper) {
    const myG = normalizeText(String((profile as any)?.governorate ?? ""));
    const tenantGov = normalizeText(String((selectedTenantConfig as any)?.governorate ?? (tSnap.data() as any)?.governorate ?? ""));
    if (myG && myG !== normalizeText(MINISTRY_SCOPE) && tenantGov && !isSameDirectorate(tenantGov, myG)) throw new Error("لا يمكنك إضافة أدمن خارج نطاق مديريتك.");
  }

  const governorateFinal = await buildGovernorateForUserRole(roleNorm, tenantId, newUserGovernorate);
  try {
    if (USE_FUNCTIONS) {
      await callFn<any, any>("adminUpsertAllowlist")({ email, enabled: !!newUserEnabled, role: roleNorm, tenantId, governorate: governorateFinal, name: String(newUserName || "").trim(), schoolName: String(newUserSchoolName || "").trim() });
    } else throw new Error("skip");
  } catch (error) {
    if (USE_FUNCTIONS && isStrictCloudRuntimeFunction("adminUpsertAllowlist")) throw toCloudRuntimeActionError(error, "adminUpsertAllowlist", "إنشاء/تحديث المستخدم");
    await setDoc(doc(db, "allowlist", email), stripUndefined({ email, enabled: !!newUserEnabled, role: roleNorm, tenantId, governorate: governorateFinal, name: String(newUserName || "").trim(), schoolName: String(newUserSchoolName || "").trim(), createdAt: serverTimestamp(), createdBy: user.email || "", updatedAt: serverTimestamp(), updatedBy: user.email || "" }), { merge: true });
  }
  await writeSecurityAudit({ type: "ALLOWLIST_CREATE", tenantId, actorUid: user.uid, actorEmail: user.email || "", targetEmail: email, details: { role: roleNorm, governorate: governorateFinal, enabled: !!newUserEnabled, name: String(newUserName || "").trim(), schoolName: String(newUserSchoolName || "").trim() } });
  await logActivity(tenantId, { actorUid: user.uid, actorEmail: user.email || "", action: "ALLOWLIST_CREATED", entity: "allowlist", entityId: email, meta: { role: roleNorm, governorate: governorateFinal, enabled: !!newUserEnabled, name: String(newUserName || "").trim(), schoolName: String(newUserSchoolName || "").trim() } });
}

export async function updateAllowUserAction(args: any) {
  const { user, users, authzSnapshot, isSuper, resolveTenantGovernorate, email, patch } = args;
  const current = users.find((u: any) => u.email.toLowerCase() === String(email).toLowerCase());
  const merged: AllowUser = { email: String(email).toLowerCase(), tenantId: current?.tenantId || "", enabled: typeof current?.enabled === "boolean" ? current.enabled : true, role: (current?.role as any) || "user", name: current?.name || "", schoolName: (current as any)?.schoolName || "", ...(current as any), ...(patch as any) };
  const roleNorm = normalizeRoleClient(merged.role, (merged as any).governorate);
  const emailLower = String(merged.email || "").toLowerCase().trim();
  if (emailLower === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase()) throw new Error("لا يمكن تعديل/حذف/تعطيل مالك المنصة الرئيسي.");
  if (!canManageAdminSystemRole(authzSnapshot, roleNorm)) throw new Error("ليست لديك صلاحية لتعديل هذا النوع من المستخدمين.");
  if (isSuper && roleNorm !== "admin") throw new Error("السوبر (المديرية) لا يستطيع تعديل إلا (الأدمن) فقط.");

  let governorateFinal: string | undefined;
  if (roleNorm === "super") {
    governorateFinal = normalizeText(String((merged as any).governorate ?? "")) || undefined;
    if (!governorateFinal) throw new Error("يجب تحديد المديرية للسوبر.");
  } else if (roleNorm === "admin") {
    governorateFinal = normalizeText(await resolveTenantGovernorate(String(merged.tenantId || ""))) || undefined;
  }

  try {
    if (USE_FUNCTIONS) {
      await callFn<any, any>("adminUpsertAllowlist")({ email: merged.email, tenantId: merged.tenantId, governorate: governorateFinal, enabled: !!merged.enabled, role: roleNorm, name: (merged.name || "").trim(), schoolName: String((merged as any).schoolName || "").trim() });
    } else throw new Error("skip");
  } catch (error) {
    if (USE_FUNCTIONS && isStrictCloudRuntimeFunction("adminUpsertAllowlist")) throw toCloudRuntimeActionError(error, "adminUpsertAllowlist", "تعديل المستخدم");
    await setDoc(doc(db, "allowlist", merged.email), stripUndefined({ email: merged.email, tenantId: merged.tenantId, governorate: governorateFinal, enabled: !!merged.enabled, role: roleNorm, name: (merged.name || "").trim(), schoolName: String((merged as any).schoolName || "").trim(), updatedAt: serverTimestamp(), updatedBy: user.email || "" }), { merge: true });
  }
}

export async function removeAllowUserAction(args: any) {
  const { user, users, authzSnapshot, email } = args;
  const item = users.find((u: any) => String(u.email).toLowerCase() === String(email).toLowerCase());
  const roleNorm = normalizeRoleClient((item as any)?.role, (item as any)?.governorate);
  const emailLower = String(email || "").toLowerCase().trim();
  if (emailLower === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase()) throw new Error("لا يمكن حذف مالك المنصة الرئيسي.");
  if (!canManageAdminSystemRole(authzSnapshot, roleNorm)) throw new Error("ليست لديك صلاحية لحذف هذا النوع من المستخدمين.");
  try {
    if (USE_FUNCTIONS) await callFn<any, any>("adminDeleteAllowlist")({ email: emailLower });
    else throw new Error("skip");
  } catch (error) {
    if (USE_FUNCTIONS && isStrictCloudRuntimeFunction("adminDeleteAllowlist")) throw toCloudRuntimeActionError(error, "adminDeleteAllowlist", "حذف المستخدم");
    await deleteDoc(doc(db, "allowlist", emailLower));
  }
  if (item?.tenantId) {
    await writeSecurityAudit({ type: "ALLOWLIST_DELETE", tenantId: item.tenantId, actorUid: user.uid, actorEmail: user.email || "", targetEmail: emailLower, details: { role: roleNorm } });
  }
}

export async function loadOwnerForTenantAction(tid: string) {
  const snap = await getDoc(doc(db, "tenants", tid, "meta", "owner"));
  return snap.exists() ? snap.data() : null;
}

export async function inviteSingleOwnerAction(args: any) {
  const { user, ownerTenantId, ownerEmail } = args;
  const tid = String(ownerTenantId || "").trim();
  const em = String(ownerEmail || "").trim().toLowerCase();
  if (!tid || !em.includes("@")) throw new Error("أدخل tenantId صحيح وبريد صحيح.");
  await setDoc(doc(db, "allowlist", em), { email: em, enabled: true, role: "admin", tenantId: tid, createdAt: serverTimestamp(), createdBy: user.email || "", updatedAt: serverTimestamp(), updatedBy: user.email || "" }, { merge: true });
}
