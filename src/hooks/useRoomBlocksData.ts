import { useMemo } from "react";
import { useAuth } from "../auth/AuthContext";
import { loadRoomBlocks, saveRoomBlocks, type RoomBlock } from "../services/roomBlocks.service";
import { useTenantArrayState } from "./useTenantArrayState";

export function useRoomBlocksData() {
  const { user, effectiveTenantId } = useAuth() as any;
  const tenantId = String(effectiveTenantId || "").trim();

  const state = useTenantArrayState<RoomBlock>({
    tenantId,
    userId: user?.uid,
    load: loadRoomBlocks,
    save: saveRoomBlocks,
  });

  return useMemo(() => ({
    tenantId,
    roomBlocks: state.items,
    setRoomBlocks: state.setItems,
    roomBlocksLoading: state.loading,
    roomBlocksLoaded: state.loaded,
    roomBlocksError: state.error,
    reloadRoomBlocks: state.reload,
    persistRoomBlocksNow: state.persistNow,
  }), [tenantId, state]);
}
