import { isTeacherUnavailable } from '../../../utils/taskDistributionUnavailability';
import { parseColKey } from './resultsDragDropRules';

function periodToAMPM(value: any): 'AM' | 'PM' {
  const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
  const lower = raw.toLowerCase();
  const compact = lower.replace(/[\.\s_-]+/g, '');
  if (raw.includes('الثانية') || raw.includes('ثانيه') || lower.includes('second') || compact === 'pm' || compact === 'bm' || compact === 'p2' || compact === 'period2' || compact === '2' || compact === 'p') return 'PM';
  return 'AM';
}

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
  const period = periodToAMPM(col?.period || 'AM');
  const normalizedTaskType = String(taskType || '').trim() as 'INVIGILATION' | 'RESERVE' | 'DUTY_INVIGILATOR';

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
