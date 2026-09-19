import { loadTenantArray, saveTenantArray, subscribeTenantArray } from "./tenantData";

export type Teacher = Record<string, any> & { id: string };

const SUB_COLLECTION = "teachers";

export function loadTeachers(tenantId: string) {
  return loadTenantArray<Teacher>(tenantId, SUB_COLLECTION, { cacheFallback: true });
}

export async function saveTeachers(tenantId: string, teachers: Teacher[], userId?: string) {
  await saveTenantArray<Teacher>(tenantId, SUB_COLLECTION, teachers || [], {
    by: userId,
    audit: {
      entity: SUB_COLLECTION,
      meta: { count: Array.isArray(teachers) ? teachers.length : 0, summary: "saved teachers" },
    },
  });
}

export function subscribeTeachers(
  tenantId: string,
  onChange: (items: Teacher[]) => void,
  onError?: (error: unknown) => void,
) {
  return subscribeTenantArray<Teacher>(tenantId, SUB_COLLECTION, onChange, onError);
}

export async function importTeachersBatch(tenantId: string, teachers: Teacher[], userId?: string) {
  await saveTeachers(tenantId, teachers, userId);
  return teachers || [];
}
