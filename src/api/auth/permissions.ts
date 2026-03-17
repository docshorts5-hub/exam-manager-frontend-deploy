import { useMemo } from "react";
import { useAuth } from "./AuthContext";
import { buildAuthzSnapshot, canAccessCapability, capsFromRoles, resolveEffectiveRoles } from "../features/authz";
import type { Capability, SaaSRole } from "../features/authz";

export type { SaaSRole, Capability };

export function canDo(roles: SaaSRole[] | undefined | null, cap: Capability): boolean {
  return capsFromRoles(roles).has(cap);
}

export function useCan() {
  const auth = useAuth() as any;
  const snapshot = useMemo(() => auth?.authzSnapshot || buildAuthzSnapshot(auth), [auth]);
  const roles = useMemo(() => resolveEffectiveRoles(snapshot), [snapshot]);
  const caps = useMemo(() => capsFromRoles(roles), [roles]);
  const can = (cap: Capability) => canAccessCapability(snapshot, cap);
  return { can, caps, roles, snapshot };
}
