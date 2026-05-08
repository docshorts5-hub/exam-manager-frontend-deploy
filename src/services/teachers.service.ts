import type { Teacher } from "../entities/teacher/model";
import { teachersRepository } from "../infra/repositories/teachersRepository";

export type { Teacher };

function safeTenantId(tenantId: string) {
  return String(tenantId || "").trim() || "default";
}

export async function loadTeachers(tenantId: string): Promise<Teacher[]> {
  return await teachersRepository.list(safeTenantId(tenantId));
}

export async function saveTeachers(tenantId: string, teachers: Teacher[], byUid?: string): Promise<void> {
  await teachersRepository.replaceAll(safeTenantId(tenantId), Array.isArray(teachers) ? teachers : [], {
    byUid,
    auditEntity: "teachers",
  });
}

export async function importTeachersBatch(tenantId: string, teachers: Teacher[]) {
  await teachersRepository.importBatch(safeTenantId(tenantId), Array.isArray(teachers) ? teachers : []);
}

export function subscribeTeachers(
  tenantId: string,
  onChange: (items: Teacher[]) => void,
  onError?: (error: unknown) => void
) {
  return teachersRepository.subscribe(safeTenantId(tenantId), onChange, onError);
}
