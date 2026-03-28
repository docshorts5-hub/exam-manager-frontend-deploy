import { describe, expect, it, vi } from "vitest";
import { runTaskDistributionOptimized, scoreDistributionRun } from "../services/taskDistributionRunner";

describe("scoreDistributionRun", () => {
  it("scores missing invigilation and reserve slots separately", () => {
    const score = scoreDistributionRun({
      debug: {
        unfilled: [
          { kind: "INVIGILATION", required: 3, assigned: 1 },
          { kind: "RESERVE", required: 2, assigned: 1 },
        ],
      },
    });

    expect(score).toEqual({ invMissing: 2, resMissing: 1, totalMissing: 3 });
  });
});

describe("runTaskDistributionOptimized", () => {
  it("keeps the best candidate based on missing slots", () => {
    const engine = vi
      .fn()
      .mockReturnValueOnce({ debug: { unfilled: [{ kind: "INVIGILATION", required: 2, assigned: 0 }] } })
      .mockReturnValueOnce({ debug: { unfilled: [{ kind: "INVIGILATION", required: 2, assigned: 1 }] } });

    const result = runTaskDistributionOptimized({
      teachers: [],
      exams: [],
      constraints: { optimizationAttempts: 2 },
      engine,
    });

    expect(engine).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ debug: { unfilled: [{ kind: "INVIGILATION", required: 2, assigned: 1 }] } });
  });
});
