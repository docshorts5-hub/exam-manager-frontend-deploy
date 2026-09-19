export type IdentityAdminFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface IdentityAdminPublicFactor {
  uid: string;
  factorId: string;
  displayName: string;
  enrollmentTime: string;
}

export interface IdentityAdminUser {
  uid: string;
  email: string;
  displayName: string;
  disabled: boolean;
  emailVerified: boolean;
  providerIds: string[];
  factors: IdentityAdminPublicFactor[];
}

export type IdentityAdminUserLookupErrorCode =
  | "IDENTITY_ADMIN_CONFIG_INVALID"
  | "INVALID_EMAIL"
  | "IDENTITY_ADMIN_TIMEOUT"
  | "IDENTITY_ADMIN_NETWORK_ERROR"
  | "IDENTITY_ADMIN_RESPONSE_TOO_LARGE"
  | "IDENTITY_ADMIN_HTTP_ERROR"
  | "AUTH_USER_NOT_FOUND"
  | "IDENTITY_ADMIN_INVALID_RESPONSE"
  | "IDENTITY_ADMIN_EMAIL_MISMATCH";

export type IdentityAdminUserLookupResult =
  | {
      ok: true;
      value: IdentityAdminUser;
    }
  | {
      ok: false;
      error: IdentityAdminUserLookupErrorCode;
      status: number;
      upstreamStatus?: number;
    };

export interface LookupIdentityAdminUserByEmailInput {
  fetcher: IdentityAdminFetch;
  firebaseProjectId: string;
  accessToken: string;
  email: string;
}

const IDENTITY_TOOLKIT_ORIGIN =
  "https://identitytoolkit.googleapis.com";

const MAX_RESPONSE_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 8_000;

const textDecoder = new TextDecoder();

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validProjectId(value: string): boolean {
  return /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(value);
}

function validAccessToken(value: string): boolean {
  return value.length >= 16 && !/\s/.test(value);
}

function failure(
  error: IdentityAdminUserLookupErrorCode,
  status: number,
  upstreamStatus?: number,
): IdentityAdminUserLookupResult {
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

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
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

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const next = await reader.read();

      if (next.done) {
        break;
      }

      if (!next.value) {
        continue;
      }

      totalBytes += next.value.byteLength;

      if (totalBytes > MAX_RESPONSE_BYTES) {
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
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(totalBytes);
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

function parseJsonRecord(
  value: string,
): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function upstreamErrorMessage(
  payload: Record<string, unknown> | null,
): string {
  if (!payload) {
    return "";
  }

  const errorValue = payload.error;

  if (!isRecord(errorValue)) {
    return "";
  }

  return normalizeText(errorValue.message).toUpperCase();
}

function publicProviders(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const providerIds = new Set<string>();

  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }

    const providerId = normalizeText(
      entry.providerId,
    ).toLowerCase();

    if (providerId) {
      providerIds.add(providerId);
    }
  }

  return Array.from(providerIds).sort();
}

function factorIdFromEnrollment(
  enrollment: Record<string, unknown>,
): string {
  if (isRecord(enrollment.totpInfo)) {
    return "totp";
  }

  if (normalizeText(enrollment.phoneInfo)) {
    return "phone";
  }

  return "unknown";
}

function publicFactors(
  value: unknown,
): IdentityAdminPublicFactor[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const factors: IdentityAdminPublicFactor[] = [];
  const seenUids = new Set<string>();

  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }

    const uid = normalizeText(
      entry.mfaEnrollmentId,
    );

    if (!uid || seenUids.has(uid)) {
      continue;
    }

    seenUids.add(uid);

    factors.push({
      uid,
      factorId: factorIdFromEnrollment(entry),
      displayName: normalizeText(
        entry.displayName,
      ),
      enrollmentTime: normalizeText(
        entry.enrolledAt,
      ),
    });
  }

  return factors;
}

function parseAdminUser(
  value: unknown,
): IdentityAdminUser | null {
  if (!isRecord(value)) {
    return null;
  }

  const uid = normalizeText(value.localId);
  const email = normalizeEmail(value.email);

  if (!uid || !validEmail(email)) {
    return null;
  }

  return {
    uid,
    email,
    displayName: normalizeText(value.displayName),
    disabled: value.disabled === true,
    emailVerified: value.emailVerified === true,
    providerIds: publicProviders(
      value.providerUserInfo,
    ),
    factors: publicFactors(value.mfaInfo),
  };
}

export async function lookupIdentityAdminUserByEmail(
  input: LookupIdentityAdminUserByEmailInput,
): Promise<IdentityAdminUserLookupResult> {
  const firebaseProjectId = normalizeText(
    input.firebaseProjectId,
  ).toLowerCase();

  const accessToken = normalizeText(
    input.accessToken,
  );

  const email = normalizeEmail(input.email);

  if (
    !validProjectId(firebaseProjectId) ||
    !validAccessToken(accessToken)
  ) {
    return failure(
      "IDENTITY_ADMIN_CONFIG_INVALID",
      503,
    );
  }

  if (!validEmail(email)) {
    return failure("INVALID_EMAIL", 400);
  }

  const endpoint =
    `${IDENTITY_TOOLKIT_ORIGIN}/v1/projects/` +
    `${encodeURIComponent(firebaseProjectId)}/accounts:lookup`;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  let response: Response;

  try {
    response = await input.fetcher(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: [email],
      }),
      redirect: "error",
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      return failure(
        "IDENTITY_ADMIN_TIMEOUT",
        504,
      );
    }

    return failure(
      "IDENTITY_ADMIN_NETWORK_ERROR",
      502,
    );
  } finally {
    clearTimeout(timeoutHandle);
  }

  const responseText =
    await readBoundedResponseText(response);

  if (!responseText.ok) {
    return failure(
      "IDENTITY_ADMIN_RESPONSE_TOO_LARGE",
      502,
      response.status,
    );
  }

  const payload = parseJsonRecord(
    responseText.text,
  );

  if (!response.ok) {
    const upstreamMessage =
      upstreamErrorMessage(payload);

    if (
      response.status === 404 ||
      upstreamMessage.includes(
        "USER_NOT_FOUND",
      )
    ) {
      return failure(
        "AUTH_USER_NOT_FOUND",
        404,
        response.status,
      );
    }

    return failure(
      "IDENTITY_ADMIN_HTTP_ERROR",
      response.status === 401 ||
        response.status === 403
        ? 503
        : 502,
      response.status,
    );
  }

  if (!payload) {
    return failure(
      "IDENTITY_ADMIN_INVALID_RESPONSE",
      502,
      response.status,
    );
  }

  const rawUsers = payload.users;

  if (!Array.isArray(rawUsers)) {
    return failure(
      "IDENTITY_ADMIN_INVALID_RESPONSE",
      502,
      response.status,
    );
  }

  const parsedUsers = rawUsers
    .map(parseAdminUser)
    .filter(
      (user): user is IdentityAdminUser =>
        user !== null,
    );

  const matchingUsers = parsedUsers.filter(
    (user) => user.email === email,
  );

  if (matchingUsers.length < 1) {
    if (parsedUsers.length > 0) {
      return failure(
        "IDENTITY_ADMIN_EMAIL_MISMATCH",
        502,
        response.status,
      );
    }

    return failure(
      "AUTH_USER_NOT_FOUND",
      404,
      response.status,
    );
  }

  if (matchingUsers.length !== 1) {
    return failure(
      "IDENTITY_ADMIN_INVALID_RESPONSE",
      502,
      response.status,
    );
  }

  const matchingUser =
    matchingUsers[0];

  if (!matchingUser) {
    return failure(
      "IDENTITY_ADMIN_INVALID_RESPONSE",
      502,
      response.status,
    );
  }

  return {
    ok: true,
    value: matchingUser,
  };
}
