// src/auth/RequireRole.tsx
import React from "react";
import { Navigate } from "react-router-dom";
import { Role, useSession } from "./SessionContext";
import { buildAuthzSnapshot, canAccessCapability } from "../features/authz";
import type { Capability } from "../features/authz";

/**
 * ✅ Route guard based on RBAC + tenant isolation.
 * Note: This is additive. Wire it in routes when you're ready.
 */
export default function RequireRole({
  roles,
  capabilities,
  children,
  redirectTo = "/forbidden",
}: {
  roles?: Role[];
  capabilities?: Capability[];
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const session = useSession() as any;
  const { loading, user, isActive, tenantId, hasRole } = session;
  const snapshot = buildAuthzSnapshot({
    user,
    profile: session?.profile,
    tenantId,
    isSuperAdmin: hasRole("super_admin"),
    isSuper: hasRole("super" as Role),
  });

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isActive) return <Navigate to="/blocked" replace />;
  if (!tenantId && !hasRole("super_admin")) return <Navigate to="/no-tenant" replace />;

  const roleOk = !roles || roles.length === 0 || hasRole(...roles);
  const capabilityOk = !capabilities || capabilities.length === 0 || capabilities.every((cap) => canAccessCapability(snapshot, cap));
  if (!roleOk || !capabilityOk) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}
