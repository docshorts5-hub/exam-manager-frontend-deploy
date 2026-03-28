import React from "react";
import type { SubCol } from "./TeacherRow";
import { ResultsTableDateHeaderCell } from "./ResultsTableDateHeaderCell";
import { ResultsTableSubColHeaderCell } from "./ResultsTableSubColHeaderCell";
import { ResultsTableEmptySubColHeaderCell } from "./ResultsTableEmptySubColHeaderCell";

type Styles = {
  tableText: string;
  tableFontSize: string;
  goldLine: string;
  goldLineSoft: string;
  teacherHeaderStyle: React.CSSProperties;
  teacherTotalHeaderStyle: React.CSSProperties;
};

type Props = {
  displayDates: string[];
  dateToSubCols: Map<string, SubCol[]>;
  allSubCols: SubCol[];
  committeesCountBySubCol: Record<string, number>;
  styles: Styles;
  formatDateWithDayAr: (dateISO: string) => { day: string; full: string; line: string };
  formatPeriod: (p?: string) => string;
  onDeleteSubCol?: (subColKey: string) => void;
  showTeacherSidebar?: boolean;
};

export function ResultsTableHeader({
  displayDates,
  dateToSubCols,
  committeesCountBySubCol,
  styles,
  formatDateWithDayAr,
  formatPeriod,
  onDeleteSubCol,
  showTeacherSidebar = true,
}: Props) {
  const headerPillBg = "linear-gradient(180deg, #b99628, #7f6410)";
  const subHeaderBg = "linear-gradient(180deg, #a78620, #6f5810)";
  const headerPillShadow = "0 14px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.14)";

  return (
    <thead>
      <tr>
        {showTeacherSidebar ? (
          <th
            rowSpan={2}
            style={{
              ...styles.teacherHeaderStyle,
              background: headerPillBg,
              border: `1px solid ${styles.goldLine}`,
              borderRadius: 18,
              boxShadow: headerPillShadow,
            }}
          >
            المعلم
          </th>
        ) : null}

        {displayDates.map((dateISO) => {
          const cols = dateToSubCols.get(dateISO) || [];
          const f = formatDateWithDayAr(dateISO);

          return (
            <ResultsTableDateHeaderCell
              key={dateISO}
              dateISO={dateISO}
              colSpan={Math.max(1, cols.length)}
              line={f.line}
              goldLine={styles.goldLine}
              tableFontSize={styles.tableFontSize}
              background={headerPillBg}
              shadow={headerPillShadow}
            />
          );
        })}

        <th
          rowSpan={2}
          style={{
            ...styles.teacherTotalHeaderStyle,
            background: headerPillBg,
            border: `1px solid ${styles.goldLine}`,
            borderRadius: 18,
            boxShadow: headerPillShadow,
          }}
        >
          إجمالي المعلم
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>(مراقبة+احتياط+مراجعة)</div>
        </th>
      </tr>

      <tr>
        {displayDates.flatMap((dateISO) => {
          const cols = dateToSubCols.get(dateISO) || [];
          if (!cols.length) {
            return [
              <ResultsTableEmptySubColHeaderCell
                key={`${dateISO}__empty`}
                goldLine={styles.goldLine}
                background={subHeaderBg}
                shadow={headerPillShadow}
                isDayStart
                isDayEnd
              />,
            ];
          }

          return cols.map((subCol, idx) => {
            const subColKey = subCol.key || `${dateISO}__${idx}`;
            const committees = committeesCountBySubCol[subColKey] ?? 0;
            return (
              <ResultsTableSubColHeaderCell
                key={subColKey}
                subject={subCol.subject}
                periodLabel={formatPeriod(subCol.period)}
                committees={committees}
                goldLine={styles.goldLine}
                background={subHeaderBg}
                shadow={headerPillShadow}
                isDayStart={idx === 0}
                isDayEnd={idx === cols.length - 1}
                onDeleteAll={onDeleteSubCol ? () => onDeleteSubCol(subColKey) : undefined}
              />
            );
          });
        })}
      </tr>
    </thead>
  );
}
