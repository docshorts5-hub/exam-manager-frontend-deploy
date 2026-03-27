export function createId(prefix = "id"): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}_${rand}`;
}

type BasicRoomBlock = {
  roomId: string;
  startDate: string;
  endDate: string;
  session?: string;
  status?: string;
};

export function isRoomBlockedToday(
  roomId: string,
  todayISO: string,
  blocks: BasicRoomBlock[]
): boolean {
  return blocks.some((block) => {
    if (block.roomId !== roomId) return false;
    if (block.status && block.status !== "active") return false;
    return block.startDate <= todayISO && block.endDate >= todayISO;
  });
}
