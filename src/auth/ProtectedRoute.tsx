import OwnerOperationalReturnOverlay from "../pages/owner/components/OwnerOperationalReturnOverlay";
// src/auth/ProtectedRoute.tsx
import React from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "./AuthContext";
import PrivilegedAccessCodeGateRoute from "./PrivilegedAccessCodeGateRoute";
import {
  canAccessCapability,
  canAccessTenantRoute,
  isGovernorateReadOnlyTenantView,
  shouldForceOnboarding,
  buildAuthzSnapshot,
} from "../features/authz";

type Props = {
  children: React.ReactNode;
};

function readGovernorateValue(source: any): string {
  return String(
    source?.governorate ??
      source?.tenantGovernorate ??
      source?.regionAr ??
      source?.governorateAr ??
      source?.scopeGovernorate ??
      source?.gov ??
      ""
  ).trim();
}

function normalizeGovernorateScope(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\u0625\u0623\u0622\u0627]/g, "\u0627")
    .replace(/\u0649/g, "\u064a")
    .replace(/\u0629/g, "\u0647")
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/\u0627\u0644\u0645\u062f\u064a\u0631\u064a\u0647\s*\u0627\u0644\u0639\u0627\u0645\u0647\s*\u0644\u0644\u062a\u0631\u0628\u064a\u0647\s*\u0648\u0627\u0644\u062a\u0639\u0644\u064a\u0645\s*\u0628\u0645\u062d\u0627\u0641\u0638\u0647/g, "")
    .replace(/\u0627\u0644\u0645\u062f\u064a\u0631\u064a\u0647\s*\u0627\u0644\u0639\u0627\u0645\u0647\s*\u0644\u0644\u062a\u0639\u0644\u064a\u0645\s*\u0628\u0645\u062d\u0627\u0641\u0638\u0647/g, "")
    .replace(/\u0627\u0644\u0645\u062d\u0627\u0641\u0638\u0647/g, "")
    .replace(/\u0645\u062d\u0627\u0641\u0638\u0647/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function sameGovernorateScope(a: unknown, b: unknown): boolean {
  const aa = normalizeGovernorateScope(a);
  const bb = normalizeGovernorateScope(b);
  return Boolean(aa && bb && aa === bb);
}

async function loadTenantScopeFromServer(tenantId: string): Promise<{
  exists: boolean;
  governorate: string;
}> {
  const { doc, getDocFromServer } = await import("firebase/firestore");
  const { db } = await import("../firebase/firebase");

  const rootSnap = await getDocFromServer(
    doc(db, "tenants", tenantId)
  );

  if (!rootSnap.exists()) {
    return {
      exists: false,
      governorate: "",
    };
  }

  const rootGovernorate = readGovernorateValue(rootSnap.data());

  if (rootGovernorate) {
    return {
      exists: true,
      governorate: rootGovernorate,
    };
  }

  const configSnap = await getDocFromServer(
    doc(db, "tenants", tenantId, "meta", "config")
  );

  return {
    exists: true,
    governorate: configSnap.exists()
      ? readGovernorateValue(configSnap.data())
      : "",
  };
}

function TrustedReadOnlyTenantViewRoute({
  auth,
  snapshot,
  tenantId,
  children,
}: {
  auth: any;
  snapshot: any;
  tenantId: string;
  children: React.ReactNode;
}) {
  const [status, setStatus] = React.useState<
    "checking" | "allowed" | "denied"
  >("checking");

  const roles = Array.isArray(snapshot?.roles)
    ? snapshot.roles
    : [];

  const isMinistry = roles.includes("ministry_super");
  const isRegional = roles.includes("super");

  const trustedGovernorate = readGovernorateValue(
    auth?.allow || auth?.profile || null
  );

  React.useEffect(() => {
    let cancelled = false;

    setStatus("checking");

    async function verifyTrustedTenantScope() {
      try {
        if (!isMinistry && !isRegional) {
          if (!cancelled) setStatus("denied");
          return;
        }

        const tenantScope = await loadTenantScopeFromServer(
          tenantId
        );

        if (cancelled) return;

        if (!tenantScope.exists) {
          setStatus("denied");
          return;
        }

        if (isMinistry) {
          setStatus("allowed");
          return;
        }

        if (
          !trustedGovernorate ||
          !tenantScope.governorate
        ) {
          setStatus("denied");
          return;
        }

        setStatus(
          sameGovernorateScope(
            trustedGovernorate,
            tenantScope.governorate
          )
            ? "allowed"
            : "denied"
        );
      } catch {
        if (!cancelled) {
          setStatus("denied");
        }
      }
    }

    void verifyTrustedTenantScope();

    return () => {
      cancelled = true;
    };
  }, [
    isMinistry,
    isRegional,
    tenantId,
    trustedGovernorate,
  ]);

  if (status === "checking") return null;

  if (status !== "allowed") {
    return (
      <Navigate
        to="/super-system"
        replace
      />
    );
  }

  return <>{children}</>;
}

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

function AuthLoadingSurface() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="جاري التحقق من الجلسة الآمنة"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483646,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background:
          "radial-gradient(circle at 50% 16%, rgba(212, 175, 55, 0.18), transparent 34%), linear-gradient(180deg, #fffdf7 0%, #f4ecd8 100%)",
        color: "#624812",
        fontFamily: '"Cairo", system-ui, sans-serif',
      }}
    >
      <div
        style={{
          minWidth: "260px",
          maxWidth: "420px",
          padding: "22px 28px",
          border: "2px solid rgba(184, 141, 37, 0.58)",
          borderRadius: "22px",
          background: "rgba(255, 253, 247, 0.96)",
          boxShadow: "0 18px 48px rgba(79, 58, 14, 0.16)",
          textAlign: "center",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: "38px",
            height: "38px",
            margin: "0 auto 14px",
            border: "4px solid rgba(184, 141, 37, 0.24)",
            borderTopColor: "#b88d25",
            borderRadius: "50%",
          }}
        />
        <div
          style={{
            fontSize: "17px",
            fontWeight: 900,
            lineHeight: "1.8",
          }}
        >
          جاري التحقق من الجلسة الآمنة...
        </div>
      </div>
    </div>
  );
}
type PassiveMfaRouteConsumerSnapshot = {
  routeMfaPolicyEnabled: boolean;
  mfaRouteRequired: boolean;
  mfaRouteWouldBlock: boolean;
};

function readPassiveMfaRouteConsumer(
  auth: any
): PassiveMfaRouteConsumerSnapshot {
  const routeMfaPolicyEnabled = auth?.routeMfaPolicyEnabled === true;
  const mfaRouteRequired = auth?.mfaRouteRequired === true;
  const mfaRouteWouldBlock =
    routeMfaPolicyEnabled &&
    mfaRouteRequired &&
    auth?.mfaRouteWouldBlock === true;

  return {
    routeMfaPolicyEnabled,
    mfaRouteRequired,
    mfaRouteWouldBlock,
  };
}

type MfaRouteLoginState = {
  from: string;
  mfaReauthRequired: true;
};

function normalizeMfaReturnPath(value: unknown): string {
  const pathname = String(value ?? "").trim();

  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    return "/";
  }

  return pathname;
}

function buildMfaRouteLoginState(
  auth: any,
  pathname: unknown
): MfaRouteLoginState | null {
  const snapshot = readPassiveMfaRouteConsumer(auth);

  if (!snapshot.mfaRouteWouldBlock) {
    return null;
  }

  return {
    from: normalizeMfaReturnPath(pathname),
    mfaReauthRequired: true,
  };
}

export function ProtectedRoute({ children }: Props) {
  const auth = useAuth() as any;

  if (auth?.loading) return <AuthLoadingSurface />;
  if (!auth?.user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!isSystemEnabledProfile(auth)) return <Navigate to="/login" replace />;

  const mfaRouteLoginState = buildMfaRouteLoginState(
    auth,
    location.pathname
  );

  if (mfaRouteLoginState) {
    return <Navigate to="/login" replace state={mfaRouteLoginState} />;
  }

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
  const location = useLocation();

  if (auth?.loading) return <AuthLoadingSurface />;
  if (!auth?.user) return <Navigate to="/login" replace />;
  if (!isSystemEnabledProfile(auth)) return <Navigate to="/login" replace />;

  const mfaRouteLoginState = buildMfaRouteLoginState(
    auth,
    location.pathname
  );

  if (mfaRouteLoginState) {
    return <Navigate to="/login" replace state={mfaRouteLoginState} />;
  }

  const snapshot = buildSnapshot(auth);

  // STEP 43D-5G: allow governorate supervisor to open /super only.
  // This keeps /system and other platform owner routes restricted.
  const pathname = String(location?.pathname || "").trim();
  const decodedPathname = (() => {
    try {
      return decodeURIComponent(pathname);
    } catch {
      return pathname;
    }
  })();

  const isSuperPortalPath = pathname === "/super" || decodedPathname === "/سوبر المحافظة";
  // Platform-owner routes are owner-only.
  // Ministry and regional supervisors may use only the exact /super portal.
  const allowed =
    isPlatformOwnerRoute(snapshot) ||
    (isSuperPortalPath && isSystemAdminRoute(snapshot));

  if (!allowed) return <Navigate to="/" replace />;
  return (
    <>
      {/* OWNER_OPERATIONAL_RETURN_IN_SuperAdminRoute */}
      <OwnerOperationalReturnOverlay />
      {children}
    </>
  );
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

  if (auth?.loading) return <AuthLoadingSurface />;
  if (!auth?.user) return <Navigate to="/login" replace />;
  if (!isSystemEnabledProfile(auth)) return <Navigate to="/login" replace />;
  if (!tenantId) return <Navigate to="/" replace />;

  const mfaRouteLoginState = buildMfaRouteLoginState(
    auth,
    location.pathname
  );

  if (mfaRouteLoginState) {
    return <Navigate to="/login" replace state={mfaRouteLoginState} />;
  }

  const snapshot = buildSnapshot(auth);
  const roles = Array.isArray(snapshot.roles) ? snapshot.roles : [];

  const isMinistryReadOnlyViewer = roles.includes("ministry_super");
  const isRegionalReadOnlyViewer = roles.includes("super");

  const hasTrustedReadOnlyViewRequest =
    (isMinistryReadOnlyViewer || isRegionalReadOnlyViewer) &&
    isGovernorateReadOnlyTenantView(tenantId);

  if (
    hasTrustedReadOnlyViewRequest &&
    isMinistryReadOnlyViewer &&
    String(location.pathname || "").toLowerCase().endsWith("/change-phone")
  ) {
    return <Navigate to="/super" replace />;
  }

  if (hasTrustedReadOnlyViewRequest) {
    const trustedGovernorate = readGovernorateValue(
      auth?.allow || auth?.profile || null
    );

    return (
      <TrustedReadOnlyTenantViewRoute
        key={[
          tenantId,
          isMinistryReadOnlyViewer ? "ministry" : "regional",
          trustedGovernorate,
        ].join(":")}
        auth={auth}
        snapshot={snapshot}
        tenantId={tenantId}
      >
        {children}
      </TrustedReadOnlyTenantViewRoute>
    );
  }

  const access = canAccessTenantRoute(snapshot, tenantId);
  if (!access.allowed) return <Navigate to={access.redirectTo || "/"} replace />;

  if (
    String(location.pathname || "").toLowerCase().endsWith("/change-phone") &&
    Array.isArray(snapshot.roles) &&
    snapshot.roles.includes("ministry_super")
  ) {
    return <Navigate to="/super" replace />;
  }

  return <>{children}</>;
}

/**
 * لوحة مالك المنصة فقط.
 */
export function SystemRoute({ children }: Props) {
  const auth = useAuth() as any;
  const location = useLocation();

  if (auth?.loading) return <AuthLoadingSurface />;
  if (!auth?.user) return <Navigate to="/login" replace />;
  if (!isSystemEnabledProfile(auth)) return <Navigate to="/login" replace />;

  const mfaRouteLoginState = buildMfaRouteLoginState(
    auth,
    location.pathname
  );

  if (mfaRouteLoginState) {
    return <Navigate to="/login" replace state={mfaRouteLoginState} />;
  }

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
  const location = useLocation();

  if (auth?.loading) return <AuthLoadingSurface />;
  if (!auth?.user) return <Navigate to="/login" replace />;
  if (!isSystemEnabledProfile(auth)) return <Navigate to="/login" replace />;

  const mfaRouteLoginState = buildMfaRouteLoginState(
    auth,
    location.pathname
  );

  if (mfaRouteLoginState) {
    return <Navigate to="/login" replace state={mfaRouteLoginState} />;
  }

  const snapshot = buildSnapshot(auth);
  if (!isSystemAdminRoute(snapshot)) return <Navigate to="/" replace />;

  const requiresGovernorateSignedCode =
    auth?.isSuper === true &&
    !isPlatformOwnerRoute(snapshot) &&
    !isMinistrySuperRoute(snapshot);

  if (requiresGovernorateSignedCode) {
    return (
      <PrivilegedAccessCodeGateRoute
        page="GovernorateSuperSystem"
        tenantId="system"
      >
        {children}
      </PrivilegedAccessCodeGateRoute>
    );
  }

  return (
    <>
      {/* OWNER_OPERATIONAL_RETURN_IN_SuperRoute */}
      <OwnerOperationalReturnOverlay />
      {children}
    </>
  );
}
