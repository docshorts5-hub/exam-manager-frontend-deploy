import type {
  InspectResponse,
  PublicFactor,
} from "./contracts";
import type {
  ResolvedAuthorizationContext,
} from "./authorizationContext";
import {
  getGoogleServiceAccountAccessToken,
  type GoogleOAuthFetch,
  type GoogleServiceAccountOAuthErrorCode,
} from "./googleServiceAccountOAuth";
import {
  lookupIdentityAdminUserByEmail,
  type IdentityAdminFetch,
  type IdentityAdminUserLookupErrorCode,
} from "./identityAdminUsers";

export type InspectAdminOperationStage =
  | "GOOGLE_OAUTH"
  | "IDENTITY_ADMIN_LOOKUP"
  | "INSPECT_MAPPING";

export type InspectAdminOperationErrorCode =
  | GoogleServiceAccountOAuthErrorCode
  | IdentityAdminUserLookupErrorCode
  | "INSPECT_CONFIG_INVALID"
  | "INSPECT_AUTHORIZATION_CONTEXT_INVALID"
  | "INSPECT_TARGET_EMAIL_MISMATCH"
  | "INSPECT_MAPPING_INVALID";

export type InspectAdminOperationInput = {
  oauthFetcher: GoogleOAuthFetch;
  identityAdminFetcher: IdentityAdminFetch;
  serviceAccountEmail: string;
  privateKeyPem: string;
  firebaseProjectId: string;
  authorization: ResolvedAuthorizationContext;
  nowSeconds?: number;
};

export type InspectAdminOperationResult =
  | {
      ok: true;
      value: InspectResponse;
    }
  | {
      ok: false;
      error: InspectAdminOperationErrorCode;
      status: number;
      stage: InspectAdminOperationStage;
      upstreamStatus?: number;
    };

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown): string {
  return text(value).toLowerCase();
}

function failure(
  error: InspectAdminOperationErrorCode,
  status: number,
  stage: InspectAdminOperationStage,
  upstreamStatus?: number,
): InspectAdminOperationResult {
  return {
    ok: false,
    error,
    status,
    stage,
    ...(upstreamStatus === undefined
      ? {}
      : { upstreamStatus }),
  };
}

function validAuthorization(
  authorization: ResolvedAuthorizationContext,
): boolean {
  const target = authorization.target;

  return (
    Boolean(authorization.actor) &&
    Boolean(target) &&
    Boolean(text(target.email)) &&
    Boolean(text(target.role)) &&
    Boolean(text(authorization.scope))
  );
}

function copyPublicFactors(
  factors: ReadonlyArray<{
    uid: string;
    factorId: string;
    displayName: string;
    enrollmentTime: string;
  }>,
): PublicFactor[] {
  return factors.map((factor) => ({
    uid: text(factor.uid),
    factorId: text(factor.factorId),
    displayName: text(factor.displayName),
    enrollmentTime: text(factor.enrollmentTime),
  }));
}

export async function inspectAdminOperation(
  input: InspectAdminOperationInput,
): Promise<InspectAdminOperationResult> {
  const serviceAccountEmail =
    normalizeEmail(input.serviceAccountEmail);

  const privateKeyPem =
    text(input.privateKeyPem);

  const firebaseProjectId =
    text(input.firebaseProjectId).toLowerCase();

  if (
    !serviceAccountEmail ||
    !privateKeyPem ||
    !firebaseProjectId
  ) {
    return failure(
      "INSPECT_CONFIG_INVALID",
      503,
      "GOOGLE_OAUTH",
    );
  }

  if (!validAuthorization(input.authorization)) {
    return failure(
      "INSPECT_AUTHORIZATION_CONTEXT_INVALID",
      500,
      "INSPECT_MAPPING",
    );
  }

  const authorizedTargetEmail =
    normalizeEmail(
      input.authorization.target.email,
    );

  if (!authorizedTargetEmail) {
    return failure(
      "INSPECT_AUTHORIZATION_CONTEXT_INVALID",
      500,
      "INSPECT_MAPPING",
    );
  }

  const oauthResult =
    await getGoogleServiceAccountAccessToken({
      fetcher: input.oauthFetcher,
      serviceAccountEmail,
      privateKeyPem,
      ...(input.nowSeconds === undefined
        ? {}
        : {
            nowSeconds:
              input.nowSeconds,
          }),
    });

  if (!oauthResult.ok) {
    return failure(
      oauthResult.error,
      oauthResult.status,
      "GOOGLE_OAUTH",
      oauthResult.upstreamStatus,
    );
  }

  const identityResult =
    await lookupIdentityAdminUserByEmail({
      fetcher: input.identityAdminFetcher,
      firebaseProjectId,
      accessToken:
        oauthResult.value.accessToken,
      email:
        authorizedTargetEmail,
    });

  if (!identityResult.ok) {
    return failure(
      identityResult.error,
      identityResult.status,
      "IDENTITY_ADMIN_LOOKUP",
      identityResult.upstreamStatus,
    );
  }

  const identityUser =
    identityResult.value;

  const returnedEmail =
    normalizeEmail(identityUser.email);

  if (
    !returnedEmail ||
    returnedEmail !== authorizedTargetEmail
  ) {
    return failure(
      "INSPECT_TARGET_EMAIL_MISMATCH",
      502,
      "INSPECT_MAPPING",
    );
  }

  const factors =
    copyPublicFactors(identityUser.factors);

  if (
    factors.some(
      (factor) =>
        !factor.uid ||
        !factor.factorId,
    )
  ) {
    return failure(
      "INSPECT_MAPPING_INVALID",
      502,
      "INSPECT_MAPPING",
    );
  }

  const totpFactorCount =
    factors.filter(
      (factor) =>
        factor.factorId
          .trim()
          .toLowerCase() === "totp",
    ).length;

  const factorCount =
    factors.length;

  const otherFactorCount =
    factorCount - totpFactorCount;

  const target =
    input.authorization.target;

  return {
    ok: true,
    value: {
      ok: true,
      target: {
        uid:
          text(identityUser.uid),
        email:
          returnedEmail,
        displayName:
          text(identityUser.displayName),
        disabled:
          identityUser.disabled === true,
        emailVerified:
          identityUser.emailVerified === true,
        providerIds:
          identityUser.providerIds.map(
            (providerId) => text(providerId),
          ),
        allowlistExists:
          target.allowlistExists,
        allowlistEnabled:
          target.allowlistEnabled,
        role:
          text(target.role),
        tenantId:
          text(target.tenantId),
        governorate:
          text(target.governorate),
        tenantKind:
          text(target.tenantKind),
        factors,
        factorCount,
        totpFactorCount,
        otherFactorCount,
        totpEnrolled:
          totpFactorCount > 0,
        scope:
          text(input.authorization.scope),
      },
    },
  };
}
