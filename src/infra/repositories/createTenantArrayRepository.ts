import { loadTenantArray, replaceTenantArray } from "../../services/tenantData";

type SaveOptions = {
  byUid?: string;
  auditEntity?: string;
};

export function createTenantArrayRepository<T extends { id: string }>(subCollection: string) {
  return {
    async list(tenantId: string): Promise<T[]> {
      return await loadTenantArray<T>(tenantId, subCollection);
    },
    async replaceAll(tenantId: string, rows: T[], options?: SaveOptions): Promise<void> {
      await replaceTenantArray(tenantId, subCollection, rows, {
        by: options?.byUid,
        audit: { action: "save", entity: options?.auditEntity || subCollection },
      });
    },
  };
}
