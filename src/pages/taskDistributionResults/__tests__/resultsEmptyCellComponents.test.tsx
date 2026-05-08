import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ResultsEmptyCellStatusMessages } from "../components/ResultsEmptyCellStatusMessages";
import { ResultsEmptyCellAddMenu } from "../components/ResultsEmptyCellAddMenu";
import { ResultsTeacherTotalCell } from "../components/ResultsTeacherTotalCell";

describe("results empty cell components", () => {
  it("renders blocked message with priority over add state", () => {
    const html = renderToStaticMarkup(
      <ResultsEmptyCellStatusMessages
        blockedMsg="خلية محجوبة"
        unavailabilityMsg="غير متاح"
        openAdd={true}
      />,
    );

    expect(html).toContain("خلية محجوبة");
    expect(html).not.toContain("اختر نوع المهمة");
  });

  it("renders add menu buttons with disabled title when cannot add", () => {
    const html = renderToStaticMarkup(
      <ResultsEmptyCellAddMenu
        addChoices={[
          { key: "INVIGILATION", label: "مراقبة" },
          { key: "RESERVE", label: "احتياط" },
        ]}
        addBtnStyle={{}}
        canAdd={(taskType) => taskType === "INVIGILATION"}
        getAddTitle={(taskType) => (taskType === "RESERVE" ? "تمت إضافة احتياط" : undefined)}
        onAddChoice={() => {}}
        onCloseAdd={() => {}}
        showInvigilationHint={true}
        invigilationHintText="لا يوجد عجز"
      />,
    );

    expect(html).toContain("مراقبة");
    expect(html).toContain("احتياط");
    expect(html).toContain("تمت إضافة احتياط");
    expect(html).toContain("لا يوجد عجز");
  });

  it("renders teacher total cell with the given total", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <tr>
            <ResultsTeacherTotalCell total={8} tableText="#fff" goldLine="#d4af37" goldLineSoft="#b8860b" />
          </tr>
        </tbody>
      </table>,
    );

    expect(html).toContain(">8<");
  });
});
