import { MINISTRY_SCOPE, isSameDirectorate, normalizeText } from "../../../constants/directorates";
import type { SuperProgramTenantRow } from "../types";

export function safeTenantId(raw: string) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function filterProgramTenants(input: {
  tenants: SuperProgramTenantRow[];
  owner: boolean;
  canAccessSystem: boolean;
  userGovernorate?: string;
}) {
  const myGov = normalizeText(String(input.userGovernorate || ""));
  if (input.owner) return input.tenants;
  if (input.canAccessSystem && myGov && myGov !== normalizeText(MINISTRY_SCOPE)) {
    return input.tenants.filter((tenant) => isSameDirectorate(String(tenant.governorate || ""), myGov));
  }
  return [];
}

export function describeProgramAccess(input: { owner: boolean; primaryRoleLabel?: string | null }) {
  return input.owner
    ? "أنت تعمل الآن بصفة مالك المنصة بصلاحيات كاملة."
    : `صلاحيتك الحالية: ${input.primaryRoleLabel ?? "مشرف نطاق"}.`;
}
