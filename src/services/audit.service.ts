// src/services/audit.service.ts
import { runFunctionWithRuntimePolicy } from "./functionsRuntimePolicy";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "RUN_ENGINE"
  | "EXPORT"
  | "LOGIN"
  | "LOGOUT";

export async function logAudit(
  tenantId: string,
  payload: {
    action: AuditAction;
    entity: string;
    entityId?: string;
    meta?: any;
    byUid: string;
  },
) {
  try {
    await runFunctionWithRuntimePolicy("writeActivityLog", {
      tenantId,
      level: "info",
      action: payload.action,
      entityType: payload.entity,
      entityId: payload.entityId || null,
      meta: payload.meta ?? null,
    }, {
      actionLabel: "كتابة سجل التدقيق",
      bestEffort: true,
      fallbackToLocalOnError: true,
      wrapStrictErrors: false,
    });
  } catch {
    // ignore
  }
}
