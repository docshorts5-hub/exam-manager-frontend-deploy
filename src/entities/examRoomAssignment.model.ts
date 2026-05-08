export type ExamRoomAssignment = {
  id: string;
  examId: string;
  roomId: string;
  roomName: string;
  dateISO: string;
  time: string;
  period: string;
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};
