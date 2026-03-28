import { loadRun, saveRun } from '../../../utils/taskDistributionStorage';
import { ensureUidsOnRun } from '../uidUtils';

export function loadAndPersistResultsRun(tenantId: string) {
  const loaded = ensureUidsOnRun(loadRun(tenantId));
  try {
    saveRun(tenantId, loaded);
  } catch {
    // ignore persistence errors during refresh
  }
  return loaded;
}

export function shouldRefreshResultsRun(eventTenantId: string | null | undefined, currentTenantId: string) {
  const eventTid = String(eventTenantId || '').trim();
  const currentTid = String(currentTenantId || '').trim();
  return !eventTid || eventTid === currentTid;
}
