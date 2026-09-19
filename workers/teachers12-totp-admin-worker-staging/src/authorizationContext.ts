import type {
  FirebaseIdTokenClaims,
} from "./firebaseIdToken";

import {
  authorizeActorSession,
  normalizeAdminRole,
  normalizeEmail,
  normalizeGovernorate,
  normalizeTenantKind,
  resolveTargetScope,
  type AuthorizedActor,
  type PublicFactor,
  type TotpAdminScope,
  type TotpAuthorizationErrorCode,
} from "./authorizationPolicy";

import {
  readAllowlistByEmail,
  readTenantDocuments,
  type FirestoreActorReadErrorCode,
  type FirestoreFetch,
} from "./firestoreActorReads";

export type AuthorizationContextErrorCode =
  | TotpAuthorizationErrorCode
  | FirestoreActorReadErrorCode
  | "TARGET_EMAIL_REQUIRED"
  | "TARGET_TENANT_DOCUMENT_REQUIRED"
  | "TARGET_GOVERNORATE_REQUIRED"
  | "TARGET_TENANT_KIND_REQUIRED"
  | "TARGET_GOVERNORATE_CONFLICT"
  | "TARGET_TENANT_KIND_CONFLICT";

export type AuthorizationContextFailure = {
  ok: false;
  error: AuthorizationContextErrorCode;
  status: number;
};

export type ResolvedTargetAuthorization = {
  email: string;
  allowlistExists: boolean;
  allowlistEnabled: boolean;
  role: string;
  tenantId: string;
  governorate: string;
  tenantKind: string;
  tenantRootExists: boolean;
  tenantConfigExists: boolean;
};

export type ResolvedAuthorizationContext = {
  actor: AuthorizedActor;
  target: ResolvedTargetAuthorization;
  scope: TotpAdminScope;
};

export type ResolveAuthorizationContextInput = {
  fetcher: FirestoreFetch;
  projectId: string;
  actorIdToken: string;
  claims: FirebaseIdTokenClaims;
  actorEnrolledFactors: PublicFactor[];
  targetEmail: string;
  nowSeconds?: number;
};

export type ResolveAuthorizationContextResult =
  | {
      ok: true;
      value: ResolvedAuthorizationContext;
    }
  | AuthorizationContextFailure;

type ReconciledText =
  | {
      ok: true;
      value: string;
    }
  | {
      ok: false;
    };

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function failure(
  error: AuthorizationContextErrorCode,
  status = 0,
): AuthorizationContextFailure {
  return {
    ok: false,
    error,
    status,
  };
}

function reconcileValues(
  values: unknown[],
  normalize: (value: unknown) => string,
  returnNormalized: boolean,
): ReconciledText {
  const candidates = values
    .map((value) => {
      const raw = text(value);

      return {
        raw,
        normalized: normalize(raw),
      };
    })
    .filter(
      (candidate) =>
        candidate.raw &&
        candidate.normalized,
    );

  const normalizedValues = Array.from(
    new Set(
      candidates.map(
        (candidate) =>
          candidate.normalized,
      ),
    ),
  );

  if (normalizedValues.length > 1) {
    return {
      ok: false,
    };
  }

  if (normalizedValues.length < 1) {
    return {
      ok: true,
      value: "",
    };
  }

  const firstNormalizedValue =
    normalizedValues[0];

  const firstCandidate =
    candidates[0];

  if (
    !firstNormalizedValue ||
    !firstCandidate
  ) {
    return {
      ok: true,
      value: "",
    };
  }

  return {
    ok: true,
    value: returnNormalized
      ? firstNormalizedValue
      : firstCandidate.raw,
  };
}

export async function resolveAuthorizationContext(
  input: ResolveAuthorizationContextInput,
): Promise<ResolveAuthorizationContextResult> {
  const actorEmail =
    normalizeEmail(input.claims.email);

  const actorAllowlist =
    await readAllowlistByEmail(
      input.fetcher,
      input.projectId,
      input.actorIdToken,
      actorEmail,
    );

  if (!actorAllowlist.ok) {
    return failure(
      actorAllowlist.error,
      actorAllowlist.status,
    );
  }

  const actorResult =
    authorizeActorSession({
      uid: input.claims.uid,
      email: actorEmail,
      authTime: input.claims.authTime,
      signInSecondFactor:
        input.claims.signInSecondFactor,
      secondFactorIdentifier:
        input.claims.secondFactorIdentifier,
      allowlist: {
        exists:
          actorAllowlist.value.exists,
        enabled:
          actorAllowlist.value.enabled,
        role:
          actorAllowlist.value.role,
        governorate:
          actorAllowlist.value.governorate,
      },
      enrolledFactors:
        input.actorEnrolledFactors,
      nowSeconds:
        input.nowSeconds,
    });

  if (!actorResult.ok) {
    return failure(actorResult.error);
  }

  const targetEmail =
    normalizeEmail(input.targetEmail);

  if (!targetEmail) {
    return failure(
      "TARGET_EMAIL_REQUIRED",
    );
  }

  const targetAllowlist =
    await readAllowlistByEmail(
      input.fetcher,
      input.projectId,
      input.actorIdToken,
      targetEmail,
    );

  if (!targetAllowlist.ok) {
    return failure(
      targetAllowlist.error,
      targetAllowlist.status,
    );
  }

  const tenantId =
    text(targetAllowlist.value.tenantId);

  let tenantRootExists = false;
  let tenantConfigExists = false;
  let tenantRootGovernorate = "";
  let tenantConfigGovernorate = "";
  let tenantRootKind = "";
  let tenantConfigKind = "";

  if (tenantId) {
    const tenantDocuments =
      await readTenantDocuments(
        input.fetcher,
        input.projectId,
        input.actorIdToken,
        tenantId,
      );

    if (!tenantDocuments.ok) {
      return failure(
        tenantDocuments.error,
        tenantDocuments.status,
      );
    }

    tenantRootExists =
      tenantDocuments.value.root.exists;

    tenantConfigExists =
      tenantDocuments.value.config.exists;

    tenantRootGovernorate =
      tenantDocuments.value.root.governorate;

    tenantConfigGovernorate =
      tenantDocuments.value.config.governorate;

    tenantRootKind =
      tenantDocuments.value.root.tenantKind;

    tenantConfigKind =
      tenantDocuments.value.config.tenantKind;
  }

  const governorateResult =
    reconcileValues(
      [
        targetAllowlist.value.governorate,
        tenantRootGovernorate,
        tenantConfigGovernorate,
      ],
      normalizeGovernorate,
      false,
    );

  if (!governorateResult.ok) {
    return failure(
      "TARGET_GOVERNORATE_CONFLICT",
    );
  }

  const tenantKindResult =
    reconcileValues(
      [
        targetAllowlist.value.tenantKind,
        tenantRootKind,
        tenantConfigKind,
      ],
      normalizeTenantKind,
      true,
    );

  if (!tenantKindResult.ok) {
    return failure(
      "TARGET_TENANT_KIND_CONFLICT",
    );
  }

  const actor =
    actorResult.value;

  if (
    actor.isGovernorateSupervisor &&
    tenantId &&
    !tenantRootExists &&
    !tenantConfigExists
  ) {
    return failure(
      "TARGET_TENANT_DOCUMENT_REQUIRED",
    );
  }

  if (
    actor.isGovernorateSupervisor &&
    tenantId &&
    !governorateResult.value
  ) {
    return failure(
      "TARGET_GOVERNORATE_REQUIRED",
    );
  }

  if (
    actor.isGovernorateSupervisor &&
    tenantId &&
    !tenantKindResult.value
  ) {
    return failure(
      "TARGET_TENANT_KIND_REQUIRED",
    );
  }

  const normalizedRole =
    normalizeAdminRole(
      targetAllowlist.value.role,
    );

  const scopeResult =
    resolveTargetScope(
      actor,
      {
        email: targetEmail,
        allowlistExists:
          targetAllowlist.value.exists,
        role: normalizedRole,
        tenantId,
        governorate:
          governorateResult.value,
        tenantKind:
          tenantKindResult.value,
      },
    );

  if (!scopeResult.ok) {
    return failure(scopeResult.error);
  }

  return {
    ok: true,
    value: {
      actor,
      target: {
        email: targetEmail,
        allowlistExists:
          targetAllowlist.value.exists,
        allowlistEnabled:
          targetAllowlist.value.enabled,
        role: normalizedRole,
        tenantId,
        governorate:
          governorateResult.value,
        tenantKind:
          tenantKindResult.value,
        tenantRootExists,
        tenantConfigExists,
      },
      scope: scopeResult.value,
    },
  };
}
