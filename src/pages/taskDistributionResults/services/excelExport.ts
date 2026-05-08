// src/pages/taskDistributionResults/excelExport.ts
import type { Assignment } from "../../../contracts/taskDistributionContract";
import { downloadBlob } from "./basicUtils";
import { getCommitteeNo, taskLabel, formatPeriod, formatDateWithDayAr } from "./taskUtils";

export type SubCol = {
  key: string; // `${dateISO}__${period}__${subject}`
  dateISO: string;
  subject: string;
  period: string; // AM/PM/...
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
    { inv: number; res: number; corr: number; total: number; deficit: number; committees: number }
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
    const DARK = "FF0B1224";
    const DARK2 = "FF020617";
    const GOLD = "FFB8860B";
    const GOLD_SOFT = "FF8A6B20";

    const GREEN = "FF22C55E";
    const RED = "FFEF4444";

    const BORDER_GOLD = {
      top: { style: "thin" as const, color: { argb: GOLD_SOFT } },
      left: { style: "thin" as const, color: { argb: GOLD_SOFT } },
      bottom: { style: "thin" as const, color: { argb: GOLD_SOFT } },
      right: { style: "thin" as const, color: { argb: GOLD_SOFT } },
    } as const;

    ws.columns = [
      { header: "المعلم", key: "teacher", width: 34 },
      ...params.allSubCols.map((sc) => ({ header: sc.key, key: sc.key, width: 28 })),
      { header: "إجمالي المعلم", key: "__teacher_total__", width: 18 },
    ];

    const totalColIndex = 2 + params.allSubCols.length;

    // Header Row 1
    const row1 = ws.getRow(1);
    row1.height = 26;
    row1.getCell(1).value = "المعلم";
    row1.getCell(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    row1.getCell(1).font = { bold: true, color: { argb: WHITE } };
    row1.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
    row1.getCell(1).border = BORDER_GOLD;

    let colPtr = 2;
    params.displayDates.forEach((dateISO) => {
      const cols = params.dateToSubCols.get(dateISO) || [];
      const span = Math.max(1, cols.length);
      const f = formatDateWithDayAr(dateISO);

      const startCol = colPtr;
      const endCol = colPtr + span - 1;

      ws.mergeCells(1, startCol, 1, endCol);

      const master = row1.getCell(startCol);
      master.value = f.line;

      for (let c = startCol; c <= endCol; c++) {
        const cc = row1.getCell(c);
        cc.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cc.font = { bold: true, color: { argb: WHITE } };
        cc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK2 } };
        cc.border = BORDER_GOLD;
      }

      colPtr = endCol + 1;
    });

    // إجمالي المعلم
    ws.mergeCells(1, totalColIndex, 2, totalColIndex);
    const totalHeadCell = row1.getCell(totalColIndex);
    totalHeadCell.value = "إجمالي المعلم\n(مراقبة+احتياط+مراجعة)";
    totalHeadCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    totalHeadCell.font = { bold: true, color: { argb: WHITE } };
    totalHeadCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
    totalHeadCell.border = BORDER_GOLD;

    // Header Row 2
    const row2 = ws.getRow(2);
    row2.height = 52;
    row2.getCell(1).value = "";
    row2.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
    row2.getCell(1).border = BORDER_GOLD;

    params.allSubCols.forEach((sc, i) => {
      const col = 2 + i;
      const committees = params.committeesCountBySubCol[sc.key] ?? 0;
      row2.getCell(col).value = `${sc.subject || "—"}\n${formatPeriod(sc.period) || ""}\nمجموع اللجان: ${committees}`;
      row2.getCell(col).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      row2.getCell(col).font = { bold: true, color: { argb: WHITE } };
      row2.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
      row2.getCell(col).border = BORDER_GOLD;
    });

    // Data
    let rIdx = 3;
    params.allTeachers.forEach((teacher) => {
      const row = ws.getRow(rIdx);
      row.height = 78;

      row.getCell(1).value = teacher;
      row.getCell(1).alignment = { vertical: "middle", horizontal: "right", wrapText: true };
      row.getCell(1).font = { bold: true, color: { argb: WHITE } };
      row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
      row.getCell(1).border = BORDER_GOLD;

      params.allSubCols.forEach((sc, i) => {
        const col = 2 + i;
        const list = params.matrix2[teacher]?.[sc.key] || [];
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
        row.getCell(col).font = { bold: true, color: { argb: WHITE } };
        row.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
        row.getCell(col).border = BORDER_GOLD;
      });

      // إجمالي المعلم + تلوين
      const tTotal = params.teacherTotals[teacher] ?? 0;
      const tc = row.getCell(totalColIndex);
      tc.value = tTotal;

      let fillArgb = "FF111827";
      if (tTotal < 5) fillArgb = GREEN;
      else if (tTotal > 7) fillArgb = RED;

      tc.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      tc.font = { bold: true, color: { argb: WHITE } };
      tc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
      tc.border = BORDER_GOLD;

      rIdx++;
    });

    // Footer Totals Detail
    const footer = ws.getRow(rIdx);
    footer.height = 32;
    footer.getCell(1).value = "الإجمالي (تفصيل)";
    footer.getCell(1).alignment = { vertical: "middle", horizontal: "right", wrapText: true };
    footer.getCell(1).font = { bold: true, color: { argb: "FF111827" } };
    footer.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
    footer.getCell(1).border = BORDER_GOLD;

    params.allSubCols.forEach((sc, i) => {
      const col = 2 + i;
      const d = params.totalsDetailBySubCol[sc.key] || {
        inv: 0,
        res: 0,
        corr: 0,
        total: 0,
        deficit: 0,
        committees: params.committeesCountBySubCol[sc.key] ?? 0,
      };

      footer.getCell(col).value =
        `مراقبة: ${d.inv}\n` +
        `احتياط: ${d.res}\n` +
        `تصحيح: ${d.corr}\n` +
        `المجموع: ${d.total}\n` +
        `العجز: ${d.deficit}`;

      footer.getCell(col).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      footer.getCell(col).font = { bold: true, color: { argb: "FF111827" } };
      footer.getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
      footer.getCell(col).border = BORDER_GOLD;
    });

    const ft = footer.getCell(totalColIndex);
    ft.value = "—";
    ft.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    ft.font = { bold: true, color: { argb: "FF111827" } };
    ft.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
    ft.border = BORDER_GOLD;

    const buffer = await wb.xlsx.writeBuffer();
    downloadBlob(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      filename
    );
  } catch {
    alert("لتصدير XLSX ثبّت exceljs:\n\nnpm i exceljs\n\nثم أعد تشغيل المشروع.");
  }
}
