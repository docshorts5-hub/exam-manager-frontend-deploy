import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../../firebase/firebase";
import type { SaaSRole, UserProfile } from "../../auth/types";


function normalizeRoles(input: unknown, fallback: SaaSRole[] = ["staff"]): SaaSRole[] {
  const roles = Array.isArray(input) ? input : fallback;
  const allowed: SaaSRole[] = ["super_admin", "tenant_admin", "manager", "staff", "viewer"];
  const normalized = roles
    .map((x) => String(x ?? "").trim().toLowerCase())
    .map((x) => (x === "admin" ? "tenant_admin" : x))
    .filter((x): x is SaaSRole => allowed.includes(x as SaaSRole));
  return normalized.length ? Array.from(new Set(normalized)) : fallback;
}

export async function getUserProfileByUid(uid: string): Promise<Record<string, any> | null> {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? (snap.data() as Record<string, any>) : null;
  } catch {
    return null;
  }
}

export async function upsertBaseUserProfileDoc(user: User, email: string): Promise<void> {
  if (!user?.uid || !email) return;
  try {
    await setDoc(
      doc(db, "users", user.uid),
      {
        email,
        displayName: user.displayName || null,
        status: "active",
        updatedAt: serverTimestamp(),
        source: "manual",
      },
      { merge: true }
    );
  } catch {}
}

export async function loadUserProfileUiModel(params: {
  uid: string;
  fallback: UserProfile | null;
}): Promise<UserProfile | null> {
  const data = await getUserProfileByUid(params.uid);
  if (!data && !params.fallback) return null;
  return {
    tenantId: (data?.tenantId ?? params.fallback?.tenantId ?? null) as string | null,
    roles: normalizeRoles(data?.roles, (params.fallback?.roles ?? ["staff"]) as UserProfile["roles"]),
    status: ((data?.status as UserProfile["status"]) || params.fallback?.status || "active") as UserProfile["status"],
    email: (params.fallback?.email || data?.email || "") as string,
    displayName: (data?.displayName || params.fallback?.displayName || undefined) as string | undefined,
    schoolName: (data?.schoolName || params.fallback?.schoolName || undefined) as string | undefined,
    updatedAt: data?.updatedAt ?? params.fallback?.updatedAt,
    source: (data?.source || params.fallback?.source || "manual") as UserProfile["source"],
  };
}
