import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { buildAuthzSnapshot, resolveHomePath } from "../features/authz";

export default function RootRedirect() {
  const auth = useAuth() as any;

  if (auth?.loading) return null;

  const role = String(
    auth?.effectiveRole ||
    auth?.allow?.role ||
    auth?.profile?.role ||
    auth?.userProfile?.role ||
    ""
  ).trim().toLowerCase();

  const tenantId = String(
    auth?.effectiveTenantId ||
    auth?.tenantId ||
    auth?.allow?.tenantId ||
    auth?.profile?.tenantId ||
    auth?.userProfile?.tenantId ||
    ""
  ).trim();

  if (role === "exam_super" && tenantId) {
    return <Navigate to={`/t/${tenantId}/dashboard12`} replace />;
  }

  const snapshot = buildAuthzSnapshot({
    user: auth?.user,
    profile: auth?.allow || auth?.profile || auth?.userProfile || null,
    isSuperAdmin: !!auth?.isSuperAdmin,
    isSuper: !!auth?.isSuper,
    tenantId: tenantId || null,
    supportTenantId: auth?.supportTenantId ?? null,
    supportUntil: typeof auth?.supportUntil === "number" ? auth.supportUntil : null,
    isSupportMode: !!auth?.isSupportMode,
  });

  return <Navigate to={resolveHomePath(snapshot)} replace />;
}
