export type RoomBlockSession = "الفترة الأولى" | "الفترة الثانية" | "full-day";
export type RoomBlockStatus = "active" | "cancelled" | "expired";

export type RoomBlock = {
  id: string;
  roomId: string;
  roomName: string;
  reason: string;
  reasonType: string;
  blockType: "full" | "partial";
  startDate: string;
  endDate: string;
  session: RoomBlockSession;
  status: RoomBlockStatus;
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};
