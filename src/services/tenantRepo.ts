// src/services/tenantRepo.ts
import { collection, doc } from "firebase/firestore";
// IMPORTANT: This repo is for Firestore tenant-scoped collections.
// Do NOT import the IndexedDB local store (src/api/db.ts) here.
import { db } from "../firebase/firebase";

export function tenantCollection(tenantId: string, name: string) {
  return collection(db, "tenants", tenantId, name);
}

export function tenantDoc(tenantId: string, name: string, id: string) {
  return doc(db, "tenants", tenantId, name, id);
}

export function createTenantRepo(tenantId: string) {
  return {
    tenantId,
    teachers: tenantCollection(tenantId, "teachers"),
    rooms: tenantCollection(tenantId, "rooms"),
    exams: tenantCollection(tenantId, "exams"),
    distributions: tenantCollection(tenantId, "distributions"),
    reports: tenantCollection(tenantId, "reports"),
    archive: tenantCollection(tenantId, "archive"),

    metaConfigDoc: doc(db, "tenants", tenantId, "meta", "config"),
  };
}
