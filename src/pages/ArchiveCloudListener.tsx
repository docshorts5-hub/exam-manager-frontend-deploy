import React from "react";
import { useParams } from "react-router-dom";
import { useTenant } from "../tenant/TenantContext";
import { useArchiveItems } from "../features/archive/hooks/useArchiveItems";

export default function ArchiveCloudListener() {
  const { tenantId } = useTenant() as any;
  const routeParams = useParams() as any;
  const routeTenantId = String(
    routeParams?.tenantId || routeParams?.tenant || routeParams?.id || routeParams?.schoolId || routeParams?.centerId || ""
  ).trim();
  const effectiveTenantId = String(routeTenantId || tenantId || "").trim();
  const { items } = useArchiveItems(effectiveTenantId);
  const cloudOnly = items.filter((x) => x.__source === "cloud" || x.__source === "both");
  return (
    <div>
      <h2>Cloud Archive</h2>
      <div>عدد النسخ السحابية: {cloudOnly.length}</div>
    </div>
  );
}
