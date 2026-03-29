// src/auth/ProtectedRoute.tsx
import React from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { canAccessCapability, canAccessTenantRoute, shouldForceOnboarding } from "../features/authz";

type Props = {
  children: React.ReactNode;
};

function buildSnapshot(auth: any) {
  const profile = auth?.profile || auth?.userProfile || null;
  return {
    isAuthenticated: !!auth?.user,
    isEnabled: profile?.enabled === true,
    isSuperAdmin: !!auth?.isSuperAdmin,
    isSuper: !!auth?.isSuper,
    tenantId: auth?.tenantId ?? profile?.tenantId ?? null,
    roles: profile?.roles || [],
    supportTenantId: auth?.supportTenantId ?? null,
    supportUntil: typeof auth?.supportUntil === "number" ? auth.supportUntil : null,
    isSupportMode: !!auth?.isSupportMode,
    displayName: profile?.userName ?? profile?.name ?? auth?.user?.displayName ?? null,
  };
}

export function ProtectedRoute({ children }: Props) {
  const auth = useAuth() as any;
  const location = useLocation();
  const profile = auth?.profile || auth?.userProfile || null;

  if (auth?.loading) return null;
  if (!auth?.user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!profile || profile.enabled !== true) return <Navigate to="/login" replace />;

  const isOnboardingPage = location.pathname === "/onboarding";
  if (!isOnboardingPage && shouldForceOnboarding(buildSnapshot(auth))) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

export function SuperAdminRoute({ children }: Props) {
  const auth = useAuth() as any;
  const profile = auth?.profile || auth?.userProfile || null;

  if (auth?.loading) return null;
  if (!auth?.user) return <Navigate to="/login" replace />;
  if (!profile || profile.enabled !== true) return <Navigate to="/login" replace />;
  if (!canAccessCapability(buildSnapshot(auth), "SYSTEM_ADMIN")) return <Navigate to="/" replace />;

  return <>{children}</>;
}

export function TenantRoute({ children }: Props) {
  const auth = useAuth() as any;
  const profile = auth?.profile || auth?.userProfile || null;
  const { tenantId } = useParams();

  if (auth?.loading) return null;
  if (!auth?.user) return <Navigate to="/login" replace />;
  if (!profile || profile.enabled !== true) return <Navigate to="/login" replace />;
  if (!tenantId) return <Navigate to="/" replace />;

  const access = canAccessTenantRoute(buildSnapshot(auth), tenantId);
  if (!access.allowed) return <Navigate to={access.redirectTo || "/"} replace />;

  return <>{children}</>;
}

export function SystemRoute({ children }: Props) {
  const auth = useAuth() as any;
  const profile = auth?.profile || auth?.userProfile || null;

  if (auth?.loading) return null;
  if (!auth?.user) return <Navigate to="/login" replace />;
  if (!profile || profile.enabled !== true) return <Navigate to="/login" replace />;
  if (!canAccessCapability(buildSnapshot(auth), "SYSTEM_ADMIN")) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function SuperRoute({ children }: Props) {
  const auth = useAuth() as any;
  const profile = auth?.profile || auth?.userProfile || null;

  if (auth?.loading) return null;
  if (!auth?.user) return <Navigate to="/login" replace />;
  if (!profile || profile.enabled !== true) return <Navigate to="/login" replace />;
  if (!canAccessCapability(buildSnapshot(auth), "SYSTEM_ADMIN")) return <Navigate to="/" replace />;
  return <>{children}</>;
}
