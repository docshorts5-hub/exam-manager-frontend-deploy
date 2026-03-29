import type { AuthzSnapshot } from "./types";
import { isPlatformOwner, resolvePrimaryRoleLabel } from "./policies";

export function resolveRoleBadgeStyle(snapshot: AuthzSnapshot): { label: string; color: string; background: string; border: string } {
  if (isPlatformOwner(snapshot)) {
    return {
      label: "مالك المنصة",
      color: "#fbbf24",
      background: "rgba(251,191,36,0.16)",
      border: "1px solid rgba(251,191,36,0.32)",
    };
  }
  if (snapshot.isSuper) {
    return {
      label: "مشرف نطاق",
      color: "#93c5fd",
      background: "rgba(147,197,253,0.12)",
      border: "1px solid rgba(147,197,253,0.28)",
    };
  }
  return {
    label: resolvePrimaryRoleLabel(snapshot),
    color: "#e5e7eb",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
  };
}
