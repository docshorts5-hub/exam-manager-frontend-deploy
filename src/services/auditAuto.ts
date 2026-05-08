// src/services/auditAuto.ts
/**
 * Lightweight automatic audit logger for UI actions like Print/Export.
 * AuthContext sets the context (tenantId + uid) globally.
 */
import { writeTenantAudit } from "./tenantData";

export type AuditContext = {
  tenantId: string | null;
  uid: string | null;
  email?: string | null;
  role?: string | null;
  isSupportMode?: boolean;
};

declare global {
  interface Window {
    __EM_AUDIT_CTX__?: AuditContext;
  }
}

export function setAuditContext(ctx: AuditContext | null) {
  window.__EM_AUDIT_CTX__ = ctx ?? undefined;
}

export function getAuditContext(): AuditContext | null {
  return window.__EM_AUDIT_CTX__ ?? null;
}

export async function auditEvent(payload: {
  action: string;
  entity: string;
  entityId?: string;
  meta?: any;
}) {
  const ctx = getAuditContext();
  const tenantId = ctx?.tenantId ?? null;
  if (!tenantId) return;

  // NOTE: keep meta small; Firestore document size limits apply.
  const meta = {
    ...(payload.meta ?? {}),
    _auto: true,
    _ts: Date.now(),
    _supportMode: !!ctx?.isSupportMode,
  };

  try {
    await writeTenantAudit(tenantId, {
      action: payload.action,
      entity: payload.entity,
      entityId: payload.entityId,
      by: ctx?.uid ?? undefined,
      meta,
    });
  } catch {
    // Don't break UX on audit failures
  }
}
