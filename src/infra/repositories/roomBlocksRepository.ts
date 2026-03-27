import type { RoomBlock } from "../../entities/roomBlock.model";

type SaveOptions = {
  byUid?: string;
  auditEntity?: string;
};

const listeners = new Map<string, Set<(items: RoomBlock[]) => void>>();

function key(tenantId: string) {
  return `roomBlocks:${tenantId}`;
}

function read(tenantId: string): RoomBlock[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(tenantId));
    return raw ? (JSON.parse(raw) as RoomBlock[]) : [];
  } catch {
    return [];
  }
}

function write(tenantId: string, rows: RoomBlock[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key(tenantId), JSON.stringify(rows));
  const subs = listeners.get(tenantId);
  if (subs) subs.forEach((fn) => fn(rows));
}

export const roomBlocksRepository = {
  async list(tenantId: string): Promise<RoomBlock[]> {
    return read(tenantId);
  },

  async replaceAll(tenantId: string, rows: RoomBlock[], _options?: SaveOptions): Promise<void> {
    write(tenantId, rows);
  },

  subscribe(
    tenantId: string,
    onChange: (items: RoomBlock[]) => void,
    _onError?: (error: unknown) => void
  ) {
    const subs = listeners.get(tenantId) ?? new Set<(items: RoomBlock[]) => void>();
    listeners.set(tenantId, subs);
    subs.add(onChange);
    onChange(read(tenantId));
    return () => {
      subs.delete(onChange);
    };
  },
};
