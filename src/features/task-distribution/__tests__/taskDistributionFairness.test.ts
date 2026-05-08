import { describe, expect, it } from "vitest";
import { buildFairnessRows } from "../services/taskDistributionFairness";

describe("buildFairnessRows", () => {
  it("counts invigilation and reserve assignments and de-duplicates free review per day", () => {
    const rows = buildFairnessRows({
      teachers: [{ id: "t1", fullName: "أحمد" }],
      assignments: [
        { teacherId: "t1", taskType: "INVIGILATION", dateISO: "2026-01-01" },
        { teacherId: "t1", taskType: "RESERVE", dateISO: "2026-01-02" },
        { teacherId: "t1", taskType: "REVIEW_FREE", dateISO: "2026-01-03" },
        { teacherId: "t1", taskType: "REVIEW_FREE", dateISO: "2026-01-03" },
        { teacherId: "t1", taskType: "CORRECTION_FREE", dateISO: "2026-01-04" },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      teacherId: "t1",
      teacherName: "أحمد",
      inv: 1,
      res: 1,
      rev: 1,
      cor: 1,
      total: 3,
    });
  });
});
