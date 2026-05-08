export const SCHEMA_VERSION = "v1";

interface ExportMeta {
  schema: string;
  createdAt: string;
}

interface ExportedData {
  [key: string]: string | null;   // ← يحل خطأ ts(7053)
}

interface ExportedDatabase {
  meta: ExportMeta;
  data: ExportedData;
}

export function exportDatabase(): ExportedDatabase {
  const data: ExportedData = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    if (key.startsWith("exam-manager")) {
      data[key] = localStorage.getItem(key);   // الآن آمن
    }
  }

  return {
    meta: {
      schema: SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
    },
    data,
  };
}

// ────────────────────────────────────────────────

export interface ImportPreview {
  totalKeys: number;
  keys: string[];
}

export function previewImport(file: ExportedDatabase): ImportPreview {
  //                                 ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
  // هذا يحل خطأ Parameter 'file' implicitly has an 'any' type  (ts7006)

  const keys = Object.keys(file.data);

  return {
    totalKeys: keys.length,
    keys,
  };
}

// ────────────────────────────────────────────────

export function importDatabase(file: unknown): void {
  //                           ↑↑↑↑↑↑
  // نستخدم unknown + type guard لتجنب any

  if (!isValidExportedDatabase(file)) {
    throw new Error("Invalid import file format");
  }

  if (file.meta.schema !== SCHEMA_VERSION) {
    throw new Error(`Schema version mismatch. Expected ${SCHEMA_VERSION}`);
  }

  Object.entries(file.data).forEach(([key, value]) => {
    // value هو string | null هنا
    if (value !== null) {
      localStorage.setItem(key, value);     // الآن آمن (يحل ts2345)
    } else {
      // اختياري: حذف المفتاح إذا كان null في الملف المستورد
      localStorage.removeItem(key);
    }
  });
}

// Type Guard ────────────────────────────────────────

function isValidExportedDatabase(value: unknown): value is ExportedDatabase {
  if (!value || typeof value !== "object") return false;

  const obj = value as Record<string, unknown>;

  // فحص meta
  if (!obj.meta || typeof obj.meta !== "object") return false;
  const meta = obj.meta as Record<string, unknown>;
  if (typeof meta.schema !== "string") return false;
  if (typeof meta.createdAt !== "string") return false;

  // فحص data
  if (!obj.data || typeof obj.data !== "object") return false;

  // يمكنك إضافة فحص أكثر دقة إذا أردت (مثلاً التحقق من قيم data)
  return true;
}