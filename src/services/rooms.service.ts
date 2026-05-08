import type { Room } from "../entities/room/model";
import { roomsRepository } from "../infra/repositories/roomsRepository";

export type { Room };

function safeTenantId(tenantId: string) {
  return String(tenantId || "").trim() || "default";
}

export async function loadRooms<T extends Room = Room>(tenantId: string): Promise<T[]> {
  return (await roomsRepository.list(safeTenantId(tenantId))) as T[];
}

export async function saveRooms<T extends Room = Room>(
  tenantId: string,
  rooms: T[],
  byUid?: string
): Promise<void> {
  await roomsRepository.replaceAll(safeTenantId(tenantId), (Array.isArray(rooms) ? rooms : []) as Room[], {
    byUid,
    auditEntity: "rooms",
  });
}

export function subscribeRooms(
  tenantId: string,
  onChange: (items: Room[]) => void,
  onError?: (error: unknown) => void
) {
  const tid = safeTenantId(tenantId);
  const repo = roomsRepository as unknown as {
    subscribe?: (
      tenantId: string,
      onChange: (items: Room[]) => void,
      onError?: (error: unknown) => void
    ) => () => void;
  };

  if (typeof repo.subscribe === "function") {
    return repo.subscribe(tid, onChange, onError);
  }

  let active = true;

  loadRooms(tid)
    .then((items) => {
      if (active) onChange(items);
    })
    .catch((err) => {
      if (active) onError?.(err);
    });

  return () => {
    active = false;
  };
}
