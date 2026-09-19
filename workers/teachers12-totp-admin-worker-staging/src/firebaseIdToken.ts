const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

const MAX_CLOCK_SKEW_SECONDS = 300;
const MAX_TOKEN_LENGTH = 16_384;
const MAX_SUBJECT_LENGTH = 128;
const DEFAULT_CACHE_SECONDS = 300;
const MAX_CACHE_SECONDS = 3_600;

type JsonRecord =
  Record<string, unknown>;

interface JwksCache {
  expiresAt: number;
  keys: Map<string, JsonWebKey>;
}

let jwksCache: JwksCache | null = null;

export interface FirebaseIdTokenClaims {
  uid: string;
  email: string;
  emailVerified: boolean;
  issuedAt: number;
  expiresAt: number;
  authTime: number;
  signInProvider: string;
  signInSecondFactor: string;
  secondFactorIdentifier: string;
}

export type FirebaseIdTokenVerificationResult =
  | {
      ok: true;
      claims: FirebaseIdTokenClaims;
    }
  | {
      ok: false;
      error: string;
    };

function isRecord(
  value: unknown,
): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function optionalString(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function numericClaim(
  value: unknown,
): number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : 0;
}

function base64UrlToBytes(
  value: string,
): Uint8Array {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padding =
    "=".repeat(
      (4 - (normalized.length % 4)) % 4,
    );

  const binary = atob(
    normalized + padding,
  );

  const bytes =
    new Uint8Array(binary.length);

  for (
    let index = 0;
    index < binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(index);
  }

  return bytes;
}

function decodeJwtJson(
  value: string,
): JsonRecord | null {
  try {
    const bytes =
      base64UrlToBytes(value);

    const decoded =
      new TextDecoder(
        "utf-8",
        {
          fatal: true,
          ignoreBOM: false,
        },
      ).decode(bytes);

    const parsed: unknown =
      JSON.parse(decoded);

    return isRecord(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function toArrayBuffer(
  bytes: Uint8Array,
): ArrayBuffer {
  const copy =
    new Uint8Array(bytes.byteLength);

  copy.set(bytes);

  return copy.buffer;
}

function responseCacheSeconds(
  response: Response,
): number {
  const cacheControl = String(
    response.headers.get(
      "cache-control",
    ) || "",
  );

  const match = cacheControl.match(
    /(?:^|,)\s*max-age=(\d+)/i,
  );

  const rawValue =
    match?.[1];

  const parsed = rawValue
    ? Number(rawValue)
    : DEFAULT_CACHE_SECONDS;

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    return DEFAULT_CACHE_SECONDS;
  }

  return Math.min(
    Math.max(parsed, 60),
    MAX_CACHE_SECONDS,
  );
}

async function refreshJwks(): Promise<
  | {
      ok: true;
      cache: JwksCache;
    }
  | {
      ok: false;
      error: string;
    }
> {
  let response: Response;

  try {
    response = await fetch(
      FIREBASE_JWKS_URL,
      {
        method: "GET",
        headers: {
          accept: "application/json",
        },
      },
    );
  } catch {
    return {
      ok: false,
      error:
        "FIREBASE_JWKS_FETCH_FAILED",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error:
        "FIREBASE_JWKS_FETCH_FAILED",
    };
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return {
      ok: false,
      error:
        "FIREBASE_JWKS_INVALID_RESPONSE",
    };
  }

  if (
    !isRecord(payload) ||
    !Array.isArray(payload.keys)
  ) {
    return {
      ok: false,
      error:
        "FIREBASE_JWKS_INVALID_RESPONSE",
    };
  }

  const keys =
    new Map<string, JsonWebKey>();

  for (const candidate of payload.keys) {
    if (
      isRecord(candidate) &&
      typeof candidate.kid === "string" &&
      candidate.kid.trim()
    ) {
      keys.set(
        candidate.kid.trim(),
        candidate as unknown as JsonWebKey,
      );
    }
  }

  if (keys.size < 1) {
    return {
      ok: false,
      error:
        "FIREBASE_JWKS_INVALID_RESPONSE",
    };
  }

  const cache: JwksCache = {
    expiresAt:
      Date.now() +
      responseCacheSeconds(response) *
        1_000,
    keys,
  };

  jwksCache = cache;

  return {
    ok: true,
    cache,
  };
}

async function resolveJwk(
  kid: string,
): Promise<
  | {
      ok: true;
      jwk: JsonWebKey;
    }
  | {
      ok: false;
      error: string;
    }
> {
  if (
    jwksCache &&
    jwksCache.expiresAt > Date.now()
  ) {
    const cachedKey =
      jwksCache.keys.get(kid);

    if (cachedKey) {
      return {
        ok: true,
        jwk: cachedKey,
      };
    }
  }

  const refreshed =
    await refreshJwks();

  if (!refreshed.ok) {
    return refreshed;
  }

  const key =
    refreshed.cache.keys.get(kid);

  if (!key) {
    return {
      ok: false,
      error: "FIREBASE_JWK_NOT_FOUND",
    };
  }

  return {
    ok: true,
    jwk: key,
  };
}

export async function verifyFirebaseIdToken(
  idToken: string,
  firebaseProjectId: string,
): Promise<FirebaseIdTokenVerificationResult> {
  const token =
    String(idToken || "").trim();

  const projectId =
    String(firebaseProjectId || "").trim();

  if (
    !token ||
    token.length > MAX_TOKEN_LENGTH ||
    !projectId
  ) {
    return {
      ok: false,
      error:
        "INVALID_FIREBASE_TOKEN_FORMAT",
    };
  }

  const parts = token.split(".");

  if (parts.length !== 3) {
    return {
      ok: false,
      error:
        "INVALID_FIREBASE_TOKEN_FORMAT",
    };
  }

  const encodedHeader = parts[0];
  const encodedPayload = parts[1];
  const encodedSignature = parts[2];

  if (
    !encodedHeader ||
    !encodedPayload ||
    !encodedSignature
  ) {
    return {
      ok: false,
      error:
        "INVALID_FIREBASE_TOKEN_FORMAT",
    };
  }

  const header =
    decodeJwtJson(encodedHeader);

  const payload =
    decodeJwtJson(encodedPayload);

  if (!header || !payload) {
    return {
      ok: false,
      error:
        "INVALID_FIREBASE_TOKEN_JSON",
    };
  }

  const algorithm =
    optionalString(header.alg);

  const tokenType =
    optionalString(header.typ);

  const kid =
    optionalString(header.kid);

  if (
    algorithm !== "RS256" ||
    (tokenType &&
      tokenType.toUpperCase() !== "JWT") ||
    !kid ||
    kid.length > 256
  ) {
    return {
      ok: false,
      error:
        "INVALID_FIREBASE_TOKEN_HEADER",
    };
  }

  const nowSeconds =
    Math.floor(Date.now() / 1_000);

  const expectedIssuer =
    `https://securetoken.google.com/${projectId}`;

  const audience =
    optionalString(payload.aud);

  const issuer =
    optionalString(payload.iss);

  const subject =
    optionalString(payload.sub);

  const expiresAt =
    numericClaim(payload.exp);

  const issuedAt =
    numericClaim(payload.iat);

  const authTime =
    numericClaim(payload.auth_time);

  if (audience !== projectId) {
    return {
      ok: false,
      error:
        "INVALID_FIREBASE_TOKEN_AUDIENCE",
    };
  }

  if (issuer !== expectedIssuer) {
    return {
      ok: false,
      error:
        "INVALID_FIREBASE_TOKEN_ISSUER",
    };
  }

  if (
    !subject ||
    subject.length >
      MAX_SUBJECT_LENGTH
  ) {
    return {
      ok: false,
      error:
        "INVALID_FIREBASE_TOKEN_SUBJECT",
    };
  }

  if (
    !expiresAt ||
    expiresAt <= nowSeconds
  ) {
    return {
      ok: false,
      error: "FIREBASE_TOKEN_EXPIRED",
    };
  }

  if (
    !issuedAt ||
    issuedAt >
      nowSeconds +
        MAX_CLOCK_SKEW_SECONDS ||
    issuedAt >= expiresAt
  ) {
    return {
      ok: false,
      error:
        "INVALID_FIREBASE_TOKEN_ISSUED_AT",
    };
  }

  if (
    !authTime ||
    authTime >
      nowSeconds +
        MAX_CLOCK_SKEW_SECONDS
  ) {
    return {
      ok: false,
      error:
        "INVALID_FIREBASE_TOKEN_AUTH_TIME",
    };
  }

  const resolved =
    await resolveJwk(kid);

  if (!resolved.ok) {
    return resolved;
  }

  let cryptoKey: CryptoKey;

  try {
    cryptoKey =
      await crypto.subtle.importKey(
        "jwk",
        resolved.jwk,
        {
          name:
            "RSASSA-PKCS1-v1_5",
          hash: "SHA-256",
        },
        false,
        ["verify"],
      );
  } catch {
    return {
      ok: false,
      error:
        "FIREBASE_JWK_IMPORT_FAILED",
    };
  }

  let signature: Uint8Array;

  try {
    signature =
      base64UrlToBytes(
        encodedSignature,
      );
  } catch {
    return {
      ok: false,
      error:
        "INVALID_FIREBASE_TOKEN_SIGNATURE",
    };
  }

  const signedBytes =
    new TextEncoder().encode(
      `${encodedHeader}.${encodedPayload}`,
    );

  let validSignature = false;

  try {
    validSignature =
      await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        cryptoKey,
        toArrayBuffer(signature),
        toArrayBuffer(signedBytes),
      );
  } catch {
    return {
      ok: false,
      error:
        "FIREBASE_TOKEN_SIGNATURE_VERIFICATION_FAILED",
    };
  }

  if (!validSignature) {
    return {
      ok: false,
      error:
        "INVALID_FIREBASE_TOKEN_SIGNATURE",
    };
  }

  const firebase =
    isRecord(payload.firebase)
      ? payload.firebase
      : {};

  return {
    ok: true,
    claims: {
      uid: subject,
      email:
        optionalString(
          payload.email,
        ).toLowerCase(),
      emailVerified:
        payload.email_verified === true,
      issuedAt,
      expiresAt,
      authTime,
      signInProvider:
        optionalString(
          firebase.sign_in_provider,
        ),
      signInSecondFactor:
        optionalString(
          firebase.sign_in_second_factor,
        ),
      secondFactorIdentifier:
        optionalString(
          firebase.second_factor_identifier,
        ),
    },
  };
}