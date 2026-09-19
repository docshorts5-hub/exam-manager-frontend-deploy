export const PLATFORM_OWNER_EMAIL = "3asal2030@gmail.com";
export const MAX_ADMIN_SESSION_AGE_SECONDS = 30 * 60;

export type TotpAdminScope =
  | "platform_owner"
  | "ministry_governorate_supers"
  | "governorate_schools_diploma";

export type TotpAuthorizationErrorCode =
  | "AUTH_EMAIL_REQUIRED"
  | "USER_DISABLED_OR_NOT_ALLOWED"
  | "TOTP_RESET_ADMIN_ROLE_REQUIRED"
  | "SECOND_FACTOR_ADMIN_SESSION_REQUIRED"
  | "RECENT_MFA_SIGN_IN_REQUIRED"
  | "ACTOR_TOTP_ENROLLMENT_REQUIRED"
  | "TOTP_SESSION_FACTOR_COULD_NOT_BE_VERIFIED"
  | "MINISTRY_CAN_RESET_GOVERNORATE_SUPERS_ONLY"
  | "GOVERNORATE_SUPER_SELF_RESET_DENIED"
  | "TARGET_TENANT_LINK_REQUIRED"
  | "GOVERNORATE_CAN_RESET_SCHOOL_AND_DIPLOMA_ADMINS_ONLY"
  | "CROSS_GOVERNORATE_TOTP_RESET_DENIED";

export type PolicyResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: TotpAuthorizationErrorCode };

export type PublicFactor = {
  uid: string;
  factorId: string;
};

export type ActorAllowlistSnapshot = {
  exists: boolean;
  enabled: boolean;
  role: string;
  governorate: string;
};

export type ActorSessionInput = {
  uid: string;
  email: string;
  authTime: number;
  signInSecondFactor?: string;
  secondFactorIdentifier?: string;
  allowlist: ActorAllowlistSnapshot;
  enrolledFactors: PublicFactor[];
  nowSeconds?: number;
};

export type AuthorizedActor = {
  uid: string;
  email: string;
  role: string;
  governorate: string;
  isOwner: boolean;
  isGovernorateSupervisor: boolean;
};

export type TargetAuthorizationInput = {
  email: string;
  allowlistExists: boolean;
  role: string;
  tenantId: string;
  governorate: string;
  tenantKind: string;
};

export type AuditVisibilityInput = {
  targetRole: string;
  targetGovernorate: string;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeEmail(value: unknown): string {
  return text(value).toLowerCase();
}

export function normalizeAdminRole(value: unknown): string {
  const role = text(value)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (
    [
      "owner",
      "platform_owner",
      "superadmin",
      "super_admin",
    ].includes(role)
  ) {
    return "super_admin";
  }

  if (role === "ministry_super") {
    return "ministry_super";
  }

  if (
    [
      "super",
      "super_regional",
      "regional_super",
      "governorate_super",
      "super_governorate",
    ].includes(role)
  ) {
    return "super";
  }

  if (
    [
      "tenant_admin",
      "school_admin",
      "admin_school",
    ].includes(role)
  ) {
    return "tenant_admin";
  }

  if (role === "admin") {
    return "admin";
  }

  if (
    [
      "exam_super",
      "exam_center_admin",
      "diploma_center_admin",
      "diploma_super",
      "center_admin",
    ].includes(role)
  ) {
    return "exam_super";
  }

  return role || "user";
}

const ARABIC_TATWEEL = /\u0640/g;
const ARABIC_DIACRITICS =
  /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;

const FULL_DIRECTORATE_PREFIX =
  "\u0627\u0644\u0645\u062f\u064a\u0631\u064a\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0644\u0644\u062a\u0639\u0644\u064a\u0645 \u0628\u0645\u062d\u0627\u0641\u0638\u0629";

const GOVERNORATE_WORD =
  "\u0645\u062d\u0627\u0641\u0638\u0629";

const WITH_GOVERNORATE_WORD =
  "\u0628\u0645\u062d\u0627\u0641\u0638\u0629";

export function normalizeGovernorate(
  value: unknown,
): string {
  return text(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(ARABIC_TATWEEL, "")
    .replace(ARABIC_DIACRITICS, "")
    .replace(FULL_DIRECTORATE_PREFIX, "")
    .replace(WITH_GOVERNORATE_WORD, "")
    .replace(GOVERNORATE_WORD, "")
    .replace(/[|/\\,_\-\s]+/g, "")
    .trim();
}

export function normalizeTenantKind(
  value: unknown,
): string {
  const kind = text(value)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (
    [
      "school",
      "school_tenant",
    ].includes(kind)
  ) {
    return "school";
  }

  if (
    [
      "exam_center",
      "examcenter",
      "diploma_center",
    ].includes(kind)
  ) {
    return "exam_center";
  }

  return kind;
}

export function authorizeActorSession(
  input: ActorSessionInput,
): PolicyResult<AuthorizedActor> {
  const email = normalizeEmail(input.email);

  if (!email) {
    return {
      ok: false,
      error: "AUTH_EMAIL_REQUIRED",
    };
  }

  const isOwner =
    email === PLATFORM_OWNER_EMAIL;

  const role = isOwner
    ? "super_admin"
    : normalizeAdminRole(input.allowlist.role);

  const enabled =
    isOwner ||
    (
      input.allowlist.exists &&
      input.allowlist.enabled
    );

  if (!enabled) {
    return {
      ok: false,
      error: "USER_DISABLED_OR_NOT_ALLOWED",
    };
  }

  if (
    !isOwner &&
    role !== "ministry_super" &&
    role !== "super"
  ) {
    return {
      ok: false,
      error: "TOTP_RESET_ADMIN_ROLE_REQUIRED",
    };
  }

  const claimValues = [
    text(input.signInSecondFactor),
    text(input.secondFactorIdentifier),
  ].filter(Boolean);

  if (claimValues.length < 1) {
    return {
      ok: false,
      error: "SECOND_FACTOR_ADMIN_SESSION_REQUIRED",
    };
  }

  const authTime =
    Number(input.authTime || 0);

  const nowSeconds =
    Number.isFinite(input.nowSeconds)
      ? Number(input.nowSeconds)
      : Math.floor(Date.now() / 1000);

  if (
    !Number.isFinite(authTime) ||
    authTime <= 0 ||
    nowSeconds - authTime >
      MAX_ADMIN_SESSION_AGE_SECONDS
  ) {
    return {
      ok: false,
      error: "RECENT_MFA_SIGN_IN_REQUIRED",
    };
  }

  const totpFactors =
    input.enrolledFactors.filter(
      (factor) =>
        text(factor.factorId).toLowerCase() ===
        "totp",
    );

  if (totpFactors.length < 1) {
    return {
      ok: false,
      error: "ACTOR_TOTP_ENROLLMENT_REQUIRED",
    };
  }

  const matchedTotp =
    totpFactors.some(
      (factor) =>
        claimValues.includes(
          text(factor.uid),
        ) ||
        claimValues.includes(
          text(factor.factorId).toLowerCase(),
        ),
    );

  if (!matchedTotp) {
    return {
      ok: false,
      error:
        "TOTP_SESSION_FACTOR_COULD_NOT_BE_VERIFIED",
    };
  }

  return {
    ok: true,
    value: {
      uid: text(input.uid),
      email,
      role,
      governorate:
        text(input.allowlist.governorate),
      isOwner,
      isGovernorateSupervisor:
        role === "super",
    },
  };
}

export function resolveTargetScope(
  actor: AuthorizedActor,
  target: TargetAuthorizationInput,
): PolicyResult<TotpAdminScope> {
  const targetEmail =
    normalizeEmail(target.email);

  const targetRole =
    normalizeAdminRole(target.role);

  if (actor.isOwner) {
    return {
      ok: true,
      value: "platform_owner",
    };
  }

  if (actor.role === "ministry_super") {
    if (
      !target.allowlistExists ||
      targetRole !== "super"
    ) {
      return {
        ok: false,
        error:
          "MINISTRY_CAN_RESET_GOVERNORATE_SUPERS_ONLY",
      };
    }

    return {
      ok: true,
      value: "ministry_governorate_supers",
    };
  }

  if (actor.isGovernorateSupervisor) {
    if (actor.email === targetEmail) {
      return {
        ok: false,
        error:
          "GOVERNORATE_SUPER_SELF_RESET_DENIED",
      };
    }

    if (
      !target.allowlistExists ||
      !text(target.tenantId)
    ) {
      return {
        ok: false,
        error: "TARGET_TENANT_LINK_REQUIRED",
      };
    }

    const tenantKind =
      normalizeTenantKind(target.tenantKind);

    const schoolAdmin =
      (
        targetRole === "tenant_admin" ||
        targetRole === "admin"
      ) &&
      tenantKind === "school";

    const diplomaAdmin =
      targetRole === "exam_super" &&
      tenantKind === "exam_center";

    if (!schoolAdmin && !diplomaAdmin) {
      return {
        ok: false,
        error:
          "GOVERNORATE_CAN_RESET_SCHOOL_AND_DIPLOMA_ADMINS_ONLY",
      };
    }

    const actorGovernorate =
      normalizeGovernorate(actor.governorate);

    const targetGovernorate =
      normalizeGovernorate(
        target.governorate,
      );

    if (
      !actorGovernorate ||
      !targetGovernorate ||
      actorGovernorate !== targetGovernorate
    ) {
      return {
        ok: false,
        error:
          "CROSS_GOVERNORATE_TOTP_RESET_DENIED",
      };
    }

    return {
      ok: true,
      value:
        "governorate_schools_diploma",
    };
  }

  return {
    ok: false,
    error: "TOTP_RESET_ADMIN_ROLE_REQUIRED",
  };
}

export function canViewAuditEntry(
  actor: AuthorizedActor,
  entry: AuditVisibilityInput,
): boolean {
  if (actor.isOwner) {
    return true;
  }

  const targetRole =
    normalizeAdminRole(entry.targetRole);

  if (actor.role === "ministry_super") {
    return targetRole === "super";
  }

  if (actor.isGovernorateSupervisor) {
    const actorGovernorate =
      normalizeGovernorate(actor.governorate);

    const targetGovernorate =
      normalizeGovernorate(
        entry.targetGovernorate,
      );

    const sameGovernorate =
      Boolean(
        actorGovernorate &&
        targetGovernorate &&
        actorGovernorate ===
          targetGovernorate,
      );

    return (
      sameGovernorate &&
      [
        "tenant_admin",
        "admin",
        "exam_super",
      ].includes(targetRole)
    );
  }

  return false;
}