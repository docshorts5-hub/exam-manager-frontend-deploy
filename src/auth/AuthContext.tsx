import React, { createContext, useContext, useEffect, useMemo } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { normalizeAllowlistRole } from "./auth-helpers";
import { SUPER_ADMIN_TENANT_ID, type AuthCtx, type Role } from "./types";
import { useSupportSession } from "./hooks/useSupportSession";
import { useAuthSessionState } from "./hooks/useAuthSessionState";
import { setAuditContext } from "../services/auditAuto";
import { buildAuthzSnapshot, canAccessCapability, capsFromRoles, isPlatformOwner, resolveEffectiveRoles, resolvePrimaryRoleLabel } from "../features/authz";

const DISABLE_FUNCTIONS = String(import.meta.env.VITE_DISABLE_FUNCTIONS ?? "true") === "true";
const IS_DEV = Boolean(import.meta.env.DEV);

const Ctx = createContext<AuthCtx | null>(null);

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useAuthSessionState();

  const { user, allow, userProfile, claims, loading, refreshAllow, setAllow, setUserProfile, setClaims } = session;

  const isSuperAdmin = useMemo(() => {
    const claimRole = String(claims?.role ?? "").toLowerCase();
    const claimSuper = claims?.enabled === true && (claimRole === "super_admin" || claims?.isOwner === true);
    const allowRole = String(allow?.role ?? "").toLowerCase();
    const allowSuper = allow?.enabled === true && allowRole === "super_admin";
    return claimSuper || allowSuper;
  }, [claims?.enabled, claims?.role, claims?.isOwner, allow?.enabled, allow?.role]);

  const isSuper = useMemo(() => {
    const email = String(user?.email ?? "").toLowerCase().trim();
    if (!allow?.enabled) return false;
    const roleNorm = normalizeAllowlistRole(allow?.role, email, (allow as any)?.governorate);
    return roleNorm === "super";
  }, [allow?.enabled, allow?.role, user?.email]);

  const isAdmin = useMemo(() => {
    const email = String(user?.email ?? "").toLowerCase().trim();
    if (!allow?.enabled) return false;
    const roleNorm = normalizeAllowlistRole(allow?.role, email, (allow as any)?.governorate);
    return roleNorm === "admin";
  }, [allow?.enabled, allow?.role, user?.email]);

  const support = useSupportSession({ claims, isSuperAdmin });

  const authzSnapshot = useMemo(() => buildAuthzSnapshot({
    user,
    profile: allow,
    userProfile,
    claims,
    isSuperAdmin,
    isSuper,
    tenantId: allow?.tenantId ?? claims?.tenantId ?? userProfile?.tenantId ?? null,
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
    const base = String(allow?.tenantId ?? claims?.tenantId ?? userProfile?.tenantId ?? "").trim();
    if (!base && !platformOwner) return null;
    if (platformOwner) {
      return support.isSupportMode && support.supportTenantId ? support.supportTenantId : SUPER_ADMIN_TENANT_ID;
    }
    return base || null;
  }, [allow?.tenantId, claims?.tenantId, userProfile?.tenantId, platformOwner, support.isSupportMode, support.supportTenantId]);

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

  const logout = async () => {
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
