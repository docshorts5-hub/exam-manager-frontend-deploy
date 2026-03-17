import { loadUnavailability } from "../../../utils/taskDistributionUnavailability";

export function buildResultsBlockedCellKey(teacherName: string, subColKey: string): string {
  return `${String(teacherName || "").trim()}||${String(subColKey || "").trim()}`;
}

export function addResultsBlockedCellMessage(
  prev: Record<string, string>,
  teacherName: string,
  subColKey: string,
  msg: string,
): Record<string, string> {
  const key = buildResultsBlockedCellKey(teacherName, subColKey);
  return { ...prev, [key]: msg };
}

export function removeResultsBlockedCellMessage(
  prev: Record<string, string>,
  teacherName: string,
  subColKey: string,
): Record<string, string> {
  const key = buildResultsBlockedCellKey(teacherName, subColKey);
  const next: Record<string, string> = { ...prev };
  delete next[key];
  return next;
}

export function safeLoadResultsUnavailability(tenantId?: string, loader: typeof loadUnavailability = loadUnavailability) {
  try {
    return loader(tenantId);
  } catch {
    return [];
  }
}
