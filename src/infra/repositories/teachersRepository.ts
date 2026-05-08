import type { Teacher } from "../../entities/teacher/model";
import { upsertTenantDoc } from "../../services/tenantDb";
import { createTenantArrayRepository } from "./createTenantArrayRepository";

const baseRepository = createTenantArrayRepository<Teacher>("teachers");

function safeTenantId(tenantId: string) {
  return String(tenantId || "").trim() || "default";
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function cryptoRandomId() {
  try {
    return (crypto?.randomUUID?.() as string) || `t_${Math.random().toString(36).slice(2, 10)}`;
  } catch {
    return `t_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function normalizeTeacherForImport(teacher: Teacher): Teacher {
  const id = clean((teacher as any).id) || clean((teacher as any).email) || cryptoRandomId();

  return {
    ...(teacher || ({} as Teacher)),
    id,
  } as Teacher;
}

export const teachersRepository = {
  list: baseRepository.list,
  subscribe: baseRepository.subscribe,
  replaceAll: baseRepository.replaceAll,

  async importBatch(tenantId: string, teachers: Teacher[]) {
    const tid = safeTenantId(tenantId);
    const rows = (Array.isArray(teachers) ? teachers : []).map(normalizeTeacherForImport);

    if (!rows.length) return;

    try {
      const { writeBatch, doc, serverTimestamp } = await import("firebase/firestore");
      const { db } = await import("../../firebase/firebase");
      const batch = writeBatch(db);

      for (const teacher of rows) {
        const id = clean((teacher as any).id) || cryptoRandomId();
        batch.set(
          doc(db, "tenants", tid, "teachers", id),
          {
            ...teacher,
            id,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      await batch.commit();
    } catch {
      for (const teacher of rows) {
        const id = clean((teacher as any).id) || cryptoRandomId();
        await upsertTenantDoc(tid, "teachers", { ...teacher, id } as any);
      }
    }
  },
};
