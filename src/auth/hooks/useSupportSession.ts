import { useMemo, useState } from "react";
import type { TokenClaims } from "../types";

export type LocalSupportState = {
  tenantId: string | null;
  until: number | null;
};

export function readLocalSupportState(): LocalSupportState {
  if (typeof window === "undefined") return { tenantId: null, until: null };
  try {
    const tenantId = localStorage.getItem("supportTenantId");
    const untilStr = localStorage.getItem("supportUntil");
    const until = untilStr ? Number(untilStr) : null;
    return {
      tenantId: tenantId ? tenantId : null,
      until: until && Number.isFinite(until) ? until : null,
    };
  } catch {
    return { tenantId: null, until: null };
  }
}

export function writeLocalSupportState(tenantId: string | null, minutes = 30): LocalSupportState {
  if (typeof window === "undefined") return { tenantId: null, until: null };
  try {
    if (!tenantId) {
      localStorage.removeItem("supportTenantId");
      localStorage.removeItem("supportUntil");
      return { tenantId: null, until: null };
    }
    const until = Date.now() + minutes * 60 * 1000;
    localStorage.setItem("supportTenantId", tenantId);
    localStorage.setItem("supportUntil", String(until));
    return { tenantId, until };
  } catch {
    return { tenantId: null, until: null };
  }
}

export function useSupportSession(params: { claims: TokenClaims | null; isSuperAdmin: boolean }) {
  const { claims, isSuperAdmin } = params;
  const [localSupport, setLocalSupport] = useState<LocalSupportState>(() => readLocalSupportState());

  const supportTenantId = useMemo(() => {
    const fromClaims = String(claims?.supportTenantId ?? "").trim();
    if (fromClaims) return fromClaims;
    const fromLocal = String(localSupport?.tenantId ?? "").trim();
    return fromLocal || null;
  }, [claims?.supportTenantId, localSupport?.tenantId]);

  const supportUntil = useMemo(() => {
    const v = claims?.supportUntil;
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n) && n > 0) return n;
    const ms = localSupport?.until;
    return typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? ms : null;
  }, [claims?.supportUntil, localSupport?.until]);

  const isSupportMode = useMemo(() => {
    if (!isSuperAdmin) return false;
    if (!supportTenantId) return false;
    if (!supportUntil) return true;
    return Date.now() < supportUntil;
  }, [isSuperAdmin, supportTenantId, supportUntil]);

  const setLocalSupportSession = (tenantId: string | null, minutes = 30) => {
    setLocalSupport(writeLocalSupportState(tenantId, minutes));
  };

  return {
    localSupport,
    supportTenantId,
    supportUntil,
    isSupportMode,
    setLocalSupportSession,
  };
}
