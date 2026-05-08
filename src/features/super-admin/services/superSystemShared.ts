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

  // سوبر الوزارة يشاهد جميع المدارس على مستوى الوزارة
  if (input.canAccessSystem && myGov === normalizeText(MINISTRY_SCOPE)) {
    return input.tenants;
  }

  // سوبر المحافظات يشاهد فقط مدارس محافظته
  if (input.canAccessSystem && myGov && myGov !== normalizeText(MINISTRY_SCOPE)) {
    return input.tenants.filter((tenant) =>
      isSameDirectorate(String(tenant.governorate || ""), myGov)
    );
  }

  return [];
}

export function describeProgramAccess(input: { owner: boolean; primaryRoleLabel?: string | null }) {
  if (input.owner) {
    return "أنت تعمل الآن بصفة مالك المنصة بصلاحيات كاملة.";
  }

  const label = String(input.primaryRoleLabel || "").trim();

  if (label === "سوبر الوزارة") {
    return "أنت تعمل الآن بصفة سوبر الوزارة بصلاحية مشاهدة على مستوى الوزارة.";
  }

  if (label === "سوبر المحافظات" || label === "مشرف نطاق") {
    return "أنت تعمل الآن بصفة سوبر المحافظات داخل نطاق محافظتك.";
  }

  return `صلاحيتك الحالية: ${label || "مستخدم"}.`;
}
