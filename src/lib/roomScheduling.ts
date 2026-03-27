import type { Exam } from "../entities/exam/model";
import type { RoomBlock } from "../entities/roomBlock.model";

export function createId(prefix: string): string {
  const c = globalThis as typeof globalThis & { crypto?: Crypto };
  if (c.crypto?.randomUUID) return `${prefix}_${c.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function dateInRange(targetISO: string, startISO: string, endISO: string): boolean {
  if (!targetISO) return false;
  const start = startISO || targetISO;
  const end = endISO || start;
  return targetISO >= start && targetISO <= end;
}

export function roomBlockMatchesExam(block: RoomBlock, exam: Pick<Exam, "dateISO" | "period">): boolean {
  if (block.status !== "active") return false;
  if (!dateInRange(exam.dateISO, block.startDate, block.endDate)) return false;
  if (block.session === "full-day") return true;
  return String(block.session || "").trim() === String(exam.period || "").trim();
}

export function isRoomBlockedForExam(roomId: string, exam: Pick<Exam, "dateISO" | "period">, blocks: RoomBlock[]): boolean {
  return blocks.some((block) => block.roomId === roomId && roomBlockMatchesExam(block, exam));
}

export function isRoomBlockedToday(roomId: string, todayISO: string, blocks: RoomBlock[]): boolean {
  return blocks.some((block) => block.roomId === roomId && block.status === "active" && dateInRange(todayISO, block.startDate, block.endDate));
}

export function blockStatusLabel(block: RoomBlock, todayISO: string): RoomBlock["status"] {
  if (block.status === "cancelled") return "cancelled";
  if (block.endDate && block.endDate < todayISO) return "expired";
  return block.status;
}
