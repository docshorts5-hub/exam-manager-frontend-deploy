import type { RoomBlock } from "../entities/roomBlock.model";
import { roomBlocksRepository } from "../infra/repositories/roomBlocksRepository";

export type { RoomBlock };

export async function loadRoomBlocks<T extends RoomBlock = RoomBlock>(tenantId: string): Promise<T[]> {
  return await roomBlocksRepository.list(tenantId) as T[];
}

export async function saveRoomBlocks<T extends RoomBlock = RoomBlock>(tenantId: string, blocks: T[], byUid?: string): Promise<void> {
  await roomBlocksRepository.replaceAll(tenantId, blocks as RoomBlock[], { byUid, auditEntity: "roomBlocks" });
}
