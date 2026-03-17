import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../firebase/firebase";
import { PRIMARY_SUPER_ADMIN_EMAIL } from "../constants/directorates";
import type { AllowDoc, Role, SaaSRole, TokenClaims, UserProfile } from "./types";
import { SUPER_ADMIN_TENANT_ID } from "./types";

export function ownerAllow(email: string): AllowDoc {
  return {
    email: String(email || "").toLowerCase().trim(),
    enabled: true,
    role: "super_admin",
    tenantId: SUPER_ADMIN_TENANT_ID,
  };
}

export function normalizeAllowlistRole(raw: any, email: string, governorate?: any): Role {
  const e = String(email ?? "").toLowerCase().trim();
  if (e === PRIMARY_SUPER_ADMIN_EMAIL.toLowerCase()) return "super_admin";

  const r = String(raw ?? "admin").trim().toLowerCase();
  if (r === "super_admin" || r === "superadmin" || r === "super admin" || r === "super-admin") return "super_admin";
  if (r === "super") return "super";
  if (r === "admin" || r === "tenant_admin" || r === "tenant admin" || r === "tenant-admin") return "admin";
  return "user";
}

export async function fetchTokenClaims(user: User): Promise<TokenClaims> {
  try {
    const res = await user.getIdTokenResult(false);
    const c: any = res?.claims ?? {};
    return {
      tenantId: typeof c.tenantId === "string" ? c.tenantId : undefined,
      role: (c.role as any) as Role,
      enabled: c.enabled === true,
      isOwner: c.isOwner === true,
      supportTenantId: typeof c.supportTenantId === "string" ? c.supportTenantId : undefined,
      supportUntil: typeof c.supportUntil === "number" ? c.supportUntil : undefined,
    };
  } catch {
    return {};
  }
}

export function allowFromClaims(email: string, claims: TokenClaims): AllowDoc | null {
  const enabled = claims.enabled === true;
  const tenantId = String(claims.tenantId ?? "").trim();
  const role = (claims.role as any) || "user";
  if (!enabled) return null;

  if (role === "super_admin" || claims.isOwner) {
    return { email, enabled: true, role: "super_admin", tenantId: SUPER_ADMIN_TENANT_ID } as AllowDoc;
  }
  if (!tenantId) return null;
  return { email, enabled: true, role, tenantId } as AllowDoc;
}


export function normalizeStoredSaaSRoles(input: unknown): SaaSRole[] {
  const raw = Array.isArray(input) ? input : [];
  const out: SaaSRole[] = [];
  for (const item of raw) {
    const role = String(item ?? "").trim().toLowerCase();
    if (["super_admin", "superadmin", "super admin", "super-admin"].includes(role)) {
      out.push("super_admin");
      continue;
    }
    if (role === "super") {
      out.push("manager");
      continue;
    }
    if (["admin", "tenant_admin", "tenant admin", "tenant-admin"].includes(role)) {
      out.push("tenant_admin");
      continue;
    }
    if (["manager", "tenant_manager", "tenant manager"].includes(role)) {
      out.push("manager");
      continue;
    }
    if (["staff", "operator", "tenant_operator", "user"].includes(role)) {
      out.push("staff");
      continue;
    }
    if (["viewer", "read_only", "readonly"].includes(role)) {
      out.push("viewer");
    }
  }
  return Array.from(new Set(out));
}

export function mapAllowRoleToSaaSRoles(params: { allowRole: Role; email: string; governorate?: string }): SaaSRole[] {
  const { allowRole, email, governorate } = params;
  const r = normalizeAllowlistRole(allowRole, email, governorate);
  if (r === "super_admin") return ["super_admin"];
  if (r === "super") return ["manager"];
  if (r === "admin") return ["tenant_admin"];
  return ["staff"];
}

export async function ensureTenantOwnerDoc(params: { tenantId: string; uid: string; email: string }) {
  const { tenantId, uid, email } = params;
  if (!tenantId) return;
  const ownerRef = doc(db, "tenants", tenantId, "meta", "owner");
  try {
    const snap = await getDoc(ownerRef);
    if (snap.exists()) return;
    await setDoc(ownerRef, { uid, email, createdAt: serverTimestamp() }, { merge: false });
  } catch {}
}

export async function isTenantOwner(params: { tenantId: string; uid: string }): Promise<boolean> {
  const { tenantId, uid } = params;
  if (!tenantId) return false;
  try {
    const ownerRef = doc(db, "tenants", tenantId, "meta", "owner");
    const snap = await getDoc(ownerRef);
    if (!snap.exists()) return false;
    const data = snap.data() as any;
    return String(data?.uid ?? "") === uid;
  } catch {
    return false;
  }
}

export async function syncUserProfileFromAllowlist(params: {
  uid: string;
  email: string;
  allow: AllowDoc;
  authDisplayName?: string | null;
}): Promise<UserProfile> {
  const { uid, email, allow, authDisplayName } = params;
  const roleNorm = normalizeAllowlistRole(allow.role, email, (allow as any)?.governorate);
  const roles = normalizeStoredSaaSRoles((allow as any)?.roles).length
    ? normalizeStoredSaaSRoles((allow as any)?.roles)
    : mapAllowRoleToSaaSRoles({ allowRole: roleNorm, email, governorate: (allow as any)?.governorate });
  const isGlobal = roleNorm === "super_admin" || roleNorm === "super";
  const tenantId = isGlobal ? SUPER_ADMIN_TENANT_ID : String(allow.tenantId ?? "").trim();

  const profile: UserProfile = {
    tenantId: tenantId || null,
    roles,
    status: allow.enabled ? "active" : "suspended",
    email,
    displayName: authDisplayName || allow.userName || allow.name || email,
    schoolName: allow.schoolName || "",
    updatedAt: serverTimestamp(),
    source: "allowlist",
  };

  if (isGlobal) return profile;
  if (tenantId) await ensureTenantOwnerDoc({ tenantId, uid, email });
  const ownerOk = tenantId ? await isTenantOwner({ tenantId, uid }) : false;
  if (!ownerOk) return profile;
  try {
    await setDoc(doc(db, "users", uid), profile, { merge: true });
  } catch {}
  return profile;
}
