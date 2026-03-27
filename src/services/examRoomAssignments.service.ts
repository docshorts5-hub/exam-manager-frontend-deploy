import type { ExamRoomAssignment } from "../entities/examRoomAssignment.model";
import { examRoomAssignmentsRepository } from "../infra/repositories/examRoomAssignmentsRepository";

export type { ExamRoomAssignment };

export async function loadExamRoomAssignments<T extends ExamRoomAssignment = ExamRoomAssignment>(tenantId: string): Promise<T[]> {
  return (await examRoomAssignmentsRepository.list(tenantId)) as T[];
}

export async function saveExamRoomAssignments<T extends ExamRoomAssignment = ExamRoomAssignment>(tenantId: string, rows: T[], byUid?: string): Promise<void> {
  await examRoomAssignmentsRepository.replaceAll(tenantId, rows as ExamRoomAssignment[], { byUid, auditEntity: "examRoomAssignments" });
}

export function subscribeExamRoomAssignments(
  tenantId: string,
  onChange: (items: ExamRoomAssignment[]) => void,
  onError?: (error: unknown) => void,
) {
  const repo = examRoomAssignmentsRepository as typeof examRoomAssignmentsRepository & {
    subscribe?: (tenantId: string, onChange: (items: ExamRoomAssignment[]) => void, onError?: (error: unknown) => void) => (() => void) | void;
  };

  if (typeof repo.subscribe === "function") {
    return repo.subscribe(tenantId, onChange, onError);
  }

  let active = true;
  void loadExamRoomAssignments(tenantId)
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
