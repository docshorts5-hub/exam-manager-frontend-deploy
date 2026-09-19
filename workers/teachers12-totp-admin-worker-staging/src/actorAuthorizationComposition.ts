import type {
  FirebaseIdTokenClaims,
} from "./firebaseIdToken";
import type {
  FirestoreFetch,
} from "./firestoreActorReads";
import {
  lookupActorMfaFactors,
  type ActorMfaLookupErrorCode,
  type IdentityLookupFetch,
} from "./identityActorFactors";
import {
  resolveAuthorizationContext,
  type AuthorizationContextErrorCode,
  type ResolvedAuthorizationContext,
} from "./authorizationContext";

export type ActorAuthorizationCompositionStage =
  | "ACTOR_MFA_LOOKUP"
  | "AUTHORIZATION_CONTEXT";

export type ActorAuthorizationCompositionErrorCode =
  | ActorMfaLookupErrorCode
  | AuthorizationContextErrorCode
  | "ACTOR_IDENTITY_UID_MISMATCH";

export type ComposeActorAuthorizationInput = {
  identityFetcher: IdentityLookupFetch;
  firestoreFetcher: FirestoreFetch;
  firebaseWebApiKey: string;
  projectId: string;
  actorIdToken: string;
  claims: FirebaseIdTokenClaims;
  targetEmail: string;
  nowSeconds?: number;
};

export type ComposeActorAuthorizationResult =
  | {
      ok: true;
      value: ResolvedAuthorizationContext;
    }
  | {
      ok: false;
      error: ActorAuthorizationCompositionErrorCode;
      status: number;
      stage: ActorAuthorizationCompositionStage;
    };

function failure(
  error: ActorAuthorizationCompositionErrorCode,
  status: number,
  stage: ActorAuthorizationCompositionStage,
): ComposeActorAuthorizationResult {
  return {
    ok: false,
    error,
    status,
    stage,
  };
}

export async function composeActorAuthorization(
  input: ComposeActorAuthorizationInput,
): Promise<ComposeActorAuthorizationResult> {
  const factorLookup =
    await lookupActorMfaFactors(
      input.identityFetcher,
      input.firebaseWebApiKey,
      input.actorIdToken,
    );

  if (!factorLookup.ok) {
    return failure(
      factorLookup.error,
      factorLookup.status,
      "ACTOR_MFA_LOOKUP",
    );
  }

  const verifiedUid =
    input.claims.uid.trim();

  const identityUid =
    factorLookup.value.uid.trim();

  if (
    !verifiedUid ||
    !identityUid ||
    identityUid !== verifiedUid
  ) {
    return failure(
      "ACTOR_IDENTITY_UID_MISMATCH",
      403,
      "ACTOR_MFA_LOOKUP",
    );
  }

  const authorizationContext =
    await resolveAuthorizationContext({
      fetcher:
        input.firestoreFetcher,
      projectId:
        input.projectId,
      actorIdToken:
        input.actorIdToken,
      claims:
        input.claims,
      actorEnrolledFactors:
        factorLookup.value.factors,
      targetEmail:
        input.targetEmail,
      ...(input.nowSeconds === undefined
        ? {}
        : {
            nowSeconds:
              input.nowSeconds,
          }),
    });

  if (!authorizationContext.ok) {
    return failure(
      authorizationContext.error,
      authorizationContext.status,
      "AUTHORIZATION_CONTEXT",
    );
  }

  return {
    ok: true,
    value:
      authorizationContext.value,
  };
}
