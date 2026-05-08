import { loadTenantArray, replaceTenantArray, subscribeTenantArray } from "../../services/tenantData";

type SaveOptions = {
  byUid?: string;
  auditEntity?: string;
};

function safeTenantId(tenantId: string) {
  return String(tenantId || "").trim() || "default";
}

function safeRows<T>(rows: T[]) {
  return Array.isArray(rows) ? rows : [];
}

function safeSubCollection(value: string) {
  const name = String(value || "").trim();
  if (!name) throw new Error("subCollection is required.");
  if (name.includes("/") || name.includes("\\")) {
    throw new Error(`Invalid subCollection name: ${name}`);
  }
  return name;
}

export function createTenantArrayRepository<T extends { id: string }>(subCollection: string) {
  const collectionName = safeSubCollection(subCollection);

  return {
    async list(tenantId: string): Promise<T[]> {
      return await loadTenantArray<T>(safeTenantId(tenantId), collectionName);
    },

    subscribe(tenantId: string, onChange: (rows: T[]) => void, onError?: (error: unknown) => void) {
      return subscribeTenantArray<T>(safeTenantId(tenantId), collectionName, onChange, onError);
    },

    async replaceAll(tenantId: string, rows: T[], options?: SaveOptions): Promise<void> {
      const payload = safeRows(rows);

      await replaceTenantArray(safeTenantId(tenantId), collectionName, payload, {
        by: options?.byUid,
        audit: {
          action: "SAVE",
          entity: options?.auditEntity || collectionName,
          meta: {
            summary: `saved ${options?.auditEntity || collectionName}`,
            count: payload.length,
          },
        },
      });
    },
  };
}
