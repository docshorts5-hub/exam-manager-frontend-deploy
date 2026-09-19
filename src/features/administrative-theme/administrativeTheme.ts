import {
  isPlatformOwner,
  resolveEffectiveRoles,
} from "../authz";

/**
 * Visual identity only.
 *
 * SECURITY:
 * - This module MUST NOT grant or deny permissions.
 * - It MUST NOT be used as an authorization source.
 * - Authorization remains owned by Auth/Authz/route guards/Firestore rules.
 */
export type AdministrativeThemeKind =
  | "ministry"
  | "governorate"
  | "neutral";

export type AdministrativeThemeDescriptor = Readonly<{
  kind: AdministrativeThemeKind;
  rootClassName: string;
  roleLabel: string;
}>;

type AuthzSnapshotInput =
  Parameters<typeof resolveEffectiveRoles>[0];

const MINISTRY_THEME: AdministrativeThemeDescriptor =
  Object.freeze({
    kind: "ministry",
    rootClassName: "yr-admin-theme--ministry",
    roleLabel: "مشرف الوزارة",
  });

const GOVERNORATE_THEME: AdministrativeThemeDescriptor =
  Object.freeze({
    kind: "governorate",
    rootClassName: "yr-admin-theme--governorate",
    roleLabel: "مشرف المحافظة",
  });

const NEUTRAL_THEME: AdministrativeThemeDescriptor =
  Object.freeze({
    kind: "neutral",
    rootClassName: "yr-admin-theme--neutral",
    roleLabel: "",
  });

/**
 * Resolves visual identity from the already-authorized role snapshot.
 *
 * Important:
 * - Platform owner intentionally remains neutral here.
 * - Ministry role wins over governorate role if an inconsistent snapshot
 *   contains both roles. This is visual fail-safe behavior only.
 * - Unknown or incomplete state resolves to neutral; never guessed.
 */
export function resolveAdministrativeTheme(
  snapshot: AuthzSnapshotInput | null | undefined,
): AdministrativeThemeDescriptor {
  if (!snapshot) {
    return NEUTRAL_THEME;
  }

  if (isPlatformOwner(snapshot)) {
    return NEUTRAL_THEME;
  }

  const roles = resolveEffectiveRoles(snapshot);

  if (roles.includes("ministry_super")) {
    return MINISTRY_THEME;
  }

  if (roles.includes("super")) {
    return GOVERNORATE_THEME;
  }

  return NEUTRAL_THEME;
}

export const ADMINISTRATIVE_THEMES = Object.freeze({
  ministry: MINISTRY_THEME,
  governorate: GOVERNORATE_THEME,
  neutral: NEUTRAL_THEME,
});