import {
  AuditLog,
  Exam,
  Room,
  RoomBlock,
  Run,
  SchoolSettings,
  Task,
  Teacher,
  Unavailability,
  ID
} from "./types";

const DB_NAME = "exam-manager-db";
const DB_VERSION = 1;

export const STORES = {
  teachers: "teachers",
  exams: "exams",
  rooms: "rooms",
  unavailability: "unavailability",
  roomBlocks: "roomBlocks",
  runs: "runs",
  tasks: "tasks",
  settings: "settings",
  audit: "audit"
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

function id(): ID {
  return crypto.randomUUID();
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      const ensure = (name: StoreName) => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      };

      ensure(STORES.teachers);
      ensure(STORES.exams);
      ensure(STORES.rooms);
      ensure(STORES.unavailability);
      ensure(STORES.roomBlocks);
      ensure(STORES.runs);
      ensure(STORES.tasks);
      ensure(STORES.settings);
      ensure(STORES.audit);
    };

    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

async function tx<T>(storeName: StoreName, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const store = t.objectStore(storeName);
    const req = fn(store);

    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result as T);

    t.oncomplete = () => db.close();
    t.onerror = () => db.close();
  });
}

export async function getAll<T>(storeName: StoreName): Promise<T[]> {
  return tx<T[]>(storeName, "readonly", (s) => s.getAll());
}

export async function getById<T>(storeName: StoreName, key: ID): Promise<T | undefined> {
  return tx<T | undefined>(storeName, "readonly", (s) => s.get(key));
}

export async function put<T extends { id: ID }>(storeName: StoreName, value: T): Promise<void> {
  await tx(storeName, "readwrite", (s) => s.put(value));
}

export async function del(storeName: StoreName, key: ID): Promise<void> {
  await tx(storeName, "readwrite", (s) => s.delete(key));
}

export async function clear(storeName: StoreName): Promise<void> {
  await tx(storeName, "readwrite", (s) => s.clear());
}

export async function count(storeName: StoreName): Promise<number> {
  return tx<number>(storeName, "readonly", (s) => s.count());
}

export async function ensureDefaults(): Promise<void> {
  // Settings default
  const settingsAll = await getAll<SchoolSettings>(STORES.settings);
  if (settingsAll.length === 0) {
    const settings: SchoolSettings = {
      id: "settings",
      schoolName: "مدرسة",
      authority: "وزارة التربية والتعليم",
      academicYear: "2026/2025",
      term: "الفصل الدراسي الأول",
      phone: "",
      policy: {
        maxPerDayDefault: 2,
        avoidBackToBack: true,
        binPolicyMode: "SOFT",
        prefer12ForSubject12: true,
        ban13LastDay: true,
        ban14LastTwoDays: true
      }
    };
    await put(STORES.settings, settings);
  }

  // Rooms default (1..30)
  const roomsAll = await getAll<Room>(STORES.rooms);
  if (roomsAll.length === 0) {
    for (let n = 1; n <= 30; n++) {
      const r: Room = { id: `room-${n}`, number: n, label: `قاعة ${n}`, capacity: 30 };
      await put(STORES.rooms, r);
    }
  }
}

export async function addAudit(action: string, details?: string): Promise<void> {
  const log: AuditLog = { id: id(), at: Date.now(), action, details };
  await put(STORES.audit, log);
}

export async function exportAll(): Promise<any> {
  const payload = {
    teachers: await getAll<Teacher>(STORES.teachers),
    exams: await getAll<Exam>(STORES.exams),
    rooms: await getAll<Room>(STORES.rooms),
    unavailability: await getAll<Unavailability>(STORES.unavailability),
    roomBlocks: await getAll<RoomBlock>(STORES.roomBlocks),
    runs: await getAll<Run>(STORES.runs),
    tasks: await getAll<Task>(STORES.tasks),
    settings: await getAll<SchoolSettings>(STORES.settings),
    audit: await getAll<AuditLog>(STORES.audit)
  };
  return payload;
}

export async function importAll(payload: any): Promise<void> {
  const safePutMany = async <T extends { id: ID }>(store: StoreName, arr: T[] | undefined) => {
    if (!Array.isArray(arr)) return;
    for (const x of arr) await put(store, x);
  };

  // ملاحظة: هذا لا يحذف القديم تلقائياً. إن أردت “استبدال كامل”، نفّذ clear قبل الاستيراد.
  await safePutMany(STORES.teachers, payload?.teachers);
  await safePutMany(STORES.exams, payload?.exams);
  await safePutMany(STORES.rooms, payload?.rooms);
  await safePutMany(STORES.unavailability, payload?.unavailability);
  await safePutMany(STORES.roomBlocks, payload?.roomBlocks);
  await safePutMany(STORES.runs, payload?.runs);
  await safePutMany(STORES.tasks, payload?.tasks);
  await safePutMany(STORES.settings, payload?.settings);
  await safePutMany(STORES.audit, payload?.audit);
}

export function newId(): ID {
  return id();
}
