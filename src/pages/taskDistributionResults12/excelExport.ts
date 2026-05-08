import type { Assignment } from "../../contracts/taskDistributionContract";
import { downloadBlob } from "./basicUtils";
import { getCommitteeNo, taskLabel, formatPeriod, formatDateWithDayAr } from "./taskUtils";

export type SubCol = {
  key: string;
  dateISO: string;
  subject: string;
  period: string;
};

export async function exportExcelStyledLikeTable(params: {
  run: any;
  displayDates: string[];
  dateToSubCols: Map<string, SubCol[]>;
  allSubCols: SubCol[];
  allTeachers: string[];
  matrix2: Record<string, Record<string, Assignment[]>>;
  committeesCountBySubCol: Record<string, number>;
  totalsDetailBySubCol: Record<
    string,
    { inv: number; res: number; duty: number; total: number; deficit: number; committees: number }
  >;
  teacherTotals: Record<string, number>;
}) {
  if (!params.run) return;

  const created = String(params.run.createdAtISO || "").slice(0, 10) || "run";
  const filename = `task_distribution_${created}.xlsx`;

  try {
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("الجدول الشامل", {
      views: [{ state: "frozen", xSplit: 1, ySplit: 2, rightToLeft: true }],
    });

    const WHITE = "FFFFFFFF";
    const BLACK = "FF000000";
    const RED_TEXT = "FFC00000";
    const RED_BG = "FFFFDDDD";
    const HEADER_BG = "FFF3F4F6";
    const BORDER = "FF000000";
    const GREEN = "FF22C55E";
    const RED = "FFEF4444";

    const BORDER_BLACK = {
      top: { style: "thin" as const, color: { argb: BORDER } },
      left: { style: "thin" as const, color: { argb: BORDER } },
      bottom: { style: "thin" as const, color: { argb: BORDER } },
      right: { style: "thin" as const, color: { argb: BORDER } },
    } as const;

    ws.columns = [
      { header: "المعلم", key: "teacher", width: 34 },
      ...params.allSubCols.map((sc) => ({ header: sc.key, key: sc.key, width: 28 })),
      { header: "إجمالي المعلم", key: "__teacher_total__", width: 18 },
    ];

    const totalColIndex = 2 + params.allSubCols.length;

    const shortageSubjects = new Set<string>();
    params.allSubCols.forEach((sc) => {
      const d = params.totalsDetailBySubCol[sc.key];
      if (d && Number(d.deficit || 0) > 0) {
        shortageSubjects.add(String(sc.subject || "").trim());
      }
    });

    const row1 = ws.getRow(1);
    row1.height = 26;
    row1.getCell(1).value = "المعلم";
    row1.getCell(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    row1.getCell(1).font = { bold: true, color: { argb: BLACK } };
    row1.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
    row1.getCell(1).border = BORDER_BLACK;

    let colPtr = 2;
    params.displayDates.forEach((dateISO) => {
      const cols = params.dateToSubCols.get(dateISO) || [];
      const span = Math.max(1, cols.length);
      const f = formatDateWithDayAr(dateISO);

      const startCol = colPtr;
      const endCol = colPtr + span - 1;

      ws.mergeCells(1, startCol, 1, endCol);

      row1.getCell(startCol).value = f.line;

      for (let c = startCol; c <= endCol; c++) {
        const cc = row1.getCell(c);
        cc.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cc.font = { bold: true, color: { argb: BLACK } };
        cc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
        cc.border = BORDER_BLACK;
      }

      colPtr = endCol + 1;
    });

    ws.mergeCells(1, totalColIndex, 2, totalColIndex);
    const totalHeadCell = row1.getCell(totalColIndex);
    totalHeadCell.value = "إجمالي المعلم\n(مراقبة+احتياط+مراقب دور)";
    totalHeadCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    totalHeadCell.font = { bold: true, color: { argb: BLACK } };
    totalHeadCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
    totalHeadCell.border = BORDER_BLACK;

    const row2 = ws.getRow(2);
    row2.height = 52;
    row2.getCell(1).value = "";
    row2.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
    row2.getCell(1).border = BORDER_BLACK;

    params.allSubCols.forEach((sc, i) => {
      const col = 2 + i;
      const committees = params.committeesCountBySubCol[sc.key] ?? 0;
      const hasDeficit = shortageSubjects.has(String(sc.subject || "").trim());

      row2.getCell(col).value = `${sc.subject || "—"}\n${formatPeriod(sc.period) || ""}\nمجموع اللجان: ${committees}`;
      row2.getCell(col).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      row2.getCell(col).font = { bold: true, color: { argb: hasDeficit ? RED_TEXT : BLACK } };
      row2.getCell(col).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: hasDeficit ? RED_BG : HEADER_BG },
      };
      row2.getCell(col).border = BORDER_BLACK;
    });

    let rIdx = 3;
    params.allTeachers.forEach((teacher) => {
      const row = ws.getRow(rIdx);
      row.height = 78;

      row.getCell(1).value = teacher;
      row.getCell(1).alignment = { vertical: "middle", horizontal: "right", wrapText: true };
      row.getCell(1).font = { bold: true, color: { argb: BLACK } };
      row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: WHITE } };
      row.getCell(1).border = BORDER_BLACK;

      params.allSubCols.forEach((sc, i) => {
        const col = 2 + i;
        const list = params.matrix2[teacher]?.[sc.key] || [];
        const hasDeficit = shortageSubjects.has(String(sc.subject || "").trim());

        const text = list
          .map((a: any) => {
            const committeeNo = getCommitteeNo(a);
            const invIdx = (a as any).invigilatorIndex;
            const meta =
              committeeNo || invIdx !== undefined
                ? ` (رقم اللجنة: ${committeeNo || "—"} • رقم المراقب: ${invIdx ?? "—"})`
                : "";
            return `${taskLabel(a.taskType)}${meta}`;
          })
          .join("\n");

        row.getCell(col).value = text || "—";
        row.getCell(col).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        row.getCell(col).font = { bold: true, color: { argb: hasDeficit ? RED_TEXT : BLACK } };
        row.getCell(col).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: hasDeficit ? RED_BG : WHITE },
        };
        row.getCell(col).border = BORDER_BLACK;
      });

      const tTotal = params.teacherTotals[teacher] ?? 0;
      const tc = row.getCell(totalColIndex);
      tc.value = tTotal;

      let fillArgb = WHITE;
      let fontArgb = BLACK;

      if (tTotal < 5) {
        fillArgb = GREEN;
        fontArgb = BLACK;
      } else if (tTotal > 7) {
        fillArgb = RED;
        fontArgb = WHITE;
      }

      tc.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      tc.font = { bold: true, color: { argb: fontArgb } };
      tc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
      tc.border = BORDER_BLACK;

      rIdx++;
    });

    const footer = ws.getRow(rIdx);
    footer.height = 40;
    footer.getCell(1).value = "الإجمالي (تفصيل)";
    footer.getCell(1).alignment = { vertical: "middle", horizontal: "right", wrapText: true };
    footer.getCell(1).font = { bold: true, color: { argb: BLACK } };
    footer.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
    footer.getCell(1).border = BORDER_BLACK;

    params.allSubCols.forEach((sc, i) => {
      const col = 2 + i;
      const d = params.totalsDetailBySubCol[sc.key] || {
        inv: 0,
        res: 0,
        duty: 0,
        total: 0,
        deficit: 0,
        committees: params.committeesCountBySubCol[sc.key] ?? 0,
      };

      const hasDeficit = Number(d.deficit || 0) > 0;

      row2.getCell(col).value = row2.getCell(col).value;

      footer.getCell(col).value =
        `مراقبة: ${d.inv}\nاحتياط: ${d.res}\nمراقب دور: ${d.duty}\nالمجموع: ${d.total}\nالعجز: ${d.deficit}`;
      footer.getCell(col).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      footer.getCell(col).font = { bold: true, color: { argb: hasDeficit ? RED_TEXT : BLACK } };
      footer.getCell(col).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: hasDeficit ? RED_BG : HEADER_BG },
      };
      footer.getCell(col).border = BORDER_BLACK;
    });

    const ft = footer.getCell(totalColIndex);
    ft.value = "—";
    ft.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    ft.font = { bold: true, color: { argb: BLACK } };
    ft.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
    ft.border = BORDER_BLACK;

    const buffer = await wb.xlsx.writeBuffer();
    downloadBlob(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      filename
    );
  } catch {
    alert("لتصدير XLSX ثبّت exceljs:\\n\\nnpm i exceljs\\n\\nثم أعد تشغيل المشروع.");
  }
}