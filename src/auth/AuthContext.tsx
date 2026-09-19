import React, { createContext, useContext, useEffect, useMemo } from "react";
import { signOut } from "firebase/auth";
import { useLocation } from "react-router-dom";
import { auth } from "../firebase/firebase";
import { normalizeAllowlistRole } from "./auth-helpers";
import { SUPER_ADMIN_TENANT_ID, type AuthCtx, type Role } from "./types";
import { useSupportSession } from "./hooks/useSupportSession";
import { useAuthSessionState } from "./hooks/useAuthSessionState";
import { setAuditContext } from "../services/auditAuto";
import { buildAuthzSnapshot, canAccessCapability, capsFromRoles, isPlatformOwner, resolveEffectiveRoles, resolvePrimaryRoleLabel } from "../features/authz";


function getStoredTenantId() {
  try {
    return String(
      sessionStorage.getItem("selectedTenantId") ||
      sessionStorage.getItem("effectiveTenantId") ||
      sessionStorage.getItem("tenantId") ||
      localStorage.getItem("selectedTenantId") ||
      localStorage.getItem("effectiveTenantId") ||
      localStorage.getItem("tenantId") ||
      ""
    ).trim();
  } catch {
    return "";
  }
}

function getTenantIdFromTenantPath(pathname: string) {
  const path = String(pathname || "").trim();
  const match = path.match(/^\/t\/([^/?#]+)/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1] || "").trim();
  } catch {
    return String(match[1] || "").trim();
  }
}

function pickTenantIdFromProfile(source: any): string {
  if (!source) return "";
  return String(
    source.tenantId ??
      source.effectiveTenantId ??
      source.selectedTenantId ??
      source.lastTenantId ??
      source.centerId ??
      source.schoolId ??
      source.diplomaCenterId ??
      source.examCenterId ??
      ""
  ).trim();
}


const DISABLE_FUNCTIONS = String(import.meta.env.VITE_DISABLE_FUNCTIONS ?? "true") === "true";
const IS_DEV = Boolean(import.meta.env.DEV);


const Ctx = createContext<AuthCtx | null>(null);

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}

type MfaRoutePolicySource = { mfaRouteRequired?: boolean };

const ROUTE_MFA_POLICY_ENABLED = false;

function readMfaRouteRequired(source: unknown): boolean {
  if (!source || typeof source !== "object") return false;
  return (source as MfaRoutePolicySource).mfaRouteRequired === true;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const routeTenantId = useMemo(() => getTenantIdFromTenantPath(location.pathname), [location.pathname]);
  const session = useAuthSessionState();

  const { user, allow, userProfile, claims, loading, mfaEnrolled, mfaSatisfied, refreshMfaState, refreshAllow, setAllow, setUserProfile, setClaims } = session;

  const routeMfaPolicyEnabled = ROUTE_MFA_POLICY_ENABLED;
  const mfaRouteRequired =
    readMfaRouteRequired(claims) ||
    readMfaRouteRequired(allow);
  const mfaRouteWouldBlock =
    routeMfaPolicyEnabled &&
    mfaRouteRequired &&
    (!mfaEnrolled || !mfaSatisfied);

  const isSuperAdmin = useMemo(() => {
    const claimRole = String(claims?.role ?? "").toLowerCase();
    const claimSuper = claims?.enabled === true && (claimRole === "super_admin" || claimRole === "owner" || claimRole === "platform_owner" || claims?.isOwner === true);
    const allowRole = String(allow?.role ?? "").toLowerCase();
    const allowSuper = allow?.enabled === true && (allowRole === "super_admin" || allowRole === "owner" || allowRole === "platform_owner");
    return claimSuper || allowSuper;
  }, [claims?.enabled, claims?.role, claims?.isOwner, allow?.enabled, allow?.role]);

  const isSuper = useMemo(() => {
    const email = String(user?.email ?? "").toLowerCase().trim();
    if (!allow?.enabled) return false;
    const roleNorm = normalizeAllowlistRole(allow?.role, email, (allow as any)?.governorate);
    return roleNorm === "super";
  }, [allow?.enabled, allow?.role, user?.email]);

  const isExamSuper = useMemo(() => {
    const email = String(user?.email ?? "").toLowerCase().trim();
    if (!allow?.enabled) return false;
    const roleNorm = normalizeAllowlistRole(allow?.role, email, (allow as any)?.governorate);
    return roleNorm === "exam_super";
  }, [allow?.enabled, allow?.role, user?.email]);

  const isAdmin = useMemo(() => {
    const email = String(user?.email ?? "").toLowerCase().trim();
    if (!allow?.enabled) return false;
    const roleNorm = normalizeAllowlistRole(allow?.role, email, (allow as any)?.governorate);
    return roleNorm === "admin" || roleNorm === "tenant_admin";
  }, [allow?.enabled, allow?.role, user?.email]);

  const support = useSupportSession({ claims, isSuperAdmin });

  const authzSnapshot = useMemo(() => buildAuthzSnapshot({
    user,
    profile: allow,
    userProfile,
    claims,
    isSuperAdmin,
    isSuper,
    tenantId: pickTenantIdFromProfile(allow) || pickTenantIdFromProfile(claims) || pickTenantIdFromProfile(userProfile) || null,
    supportTenantId: support.supportTenantId,
    supportUntil: support.supportUntil,
    isSupportMode: support.isSupportMode,
  }), [user, allow, userProfile, claims, isSuperAdmin, isSuper, support.supportTenantId, support.supportUntil, support.isSupportMode]);

  const platformOwner = useMemo(() => isPlatformOwner(authzSnapshot), [authzSnapshot]);
  const capabilities = useMemo(() => Array.from(capsFromRoles(resolveEffectiveRoles(authzSnapshot))), [authzSnapshot]);
  const can = useMemo(() => (capability: any) => canAccessCapability(authzSnapshot, capability), [authzSnapshot]);
  const primaryRoleLabel = useMemo(() => resolvePrimaryRoleLabel(authzSnapshot), [authzSnapshot]);
  const canSupport = useMemo(() => can("SUPPORT_MODE"), [can]);

  const effectiveTenantId = useMemo(() => {
    const base = String(pickTenantIdFromProfile(allow) || pickTenantIdFromProfile(claims) || pickTenantIdFromProfile(userProfile) || "").trim();
    const storedTenantId = getStoredTenantId();

    if (platformOwner) {
      if (support.isSupportMode && support.supportTenantId) return support.supportTenantId;

      // عند دخول مالك المنصة إلى مدرسة من المسار /t/:tenantId يجب أن تصبح هذه المدرسة
      // هي مصدر البيانات. سابقًا كان يرجع SUPER_ADMIN_TENANT_ID، فتظهر صفحات المدرسة فارغة.
      if (routeTenantId) return routeTenantId;

      return SUPER_ADMIN_TENANT_ID;
    }

    if (isSuper && routeTenantId) {
      return routeTenantId;
    }

    // سوبر المحافظة لا يجب أن يعتمد على tenantId مخزّن من جلسة قديمة عند فتح /super-system.
    // عند دخول مدرسة محددة عبر /t/:tenantId نستخدم routeTenantId فقط، أما بوابة السوبر فتقرأ كـ system.
    if (isSuper) {
      return SUPER_ADMIN_TENANT_ID;
    }

    if (!base) return null;
    return base || null;
  }, [allow, claims, userProfile, platformOwner, support.isSupportMode, support.supportTenantId, isSuper, routeTenantId]);

  const effectiveRole = useMemo<Role | null>(() => {
    if (!user?.email) return null;
    return normalizeAllowlistRole(allow?.role, user.email, (allow as any)?.governorate);
  }, [allow?.role, user?.email]);


  useEffect(() => {
    setAuditContext({
      tenantId: effectiveTenantId,
      uid: user?.uid ?? null,
      email: user?.email ?? null,
      role: effectiveRole ?? (platformOwner ? "super_admin" : null),
      isSupportMode: support.isSupportMode,
    });
  }, [effectiveTenantId, user?.uid, user?.email, effectiveRole, support.isSupportMode, platformOwner]);


  useEffect(() => {
    if (typeof window === "undefined") return;

    const tid = String(effectiveTenantId || pickTenantIdFromProfile(allow) || pickTenantIdFromProfile(claims) || pickTenantIdFromProfile(userProfile) || "").trim();
    const role = String(effectiveRole || allow?.role || claims?.role || "").trim();

    try {
      // Legacy pages still read these keys. Keep them in sync from the authenticated allowlist
      // so a new device using the same school email opens the same tenant instead of local/default data.
      if (tid && tid !== SUPER_ADMIN_TENANT_ID && ((!platformOwner && role !== "super") || routeTenantId)) {
        window.localStorage.setItem("tenantId", tid);
        window.localStorage.setItem("effectiveTenantId", tid);
        window.localStorage.setItem("selectedTenantId", tid);
        window.sessionStorage.setItem("tenantId", tid);
        window.sessionStorage.setItem("effectiveTenantId", tid);
        window.sessionStorage.setItem("selectedTenantId", tid);
      }

      if (role) {
        window.localStorage.setItem("effectiveRole", role);
        window.sessionStorage.setItem("effectiveRole", role);
      }
    } catch {
      // Legacy sync must not block login.
    }
  }, [effectiveTenantId, allow, allow?.role, claims, claims?.role, userProfile, effectiveRole, platformOwner, routeTenantId]);
  function clearProtectedEmailCodeSessionsOnLogout() {
    if (typeof window === "undefined") return;

    try {
      const prefixes = [
        "yr:taskrun12:email-code-session:",
        "yr:settings12:email-code-session:",
        "yr:super-admin-area:email-code-session:",
      ];
      const keysToRemove: string[] = [];

      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // Best-effort cleanup only. Never block logout because localStorage failed.
    }
  }


  const logout = async () => {
    clearProtectedEmailCodeSessionsOnLogout();

    try {
      await signOut(auth);
    } finally {
      setAllow(null);
      setUserProfile(null);
      setClaims(null);
    }
  };

  const startSupportForTenant = async (tenantId: string, reason?: string) => {
    const t = String(tenantId ?? "").trim();
    if (!t || !auth.currentUser) return;
    if (DISABLE_FUNCTIONS || IS_DEV) {
      support.setLocalSupportSession(t, 30);
      await refreshAllow();
      return;
    }
    try {
      const { callFn } = await import("../services/functionsClient");
      const fn = callFn<any, any>("startSupportSession");
      await fn({ tenantId: t, reason: String(reason ?? "").trim() || undefined, durationMinutes: 30 });
      await auth.currentUser.getIdToken(true);
    } catch {
      support.setLocalSupportSession(t, 30);
    }
    await refreshAllow();
  };

  const endSupport = async () => {
    if (!auth.currentUser) return;
    if (DISABLE_FUNCTIONS || IS_DEV) {
      support.setLocalSupportSession(null);
      await refreshAllow();
      return;
    }
    try {
      const { callFn } = await import("../services/functionsClient");
      const fn = callFn<any, any>("endSupportSession");
      await fn({});
      await auth.currentUser.getIdToken(true);
    } catch {
    } finally {
      support.setLocalSupportSession(null);
    }
    await refreshAllow();
  };

  const value: AuthCtx = {
    user,
    loading,
    mfaEnrolled,
    mfaSatisfied,
    refreshMfaState,
    routeMfaPolicyEnabled,
    mfaRouteRequired,
    mfaRouteWouldBlock,
    claims,
    allow,
    effectiveAllow: allow,
    effectiveTenantId,
    effectiveRole,
    userProfile,
    profile: allow,
    isSuperAdmin,
    isPlatformOwner: platformOwner,
    isSuper,
    isAdmin,
    canSupport,
    supportTenantId: support.supportTenantId,
    supportUntil: support.supportUntil,
    startSupportForTenant,
    endSupport,
    refreshAllow: async () => refreshAllow(),
    logout,
    isSupportMode: support.isSupportMode,
    tenantId: effectiveTenantId,
    authzSnapshot,
    capabilities,
    can,
    primaryRoleLabel,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}



