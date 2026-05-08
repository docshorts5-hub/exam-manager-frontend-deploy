import type { RoomBlock } from "../entities/roomBlock.model";
import { roomBlocksRepository } from "../infra/repositories/roomBlocksRepository";

export type { RoomBlock };

function safeTenantId(tenantId: string) {
  return String(tenantId || "").trim() || "default";
}

export async function loadRoomBlocks<T extends RoomBlock = RoomBlock>(tenantId: string): Promise<T[]> {
  return (await roomBlocksRepository.list(safeTenantId(tenantId))) as T[];
}

export async function saveRoomBlocks<T extends RoomBlock = RoomBlock>(
  tenantId: string,
  blocks: T[],
  byUid?: string
): Promise<void> {
  await roomBlocksRepository.replaceAll(safeTenantId(tenantId), (Array.isArray(blocks) ? blocks : []) as RoomBlock[], {
    byUid,
    auditEntity: "roomBlocks",
  });
}

export function subscribeRoomBlocks(
  tenantId: string,
  onChange: (items: RoomBlock[]) => void,
  onError?: (error: unknown) => void
) {
  const tid = safeTenantId(tenantId);
  const repo = roomBlocksRepository as unknown as {
    subscribe?: (
      tenantId: string,
      onChange: (items: RoomBlock[]) => void,
      onError?: (error: unknown) => void
    ) => (() => void) | void;
  };

  if (typeof repo.subscribe === "function") {
    return repo.subscribe(tid, onChange, onError);
  }

  let active = true;
  loadRoomBlocks(tid)
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
