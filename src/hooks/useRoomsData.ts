import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import { loadRooms, saveRooms, subscribeRooms, type Room } from "../services/rooms.service";
import { useTenantArrayState } from "./useTenantArrayState";

export function useRoomsData() {
  const { user, effectiveTenantId } = useAuth() as any;
  const tenantId = String(effectiveTenantId || "").trim();

  const state = useTenantArrayState<Room>({
    tenantId,
    userId: user?.uid,
    load: (tid) => loadRooms<Room>(tid),
    save: (tid, items, uid) => saveRooms<Room>(tid, items, uid),
    subscribe: (tid, onChange, onError) => subscribeRooms(tid, onChange as any, onError),
  });

  const itemsRef = useRef<Room[]>(state.items);
  useEffect(() => {
    itemsRef.current = state.items;
  }, [state.items]);

  const createRoom = useCallback(async (room: Room) => {
    const next = [{ ...room, status: room.status || "active" }, ...itemsRef.current];
    itemsRef.current = next;
    state.setItems(next);
    await state.persistNow(next);
  }, [state.setItems, state.persistNow]);

  const updateRoom = useCallback(async (room: Room) => {
    const next = itemsRef.current.map((item) => item.id === room.id ? { ...room, status: room.status || "active" } : item);
    itemsRef.current = next;
    state.setItems(next);
    await state.persistNow(next);
  }, [state.setItems, state.persistNow]);

  const deleteRoom = useCallback(async (roomId: string) => {
    const next = itemsRef.current.filter((item) => item.id !== roomId);
    itemsRef.current = next;
    state.setItems(next);
    await state.persistNow(next);
  }, [state.setItems, state.persistNow]);

  const deleteAllRooms = useCallback(async () => {
    itemsRef.current = [];
    state.setItems([]);
    await state.persistNow([]);
  }, [state.setItems, state.persistNow]);

  return useMemo(() => ({
    tenantId,
    rooms: state.items,
    setRooms: state.setItems,
    loading: state.loading,
    loaded: state.loaded,
    error: state.error,
    saving: false,
    roomsLoading: state.loading,
    roomsLoaded: state.loaded,
    roomsError: state.error,
    reloadRooms: state.reload,
    persistRoomsNow: state.persistNow,
    createRoom,
    updateRoom,
    deleteRoom,
    deleteAllRooms,
  }), [tenantId, state.items, state.setItems, state.loading, state.loaded, state.error, state.reload, state.persistNow, createRoom, updateRoom, deleteRoom, deleteAllRooms]);
}
