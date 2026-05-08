import { isTeacherUnavailable } from '../../../utils/taskDistributionUnavailability';
import { parseColKey } from './resultsDragDropRules';

export function buildResultsCellUnavailabilityReason({
  teacherName,
  subColKey,
  taskType,
  teacherNameToId,
  unavailIndex,
  unavailReasonMap,
}: {
  teacherName: string;
  subColKey: string;
  taskType: string;
  teacherNameToId: Map<string, string>;
  unavailIndex: Set<string>;
  unavailReasonMap: Map<string, string>;
}): string | null {
  const trimmedTeacherName = String(teacherName || '').trim();
  const teacherId = teacherNameToId.get(trimmedTeacherName) || trimmedTeacherName;
  const col = parseColKey(subColKey);
  const dateISO = String(col?.dateISO || '').trim();
  const period = (String(col?.period || 'AM').toUpperCase() === 'PM' ? 'PM' : 'AM') as 'AM' | 'PM';
  const normalizedTaskType = String(taskType || '').trim() as 'INVIGILATION' | 'RESERVE' | 'REVIEW_FREE' | 'CORRECTION_FREE';

  const blocked = isTeacherUnavailable({
    teacherId,
    dateISO,
    period,
    taskType: normalizedTaskType,
    index: unavailIndex,
  });

  if (!blocked) return null;

  const allKey = `${teacherId}|${dateISO}|${period}|ALL`;
  const typedKey = `${teacherId}|${dateISO}|${period}|${normalizedTaskType}`;
  const reason = (unavailReasonMap.get(typedKey) || unavailReasonMap.get(allKey) || 'غير متاح').trim();
  return reason || 'غير متاح';
}
