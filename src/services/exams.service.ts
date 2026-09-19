import { loadTenantArray, saveTenantArray, subscribeTenantArray } from "./tenantData";

export type Exam = Record<string, any> & { id: string };

const SUB_COLLECTION = "exams";

export function loadExams(tenantId: string) {
  return loadTenantArray<Exam>(tenantId, SUB_COLLECTION, { cacheFallback: true });
}

export async function saveExams(tenantId: string, exams: Exam[], userId?: string) {
  await saveTenantArray<Exam>(tenantId, SUB_COLLECTION, exams || [], {
    by: userId,
    audit: {
      entity: SUB_COLLECTION,
      meta: { count: Array.isArray(exams) ? exams.length : 0, summary: "saved exams" },
    },
  });
}

export function subscribeExams(
  tenantId: string,
  onChange: (items: Exam[]) => void,
  onError?: (error: unknown) => void,
) {
  return subscribeTenantArray<Exam>(tenantId, SUB_COLLECTION, onChange, onError);
}
