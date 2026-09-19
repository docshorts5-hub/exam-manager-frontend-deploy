import { loadTenantArray, saveTenantArray, subscribeTenantArray } from "./tenantData";

export type Room = Record<string, any> & { id: string };

const SUB_COLLECTION = "rooms";

export function loadRooms(tenantId: string) {
  return loadTenantArray<Room>(tenantId, SUB_COLLECTION, { cacheFallback: true });
}

export async function saveRooms(tenantId: string, rooms: Room[], userId?: string) {
  await saveTenantArray<Room>(tenantId, SUB_COLLECTION, rooms || [], {
    by: userId,
    audit: {
      entity: SUB_COLLECTION,
      meta: { count: Array.isArray(rooms) ? rooms.length : 0, summary: "saved rooms" },
    },
  });
}

export function subscribeRooms(
  tenantId: string,
  onChange: (items: Room[]) => void,
  onError?: (error: unknown) => void,
) {
  return subscribeTenantArray<Room>(tenantId, SUB_COLLECTION, onChange, onError);
}
