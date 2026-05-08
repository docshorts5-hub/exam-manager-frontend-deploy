import { runFunctionWithRuntimePolicy } from "./functionsRuntimePolicy";

export type SecurityAuditEventType =
  | "ALLOWLIST_CREATE"
  | "ALLOWLIST_UPDATE"
  | "ALLOWLIST_DELETE"
  | "TENANT_CREATE"
  | "TENANT_UPDATE"
  | "TENANT_DELETE"
  | "OWNER_SET"
  | "USER_PROFILE_SYNC";

export type SecurityAuditEvent = {
  type: SecurityAuditEventType;
  tenantId: string;
  actorUid: string;
  actorEmail: string;
  targetEmail?: string;
  details?: Record<string, any>;
  createdAt?: any;
};

export async function writeSecurityAudit(event: Omit<SecurityAuditEvent, "createdAt">) {
  try {
    await runFunctionWithRuntimePolicy("writeActivityLog", {
      tenantId: event.tenantId,
      level: "warning",
      action: "PERMISSIONS_CHANGE",
      entityType: "security",
      entityId: event.type,
      message: `Security event: ${event.type}`,
      meta: {
        ...event,
      },
    }, {
      actionLabel: "كتابة سجل أمني",
      bestEffort: true,
      fallbackToLocalOnError: true,
      wrapStrictErrors: false,
    });
  } catch {
    // never break UI
  }
}
