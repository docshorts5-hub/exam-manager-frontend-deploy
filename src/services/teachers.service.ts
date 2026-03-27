import type { Teacher } from "../entities/teacher/model";
import { teachersRepository } from "../infra/repositories/teachersRepository";

export type { Teacher };

export async function loadTeachers(tenantId: string): Promise<Teacher[]> {
  return await teachersRepository.list(tenantId);
}

export async function saveTeachers(tenantId: string, teachers: Teacher[], byUid?: string): Promise<void> {
  await teachersRepository.replaceAll(tenantId, teachers, { byUid, auditEntity: "teachers" });
}

export async function importTeachersBatch(tenantId: string, teachers: Teacher[]) {
  await teachersRepository.importBatch(tenantId, teachers);
}


export function subscribeTeachers(tenantId: string, onChange: (items: Teacher[]) => void, onError?: (error: unknown) => void) {
  return teachersRepository.subscribe(tenantId, onChange, onError);
}
