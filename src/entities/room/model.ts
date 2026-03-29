export type RoomStatus = "active" | "inactive";

export type Room = {
  id: string;
  roomName: string;
  code?: string;
  building: string;
  type: string;
  capacity: number;
  status?: RoomStatus;
  notes: string;
};
