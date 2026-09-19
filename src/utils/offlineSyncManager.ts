/**
 * Legacy offline synchronization — security disabled.
 *
 * The previous implementation replayed arbitrary global actions,
 * had no tenant binding, allowed concurrent workers and could
 * duplicate or lose operations during partial synchronization.
 */

import type {
  OfflineAction,
} from "./offlineQueue";

const OFFLINE_SYNC_DISABLED_REASON =
  "OFFLINE_SYNC_DISABLED_PENDING_TENANT_BOUND_DESIGN";

export function startOfflineSync(
  processAction:
    (action: OfflineAction) =>
      Promise<void> | void
): never {
  void processAction;

  throw new Error(
    OFFLINE_SYNC_DISABLED_REASON
  );
}