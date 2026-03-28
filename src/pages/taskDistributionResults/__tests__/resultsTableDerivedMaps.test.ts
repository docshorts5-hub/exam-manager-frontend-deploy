import { describe, expect, it } from "vitest";
import {
  buildInvigilationDeficitBySubCol,
  buildRequiredBySubCol,
  buildReserveCountBySubCol,
} from "../services/resultsTableDerivedMaps";

describe("resultsTableDerivedMaps", () => {
  it("builds deficit map without negative values", () => {
    const result = buildInvigilationDeficitBySubCol({
      a: { inv: 2, res: 1, corr: 0, total: 3, deficit: 0, committees: 2, required: 5 },
      b: { inv: 4, res: 0, corr: 0, total: 4, deficit: 0, committees: 2, required: 3 },
    });

    expect(result).toEqual({ a: 3, b: 0 });
  });

  it("builds reserve and required maps with safe fallbacks", () => {
    const source = {
      a: { inv: 2, res: 1, corr: 0, total: 3, deficit: 0, committees: 2, required: 5 },
      b: { inv: 1, res: 0, corr: 0, total: 1, deficit: 0, committees: 1 },
    };

    expect(buildReserveCountBySubCol(source)).toEqual({ a: 1, b: 0 });
    expect(buildRequiredBySubCol(source)).toEqual({ a: 5, b: 0 });
  });
});
