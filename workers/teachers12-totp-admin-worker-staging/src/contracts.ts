export const ADMIN_ROUTES = [
  "/api/totp-admin/inspect",
  "/api/totp-admin/reset",
  "/api/totp-admin/audit",
] as const;

export type AdminRoute =
  (typeof ADMIN_ROUTES)[number];

const ADMIN_ROUTE_SET =
  new Set<string>(ADMIN_ROUTES);

export interface InspectRequest {
  email: string;
}

export interface ResetRequest {
  requestId: string;
  email: string;
  confirmTargetEmail: string;
  reason: string;
  confirmSelfReset: boolean;
}

export interface AuditRequest {
  limit: number;
}

export interface PublicFactor {
  uid: string;
  factorId: string;
  displayName: string;
  enrollmentTime: string;
}

export interface PublicTarget {
  uid: string;
  email: string;
  displayName: string;
  disabled: boolean;
  emailVerified: boolean;
  providerIds: string[];
  allowlistExists: boolean;
  allowlistEnabled: boolean;
  role: string;
  tenantId: string;
  governorate: string;
  tenantKind: string;
  factors: PublicFactor[];
  factorCount: number;
  totpFactorCount: number;
  otherFactorCount: number;
  totpEnrolled: boolean;
  scope: string;
}

export interface InspectResponse {
  ok: true;
  target: PublicTarget;
}

export interface ResetResponse {
  ok: true;
  auditId: string;
  requestId: string;
  status: "SUCCESS" | "PARTIAL_SUCCESS";
  targetUid: string;
  targetEmail: string;
  removedTotpFactors: number;
  preservedOtherFactors: number;
  refreshTokensRevoked: boolean;
  selfReset: boolean;
  requiresNewTotpEnrollment: true;
  warningCode?: string;
}

export interface AuditItem {
  id: string;
  status: string;
  actorEmail: string;
  actorRole: string;
  targetEmail: string;
  targetRole: string;
  targetTenantId: string;
  targetGovernorate: string;
  targetTenantKind: string;
  removedTotpFactors: number;
  preservedOtherFactors: number;
  refreshTokensRevoked: boolean;
  selfReset: boolean;
  reason: string;
  scope: string;
  createdAt: string;
  completedAt: string;
}

export interface AuditResponse {
  ok: true;
  items: AuditItem[];
}

export type ParsedAdminRequest =
  | {
      operation: "inspect";
      route: "/api/totp-admin/inspect";
      data: InspectRequest;
    }
  | {
      operation: "reset";
      route: "/api/totp-admin/reset";
      data: ResetRequest;
    }
  | {
      operation: "audit";
      route: "/api/totp-admin/audit";
      data: AuditRequest;
    };

export type ContractParseResult =
  | {
      ok: true;
      request: ParsedAdminRequest;
    }
  | {
      ok: false;
      status: 400;
      error: string;
    };

const RESET_REQUEST_ID_PATTERN =
  /^[A-Za-z0-9_-]{16,80}$/;

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  const allowed = new Set(allowedKeys);

  return Object.keys(value).every(
    (key) => allowed.has(key),
  );
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function invalid(
  error: string,
): ContractParseResult {
  return {
    ok: false,
    status: 400,
    error,
  };
}

export function isAdminRoute(
  value: string,
): value is AdminRoute {
  return ADMIN_ROUTE_SET.has(value);
}

export function parseAdminRequest(
  route: AdminRoute,
  value: unknown,
): ContractParseResult {
  if (!isRecord(value)) {
    return invalid("INVALID_JSON_OBJECT");
  }

  if (route === "/api/totp-admin/inspect") {
    if (!hasOnlyKeys(value, ["email"])) {
      return invalid("UNEXPECTED_REQUEST_FIELD");
    }

    if (typeof value.email !== "string") {
      return invalid("INVALID_EMAIL");
    }

    const email = normalizeEmail(value.email);

    if (!email || !validEmail(email)) {
      return invalid("INVALID_EMAIL");
    }

    return {
      ok: true,
      request: {
        operation: "inspect",
        route,
        data: {
          email,
        },
      },
    };
  }

  if (route === "/api/totp-admin/reset") {
    if (
      !hasOnlyKeys(value, [
        "requestId",
        "email",
        "confirmTargetEmail",
        "reason",
        "confirmSelfReset",
      ])
    ) {
      return invalid("UNEXPECTED_REQUEST_FIELD");
    }

    if (
      typeof value.requestId !== "string" ||
      !RESET_REQUEST_ID_PATTERN.test(
        value.requestId.trim(),
      )
    ) {
      return invalid("INVALID_REQUEST_ID");
    }

    if (
      typeof value.email !== "string" ||
      typeof value.confirmTargetEmail !==
        "string"
    ) {
      return invalid("INVALID_EMAIL");
    }

    const email =
      normalizeEmail(value.email);

    const confirmTargetEmail =
      normalizeEmail(
        value.confirmTargetEmail,
      );

    if (!email || !validEmail(email)) {
      return invalid("INVALID_EMAIL");
    }

    if (confirmTargetEmail !== email) {
      return invalid(
        "TARGET_EMAIL_CONFIRMATION_MISMATCH",
      );
    }

    if (typeof value.reason !== "string") {
      return invalid(
        "RESET_REASON_MUST_BE_10_TO_500_CHARACTERS",
      );
    }

    const reason = value.reason.trim();

    if (
      reason.length < 10 ||
      reason.length > 500
    ) {
      return invalid(
        "RESET_REASON_MUST_BE_10_TO_500_CHARACTERS",
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        value,
        "confirmSelfReset",
      ) &&
      typeof value.confirmSelfReset !==
        "boolean"
    ) {
      return invalid(
        "INVALID_SELF_RESET_CONFIRMATION",
      );
    }

    return {
      ok: true,
      request: {
        operation: "reset",
        route,
        data: {
          requestId:
            value.requestId.trim(),
          email,
          confirmTargetEmail,
          reason,
          confirmSelfReset:
            value.confirmSelfReset === true,
        },
      },
    };
  }

  if (!hasOnlyKeys(value, ["limit"])) {
    return invalid("UNEXPECTED_REQUEST_FIELD");
  }

  const limit =
    value.limit === undefined
      ? 50
      : value.limit;

  if (
    typeof limit !== "number" ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    return invalid("INVALID_AUDIT_LIMIT");
  }

  return {
    ok: true,
    request: {
      operation: "audit",
      route,
      data: {
        limit,
      },
    },
  };
}