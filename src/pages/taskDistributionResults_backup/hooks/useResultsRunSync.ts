import { useEffect, useState } from "react";
import { loadRun, RUN_UPDATED_EVENT } from "../../../utils/taskDistributionStorage";
import { ensureUidsOnRun } from "../uidUtils";
import { loadAndPersistResultsRun, shouldRefreshResultsRun } from "../services/resultsRunSyncHelpers";

export function useResultsRunSync(tenantId: string) {
  const [run, setRun] = useState(() => ensureUidsOnRun(loadRun(tenantId)));

  useEffect(() => {
    const refresh = () => {
      const loaded = loadAndPersistResultsRun(tenantId);
      setRun(loaded);
    };

    refresh();

    const onFocus = () => refresh();
    const onUpdated = (e: any) => {
      const tid = String(e?.detail?.tenantId || "").trim();
      if (shouldRefreshResultsRun(tid, tenantId)) refresh();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener(RUN_UPDATED_EVENT, onUpdated as any);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(RUN_UPDATED_EVENT, onUpdated as any);
    };
  }, [tenantId]);

  return { run, setRun };
}
