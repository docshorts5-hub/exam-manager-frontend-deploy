import type { SuperProgramTenantRow } from "../types";
import { describeProgramAccess, filterProgramTenants } from "./superSystemShared";

export function buildProgramEnterState(input: {
  tenants: SuperProgramTenantRow[];
  owner: boolean;
  canAccessSystem: boolean;
  userGovernorate?: string;
  primaryRoleLabel?: string | null;
}) {
  const visibleTenants = filterProgramTenants({
    tenants: input.tenants,
    owner: input.owner,
    canAccessSystem: input.canAccessSystem,
    userGovernorate: input.userGovernorate,
  });

  return {
    visibleTenants,
    accessDescription: describeProgramAccess({
      owner: input.owner,
      primaryRoleLabel: input.primaryRoleLabel,
    }),
  };
}
