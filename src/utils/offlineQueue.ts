/**
 * Legacy offline queue — security disabled.
 *
 * The old queue was global, untyped and not bound to a tenant.
 * Existing browser data is intentionally left untouched so that
 * unknown operations are not silently deleted or assigned to a tenant.
 *
 * Do not re-enable this API until a tenant-bound, versioned,
 * schema-validated and idempotent queue is implemented.
 */

export const LEGACY_OFFLINE_QUEUE_KEY =
  "exam-manager-offline-queue";

export type OfflineAction =
  Readonly<Record<string, unknown>>;

const OFFLINE_QUEUE_DISABLED_REASON =
  "OFFLINE_QUEUE_DISABLED_PENDING_TENANT_BOUND_DESIGN";

function failOfflineQueueClosed(
  operation: string
): never {
  throw new Error(
    `${OFFLINE_QUEUE_DISABLED_REASON}:${operation}`
  );
}

export function addOfflineAction(
  action: OfflineAction
): never {
  void action;

  return failOfflineQueueClosed("add");
}

export function getOfflineActions():
  OfflineAction[] {
  return failOfflineQueueClosed("read-for-replay");
}

export function clearOfflineQueue(): never {
  return failOfflineQueueClosed("clear");
}