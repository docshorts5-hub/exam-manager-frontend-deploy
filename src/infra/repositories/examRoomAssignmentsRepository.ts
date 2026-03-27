import type { ExamRoomAssignment } from "../../entities/examRoomAssignment.model";

type SaveOptions = {
  byUid?: string;
  auditEntity?: string;
};

const listeners = new Map<string, Set<(items: ExamRoomAssignment[]) => void>>();

function key(tenantId: string) {
  return `examRoomAssignments:${tenantId}`;
}

function read(tenantId: string): ExamRoomAssignment[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(tenantId));
    return raw ? (JSON.parse(raw) as ExamRoomAssignment[]) : [];
  } catch {
    return [];
  }
}

function write(tenantId: string, rows: ExamRoomAssignment[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key(tenantId), JSON.stringify(rows));
  const subs = listeners.get(tenantId);
  if (subs) subs.forEach((fn) => fn(rows));
}

export const examRoomAssignmentsRepository = {
  async list(tenantId: string): Promise<ExamRoomAssignment[]> {
    return read(tenantId);
  },

  async replaceAll(tenantId: string, rows: ExamRoomAssignment[], _options?: SaveOptions): Promise<void> {
    write(tenantId, rows);
  },

  subscribe(
    tenantId: string,
    onChange: (items: ExamRoomAssignment[]) => void,
    _onError?: (error: unknown) => void
  ) {
    const subs = listeners.get(tenantId) ?? new Set<(items: ExamRoomAssignment[]) => void>();
    listeners.set(tenantId, subs);
    subs.add(onChange);
    onChange(read(tenantId));
    return () => {
      subs.delete(onChange);
    };
  },
};
