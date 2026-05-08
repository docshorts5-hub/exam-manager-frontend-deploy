import type { ExamRoomAssignment } from "../entities/examRoomAssignment.model";
import { examRoomAssignmentsRepository } from "../infra/repositories/examRoomAssignmentsRepository";

export type { ExamRoomAssignment };

function safeTenantId(tenantId: string) {
  return String(tenantId || "").trim() || "default";
}

export async function loadExamRoomAssignments<T extends ExamRoomAssignment = ExamRoomAssignment>(
  tenantId: string
): Promise<T[]> {
  return (await examRoomAssignmentsRepository.list(safeTenantId(tenantId))) as T[];
}

export async function saveExamRoomAssignments<T extends ExamRoomAssignment = ExamRoomAssignment>(
  tenantId: string,
  rows: T[],
  byUid?: string
): Promise<void> {
  await examRoomAssignmentsRepository.replaceAll(
    safeTenantId(tenantId),
    (Array.isArray(rows) ? rows : []) as ExamRoomAssignment[],
    {
      byUid,
      auditEntity: "examRoomAssignments",
    }
  );
}

export function subscribeExamRoomAssignments(
  tenantId: string,
  onChange: (items: ExamRoomAssignment[]) => void,
  onError?: (error: unknown) => void
) {
  const tid = safeTenantId(tenantId);
  const repo = examRoomAssignmentsRepository as unknown as {
    subscribe?: (
      tenantId: string,
      onChange: (items: ExamRoomAssignment[]) => void,
      onError?: (error: unknown) => void
    ) => (() => void) | void;
  };

  if (typeof repo.subscribe === "function") {
    return repo.subscribe(tid, onChange, onError);
  }

  let active = true;
  loadExamRoomAssignments(tid)
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
