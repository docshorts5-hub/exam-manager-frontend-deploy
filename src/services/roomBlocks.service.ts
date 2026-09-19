import { loadTenantArray, saveTenantArray, subscribeTenantArray } from "./tenantData";

export type RoomBlock = Record<string, any> & { id: string };

const SUB_COLLECTION = "roomBlocks";

export function loadRoomBlocks(tenantId: string) {
  return loadTenantArray<RoomBlock>(tenantId, SUB_COLLECTION, { cacheFallback: true });
}

export async function saveRoomBlocks(tenantId: string, roomBlocks: RoomBlock[], userId?: string) {
  await saveTenantArray<RoomBlock>(tenantId, SUB_COLLECTION, roomBlocks || [], {
    by: userId,
    audit: {
      entity: SUB_COLLECTION,
      meta: { count: Array.isArray(roomBlocks) ? roomBlocks.length : 0, summary: "saved room blocks" },
    },
  });
}

export function subscribeRoomBlocks(
  tenantId: string,
  onChange: (items: RoomBlock[]) => void,
  onError?: (error: unknown) => void,
) {
  return subscribeTenantArray<RoomBlock>(tenantId, SUB_COLLECTION, onChange, onError);
}
