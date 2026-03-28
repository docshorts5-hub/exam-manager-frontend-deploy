export type RoomBlockReasonType = "maintenance" | "conflict" | "reserved" | "admin" | "other";
export type RoomBlockType = "full" | "partial";
export type RoomBlockSession = "full-day" | "morning" | "evening";
export type RoomBlockStatus = "active" | "cancelled";

export type RoomBlock = {
  id: string;
  roomId: string;
  roomName: string;
  reason: string;
  reasonType: RoomBlockReasonType;
  blockType: RoomBlockType;
  startDate: string;
  endDate: string;
  session: RoomBlockSession;
  status: RoomBlockStatus;
  notes?: string;
  createdBy?: string;
};
