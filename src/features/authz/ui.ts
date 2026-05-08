import type { AuthzSnapshot } from "./types";
import { isPlatformOwner, resolveEffectiveRoles, resolvePrimaryRoleLabel } from "./policies";

export function resolveRoleBadgeStyle(
  snapshot: AuthzSnapshot
): { label: string; color: string; background: string; border: string } {
  if (isPlatformOwner(snapshot)) {
    return {
      label: "مالك المنصة",
      color: "#fbbf24",
      background: "rgba(251,191,36,0.16)",
      border: "1px solid rgba(251,191,36,0.32)",
    };
  }

  const roles = resolveEffectiveRoles(snapshot);

  if (roles.includes("ministry_super")) {
    return {
      label: "سوبر الوزارة",
      color: "#c4b5fd",
      background: "rgba(196,181,253,0.14)",
      border: "1px solid rgba(196,181,253,0.30)",
    };
  }

  if (roles.includes("super")) {
    return {
      label: "سوبر المحافظات",
      color: "#93c5fd",
      background: "rgba(147,197,253,0.12)",
      border: "1px solid rgba(147,197,253,0.28)",
    };
  }

  if (roles.includes("tenant_admin")) {
    return {
      label: "أدمن المدرسة",
      color: "#34d399",
      background: "rgba(52,211,153,0.12)",
      border: "1px solid rgba(52,211,153,0.28)",
    };
  }

  return {
    label: resolvePrimaryRoleLabel(snapshot),
    color: "#e5e7eb",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
  };
}
