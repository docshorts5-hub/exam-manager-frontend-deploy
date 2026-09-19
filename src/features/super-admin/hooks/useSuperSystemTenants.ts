
// src/hooks/useSuperSystemTenants.ts
import { useEffect, useMemo, useState } from "react";
import { MINISTRY_SCOPE, normalizeText, isSameDirectorate } from "../../../constants/directorates";
import type { SuperSystemTenant } from "../types";
import { subscribeSuperTenants } from "../services/superSystemService";

export function useSuperSystemTenants(params: { canSeeAllGovs: boolean; myGov: string }) {
  const [tenants, setTenants] = useState<SuperSystemTenant[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const normalizedMyGov = normalizeText(String(params.myGov || ""));

  const isTenantInScope = (tenant: SuperSystemTenant) => {
    const tenantGov = String(tenant.governorate || "").trim();
    if (params.canSeeAllGovs) {
      return true; // مالك المنصة يرى الجميع
    }
    return isSameDirectorate(tenantGov, normalizedMyGov); // سوبر المحافظات يرى فقط مدارس محافظته
  };

  useEffect(() => {
    return subscribeSuperTenants(
      (rows) => {
        setTenants(rows);
        setSelectedTenantId((current) => {
          if (current && rows.some((item) => item.id === current && isTenantInScope(item))) return current;
          const firstVisible = rows.find((t) => isTenantInScope(t));
          return firstVisible?.id ?? "";
        });
      },
      undefined,
      { canSeeAllGovs: params.canSeeAllGovs, myGov: params.myGov },
    );
  }, [params.canSeeAllGovs, params.myGov, normalizedMyGov]);

  const visibleTenants = useMemo(() => {
    const q = normalizeText(search);
    const base = tenants.filter((t) => isTenantInScope(t));
    if (!q) return base;
    return base.filter(
      (t) =>
        normalizeText(t.name || "").includes(q) ||
        normalizeText(t.id).includes(q) ||
        normalizeText(String(t.governorate || "")).includes(q)
    );
  }, [search, tenants, params.canSeeAllGovs, normalizedMyGov]);

  const selectedTenant = useMemo(
    () => visibleTenants.find((t) => t.id === selectedTenantId) || null,
    [visibleTenants, selectedTenantId],
  );

  return {
    tenants,
    setTenants,
    search,
    setSearch,
    selectedTenantId,
    setSelectedTenantId,
    visibleTenants,
    selectedTenant,
  };
}
