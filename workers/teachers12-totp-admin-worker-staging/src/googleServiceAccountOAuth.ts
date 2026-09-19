export type GoogleOAuthFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type GoogleServiceAccountOAuthErrorCode =
  | "GOOGLE_OAUTH_CONFIG_INVALID"
  | "GOOGLE_OAUTH_PRIVATE_KEY_INVALID"
  | "GOOGLE_OAUTH_SIGNING_FAILED"
  | "GOOGLE_OAUTH_TIMEOUT"
  | "GOOGLE_OAUTH_NETWORK_ERROR"
  | "GOOGLE_OAUTH_RESPONSE_TOO_LARGE"
  | "GOOGLE_OAUTH_HTTP_ERROR"
  | "GOOGLE_OAUTH_INVALID_RESPONSE";

export type GoogleServiceAccountOAuthResult =
  | {
      ok: true;
      value: {
        accessToken: string;
        tokenType: "Bearer";
        expiresInSeconds: number;
        expiresAtSeconds: number;
      };
    }
  | {
      ok: false;
      error: GoogleServiceAccountOAuthErrorCode;
      status: number;
      upstreamStatus?: number;
    };

export type GetGoogleServiceAccountAccessTokenInput = {
  fetcher: GoogleOAuthFetch;
  serviceAccountEmail: string;
  privateKeyPem: string;
  scope?: string;
  nowSeconds?: number;
};

const GOOGLE_OAUTH_TOKEN_ENDPOINT =
  "https://oauth2.googleapis.com/token";

const GOOGLE_OAUTH_AUDIENCE =
  GOOGLE_OAUTH_TOKEN_ENDPOINT;

export const GOOGLE_CLOUD_PLATFORM_SCOPE =
  "https://www.googleapis.com/auth/cloud-platform";

const GOOGLE_OAUTH_GRANT_TYPE =
  "urn:ietf:params:oauth:grant-type:jwt-bearer";

const MAX_OAUTH_RESPONSE_BYTES = 64 * 1024;
const OAUTH_TIMEOUT_MS = 8_000;
const ASSERTION_LIFETIME_SECONDS = 60 * 60;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function failure(
  error: GoogleServiceAccountOAuthErrorCode,
  status: number,
  upstreamStatus?: number,
): GoogleServiceAccountOAuthResult {
  return {
    ok: false,
    error,
    status,
    ...(upstreamStatus === undefined
      ? {}
      : {
          upstreamStatus,
        }),
  };
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function base64UrlFromBytes(
  bytes: Uint8Array,
): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (
    let offset = 0;
    offset < bytes.length;
    offset += chunkSize
  ) {
    const chunk =
      bytes.subarray(
        offset,
        Math.min(
          offset + chunkSize,
          bytes.length,
        ),
      );

    binary +=
      String.fromCharCode(...chunk);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlFromText(
  value: string,
): string {
  return base64UrlFromBytes(
    textEncoder.encode(value),
  );
}

function decodePkcs8PrivateKey(
  privateKeyPem: string,
): ArrayBuffer | null {
  const normalized =
    normalizeText(privateKeyPem);

  if (
    !normalized.includes(
      "-----BEGIN PRIVATE KEY-----",
    ) ||
    !normalized.includes(
      "-----END PRIVATE KEY-----",
    )
  ) {
    return null;
  }

  const base64Value =
    normalized
      .replace(
        "-----BEGIN PRIVATE KEY-----",
        "",
      )
      .replace(
        "-----END PRIVATE KEY-----",
        "",
      )
      .replace(/\s+/g, "");

  if (
    !base64Value ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(
      base64Value,
    )
  ) {
    return null;
  }

  try {
    const binary = atob(base64Value);
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

    return bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset +
        bytes.byteLength,
    ) as ArrayBuffer;
  } catch {
    return null;
  }
}

async function signServiceAccountAssertion(
  serviceAccountEmail: string,
  privateKeyPem: string,
  scope: string,
  nowSeconds: number,
): Promise<
  | {
      ok: true;
      assertion: string;
    }
  | {
      ok: false;
      error:
        | "GOOGLE_OAUTH_PRIVATE_KEY_INVALID"
        | "GOOGLE_OAUTH_SIGNING_FAILED";
    }
> {
  const keyBytes =
    decodePkcs8PrivateKey(privateKeyPem);

  if (!keyBytes) {
    return {
      ok: false,
      error:
        "GOOGLE_OAUTH_PRIVATE_KEY_INVALID",
    };
  }

  try {
    const signingKey =
      await crypto.subtle.importKey(
        "pkcs8",
        keyBytes,
        {
          name: "RSASSA-PKCS1-v1_5",
          hash: "SHA-256",
        },
        false,
        ["sign"],
      );

    const header =
      base64UrlFromText(
        JSON.stringify({
          alg: "RS256",
          typ: "JWT",
        }),
      );

    const claims =
      base64UrlFromText(
        JSON.stringify({
          iss: serviceAccountEmail,
          scope,
          aud: GOOGLE_OAUTH_AUDIENCE,
          iat: nowSeconds,
          exp:
            nowSeconds +
            ASSERTION_LIFETIME_SECONDS,
        }),
      );

    const unsignedAssertion =
      `${header}.${claims}`;

    const signatureBuffer =
      await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        signingKey,
        textEncoder.encode(
          unsignedAssertion,
        ),
      );

    const signature =
      base64UrlFromBytes(
        new Uint8Array(signatureBuffer),
      );

    return {
      ok: true,
      assertion:
        `${unsignedAssertion}.${signature}`,
    };
  } catch {
    return {
      ok: false,
      error: "GOOGLE_OAUTH_SIGNING_FAILED",
    };
  }
}

async function readBoundedResponseText(
  response: Response,
): Promise<
  | {
      ok: true;
      text: string;
    }
  | {
      ok: false;
    }
> {
  if (!response.body) {
    return {
      ok: true,
      text: "",
    };
  }

  const reader =
    response.body.getReader();

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const next =
        await reader.read();

      if (next.done) {
        break;
      }

      if (next.value) {
        totalBytes +=
          next.value.byteLength;

        if (
          totalBytes >
          MAX_OAUTH_RESPONSE_BYTES
        ) {
          try {
            await reader.cancel();
          } catch {
            // Ignore cancellation failures.
          }

          return {
            ok: false,
          };
        }

        chunks.push(next.value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  const merged =
    new Uint8Array(totalBytes);

  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    ok: true,
    text: textDecoder.decode(merged),
  };
}

export async function getGoogleServiceAccountAccessToken(
  input: GetGoogleServiceAccountAccessTokenInput,
): Promise<GoogleServiceAccountOAuthResult> {
  const serviceAccountEmail =
    normalizeText(
      input.serviceAccountEmail,
    ).toLowerCase();

  const privateKeyPem =
    normalizeText(input.privateKeyPem);

  const scope =
    normalizeText(input.scope) ||
    GOOGLE_CLOUD_PLATFORM_SCOPE;

  const nowSeconds =
    input.nowSeconds === undefined
      ? Math.floor(Date.now() / 1000)
      : Math.floor(input.nowSeconds);

  if (
    !serviceAccountEmail ||
    !serviceAccountEmail.includes("@") ||
    !privateKeyPem ||
    !scope ||
    !Number.isFinite(nowSeconds) ||
    nowSeconds <= 0
  ) {
    return failure(
      "GOOGLE_OAUTH_CONFIG_INVALID",
      503,
    );
  }

  const signedAssertion =
    await signServiceAccountAssertion(
      serviceAccountEmail,
      privateKeyPem,
      scope,
      nowSeconds,
    );

  if (!signedAssertion.ok) {
    return failure(
      signedAssertion.error,
      503,
    );
  }

  const controller =
    new AbortController();

  const timeoutHandle =
    setTimeout(
      () => controller.abort(),
      OAUTH_TIMEOUT_MS,
    );

  let response: Response;

  try {
    const body =
      new URLSearchParams({
        grant_type:
          GOOGLE_OAUTH_GRANT_TYPE,
        assertion:
          signedAssertion.assertion,
      }).toString();

    response =
      await input.fetcher(
        GOOGLE_OAUTH_TOKEN_ENDPOINT,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type":
              "application/x-www-form-urlencoded",
          },
          body,
          redirect: "error",
          signal: controller.signal,
        },
      );
  } catch {
    if (controller.signal.aborted) {
      return failure(
        "GOOGLE_OAUTH_TIMEOUT",
        504,
      );
    }

    return failure(
      "GOOGLE_OAUTH_NETWORK_ERROR",
      502,
    );
  } finally {
    clearTimeout(timeoutHandle);
  }

  const responseText =
    await readBoundedResponseText(response);

  if (!responseText.ok) {
    return failure(
      "GOOGLE_OAUTH_RESPONSE_TOO_LARGE",
      502,
      response.status,
    );
  }

  if (!response.ok) {
    return failure(
      "GOOGLE_OAUTH_HTTP_ERROR",
      response.status === 401 ||
        response.status === 403
        ? 503
        : 502,
      response.status,
    );
  }

  let payload: unknown;

  try {
    payload =
      JSON.parse(responseText.text);
  } catch {
    return failure(
      "GOOGLE_OAUTH_INVALID_RESPONSE",
      502,
      response.status,
    );
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return failure(
      "GOOGLE_OAUTH_INVALID_RESPONSE",
      502,
      response.status,
    );
  }

  const tokenPayload =
    payload as Record<string, unknown>;

  const accessToken =
    normalizeText(
      tokenPayload.access_token,
    );

  const tokenType =
    normalizeText(
      tokenPayload.token_type,
    );

  const expiresInSeconds =
    Math.floor(
      Number(tokenPayload.expires_in),
    );

  if (
    !accessToken ||
    tokenType.toLowerCase() !==
      "bearer" ||
    !Number.isFinite(
      expiresInSeconds,
    ) ||
    expiresInSeconds <= 0 ||
    expiresInSeconds >
      ASSERTION_LIFETIME_SECONDS
  ) {
    return failure(
      "GOOGLE_OAUTH_INVALID_RESPONSE",
      502,
      response.status,
    );
  }

  return {
    ok: true,
    value: {
      accessToken,
      tokenType: "Bearer",
      expiresInSeconds,
      expiresAtSeconds:
        nowSeconds + expiresInSeconds,
    },
  };
}
