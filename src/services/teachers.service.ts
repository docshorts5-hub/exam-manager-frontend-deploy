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
  if (typeof teachersRepository.importBatch === "function") {
    await teachersRepository.importBatch(tenantId, teachers);
    return;
  }
  await saveTeachers(tenantId, teachers);
}

export function subscribeTeachers(
  tenantId: string,
  onChange: (items: Teacher[]) => void,
  onError?: (error: unknown) => void,
) {
  const repo = teachersRepository as typeof teachersRepository & {
    subscribe?: (tenantId: string, onChange: (items: Teacher[]) => void, onError?: (error: unknown) => void) => (() => void) | void;
  };

  if (typeof repo.subscribe === "function") {
    return repo.subscribe(tenantId, onChange, onError);
  }

  let active = true;
  void loadTeachers(tenantId)
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
