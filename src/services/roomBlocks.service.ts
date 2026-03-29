import type { RoomBlock } from "../entities/roomBlock.model";
import { roomBlocksRepository } from "../infra/repositories/roomBlocksRepository";

export type { RoomBlock };

export async function loadRoomBlocks<T extends RoomBlock = RoomBlock>(tenantId: string): Promise<T[]> {
  return (await roomBlocksRepository.list(tenantId)) as T[];
}

export async function saveRoomBlocks<T extends RoomBlock = RoomBlock>(
  tenantId: string,
  blocks: T[],
  byUid?: string
): Promise<void> {
  await roomBlocksRepository.replaceAll(tenantId, blocks as RoomBlock[], {
    byUid,
    auditEntity: "roomBlocks",
  });
}

export function subscribeRoomBlocks(
  tenantId: string,
  onChange: (items: RoomBlock[]) => void,
  onError?: (error: unknown) => void
) {
  const repo = roomBlocksRepository as unknown as {
    subscribe?: (
      tenantId: string,
      onChange: (items: RoomBlock[]) => void,
      onError?: (error: unknown) => void
    ) => (() => void) | void;
  };

  if (typeof repo.subscribe === "function") {
    return repo.subscribe(tenantId, onChange, onError);
  }

  let active = true;
  loadRoomBlocks(tenantId)
    .then((items) => {
      if (active) onChange(items);
    })
    .catch((err) => {
      if (active) onError?.(err);
    });

  return () => {
    active = false;
  };
}
