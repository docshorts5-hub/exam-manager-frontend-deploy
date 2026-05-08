import React from "react";
import { useTenant } from "../tenant/TenantContext";
import { useArchiveItems } from "../features/archive/hooks/useArchiveItems";

export default function ArchiveCloudListener() {
  const { tenantId } = useTenant() as any;
  const { items } = useArchiveItems(String(tenantId || ""));
  const cloudOnly = items.filter((x) => x.__source === "cloud" || x.__source === "both");
  return (
    <div>
      <h2>Cloud Archive</h2>
      <div>عدد النسخ السحابية: {cloudOnly.length}</div>
    </div>
  );
}
