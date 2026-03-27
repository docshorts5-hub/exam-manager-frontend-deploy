import type { Exam } from "../entities/exam/model";
import { examsRepository } from "../infra/repositories/examsRepository";

export type { Exam };

export async function loadExams(tenantId: string): Promise<Exam[]> {
  return await examsRepository.list(tenantId);
}

export async function saveExams(tenantId: string, exams: Exam[], byUid?: string): Promise<void> {
  await examsRepository.replaceAll(tenantId, exams, { byUid, auditEntity: "exams" });
}

export function subscribeExams(
  tenantId: string,
  onChange: (items: Exam[]) => void,
  onError?: (error: unknown) => void,
) {
  const repo = examsRepository as typeof examsRepository & {
    subscribe?: (tenantId: string, onChange: (items: Exam[]) => void, onError?: (error: unknown) => void) => (() => void) | void;
  };

  if (typeof repo.subscribe === "function") {
    return repo.subscribe(tenantId, onChange, onError);
  }

  let active = true;
  void loadExams(tenantId)
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
