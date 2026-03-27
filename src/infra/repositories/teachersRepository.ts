import type { Teacher } from "../../entities/teacher/model";
import { upsertTenantDoc } from "../../services/tenantDb";
import { createTenantArrayRepository } from "./createTenantArrayRepository";

const baseRepository = createTenantArrayRepository<Teacher>("teachers");

function cryptoRandomId() {
  try {
    return (crypto?.randomUUID?.() as string) || `t_${Math.random().toString(36).slice(2, 10)}`;
  } catch {
    return `t_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export const teachersRepository = {
  list: baseRepository.list,
  subscribe: baseRepository.subscribe,
  replaceAll: baseRepository.replaceAll,
  async importBatch(tenantId: string, teachers: Teacher[]) {
    try {
      const { writeBatch, doc } = await import("firebase/firestore");
      const { db } = await import("../../firebase/firebase");
      const batch = writeBatch(db);
      for (const teacher of teachers) {
        const id = (teacher as any).id || (teacher as any).email || cryptoRandomId();
        batch.set(doc(db, `tenants/${tenantId}/teachers/${id}`), { ...teacher, id }, { merge: true });
      }
      await batch.commit();
    } catch {
      for (const teacher of teachers) {
        const id = (teacher as any).id || (teacher as any).email || cryptoRandomId();
        await upsertTenantDoc(tenantId, "teachers", { ...teacher, id } as any);
      }
    }
  },
};
