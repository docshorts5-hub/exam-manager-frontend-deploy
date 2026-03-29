import type { ExamRoomAssignment } from "../../entities/examRoomAssignment.model";
import { createTenantArrayRepository } from "./createTenantArrayRepository";

const baseRepository = createTenantArrayRepository<ExamRoomAssignment>("examRoomAssignments");

export const examRoomAssignmentsRepository = {
  list: baseRepository.list,
  replaceAll: baseRepository.replaceAll,
};
