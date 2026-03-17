import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebase";

export function slugifyTenantId(input: string) {
  const raw = (input || "").trim().toLowerCase();
  return raw
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isValidTenantId(input: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input);
}

export function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (v !== undefined) out[k] = v;
  });
  return out as T;
}

export function normalizeRoleClient(raw: any, governorate?: any): "super_admin" | "super" | "admin" | "user" {
  const r = String(raw ?? "admin").trim().toLowerCase();
  if (r === "super_admin" || r === "superadmin" || r === "super admin" || r === "super-admin") return "super_admin";
  if (r === "super") {
    const g = String(governorate ?? "").trim();
    return g ? "super" : "super_admin";
  }
  if (r === "admin" || r === "tenant_admin" || r === "tenantadmin" || r === "tenant admin" || r === "tenant-admin") return "admin";
  return "user";
}

export async function resolveTenantGovernorate(tenantId: string): Promise<string> {
  const tid = String(tenantId || "").trim();
  if (!tid) return "";

  try {
    const cfgSnap = await getDoc(doc(db, "tenants", tid, "meta", "config"));
    if (cfgSnap.exists()) {
      const data = cfgSnap.data() as any;
      const g = String(data?.governorate ?? data?.regionAr ?? "").trim();
      if (g) return g;
    }
  } catch {}

  try {
    const tSnap = await getDoc(doc(db, "tenants", tid));
    if (tSnap.exists()) {
      const data = tSnap.data() as any;
      const g = String(data?.governorate ?? "").trim();
      if (g) return g;
    }
  } catch {}

  return "";
}
