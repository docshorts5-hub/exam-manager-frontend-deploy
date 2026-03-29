// src/pages/taskDistributionResults/masterTableStorage.ts
import { ALL_TABLE_KEY, MASTER_TABLE_KEY, RESULTS_TABLE_KEY } from "./constants";
import { MASTER_TABLE_UPDATED_EVENT } from "../../utils/taskDistributionStorage";

type MasterTableMeta = {
  runId?: string;
  runCreatedAtISO?: string;
  ts?: number;
  source?: "run" | "manual" | string;
};

/**
 * ✅ تفريغ/استبدال بيانات الجدول الشامل
 * (يتم تحديث أكثر من key لأن صفحات متعددة تقرأ من مخازن مختلفة)
 */
export function writeMasterTable(assignments: any[], meta?: MasterTableMeta) {
  const payload = { rows: assignments, data: assignments, meta: { ...(meta || {}), ts: Date.now() } };
  const raw = JSON.stringify(payload);
  localStorage.setItem(MASTER_TABLE_KEY, raw);
  localStorage.setItem(ALL_TABLE_KEY, raw);
  localStorage.setItem(RESULTS_TABLE_KEY, raw);
  try {
    window.dispatchEvent(
      new CustomEvent(MASTER_TABLE_UPDATED_EVENT, { detail: { ts: Date.now(), source: meta?.source || "manual" } })
    );
  } catch {}
}
