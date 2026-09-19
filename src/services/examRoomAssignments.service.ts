import { loadTenantArray, saveTenantArray, subscribeTenantArray } from "./tenantData";

export type ExamRoomAssignment = Record<string, any> & { id: string };

const SUB_COLLECTION = "examRoomAssignments";

export function loadExamRoomAssignments(tenantId: string) {
  return loadTenantArray<ExamRoomAssignment>(tenantId, SUB_COLLECTION, { cacheFallback: true });
}

export async function saveExamRoomAssignments(
  tenantId: string,
  assignments: ExamRoomAssignment[],
  userId?: string,
) {
  await saveTenantArray<ExamRoomAssignment>(tenantId, SUB_COLLECTION, assignments || [], {
    by: userId,
    audit: {
      entity: SUB_COLLECTION,
      meta: { count: Array.isArray(assignments) ? assignments.length : 0, summary: "saved exam room assignments" },
    },
  });
}

export function subscribeExamRoomAssignments(
  tenantId: string,
  onChange: (items: ExamRoomAssignment[]) => void,
  onError?: (error: unknown) => void,
) {
  return subscribeTenantArray<ExamRoomAssignment>(tenantId, SUB_COLLECTION, onChange, onError);
}
