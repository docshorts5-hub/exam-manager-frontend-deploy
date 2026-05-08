import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { getTenantIdFromHost } from "./getTenantIdFromHost";
import { useAuth } from "../auth/AuthContext";
import { initAutoArchiveCloudSync } from "../services/autoCloudSync";

export type TenantConfig = {
  tenantId: string;
  enabled?: boolean;
  deleted?: boolean;
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
      if (authLoading) {
        setState((s) => ({ ...s, loading: true, error: null }));
        return;
      }

      const tenantId = resolveTenantIdForApp({ authedUser, effectiveTenantId });

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
        const tenantRef = doc(db, "tenants", tenantId);
        const configRef = doc(db, "tenants", tenantId, "meta", "config");

        const [tenantSnap, configSnap] = await Promise.all([
          getDoc(tenantRef),
          getDoc(configRef),
        ]);

        if (!tenantSnap.exists()) {
          throw new Error(`Missing tenants/${tenantId}`);
        }

        if (!configSnap.exists()) {
          throw new Error(`Missing tenants/${tenantId}/meta/config`);
        }

        const tenantData = (tenantSnap.data() as any) || {};
        const configData = (configSnap.data() as any) || {};

        const tenantDeleted = tenantData?.deleted === true;
        const configDeleted = configData?.deleted === true;
        const tenantEnabled = tenantData?.enabled !== false;
        const configEnabled = configData?.enabled !== false;

        if (tenantDeleted || configDeleted) {
          throw new Error("TENANT_DELETED");
        }

        if (!tenantEnabled || !configEnabled) {
          throw new Error("TENANT_DISABLED");
        }

        if (cancelled) return;

        setState({
          tenantId,
          config: {
            tenantId,
            ...tenantData,
            ...configData,
            enabled: tenantEnabled && configEnabled,
            deleted: tenantDeleted || configDeleted,
          },
          loading: false,
          error: null,
        });
      } catch (e: any) {
        if (cancelled) return;

        const raw = String(e?.message || e || "").trim();
        const normalizedError =
          raw === "TENANT_DELETED"
            ? "هذه المدرسة محذوفة ولا يمكن الدخول إليها."
            : raw === "TENANT_DISABLED"
            ? "هذه المدرسة غير مفعلة حاليًا ولا يمكن الدخول إليها."
            : raw || "تعذر تحميل بيانات المدرسة.";

        setState({
          tenantId: null,
          config: null,
          loading: false,
          error: normalizedError,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, authedUser, effectiveTenantId]);

  useEffect(() => {
    if (!authedUser) return;
    const tid = String(state.tenantId || "").trim();
    if (!tid) return;

    const cleanup = initAutoArchiveCloudSync({
      tenantId: tid,
      enabled: true,
      intervalMs: 5 * 60 * 1000,
      maxUpsert: 200,
      maxFetch: 500,
    });

    return () => cleanup();
  }, [authedUser, state.tenantId]);

  const value = useMemo(() => state, [state]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}
