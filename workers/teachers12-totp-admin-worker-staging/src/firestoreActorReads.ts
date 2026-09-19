export const FIRESTORE_REST_ORIGIN =
  "https://firestore.googleapis.com";

export const FIRESTORE_DATABASE_ID =
  "(default)";

export const MAX_FIRESTORE_RESPONSE_BYTES =
  64 * 1024;

export const FIRESTORE_REQUEST_TIMEOUT_MS =
  8_000;

export type FirestoreFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type FirestoreActorReadErrorCode =
  | "INVALID_FIRESTORE_READ_INPUT"
  | "FIRESTORE_AUTHORIZATION_DENIED"
  | "FIRESTORE_RESPONSE_TOO_LARGE"
  | "FIRESTORE_INVALID_RESPONSE"
  | "FIRESTORE_UPSTREAM_UNAVAILABLE"
  | "FIRESTORE_REQUEST_TIMEOUT"
  | "FIRESTORE_REQUEST_FAILED";

export type FirestoreReadResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: FirestoreActorReadErrorCode;
      status: number;
    };

type FirestoreValue = {
  stringValue?: string;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  nullValue?: null;
};

type FirestoreDocument = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
};

export type AllowlistReadSnapshot = {
  exists: boolean;
  enabled: boolean;
  role: string;
  tenantId: string;
  governorate: string;
  tenantKind: string;
};

export type TenantRecordReadSnapshot = {
  exists: boolean;
  governorate: string;
  tenantKind: string;
};

export type TenantDocumentsReadSnapshot = {
  tenantId: string;
  root: TenantRecordReadSnapshot;
  config: TenantRecordReadSnapshot;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizedEmail(value: unknown): string {
  return text(value).toLowerCase();
}

function validProjectId(value: string): boolean {
  return (
    value.length >= 6 &&
    value.length <= 64 &&
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(value)
  );
}

function encodedSegment(value: string): string {
  return encodeURIComponent(value);
}

function documentUrl(
  projectId: string,
  segments: string[],
): string {
  const encodedPath = segments
    .map(encodedSegment)
    .join("/");

  return (
    `${FIRESTORE_REST_ORIGIN}/v1/projects/` +
    `${encodedSegment(projectId)}/databases/` +
    `${FIRESTORE_DATABASE_ID}/documents/` +
    encodedPath
  );
}

function stringField(
  fields: Record<string, FirestoreValue>,
  names: string[],
): string {
  for (const name of names) {
    const value = fields[name]?.stringValue;

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return "";
}

function booleanField(
  fields: Record<string, FirestoreValue>,
  name: string,
): boolean {
  return fields[name]?.booleanValue === true;
}

function governorateField(
  fields: Record<string, FirestoreValue>,
): string {
  return stringField(
    fields,
    [
      "governorate",
      "tenantGovernorate",
      "regionAr",
      "governorateAr",
      "scopeGovernorate",
      "gov",
    ],
  );
}

function tenantKindField(
  fields: Record<string, FirestoreValue>,
): string {
  return stringField(
    fields,
    [
      "tenantKind",
      "kind",
      "type",
      "tenantType",
    ],
  );
}

async function boundedResponseText(
  response: Response,
): Promise<
  FirestoreReadResult<string>
> {
  const contentLengthHeader =
    response.headers.get("content-length");

  if (contentLengthHeader) {
    const declaredLength =
      Number(contentLengthHeader);

    if (
      Number.isFinite(declaredLength) &&
      declaredLength >
        MAX_FIRESTORE_RESPONSE_BYTES
    ) {
      return {
        ok: false,
        error:
          "FIRESTORE_RESPONSE_TOO_LARGE",
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
        MAX_FIRESTORE_RESPONSE_BYTES
      ) {
        await reader.cancel();

        return {
          ok: false,
          error:
            "FIRESTORE_RESPONSE_TOO_LARGE",
          status: response.status,
        };
      }

      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  const joined = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    ok: true,
    value: new TextDecoder().decode(joined),
  };
}

async function getFirestoreDocument(
  fetcher: FirestoreFetch,
  projectId: string,
  actorIdToken: string,
  segments: string[],
): Promise<
  FirestoreReadResult<FirestoreDocument | null>
> {
  const normalizedProjectId =
    text(projectId);

  const token = text(actorIdToken);

  if (
    !validProjectId(normalizedProjectId) ||
    !token ||
    segments.length < 2 ||
    segments.some(
      (segment) => !text(segment),
    )
  ) {
    return {
      ok: false,
      error:
        "INVALID_FIRESTORE_READ_INPUT",
      status: 0,
    };
  }

  const controller = new AbortController();

  const timeoutHandle = setTimeout(
    () => controller.abort(),
    FIRESTORE_REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetcher(
      documentUrl(
        normalizedProjectId,
        segments.map(text),
      ),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Cache-Control": "no-store",
        },
        redirect: "error",
        signal: controller.signal,
      },
    );

    const bodyResult =
      await boundedResponseText(response);

    if (!bodyResult.ok) {
      return bodyResult;
    }

    if (response.status === 404) {
      return {
        ok: true,
        value: null,
      };
    }

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      return {
        ok: false,
        error:
          "FIRESTORE_AUTHORIZATION_DENIED",
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
          "FIRESTORE_UPSTREAM_UNAVAILABLE",
        status: response.status,
      };
    }

    if (response.status !== 200) {
      return {
        ok: false,
        error:
          "FIRESTORE_INVALID_RESPONSE",
        status: response.status,
      };
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(bodyResult.value);
    } catch {
      return {
        ok: false,
        error:
          "FIRESTORE_INVALID_RESPONSE",
        status: response.status,
      };
    }

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return {
        ok: false,
        error:
          "FIRESTORE_INVALID_RESPONSE",
        status: response.status,
      };
    }

    const document =
      parsed as FirestoreDocument;

    if (
      document.fields !== undefined &&
      (
        !document.fields ||
        typeof document.fields !==
          "object" ||
        Array.isArray(document.fields)
      )
    ) {
      return {
        ok: false,
        error:
          "FIRESTORE_INVALID_RESPONSE",
        status: response.status,
      };
    }

    return {
      ok: true,
      value: document,
    };
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      return {
        ok: false,
        error:
          "FIRESTORE_REQUEST_TIMEOUT",
        status: 0,
      };
    }

    return {
      ok: false,
      error:
        "FIRESTORE_REQUEST_FAILED",
      status: 0,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function allowlistSnapshot(
  document: FirestoreDocument | null,
): AllowlistReadSnapshot {
  if (!document) {
    return {
      exists: false,
      enabled: false,
      role: "",
      tenantId: "",
      governorate: "",
      tenantKind: "",
    };
  }

  const fields = document.fields || {};

  return {
    exists: true,
    enabled:
      booleanField(fields, "enabled"),
    role:
      stringField(fields, ["role"]),
    tenantId:
      stringField(fields, ["tenantId"]),
    governorate:
      governorateField(fields),
    tenantKind:
      tenantKindField(fields),
  };
}

function tenantRecordSnapshot(
  document: FirestoreDocument | null,
): TenantRecordReadSnapshot {
  if (!document) {
    return {
      exists: false,
      governorate: "",
      tenantKind: "",
    };
  }

  const fields = document.fields || {};

  return {
    exists: true,
    governorate:
      governorateField(fields),
    tenantKind:
      tenantKindField(fields),
  };
}

export async function readAllowlistByEmail(
  fetcher: FirestoreFetch,
  projectId: string,
  actorIdToken: string,
  email: string,
): Promise<
  FirestoreReadResult<AllowlistReadSnapshot>
> {
  const emailValue =
    normalizedEmail(email);

  if (!emailValue) {
    return {
      ok: false,
      error:
        "INVALID_FIRESTORE_READ_INPUT",
      status: 0,
    };
  }

  const result =
    await getFirestoreDocument(
      fetcher,
      projectId,
      actorIdToken,
      [
        "allowlist",
        emailValue,
      ],
    );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    value:
      allowlistSnapshot(result.value),
  };
}

export async function readTenantDocuments(
  fetcher: FirestoreFetch,
  projectId: string,
  actorIdToken: string,
  tenantId: string,
): Promise<
  FirestoreReadResult<TenantDocumentsReadSnapshot>
> {
  const tenantValue = text(tenantId);

  if (!tenantValue) {
    return {
      ok: false,
      error:
        "INVALID_FIRESTORE_READ_INPUT",
      status: 0,
    };
  }

  const rootResult =
    await getFirestoreDocument(
      fetcher,
      projectId,
      actorIdToken,
      [
        "tenants",
        tenantValue,
      ],
    );

  if (!rootResult.ok) {
    return rootResult;
  }

  const configResult =
    await getFirestoreDocument(
      fetcher,
      projectId,
      actorIdToken,
      [
        "tenants",
        tenantValue,
        "meta",
        "config",
      ],
    );

  if (!configResult.ok) {
    return configResult;
  }

  return {
    ok: true,
    value: {
      tenantId: tenantValue,
      root:
        tenantRecordSnapshot(
          rootResult.value,
        ),
      config:
        tenantRecordSnapshot(
          configResult.value,
        ),
    },
  };
}