// src/auth/ProtectedRoute.tsx
import React from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "./AuthContext";
import {
  canAccessCapability,
  canAccessTenantRoute,
  shouldForceOnboarding,
  buildAuthzSnapshot,
} from "../features/authz";

type Props = {
  children: React.ReactNode;
};

function buildSnapshot(auth: any) {
  return buildAuthzSnapshot({
    user: auth?.user,
    profile: auth?.profile || auth?.userProfile || null,
    isSuperAdmin: !!auth?.isSuperAdmin,
    isSuper: !!auth?.isSuper,
    tenantId: auth?.tenantId ?? auth?.profile?.tenantId ?? auth?.userProfile?.tenantId ?? null,
    supportTenantId: auth?.supportTenantId ?? null,
    supportUntil: typeof auth?.supportUntil === "number" ? auth.supportUntil : null,
    isSupportMode: !!auth?.isSupportMode,
  });
}

function isSystemEnabledProfile(auth: any) {
  const profile = auth?.profile || auth?.userProfile || null;
  return !!profile && profile.enabled === true;
}

function isPlatformOwnerRoute(snapshot: any) {
  return canAccessCapability(snapshot, "PLATFORM_OWNER");
}

function isMinistrySuperRoute(snapshot: any) {
  return Array.isArray(snapshot?.roles) && snapshot.roles.includes("ministry_super");
}

function isSystemAdminRoute(snapshot: any) {
  return canAccessCapability(snapshot, "SYSTEM_ADMIN");
}

function isExamSuperForTenant(auth: any, tenantId?: string | null) {
  const role = String(auth?.allow?.role || auth?.profile?.role || auth?.userProfile?.role || "").trim().toLowerCase();
  const linkedTenantId = String(auth?.allow?.tenantId || auth?.effectiveTenantId || auth?.profile?.tenantId || auth?.userProfile?.tenantId || "").trim();
  const enabled = auth?.allow?.enabled === true || auth?.profile?.enabled === true || auth?.userProfile?.enabled === true;
  if (!tenantId) return enabled && role === "exam_super";
  return enabled && role === "exam_super" && linkedTenantId === String(tenantId).trim();
}

export function ProtectedRoute({ children }: Props) {
  const auth = useAuth() as any;
  const location = useLocation();

  if (auth?.loading) return null;
  if (!auth?.user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!isSystemEnabledProfile(auth)) return <Navigate to="/login" replace />;

  const snapshot = buildSnapshot(auth);
  const isOnboardingPage = location.pathname === "/onboarding";

  if (!isOnboardingPage && shouldForceOnboarding(snapshot)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

/**
 * مسارات بوابة السوبر العليا:
 * - مالك المنصة
 * - سوبر الوزارة
 *
 * لا تسمح لسوبر المحافظات بدخول /super أو /system.
 */
export function SuperAdminRoute({ children }: Props) {
  const auth = useAuth() as any;

  if (auth?.loading) return null;
  if (!auth?.user) return <Navigate to="/login" replace />;
  if (!isSystemEnabledProfile(auth)) return <Navigate to="/login" replace />;

  const snapshot = buildSnapshot(auth);
  const allowed = isPlatformOwnerRoute(snapshot) || isMinistrySuperRoute(snapshot);

  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/**
 * دخول المدرسة:
 * - مالك المنصة وفق support mode/tenant route policy
 * - أدمن المدرسة فقط لمدرسته
 *
 * ويمنع:
 * - سوبر الوزارة
 * - سوبر المحافظات
 */
export function TenantRoute({ children }: Props) {
  const auth = useAuth() as any;
  const { tenantId } = useParams();
  const location = useLocation();

  if (auth?.loading) return null;
  if (!auth?.user) return <Navigate to="/login" replace />;
  if (!isSystemEnabledProfile(auth)) return <Navigate to="/login" replace />;
  if (!tenantId) return <Navigate to="/" replace />;

  const snapshot = buildSnapshot(auth);
  const requestedPath = String(location.pathname || "").toLowerCase();
  const currentRole = String(
    auth?.effectiveRole ||
    auth?.allow?.role ||
    auth?.profile?.role ||
    auth?.userProfile?.role ||
    ""
  ).trim().toLowerCase();

  const tenantRoot = `/t/${tenantId}`.toLowerCase();

  // سوبر المحافظة:
  // - إذا دخل مدرسة من صفحة المدارس يبقى داخل جميع صفحات نفس المدرسة
  // - وإذا دخل من صفحة سوبر الامتحانات فـ dashboard12 أيضًا ضمن نفس tenant path
  if (
    currentRole === "super" &&
    (requestedPath === tenantRoot ||
      requestedPath === `${tenantRoot}/` ||
      requestedPath.startsWith(`${tenantRoot}/`))
  ) {
    return <>{children}</>;
  }

  const access = canAccessTenantRoute(snapshot, tenantId);
  if (!access.allowed) return <Navigate to={access.redirectTo || "/"} replace />;

  return <>{children}</>;
}

/**
 * لوحة مالك المنصة فقط.
 */
export function SystemRoute({ children }: Props) {
  const auth = useAuth() as any;

  if (auth?.loading) return null;
  if (!auth?.user) return <Navigate to="/login" replace />;
  if (!isSystemEnabledProfile(auth)) return <Navigate to="/login" replace />;

  const snapshot = buildSnapshot(auth);
  if (!isPlatformOwnerRoute(snapshot)) return <Navigate to="/" replace />;

  return <>{children}</>;
}

/**
 * صفحة super-system:
 * - مالك المنصة
 * - سوبر الوزارة
 * - سوبر المحافظات
 */
export function SuperRoute({ children }: Props) {
  const auth = useAuth() as any;

  if (auth?.loading) return null;
  if (!auth?.user) return <Navigate to="/login" replace />;
  if (!isSystemEnabledProfile(auth)) return <Navigate to="/login" replace />;

  const snapshot = buildSnapshot(auth);
  if (!isSystemAdminRoute(snapshot)) return <Navigate to="/" replace />;

  return <>{children}</>;
}
