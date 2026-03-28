import { loadTenantArray, replaceTenantArray, subscribeTenantArray } from "../../services/tenantData";

type SaveOptions = {
  byUid?: string;
  auditEntity?: string;
};

export function createTenantArrayRepository<T extends { id: string }>(subCollection: string) {
  return {
    async list(tenantId: string): Promise<T[]> {
      return await loadTenantArray<T>(tenantId, subCollection);
    },
    subscribe(tenantId: string, onChange: (rows: T[]) => void, onError?: (error: unknown) => void) {
      return subscribeTenantArray<T>(tenantId, subCollection, onChange, onError);
    },
    async replaceAll(tenantId: string, rows: T[], options?: SaveOptions): Promise<void> {
      await replaceTenantArray(tenantId, subCollection, rows, {
        by: options?.byUid,
        audit: { action: "SAVE", entity: options?.auditEntity || subCollection },
      });
    },
  };
}
