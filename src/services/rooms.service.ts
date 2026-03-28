import type { Room } from "../entities/room/model";

let data: Room[] = [];

export async function loadRooms(): Promise<Room[]> {
  return data;
}

export async function saveRooms(rooms: Room[]): Promise<void> {
  data = rooms;
}
