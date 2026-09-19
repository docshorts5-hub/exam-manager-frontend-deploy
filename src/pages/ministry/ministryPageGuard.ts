import { MINISTRY_SCOPE } from "../../constants/directorates";

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function lower(value: unknown): string {
  return text(value).toLowerCase();
}

function sourcesFromAuth(auth: any): any[] {
  return [
    auth,
    auth?.allow,
    auth?.profile,
    auth?.userProfile,
    auth?.authzSnapshot,
    auth?.snapshot,
    auth?.claims,
    auth?.userClaims,
    auth?.tokenClaims,
    auth?.session,
    auth?.sessionState,
    auth?.permissions,
  ].filter(Boolean);
}

function collectRoleValues(source: any): string[] {
  const values: string[] = [];

  [
    source?.role,
    source?.primaryRole,
    source?.effectiveRole,
    source?.viewAsRole,
    source?.customRole,
    source?.roleId,
    source?.roleName,
    source?.primaryRoleLabel,
    source?.roleLabel,
    source?.currentRoleLabel,
    source?.displayRole,
    source?.label,
    source?.roleAr,
    source?.roleArabic,
    source?.accountType,
    source?.roleScope,
    source?.legacyRole,
  ].forEach((value) => {
    const v = lower(value);
    if (v) values.push(v);
  });

  [
    source?.roles,
    source?.explicitRoles,
    source?.roleList,
    source?.claims?.roles,
    source?.claims?.role,
    source?.permissions?.roles,
  ].forEach((value) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        const v = lower(item);
        if (v) values.push(v);
      });
    } else {
      const v = lower(value);
      if (v) values.push(v);
    }
  });

  return values;
}

export function isMinistrySuperViewer(auth: any): boolean {
  if (!auth) return false;

  if (
    auth?.isMinistrySuper === true ||
    auth?.isMinistryViewer === true ||
    auth?.ministrySuper === true
  ) {
    return true;
  }

  const sources = sourcesFromAuth(auth);
  const roleText = sources.flatMap(collectRoleValues).join(" ");

  const ministrySupervisorArabic = "\u0645\u0634\u0631\u0641 \u0627\u0644\u0648\u0632\u0627\u0631\u0629";
  const ministrySuperArabic = "\u0633\u0648\u0628\u0631 \u0627\u0644\u0648\u0632\u0627\u0631\u0629";

  if (
    roleText.includes("ministry_super") ||
    roleText.includes("ministry-super") ||
    roleText.includes("ministry super") ||
    roleText.includes(ministrySupervisorArabic) ||
    roleText.includes(ministrySuperArabic)
  ) {
    return true;
  }

  const governorates = sources.map((source) =>
    text(
      source?.governorate ??
        source?.scope ??
        source?.viewAsScope ??
        source?.effectiveScope ??
        source?.tenantGovernorate ??
        source?.roleScope ??
        ""
    )
  );

  return governorates.some((value) => value === MINISTRY_SCOPE);
}
