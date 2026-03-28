import { useMemo } from "react";
import { useAuth } from "../auth/AuthContext";
import { loadRooms, saveRooms, type Room } from "../services/rooms.service";
import { useTenantArrayState } from "./useTenantArrayState";

export function useRoomsData() {
  const { user, effectiveTenantId } = useAuth() as any;
  const tenantId = String(effectiveTenantId || "").trim();

  const state = useTenantArrayState<Room>({
    tenantId,
    userId: user?.uid,
    load: (tid) => loadRooms<Room>(tid),
    save: (tid, items, uid) => saveRooms<Room>(tid, items, uid),
  });

  return useMemo(() => ({
    tenantId,
    rooms: state.items,
    setRooms: state.setItems,
    roomsLoading: state.loading,
    roomsLoaded: state.loaded,
    roomsError: state.error,
    reloadRooms: state.reload,
    persistRoomsNow: state.persistNow,
  }), [tenantId, state]);
}
