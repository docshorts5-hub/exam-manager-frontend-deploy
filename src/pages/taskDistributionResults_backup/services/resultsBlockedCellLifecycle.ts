import { addResultsBlockedCellMessage, removeResultsBlockedCellMessage } from './resultsInteractionHelpers';

export type ResultsBlockedCellSetter = (
  updater: (prev: Record<string, string>) => Record<string, string>,
) => void;

export type ResultsBlockedCellScheduler = (callback: () => void, delayMs: number) => unknown;

export function scheduleResultsBlockedCellMessage(
  setBlockedCellMsg: ResultsBlockedCellSetter,
  teacherName: string,
  subColKey: string,
  msg: string,
  scheduler: ResultsBlockedCellScheduler = (callback, delayMs) => window.setTimeout(callback, delayMs),
  delayMs = 8000,
) {
  setBlockedCellMsg((prev) => addResultsBlockedCellMessage(prev, teacherName, subColKey, msg));
  return scheduler(() => {
    setBlockedCellMsg((prev) => removeResultsBlockedCellMessage(prev, teacherName, subColKey));
  }, delayMs);
}
