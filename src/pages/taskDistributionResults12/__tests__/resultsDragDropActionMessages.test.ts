import {
  getResultsDragDropTypeMismatchMessage,
  getResultsDragDropUnsupportedMessage,
  getResultsEmptyCellOccupiedMessage,
} from "../services/resultsDragDropActionMessages";

describe("resultsDragDropActionMessages", () => {
  it("returns the unsupported drag/drop message", () => {
    expect(getResultsDragDropUnsupportedMessage()).toContain("السحب والإفلات");
  });

  it("returns the type mismatch message", () => {
    expect(getResultsDragDropTypeMismatchMessage()).toContain("نوعين مختلفين");
  });

  it("returns the occupied empty-cell message", () => {
    expect(getResultsEmptyCellOccupiedMessage()).toContain("مهمة بالفعل");
  });
});
