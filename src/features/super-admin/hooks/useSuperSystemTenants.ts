import { useEffect, useMemo, useState } from "react";
import { normalizeText } from "../../../constants/directorates";
import type { SuperSystemTenant } from "../types";
import { subscribeSuperTenants } from "../services/superSystemService";

export function useSuperSystemTenants(params: { canSeeAllGovs: boolean; myGov: string }) {
  const [tenants, setTenants] = useState<SuperSystemTenant[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");

  useEffect(() => {
    return subscribeSuperTenants((rows) => {
      setTenants(rows);
      setSelectedTenantId((current) => {
        if (current && rows.some((item) => item.id === current)) return current;
        const firstVisible = rows.find((t) => params.canSeeAllGovs || String(t.governorate || "") === params.myGov);
        return firstVisible?.id ?? "";
      });
    });
  }, [params.canSeeAllGovs, params.myGov]);

  const visibleTenants = useMemo(() => {
    const q = normalizeText(search);
    const base = tenants.filter((t) => (params.canSeeAllGovs ? true : String(t.governorate || "") === params.myGov));
    if (!q) return base;
    return base.filter((t) => normalizeText(t.name || "").includes(q) || normalizeText(t.id).includes(q));
  }, [params.canSeeAllGovs, params.myGov, search, tenants]);

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
