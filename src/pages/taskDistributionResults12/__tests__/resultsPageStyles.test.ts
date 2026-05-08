import { describe, expect, it } from "vitest";
import { getResultsHeader3DStyles, getResultsTableHeaderStyles } from "../services/resultsPageStyles";

describe("resultsPageStyles", () => {
  it("builds header styles with the provided gold line", () => {
    const styles = getResultsHeader3DStyles("#b8860b");
    expect(styles.outer.border).toContain("#b8860b");
    expect(styles.rim.position).toBe("absolute");
    expect(styles.shine.pointerEvents).toBe("none");
  });

  it("builds teacher header styles with supplied colors", () => {
    const styles = getResultsTableHeaderStyles({
      tableText: "#fff",
      tableFontSize: "12px",
      goldLine: "#111",
      goldLineSoft: "#222",
    });
    expect(styles.teacherHeaderStyle.color).toBe("#fff");
    expect(styles.teacherHeaderStyle.borderLeft).toContain("#111");
    expect(styles.teacherTotalHeaderStyle.borderBottom).toContain("#222");
  });
});
