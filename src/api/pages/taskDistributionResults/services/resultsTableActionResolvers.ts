import { buildResultsCellUnavailabilityReason } from './resultsTableActionHelpers';

type ResolverArgs = {
  teacherNameToId: Map<string, string>;
  unavailIndex: Set<string>;
  unavailReasonMap: Map<string, string>;
};

export function createResultsCellUnavailabilityResolver({
  teacherNameToId,
  unavailIndex,
  unavailReasonMap,
}: ResolverArgs) {
  return (teacherName: string, subColKey: string, taskType: string): string | null =>
    buildResultsCellUnavailabilityReason({
      teacherName,
      subColKey,
      taskType,
      teacherNameToId,
      unavailIndex,
      unavailReasonMap,
    });
}
