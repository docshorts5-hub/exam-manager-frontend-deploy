import {
  isAdminRoute,
  parseAdminRequest,
  type AdminRoute,
} from "./contracts";
import {
  verifyFirebaseIdToken,
} from "./firebaseIdToken";
import {
  composeActorAuthorization,
} from "./actorAuthorizationComposition";
import {
  inspectAdminOperation,
} from "./inspectAdminOperation";

interface Env {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_WEB_API_KEY?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_PEM?: string;
  DEPLOYMENT_STAGE: string;
  DEPLOYMENT_BLOCKED: string;
  ALLOWED_ORIGINS: string;
}

type JsonRecord =
  Record<string, unknown>;

type JsonBodyResult =
  | {
      ok: true;
      value: unknown;
    }
  | {
      ok: false;
      status: 400 | 413 | 415;
      error: string;
    };

const SERVICE_NAME =
  "teachers12-totp-admin-worker-staging";

const MAX_REQUEST_BYTES = 16_384;
const RESET_IMPLEMENTED = false;
const ADMIN_OPERATIONS_READY = false;

const identityFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> =>
  fetch(input, init);

const oauthFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> =>
  fetch(input, init);

const firestoreFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> =>
  fetch(input, init);

function parseAllowedOrigins(
  value: string,
): Set<string> {
  return new Set(
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function requestOrigin(
  request: Request,
): string {
  return String(
    request.headers.get("origin") || "",
  ).trim();
}

function originAllowed(
  request: Request,
  env: Env,
): boolean {
  const origin = requestOrigin(request);

  if (!origin) {
    return false;
  }

  return parseAllowedOrigins(
    env.ALLOWED_ORIGINS,
  ).has(origin);
}

function securityHeaders(): Headers {
  const headers = new Headers();

  headers.set(
    "content-type",
    "application/json; charset=utf-8",
  );

  headers.set(
    "cache-control",
    "no-store, max-age=0",
  );

  headers.set("pragma", "no-cache");

  headers.set(
    "x-content-type-options",
    "nosniff",
  );

  headers.set(
    "x-frame-options",
    "DENY",
  );

  headers.set(
    "content-security-policy",
    "default-src 'none'; frame-ancestors 'none'",
  );

  headers.set(
    "referrer-policy",
    "no-referrer",
  );

  return headers;
}

function responseHeaders(
  request: Request,
  env: Env,
  includeCors: boolean,
): Headers {
  const headers = securityHeaders();

  if (
    includeCors &&
    originAllowed(request, env)
  ) {
    const origin = requestOrigin(request);

    headers.set(
      "access-control-allow-origin",
      origin,
    );

    headers.set(
      "access-control-allow-methods",
      "POST, OPTIONS",
    );

    headers.set(
      "access-control-allow-headers",
      "authorization, content-type",
    );

    headers.set(
      "access-control-max-age",
      "600",
    );

    headers.set("vary", "Origin");
  }

  return headers;
}

function jsonResponse(
  request: Request,
  env: Env,
  status: number,
  body: JsonRecord,
  includeCors = true,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: responseHeaders(
        request,
        env,
        includeCors,
      ),
    },
  );
}

function deploymentBlocked(
  env: Env,
): boolean {
  return (
    String(
      env.DEPLOYMENT_BLOCKED || "",
    ).toLowerCase() !== "false"
  );
}

function bearerToken(
  request: Request,
): string | null {
  const authorization = String(
    request.headers.get("authorization") || "",
  );

  const match = authorization.match(
    /^Bearer\s+([^\s]+)$/i,
  );

  return match?.[1] || null;
}

async function readJsonBody(
  request: Request,
): Promise<JsonBodyResult> {
  const contentType = String(
    request.headers.get("content-type") || "",
  ).toLowerCase();

  if (
    !contentType.startsWith(
      "application/json",
    )
  ) {
    return {
      ok: false,
      status: 415,
      error: "JSON_CONTENT_TYPE_REQUIRED",
    };
  }

  const contentLength = Number(
    request.headers.get(
      "content-length",
    ) || "0",
  );

  if (
    Number.isFinite(contentLength) &&
    contentLength >
      MAX_REQUEST_BYTES
  ) {
    return {
      ok: false,
      status: 413,
      error: "REQUEST_BODY_TOO_LARGE",
    };
  }

  const buffer =
    await request.arrayBuffer();

  if (
    buffer.byteLength < 1 ||
    buffer.byteLength >
      MAX_REQUEST_BYTES
  ) {
    return {
      ok: false,
      status:
        buffer.byteLength >
        MAX_REQUEST_BYTES
          ? 413
          : 400,
      error:
        buffer.byteLength >
        MAX_REQUEST_BYTES
          ? "REQUEST_BODY_TOO_LARGE"
          : "INVALID_JSON_BODY",
    };
  }

  let text: string;

  try {
    text = new TextDecoder(
      "utf-8",
      {
        fatal: true,
        ignoreBOM: false,
      },
    ).decode(buffer);
  } catch {
    return {
      ok: false,
      status: 400,
      error: "INVALID_UTF8_BODY",
    };
  }

  try {
    return {
      ok: true,
      value: JSON.parse(text),
    };
  } catch {
    return {
      ok: false,
      status: 400,
      error: "INVALID_JSON_BODY",
    };
  }
}

function handleOptions(
  request: Request,
  env: Env,
): Response {
  if (!originAllowed(request, env)) {
    return jsonResponse(
      request,
      env,
      403,
      {
        ok: false,
        error: "ORIGIN_NOT_ALLOWED",
      },
      false,
    );
  }

  return new Response(null, {
    status: 204,
    headers: responseHeaders(
      request,
      env,
      true,
    ),
  });
}

async function handleAdminRequest(
  request: Request,
  env: Env,
  route: AdminRoute,
): Promise<Response> {
  if (!originAllowed(request, env)) {
    return jsonResponse(
      request,
      env,
      403,
      {
        ok: false,
        error: "ORIGIN_NOT_ALLOWED",
      },
      false,
    );
  }

  if (deploymentBlocked(env)) {
    return jsonResponse(
      request,
      env,
      503,
      {
        ok: false,
        error:
          "TOTP_ADMIN_WORKER_DISABLED",
      },
    );
  }

  const token =
    bearerToken(request);

  if (!token) {
    return jsonResponse(
      request,
      env,
      401,
      {
        ok: false,
        error: "AUTH_REQUIRED",
      },
    );
  }

  const verification =
    await verifyFirebaseIdToken(
      token,
      env.FIREBASE_PROJECT_ID,
    );

  if (!verification.ok) {
    return jsonResponse(
      request,
      env,
      401,
      {
        ok: false,
        error: verification.error,
      },
    );
  }

  if (!verification.claims.email) {
    return jsonResponse(
      request,
      env,
      403,
      {
        ok: false,
        error: "AUTH_EMAIL_REQUIRED",
      },
    );
  }

  const jsonBody =
    await readJsonBody(request);

  if (!jsonBody.ok) {
    return jsonResponse(
      request,
      env,
      jsonBody.status,
      {
        ok: false,
        error: jsonBody.error,
      },
    );
  }

  const contract =
    parseAdminRequest(
      route,
      jsonBody.value,
    );

  if (!contract.ok) {
    return jsonResponse(
      request,
      env,
      contract.status,
      {
        ok: false,
        error: contract.error,
      },
    );
  }

  if (contract.request.operation === "audit") {
    return jsonResponse(
      request,
      env,
      501,
      {
        ok: false,
        error: "NOT_IMPLEMENTED",
        operation:
          contract.request.operation,
        adminOperationsReady:
          ADMIN_OPERATIONS_READY,
        resetImplemented:
          RESET_IMPLEMENTED,
      },
    );
  }

  const firebaseWebApiKey =
    String(
      env.FIREBASE_WEB_API_KEY || "",
    ).trim();

  if (!firebaseWebApiKey) {
    return jsonResponse(
      request,
      env,
      503,
      {
        ok: false,
        error:
          "FIREBASE_WEB_API_KEY_NOT_CONFIGURED",
      },
    );
  }

  const authorization =
    await composeActorAuthorization({
      identityFetcher,
      firestoreFetcher,
      firebaseWebApiKey,
      projectId:
        env.FIREBASE_PROJECT_ID,
      actorIdToken:
        token,
      claims:
        verification.claims,
      targetEmail:
        contract.request.data.email,
    });

  if (!authorization.ok) {
    return jsonResponse(
      request,
      env,
      authorization.status,
      {
        ok: false,
        error:
          authorization.error,
        stage:
          authorization.stage,
      },
    );
  }

  if (
    contract.request.operation === "inspect"
  ) {
    const inspectResult =
      await inspectAdminOperation({
        oauthFetcher,
        identityAdminFetcher:
          identityFetcher,
        serviceAccountEmail:
          String(
            env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
              "",
          ),
        privateKeyPem:
          String(
            env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_PEM ||
              "",
          ),
        firebaseProjectId:
          env.FIREBASE_PROJECT_ID,
        authorization:
          authorization.value,
      });

    if (!inspectResult.ok) {
      return jsonResponse(
        request,
        env,
        inspectResult.status,
        {
          ok: false,
          error:
            inspectResult.error,
          stage:
            inspectResult.stage,
        },
      );
    }

    return jsonResponse(
      request,
      env,
      200,
      {
        ...inspectResult.value,
      },
    );
  }

  return jsonResponse(
    request,
    env,
    501,
    {
      ok: false,
      error: "NOT_IMPLEMENTED",
      operation:
        contract.request.operation,
      adminOperationsReady:
        ADMIN_OPERATIONS_READY,
      resetImplemented:
        RESET_IMPLEMENTED,
    },
  );
}

export default {
  async fetch(
    request: Request,
    env: Env,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (
      request.method === "GET" &&
      url.pathname === "/health"
    ) {
      return jsonResponse(
        request,
        env,
        200,
        {
          ok: true,
          service: SERVICE_NAME,
          stage:
            env.DEPLOYMENT_STAGE,
          firebaseProjectId:
            env.FIREBASE_PROJECT_ID,
          deploymentBlocked:
            deploymentBlocked(env),
          adminOperationsReady:
            ADMIN_OPERATIONS_READY,
          resetImplemented:
            RESET_IMPLEMENTED,
        },
        false,
      );
    }

    if (!isAdminRoute(url.pathname)) {
      return jsonResponse(
        request,
        env,
        404,
        {
          ok: false,
          error: "NOT_FOUND",
        },
        false,
      );
    }

    if (request.method === "OPTIONS") {
      return handleOptions(
        request,
        env,
      );
    }

    if (request.method !== "POST") {
      return jsonResponse(
        request,
        env,
        405,
        {
          ok: false,
          error: "METHOD_NOT_ALLOWED",
        },
        false,
      );
    }

    return handleAdminRequest(
      request,
      env,
      url.pathname,
    );
  },
};
