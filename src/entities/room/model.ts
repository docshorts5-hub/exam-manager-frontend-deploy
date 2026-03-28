export type Room = {
  id: string;
  roomName: string;
  building: string;
  type: string;
  capacity: number;
  notes: string;
  code?: string;
  status?: "active" | "inactive";
};
