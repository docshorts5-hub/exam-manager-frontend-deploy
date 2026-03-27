import type { Room } from "../entities/room/model";
import { roomsRepository } from "../infra/repositories/roomsRepository";

export type { Room };

export async function loadRooms<T extends Room = Room>(tenantId: string): Promise<T[]> {
  return await roomsRepository.list(tenantId) as T[];
}

export async function saveRooms<T extends Room = Room>(tenantId: string, rooms: T[], byUid?: string): Promise<void> {
  await roomsRepository.replaceAll(tenantId, rooms as Room[], { byUid, auditEntity: "rooms" });
}


export function subscribeRooms(tenantId: string, onChange: (items: Room[]) => void, onError?: (error: unknown) => void) {
  return roomsRepository.subscribe(tenantId, onChange, onError);
}
