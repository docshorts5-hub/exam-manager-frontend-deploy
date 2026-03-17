export type CanAddTaskToEmptyCellInput = {
  taskType: string;
  required: number;
  invigilationDeficit: number;
  reserveCount: number;
  unavailableReason?: string | null;
};

export function canAddTaskToEmptyCell(input: CanAddTaskToEmptyCellInput): boolean {
  const { taskType, required, invigilationDeficit, reserveCount, unavailableReason } = input;
  if (unavailableReason) return false;

  if (taskType === "INVIGILATION") {
    return invigilationDeficit > 0;
  }

  if (taskType === "RESERVE") {
    if (required <= 0) return false;
    return reserveCount === 0;
  }

  return true;
}
