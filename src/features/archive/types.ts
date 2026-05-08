import type { ArchivedDistributionRun } from "../../utils/taskDistributionStorage";

export type ArchiveItem = ArchivedDistributionRun & {
  __source?: "local" | "cloud" | "both";
};
