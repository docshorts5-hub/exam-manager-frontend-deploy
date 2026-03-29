import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  loadRooms,
  saveRooms,
  subscribeRooms,
  type Room,
} from "../services/rooms.service";
import { useTenantArrayState } from "./useTenantArrayState";

export function useRoomsData() {
  const { user, effectiveTenantId } = useAuth() as any;
  const tenantId = String(effectiveTenantId || "").trim();

  const state = useTenantArrayState<Room>({
    tenantId,
    userId: user?.uid,
    load: loadRooms,
    save: saveRooms,
    subscribe: subscribeRooms,
  });

  const itemsRef = useRef<Room[]>(state.items);

  useEffect(() => {
    itemsRef.current = state.items;
  }, [state.items]);

  const createRoom = useCallback(
    async (room: Room) => {
      const next = [{ ...room, status: room.status || "active" }, ...itemsRef.current];
      await state.persistNow(next);
    },
    [state.persistNow]
  );

  const updateRoom = useCallback(
    async (room: Room) => {
      const next = itemsRef.current.map((item) =>
        item.id === room.id
          ? { ...room, status: room.status || "active" }
          : item
      );
      await state.persistNow(next);
    },
    [state.persistNow]
  );

  const deleteRoom = useCallback(
    async (roomId: string) => {
      const next = itemsRef.current.filter((item) => item.id !== roomId);
      await state.persistNow(next);
    },
    [state.persistNow]
  );

  const deleteAllRooms = useCallback(async () => {
    await state.persistNow([]);
  }, [state.persistNow]);

  return useMemo(
    () => ({
      tenantId,
      rooms: state.items,
      setRooms: state.setItems,
      loading: state.loading,
      loaded: state.loaded,
      error: state.error,
      saving: state.saving,
      roomsLoading: state.loading,
      roomsLoaded: state.loaded,
      roomsError: state.error,
      reloadRooms: state.reload,
      persistRoomsNow: state.persistNow,
      createRoom,
      updateRoom,
      deleteRoom,
      deleteAllRooms,
    }),
    [
      tenantId,
      state.items,
      state.setItems,
      state.loading,
      state.loaded,
      state.error,
      state.saving,
      state.reload,
      state.persistNow,
      createRoom,
      updateRoom,
      deleteRoom,
      deleteAllRooms,
    ]
  );
}