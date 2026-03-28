import type { Room } from "../../entities/room/model";
import { createTenantArrayRepository } from "./createTenantArrayRepository";

const baseRepository = createTenantArrayRepository<Room>("rooms");

export const roomsRepository = {
  list: baseRepository.list,
  replaceAll: baseRepository.replaceAll,
};
