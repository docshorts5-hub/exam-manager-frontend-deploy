import React from "react";
import type { Assignment } from "../../../contracts/taskDistributionContract";
import { ResultsEmptyTeacherCell } from "./ResultsEmptyTeacherCell";
import { ResultsAssignedTeacherCell } from "./ResultsAssignedTeacherCell";
import { ResultsTeacherIdentityCell } from "./ResultsTeacherIdentityCell";
import { ResultsTeacherTotalCell } from "./ResultsTeacherTotalCell";
import { canAddTaskToEmptyCell } from "../services/resultsTeacherRowRules";

export type SubCol = {
  key: string;
  dateISO: string;
  subject: string;
  period: string;
};

export type TeacherRowProps = {
  teacher: string;
  teacherIndex: number;
  allSubCols: SubCol[];
  displayDates: string[];
  matrix2: Record<string, Record<string, Assignment[]>>;
  teacherTotals: Record<string, number>;

  columnColor: (index: number) => { colBg: string; headBg: string };
  teacherRowColor: (index: number) => { stripe: string };
  getSubjectBackground: (subject?: string) => string;

  taskLabel: (t: any) => string;
  normalizeSubject: (s: string) => string;
  formatPeriod: (p?: string) => string;
  getCommitteeNo: (a: any) => string | undefined;

  isDraggableTaskType: (taskType: any) => boolean;
  dragSrcUid: string | null;
  dragOverUid: string | null;
  setDragSrcUid: (v: string | null) => void;
  setDragOverUid: (v: string | null) => void;
  onSwap: (srcUid: string, dstUid: string) => void;
  // ✅ Drop on empty cell (move)
  onDropToEmpty: (srcUid: string, dstTeacher: string, subColKey: string) => void;
  // ✅ Drop on any cell (move/swap)
  onDropToCell?: (srcUid: string, dstTeacher: string, subColKey: string, dstCellList: any[]) => void;

  // ✅ Add task into empty cell
  onAddToEmpty?: (dstTeacher: string, subColKey: string, taskType: string) => void;

  // ✅ For enabling/disabling add actions per exam column
  // invigilationDeficit = required - inv (exclude reserve)
  invigilationDeficitBySubCol?: Record<string, number>;
  reserveCountBySubCol?: Record<string, number>;
  requiredBySubCol?: Record<string, number>;

  // Unavailability (manual edits guard + show reason inside table)
  getUnavailabilityReasonForCell?: (teacherName: string, subColKey: string, taskType: string) => string | null;
  blockedCellMsg?: Record<string, string>;

  // ✅ Delete task
  onDeleteByUid?: (uid: string) => void;

  // ✅ selection (for copy/paste)
  selectedCell?: { teacher: string; subColKey: string; uid?: string } | null;
  onSelectCell?: (payload: { teacher: string; subColKey: string; uid?: string }) => void;

  // ✅ conflict flashing (optional)
  isConflictUid?: (uid: string) => boolean;

  styles: {
    tableText: string;
    tableFontSize: string;
    goldLine: string;
    goldLineSoft: string;
  };
  showTeacherSidebar?: boolean;
};

export function TeacherRow(props: TeacherRowProps) {
  const showTeacherSidebar = props.showTeacherSidebar !== false;
  const tc = props.teacherRowColor(props.teacherIndex);
  const tTotal = props.teacherTotals[props.teacher] ?? 0;

  const [openAddKey, setOpenAddKey] = React.useState<string | null>(null);

  const addBtnStyle: React.CSSProperties = {
    borderRadius: 10,
    padding: "9px 10px",
    border: `1px solid ${props.styles.goldLineSoft}`,
    background: "rgba(2,6,23,0.55)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
    width: "100%",
  };

  const addChoices: { key: string; label: string }[] = [
    { key: "INVIGILATION", label: "مراقبة" },
    { key: "RESERVE", label: "احتياط" },
    { key: "REVIEW_FREE", label: "مراجعة" },
    { key: "CORRECTION_FREE", label: "تصحيح" },
  ];

  const invDeficitFor = (subColKey: string) => props.invigilationDeficitBySubCol?.[subColKey] ?? 0;
  const resCountFor = (subColKey: string) => props.reserveCountBySubCol?.[subColKey] ?? 0;
  const requiredFor = (subColKey: string) => props.requiredBySubCol?.[subColKey] ?? 0;

  const canAdd = (subColKey: string, taskType: string) =>
    canAddTaskToEmptyCell({
      taskType,
      required: requiredFor(subColKey),
      invigilationDeficit: invDeficitFor(subColKey),
      reserveCount: resCountFor(subColKey),
      unavailableReason: props.getUnavailabilityReasonForCell?.(props.teacher, subColKey, taskType),
    });

  return (
    <tr key={props.teacher}>
{showTeacherSidebar ? (
      <ResultsTeacherIdentityCell
        teacher={props.teacher}
        stripeColor={tc.stripe}
        tableText={props.styles.tableText}
        tableFontSize={props.styles.tableFontSize}
        goldLine={props.styles.goldLine}
        goldLineSoft={props.styles.goldLineSoft}
      />
      ) : null}

      {props.allSubCols.map((sc) => {
        const list = props.matrix2[props.teacher]?.[sc.key] || [];
        // ✅ لا نستخدم ألوان متعددة لكل يوم — شكل موحّد مثل جدول الامتحانات

        const isDayStart = props.allSubCols.findIndex((x) => x.key === sc.key) === 0 || props.allSubCols[props.allSubCols.findIndex((x) => x.key === sc.key) - 1]?.dateISO !== sc.dateISO;
        const cellMsgKey = `${props.teacher}||${sc.key}`;
        const blockedMsg = props.blockedCellMsg?.[cellMsgKey] || null;
        const unInv = props.getUnavailabilityReasonForCell?.(props.teacher, sc.key, "INVIGILATION") || null;
        const unRes = props.getUnavailabilityReasonForCell?.(props.teacher, sc.key, "RESERVE") || null;

        const cellOuter: React.CSSProperties = {
          padding: "0px",
          border: "none",
          background: "transparent",
          textAlign: "center",
          verticalAlign: "middle",
          color: props.styles.tableText,
          fontWeight: 800,
          fontSize: props.styles.tableFontSize,
        };

        if (!list.length) {
          return (
            <ResultsEmptyTeacherCell
              key={sc.key}
              teacher={props.teacher}
              subColKey={sc.key}
              dragSrcUid={props.dragSrcUid}
              selected={
                props.selectedCell?.teacher === props.teacher && props.selectedCell?.subColKey === sc.key
              }
              blockedMsg={blockedMsg}
              unavailabilityMsg={(unInv || unRes) || null}
              openAdd={openAddKey === sc.key}
              addChoices={addChoices}
              addBtnStyle={addBtnStyle}
              canAdd={(taskType) => canAdd(sc.key, taskType)}
              getAddTitle={(taskType) => props.getUnavailabilityReasonForCell?.(props.teacher, sc.key, taskType) || undefined}
              onSelect={() => props.onSelectCell?.({ teacher: props.teacher, subColKey: sc.key })}
              onToggleAdd={() => setOpenAddKey((prev) => (prev === sc.key ? null : sc.key))}
              onDragOverEmpty={(e) => {
                if (!props.dragSrcUid) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDropToEmpty={(e) => {
                e.preventDefault();
                const srcUid = e.dataTransfer.getData("text/plain") || "";
                if (!srcUid) return;
                props.setDragOverUid(null);
                props.setDragSrcUid(null);
                props.onDropToEmpty(srcUid, props.teacher, sc.key);
              }}
              onAddChoice={(taskType) => {
                props.onAddToEmpty?.(props.teacher, sc.key, taskType);
                setOpenAddKey(null);
              }}
              onCloseAdd={() => setOpenAddKey(null)}
              onAddToEmptyEnabled={typeof props.onAddToEmpty === "function"}
              showInvigilationHint={
                (invDeficitFor(sc.key) <= 0 || requiredFor(sc.key) <= 0) && typeof props.onAddToEmpty === "function"
              }
              invigilationHintText={
                `لا يوجد عجز في المراقبة لهذا الاختبار — سيتم تفعيل إضافة مراقبة تلقائيًا عند حذف مراقبة وظهور نقص. ${
                  requiredFor(sc.key) > 0
                    ? resCountFor(sc.key) === 0
                      ? "يمكنك إضافة احتياط (احتياط واحد فقط) إذا رغبت."
                      : "تم إضافة احتياط بالفعل لهذا الاختبار."
                    : "هذا العمود ليس من جدول الامتحانات."
                }`
              }
              styles={{ goldLine: props.styles.goldLine, goldLineSoft: props.styles.goldLineSoft }}
              isDayStart={isDayStart}
            />
          );
        }

        return (
          <ResultsAssignedTeacherCell
            key={sc.key}
            teacher={props.teacher}
            sc={sc}
            list={list as Assignment[]}
            cellOuter={cellOuter}
            getSubjectBackground={props.getSubjectBackground}
            normalizeSubject={props.normalizeSubject}
            formatPeriod={props.formatPeriod}
            getCommitteeNo={props.getCommitteeNo}
            taskLabel={props.taskLabel}
            isDraggableTaskType={props.isDraggableTaskType}
            dragSrcUid={props.dragSrcUid}
            dragOverUid={props.dragOverUid}
            setDragSrcUid={props.setDragSrcUid}
            setDragOverUid={props.setDragOverUid}
            onDropToCell={props.onDropToCell}
            onSwap={props.onSwap}
            onSelectCell={props.onSelectCell}
            selectedCell={props.selectedCell}
            onDeleteByUid={props.onDeleteByUid}
            isConflictUid={props.isConflictUid}
            styles={{ goldLine: props.styles.goldLine, goldLineSoft: props.styles.goldLineSoft, tableText: props.styles.tableText }}
            isDayStart={isDayStart}
          />
        );
      })}

      <ResultsTeacherTotalCell
        total={tTotal}
        tableText={props.styles.tableText}
        goldLine={props.styles.goldLine}
        goldLineSoft={props.styles.goldLineSoft}
      />
    </tr>
  );
}
