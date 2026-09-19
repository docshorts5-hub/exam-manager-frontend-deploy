import type {
  PublicFactor,
} from "./authorizationPolicy";

export const IDENTITY_TOOLKIT_ORIGIN =
  "https://identitytoolkit.googleapis.com";

export const MAX_IDENTITY_LOOKUP_RESPONSE_BYTES =
  64 * 1024;

export const IDENTITY_LOOKUP_TIMEOUT_MS =
  8_000;

export type IdentityLookupFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type ActorMfaLookupErrorCode =
  | "INVALID_ACTOR_MFA_LOOKUP_INPUT"
  | "ACTOR_MFA_LOOKUP_AUTHORIZATION_DENIED"
  | "ACTOR_MFA_LOOKUP_RESPONSE_TOO_LARGE"
  | "ACTOR_MFA_LOOKUP_INVALID_RESPONSE"
  | "ACTOR_MFA_LOOKUP_UPSTREAM_UNAVAILABLE"
  | "ACTOR_MFA_LOOKUP_REQUEST_TIMEOUT"
  | "ACTOR_MFA_LOOKUP_REQUEST_FAILED";

export type ActorMfaLookupResult =
  | {
      ok: true;
      value: {
        uid: string;
        factors: PublicFactor[];
      };
    }
  | {
      ok: false;
      error: ActorMfaLookupErrorCode;
      status: number;
    };

type BoundedTextResult =
  | {
      ok: true;
      value: string;
    }
  | {
      ok: false;
      error: "ACTOR_MFA_LOOKUP_RESPONSE_TOO_LARGE";
      status: number;
    };

type UnknownRecord =
  Record<string, unknown>;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value),
  );
}

function validApiKey(
  value: string,
): boolean {
  return (
    value.length >= 20 &&
    value.length <= 256 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

function isAbortError(
  error: unknown,
): boolean {
  return (
    isRecord(error) &&
    text(error.name) === "AbortError"
  );
}

function lookupUrl(
  apiKey: string,
): URL {
  const url = new URL(
    `${IDENTITY_TOOLKIT_ORIGIN}/v1/accounts:lookup`,
  );

  url.searchParams.set("key", apiKey);

  return url;
}

async function boundedResponseText(
  response: Response,
): Promise<BoundedTextResult> {
  const contentLengthHeader =
    response.headers.get("content-length");

  if (contentLengthHeader) {
    const declaredLength =
      Number(contentLengthHeader);

    if (
      Number.isFinite(declaredLength) &&
      declaredLength >
        MAX_IDENTITY_LOOKUP_RESPONSE_BYTES
    ) {
      return {
        ok: false,
        error:
          "ACTOR_MFA_LOOKUP_RESPONSE_TOO_LARGE",
        status: response.status,
      };
    }
  }

  if (!response.body) {
    return {
      ok: true,
      value: "",
    };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const readResult = await reader.read();

      if (readResult.done) {
        break;
      }

      const chunk = readResult.value;

      if (!chunk) {
        continue;
      }

      totalBytes += chunk.byteLength;

      if (
        totalBytes >
        MAX_IDENTITY_LOOKUP_RESPONSE_BYTES
      ) {
        await reader.cancel();

        return {
          ok: false,
          error:
            "ACTOR_MFA_LOOKUP_RESPONSE_TOO_LARGE",
          status: response.status,
        };
      }

      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  const joined =
    new Uint8Array(totalBytes);

  let offset = 0;

  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    ok: true,
    value:
      new TextDecoder().decode(joined),
  };
}

function parsePublicFactors(
  rawMfaInfo: unknown,
): PublicFactor[] | null {
  if (rawMfaInfo === undefined) {
    return [];
  }

  if (!Array.isArray(rawMfaInfo)) {
    return null;
  }

  const factors: PublicFactor[] = [];
  const factorIds =
    new Set<string>();

  for (const rawFactor of rawMfaInfo) {
    if (!isRecord(rawFactor)) {
      return null;
    }

    const uid =
      text(rawFactor.mfaEnrollmentId);

    if (!uid || factorIds.has(uid)) {
      return null;
    }

    const detectedFactorIds: string[] = [];

    if (
      typeof rawFactor.phoneInfo ===
        "string" &&
      text(rawFactor.phoneInfo)
    ) {
      detectedFactorIds.push("phone");
    }

    if (isRecord(rawFactor.totpInfo)) {
      detectedFactorIds.push("totp");
    }

    if (isRecord(rawFactor.emailInfo)) {
      detectedFactorIds.push("email");
    }

    if (detectedFactorIds.length !== 1) {
      return null;
    }

    const factorId =
      detectedFactorIds[0];

    if (!factorId) {
      return null;
    }

    factorIds.add(uid);

    factors.push({
      uid,
      factorId,
    });
  }

  return factors;
}

export async function lookupActorMfaFactors(
  fetcher: IdentityLookupFetch,
  firebaseWebApiKey: string,
  actorIdToken: string,
): Promise<ActorMfaLookupResult> {
  const apiKey =
    text(firebaseWebApiKey);

  const idToken =
    text(actorIdToken);

  if (
    !validApiKey(apiKey) ||
    !idToken
  ) {
    return {
      ok: false,
      error:
        "INVALID_ACTOR_MFA_LOOKUP_INPUT",
      status: 0,
    };
  }

  const controller =
    new AbortController();

  const timeoutHandle =
    setTimeout(
      () => controller.abort(),
      IDENTITY_LOOKUP_TIMEOUT_MS,
    );

  try {
    const response = await fetcher(
      lookupUrl(apiKey),
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type":
            "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({
          idToken,
        }),
        redirect: "error",
        signal: controller.signal,
      },
    );

    const bodyResult =
      await boundedResponseText(response);

    if (!bodyResult.ok) {
      return bodyResult;
    }

    if (
      response.status === 400 ||
      response.status === 401 ||
      response.status === 403
    ) {
      return {
        ok: false,
        error:
          "ACTOR_MFA_LOOKUP_AUTHORIZATION_DENIED",
        status: response.status,
      };
    }

    if (
      response.status === 429 ||
      response.status >= 500
    ) {
      return {
        ok: false,
        error:
          "ACTOR_MFA_LOOKUP_UPSTREAM_UNAVAILABLE",
        status: response.status,
      };
    }

    if (response.status !== 200) {
      return {
        ok: false,
        error:
          "ACTOR_MFA_LOOKUP_INVALID_RESPONSE",
        status: response.status,
      };
    }

    let parsed: unknown;

    try {
      parsed =
        JSON.parse(bodyResult.value);
    } catch {
      return {
        ok: false,
        error:
          "ACTOR_MFA_LOOKUP_INVALID_RESPONSE",
        status: response.status,
      };
    }

    if (!isRecord(parsed)) {
      return {
        ok: false,
        error:
          "ACTOR_MFA_LOOKUP_INVALID_RESPONSE",
        status: response.status,
      };
    }

    const users = parsed.users;

    if (
      !Array.isArray(users) ||
      users.length !== 1
    ) {
      return {
        ok: false,
        error:
          "ACTOR_MFA_LOOKUP_INVALID_RESPONSE",
        status: response.status,
      };
    }

    const user = users[0];

    if (!isRecord(user)) {
      return {
        ok: false,
        error:
          "ACTOR_MFA_LOOKUP_INVALID_RESPONSE",
        status: response.status,
      };
    }

    const uid = text(user.localId);

    const factors =
      parsePublicFactors(user.mfaInfo);

    if (!uid || !factors) {
      return {
        ok: false,
        error:
          "ACTOR_MFA_LOOKUP_INVALID_RESPONSE",
        status: response.status,
      };
    }

    return {
      ok: true,
      value: {
        uid,
        factors,
      },
    };
  } catch (error) {
    if (isAbortError(error)) {
      return {
        ok: false,
        error:
          "ACTOR_MFA_LOOKUP_REQUEST_TIMEOUT",
        status: 0,
      };
    }

    return {
      ok: false,
      error:
        "ACTOR_MFA_LOOKUP_REQUEST_FAILED",
      status: 0,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}
