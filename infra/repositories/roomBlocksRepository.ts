import type { RoomBlock } from "../../entities/roomBlock.model";
import { createTenantArrayRepository } from "./createTenantArrayRepository";

const baseRepository = createTenantArrayRepository<RoomBlock>("roomBlocks");

export const roomBlocksRepository = {
  list: baseRepository.list,
  replaceAll: baseRepository.replaceAll,
};
