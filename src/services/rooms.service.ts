import type { Room } from "../entities/room/model";
import { roomsRepository } from "../infra/repositories/roomsRepository";

// تعريف نوع Room بشكل صحيح إذا لم يكن موجوداً في مكان آخر
export type Room = {
  id: string;
  roomName: string;
  code?: string;  // أضفناها لأن `Room` كانت تفتقدها
  building: string;
  type: string;
  capacity: number;
  status?: "active" | "inactive"; // أضفنا الحقل لأن `Room` كانت تفتقده
  notes: string;
};

export async function loadRooms<T extends Room = Room>(tenantId: string): Promise<T[]> {
  return await roomsRepository.list(tenantId) as T[];  // تأكد أن `list` يرجع نوع `Room`
}

export async function saveRooms<T extends Room = Room>(tenantId: string, rooms: T[], byUid?: string): Promise<void> {
  await roomsRepository.replaceAll(tenantId, rooms as Room[], { byUid, auditEntity: "rooms" });
}

// الاشتراك في التغييرات
export function subscribeRooms(tenantId: string, onChange: (items: Room[]) => void, onError?: (error: unknown) => void) {
  return roomsRepository.subscribe(tenantId, onChange, onError);  // تأكد أن `roomsRepository.subscribe` يدير الـ `Room[]`
}
