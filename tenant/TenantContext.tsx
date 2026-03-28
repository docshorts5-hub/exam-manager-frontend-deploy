import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { getTenantIdFromHost } from "./getTenantIdFromHost";
import { useAuth } from "../auth/AuthContext";
import { initAutoArchiveCloudSync } from "../services/autoCloudSync";

export type TenantConfig = {
  tenantId: string;
  enabled?: boolean;
  schoolName?: string;
  authority?: string;
  academicYear?: string;
  term?: string;
  phone?: string;
  logoUrl?: string;
} & Record<string, any>;

type TenantState = {
  tenantId: string | null;
  config: TenantConfig | null;
  loading: boolean;
  error: string | null;
};

const TenantContext = createContext<TenantState>({
  tenantId: null,
  config: null,
  loading: true,
  error: null,
});

export function useTenant() {
  return useContext(TenantContext);
}

function resolveTenantIdForApp(opts: {
  authedUser: any;
  effectiveTenantId?: string;
}): string {
  const envTenant = ((import.meta as any).env?.VITE_TENANT_ID as string | undefined) || "";
  const fromHost = getTenantIdFromHost();

  // If signed in, always prefer the tenant that comes from allowlist/profile.
  // This fixes the common local-dev case where VITE_TENANT_ID is set to a different tenant.
  const fromProfile = (opts.authedUser ? String(opts.effectiveTenantId || "") : "").trim();

  return (
    fromProfile ||
    String(envTenant).trim() ||
    (fromHost.ok ? String(fromHost.tenantId).trim() : "")
  );
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth() as any;
  const authLoading: boolean = !!auth?.loading;
  const authedUser = auth?.user;
  const effectiveTenantId: string | undefined = auth?.effectiveTenantId;

  const [state, setState] = useState<TenantState>({
    tenantId: null,
    config: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // While auth is still initializing, don't call Firestore.
      if (authLoading) {
        setState((s) => ({ ...s, loading: true, error: null }));
        return;
      }

      const tenantId = resolveTenantIdForApp({ authedUser, effectiveTenantId });

      // Not signed in yet: don't call Firestore (rules will block). Just keep tenantId for UI hints.
      if (!authedUser) {
        setState({ tenantId: tenantId || null, config: null, loading: false, error: null });
        return;
      }

      if (!tenantId) {
        setState({ tenantId: null, config: null, loading: false, error: "No tenantId resolved." });
        return;
      }

      setState((s) => ({ ...s, loading: true, error: null }));

      try {
        const configRef = doc(db, `tenants/${tenantId}/meta/config`);
        const configSnap = await getDoc(configRef);

        if (!configSnap.exists()) {
          throw new Error(`Missing tenants/${tenantId}/meta/config`);
        }

        if (cancelled) return;
        setState({
          tenantId,
          config: { tenantId, ...(configSnap.data() as any) },
          loading: false,
          error: null,
        });
      } catch (e: any) {
        if (cancelled) return;
        setState({
          tenantId: null,
          config: null,
          loading: false,
          error: e?.message || String(e),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, authedUser, effectiveTenantId]);

  // ✅ Auto cloud sync (Archive) for every signed-in user
  useEffect(() => {
    if (!authedUser) return;
    const tid = String(state.tenantId || "").trim();
    if (!tid) return;

    const cleanup = initAutoArchiveCloudSync({
      tenantId: tid,
      enabled: true,
      intervalMs: 5 * 60 * 1000, // 5 minutes
      maxUpsert: 200,
      maxFetch: 500,
    });

    return () => cleanup();
  }, [authedUser, state.tenantId]);

  const value = useMemo(() => state, [state]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}
