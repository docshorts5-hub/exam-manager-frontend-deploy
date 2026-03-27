import type { Exam } from "../entities/exam/model";
import { examsRepository } from "../infra/repositories/examsRepository";

export type { Exam };

export async function loadExams(tenantId: string): Promise<Exam[]> {
  return await examsRepository.list(tenantId);
}

export async function saveExams(tenantId: string, exams: Exam[], byUid?: string): Promise<void> {
  await examsRepository.replaceAll(tenantId, exams, { byUid, auditEntity: "exams" });
}


export function subscribeExams(tenantId: string, onChange: (items: Exam[]) => void, onError?: (error: unknown) => void) {
  return examsRepository.subscribe(tenantId, onChange, onError);
}
