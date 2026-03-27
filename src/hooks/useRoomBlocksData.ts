import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import { loadRoomBlocks, saveRoomBlocks, subscribeRoomBlocks, type RoomBlock } from "../services/roomBlocks.service";
import { useTenantArrayState } from "./useTenantArrayState";

export function useRoomBlocksData() {
  const { user, effectiveTenantId } = useAuth() as any;
  const tenantId = String(effectiveTenantId || "").trim();

  const state = useTenantArrayState<RoomBlock>({
    tenantId,
    userId: user?.uid,
    load: loadRoomBlocks,
    save: saveRoomBlocks,
    subscribe: subscribeRoomBlocks,
  });

  const itemsRef = useRef<RoomBlock[]>(state.items);
  useEffect(() => {
    itemsRef.current = state.items;
  }, [state.items]);

  const createRoomBlock = useCallback(async (block: RoomBlock) => {
    const next = [block, ...itemsRef.current];
    itemsRef.current = next;
    state.setItems(next);
    await state.persistNow(next);
  }, [state.setItems, state.persistNow]);

  const deleteRoomBlocksByRoomId = useCallback(async (roomId: string) => {
    const next = itemsRef.current.filter((block) => block.roomId !== roomId);
    itemsRef.current = next;
    state.setItems(next);
    await state.persistNow(next);
  }, [state.setItems, state.persistNow]);

  const replaceRoomBlocks = useCallback(async (next: RoomBlock[]) => {
    itemsRef.current = next;
    state.setItems(next);
    await state.persistNow(next);
  }, [state.setItems, state.persistNow]);

  return useMemo(() => ({
    tenantId,
    roomBlocks: state.items,
    setRoomBlocks: state.setItems,
    roomBlocksLoading: state.loading,
    roomBlocksLoaded: state.loaded,
    roomBlocksError: state.error,
    reloadRoomBlocks: state.reload,
    persistRoomBlocksNow: state.persistNow,
    createRoomBlock,
    deleteRoomBlocksByRoomId,
    replaceRoomBlocks,
  }), [tenantId, state.items, state.setItems, state.loading, state.loaded, state.error, state.reload, state.persistNow, createRoomBlock, deleteRoomBlocksByRoomId, replaceRoomBlocks]);
}
