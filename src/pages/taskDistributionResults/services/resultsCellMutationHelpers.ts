import { colKeyOf } from './resultsDragDropRules';

export function isSupportedResultsTaskType(taskType: string) {
  return new Set(["INVIGILATION", "RESERVE", "REVIEW_FREE", "CORRECTION_FREE"]).has(String(taskType || '').trim());
}

export function computeMissingCommitteeSlotForResultsCell({
  taskType,
  currentAssignments,
  dstColKey,
  col,
  examKeyToCommittees,
  invigilatorsPerRoomForSubject,
  normalizeSubject,
}: {
  taskType: string;
  currentAssignments: any[];
  dstColKey: string;
  col: { dateISO: string; period: string; subject: string };
  examKeyToCommittees: Record<string, any>;
  invigilatorsPerRoomForSubject: (subject: string) => number;
  normalizeSubject: (subject: string) => string;
}) {
  try {
    if (String(taskType || '') !== 'INVIGILATION') {
      return { committeeNo: undefined, invigilatorIndex: undefined };
    }

    const subject = normalizeSubject(col.subject || '');
    const period = String(col.period || 'AM').toUpperCase() || 'AM';
    const ek = `${String(col.dateISO || '').trim()}__${period}__${subject}`;

    const rooms = Number(examKeyToCommittees[ek] ?? 0) || 0;
    const invPerRoom = Math.max(1, Number(invigilatorsPerRoomForSubject(subject)) || 1);
    if (rooms <= 0) return { committeeNo: undefined, invigilatorIndex: undefined };

    const occ: Record<number, Set<number>> = {};
    for (const a of currentAssignments || []) {
      if (colKeyOf(a) !== dstColKey) continue;
      if (String(a?.taskType || '') !== 'INVIGILATION') continue;
      const cn = Number(a?.committeeNo ?? a?.committee ?? a?.committee_number ?? 0) || 0;
      const ii = Number(a?.invigilatorIndex ?? a?.invigilator_index ?? 0) || 0;
      if (cn <= 0 || ii <= 0) continue;
      if (!occ[cn]) occ[cn] = new Set<number>();
      occ[cn].add(ii);
    }

    for (let committeeNo = 1; committeeNo <= rooms; committeeNo++) {
      const used = occ[committeeNo] || new Set<number>();
      for (let invigilatorIndex = 1; invigilatorIndex <= invPerRoom; invigilatorIndex++) {
        if (!used.has(invigilatorIndex)) {
          return { committeeNo, invigilatorIndex };
        }
      }
    }

    return { committeeNo: rooms, invigilatorIndex: invPerRoom };
  } catch {
    return { committeeNo: undefined, invigilatorIndex: undefined };
  }
}
