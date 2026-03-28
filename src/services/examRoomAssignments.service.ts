import type { ExamRoomAssignment } from "../entities/examRoomAssignment.model";
import { examRoomAssignmentsRepository } from "../infra/repositories/examRoomAssignmentsRepository";

export type { ExamRoomAssignment };

export async function loadExamRoomAssignments<T extends ExamRoomAssignment = ExamRoomAssignment>(tenantId: string): Promise<T[]> {
  return await examRoomAssignmentsRepository.list(tenantId) as T[];
}

export async function saveExamRoomAssignments<T extends ExamRoomAssignment = ExamRoomAssignment>(tenantId: string, rows: T[], byUid?: string): Promise<void> {
  await examRoomAssignmentsRepository.replaceAll(tenantId, rows as ExamRoomAssignment[], { byUid, auditEntity: "examRoomAssignments" });
}
