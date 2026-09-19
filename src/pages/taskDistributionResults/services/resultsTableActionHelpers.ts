import { isTeacherUnavailable } from '../../../utils/taskDistributionUnavailability';
import { parseColKey } from './resultsDragDropRules';

function normalizeArabicPeriodText(value: any) {
  return String(value ?? '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function periodToAMPM(value: any): 'AM' | 'PM' {
  const raw = normalizeArabicPeriodText(value);
  const lower = raw.toLowerCase();
  const compact = lower.replace(/[\.\s_\-:،/]+/g, '');
  if (
    raw.includes('الثاني') ||
    raw.includes('ثاني') ||
    raw.includes('مسائي') ||
    raw.includes('مساء') ||
    raw.includes('بعد الظهر') ||
    lower.includes('second') ||
    lower.includes('afternoon') ||
    lower.includes('evening') ||
    compact === 'pm' ||
    compact === 'bm' ||
    compact === 'p2' ||
    compact === 'period2' ||
    compact === 'secondperiod' ||
    compact === '2ndperiod' ||
    compact === 'shift2' ||
    compact === 'session2' ||
    compact === '2' ||
    compact === '02' ||
    compact === 'p' ||
    compact === 'b'
  ) return 'PM';
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
