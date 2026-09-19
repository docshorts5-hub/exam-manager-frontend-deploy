import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom"; 
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { loadTenantArray, loadTenantSettings, replaceTenantArray } from "../services/tenantData";
import { createId, isRoomBlockedToday } from "../lib/roomScheduling";
import type { Room } from "../services/rooms.service";
import type { RoomBlock } from "../services/roomBlocks.service";


const ROOMS12_BORDER_COLORS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#4f46e5",
  "#db2777",
  "#ca8a04",
  "#059669",
];

const rooms12BorderColor = (index: number) =>
  ROOMS12_BORDER_COLORS[Math.abs(index) % ROOMS12_BORDER_COLORS.length];

const rooms12ColoredBorder = (index: number) =>
  `3px solid ${rooms12BorderColor(index)}`;

const APP_NAME = "";
const ROOMS12_SUBCOLLECTION = "rooms";
const ROOMS12_BLOCKS_SUBCOLLECTION = "roomBlocks";
const ROOMS12_LEGACY_ROOMS_CACHE_KEY = "exam-manager:rooms12-cache:v1";
const ROOMS12_LEGACY_BLOCKS_CACHE_KEY = "exam-manager:roomBlocks12-cache:v1";
const DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID = "diplomaExamCenter";

const ROOMS12_EXAM_CENTER_DATA_KEY = "exam-manager:exam-center-data:v1";
const ROOMS12_EXAM_CENTER_LOGO_KEY = "exam-manager:exam-center-logo:v1";
const ROOMS12_CONTROL_HEAD_NAME_KEY = "exam-manager:control-head-name:v1";
const ROOMS12_DEFAULT_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

type Rooms12ExamCenterData = {
  name?: string;
  examCenterCode?: string;
  centerCode?: string;
  governorate?: string;
  semester?: string;
  phone?: string;
  address?: string;
  controlHeadName?: string;
  academicYear?: string;
  logo?: string;
};

// 🛡️ SECURITY LAYER: التنظيف الجذري للمدخلات (CSV, Excel & Manual) 🛡️
const sanitizeInput = (input: string | null | undefined): string => {
  if (!input) return "";
  let sanitized = String(input)
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  // الحماية من Spreadsheet Injection (Excel/CSV Macro Injection)
  if (/^[=\-+\@]/.test(sanitized)) {
    sanitized = "'" + sanitized;
  }
  return sanitized;
};

function rooms12Clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function rooms12TenantIdFromAuth(auth: any) {
  return (
    String(
      auth?.effectiveTenantId ||
        auth?.profile?.tenantId ||
        auth?.userProfile?.tenantId ||
        auth?.user?.tenantId ||
        "default"
    ).trim() || "default"
  );
}

function rooms12SafeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rooms12AcademicYearFromSystemDate(now = new Date()) {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear} / ${startYear + 1}`;
}

function rooms12ReadExamCenterData(): Rooms12ExamCenterData {
  const saved = rooms12SafeJson<Rooms12ExamCenterData>(
    localStorage.getItem(ROOMS12_EXAM_CENTER_DATA_KEY),
    {}
  );

  return {
    ...saved,
    examCenterCode: rooms12Clean(saved.examCenterCode || saved.centerCode || ""),
    controlHeadName: rooms12Clean(
      saved.controlHeadName || localStorage.getItem(ROOMS12_CONTROL_HEAD_NAME_KEY) || ""
    ),
  };
}

function rooms12ReadOfficialLogo() {
  return rooms12Clean(localStorage.getItem(ROOMS12_EXAM_CENTER_LOGO_KEY)) || ROOMS12_DEFAULT_LOGO_URL;
}


const BUILDING_OPTIONS_AR = [
  { value: "", label: "— اختر المبنى —" },
  { value: "المبنى A", label: "المبنى A" },
  { value: "المبنى B", label: "المبنى B" },
  { value: "المبنى C", label: "المبنى C" },
  { value: "الدور الأرضي", label: "الدور الأرضي" },
  { value: "الدور الأول", label: "الدور الأول" },
  { value: "الدور الثاني", label: "الدور الثاني" },
];

const BUILDING_OPTIONS_EN = [
  { value: "", label: "— Select Building —" },
  { value: "المبنى A", label: "Building A" },
  { value: "المبنى B", label: "Building B" },
  { value: "المبنى C", label: "Building C" },
  { value: "الدور الأرضي", label: "Ground Floor" },
  { value: "الدور الأول", label: "First Floor" },
  { value: "الدور الثاني", label: "Second Floor" },
];

const ROOM_TYPE_OPTIONS_AR = [
  { value: "", label: "— اختر النوع —" },
  { value: "قاعة دراسية", label: "قاعة دراسية" },
  { value: "مختبر", label: "مختبر" },
  { value: "قاعة حاسب", label: "قاعة حاسب" },
  { value: "قاعة متعددة", label: "قاعة متعددة" },
];

const ROOM_TYPE_OPTIONS_EN = [
  { value: "", label: "— Select Type —" },
  { value: "قاعة دراسية", label: "Classroom" },
  { value: "مختبر", label: "Laboratory" },
  { value: "قاعة حاسب", label: "Computer Lab" },
  { value: "قاعة متعددة", label: "Multi-purpose Hall" },
];

const ROOM_STATUS_OPTIONS_AR = [
  { value: "active", label: "نشطة" },
  { value: "inactive", label: "موقوفة" },
];

const ROOM_STATUS_OPTIONS_EN = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const BLOCK_REASON_OPTIONS_AR = [
  { value: "maintenance", label: "صيانة" },
  { value: "reserved", label: "محجوزة" },
  { value: "conflict", label: "تعارض" },
  { value: "admin", label: "قرار إداري" },
];

const BLOCK_REASON_OPTIONS_EN = [
  { value: "maintenance", label: "Maintenance" },
  { value: "reserved", label: "Reserved" },
  { value: "conflict", label: "Conflict" },
  { value: "admin", label: "Administrative Decision" },
];

const BLOCK_SESSION_OPTIONS_AR = [
  { value: "full-day", label: "اليوم كامل" },
  { value: "الفترة الأولى", label: "الفترة الأولى" },
  { value: "الفترة الثانية", label: "الفترة الثانية" },
];

const BLOCK_SESSION_OPTIONS_EN = [
  { value: "full-day", label: "Full Day" },
  { value: "الفترة الأولى", label: "First Period" },
  { value: "الفترة الثانية", label: "Second Period" },
];

const emptyRoom: Room = {
  id: "",
  roomName: "",
  code: "",
  building: "",
  type: "",
  capacity: 30,
  status: "active",
  notes: "",
};

type QuickBlockState = {
  open: boolean;
  roomId: string;
  roomName: string;
  reason: string;
  reasonType: string;
  startDate: string;
  endDate: string;
  session: "الفترة الأولى" | "الفترة الثانية" | "full-day";
};

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): any[] {
  const lines: string[] = [];
  const s = text.replace(/\r/g, "");
  let cur = "";
  let inQ = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') {
      if (inQ && s[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }
    if (ch === "\n" && !inQ) {
      lines.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim() !== "") lines.push(cur);
  if (!lines.length) return [];
  const split = (line: string) => {
    const out: string[] = [];
    let c = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') {
          c += '"';
          i++;
        } else {
          q = !q;
        }
        continue;
      }
      if (ch === "," && !q) {
        out.push(c);
        c = "";
        continue;
      }
      c += ch;
    }
    out.push(c);
    return out.map((x) => x.trim());
  };
  const headers = split(lines[0]);
  const rows = lines.slice(1).map(split);
  return rows.map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? "";
    });
    return obj;
  });
}

function normalizeHeader(h: string) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\u0600-\u06FFa-z0-9]/g, "");
}

function getCell(row: Record<string, unknown>, keys: string[]) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== "") return String(row[k]).trim();
  }
  const map: Record<string, unknown> = {};
  Object.keys(row || {}).forEach((kk) => {
    map[normalizeHeader(kk)] = row[kk];
  });
  for (const nk of keys.map(normalizeHeader)) {
    if (map[nk] != null && String(map[nk]).trim() !== "") return String(map[nk]).trim();
  }
  return "";
}

async function tryReadExcel(file: File): Promise<Record<string, unknown>[] | null> {
  try {
    const XLSX = await import("xlsx");
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
    return json as Record<string, unknown>[];
  } catch {
    return null;
  }
}

// ✅ تم تطبيق الحماية هنا لضمان تنظيف كل مدخلات Excel و CSV قبل حفظها
function parseRoomsFromObjects(rows: Record<string, unknown>[]): Room[] {
  return rows
    .map((r, index) => {
      const roomName = sanitizeInput(getCell(r, ["اسم القاعة", "القاعة", "room", "roomname", "name"]));
      const code = sanitizeInput(getCell(r, ["الكود", "code", "roomCode", "رقم القاعة"]));
      const building = sanitizeInput(getCell(r, ["المبنى", "building", "block", "الدور"]));
      const type = sanitizeInput(getCell(r, ["النوع", "type"]));
      const capacity = Number(getCell(r, ["السعة", "capacity", "cap"])) || 0;
      const statusRaw = String(getCell(r, ["الحالة", "status"]) || "active").toLowerCase();
      const status = (statusRaw === "inactive" || statusRaw === "موقوفة") ? "inactive" : "active";
      const notes = sanitizeInput(getCell(r, ["ملاحظات", "notes", "note"]));

      return {
        id: createId("room"),
        roomName,
        code,
        building,
        type,
        capacity,
        status,
        notes,
      } as Room;
    })
    .filter((x) => x.roomName);
}

function rooms12SafeParseArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rooms12NormalizeRoom(value: any): Room {
  return {
    id: rooms12Clean(value?.id) || createId("room"),
    roomName: sanitizeInput(value?.roomName || value?.name || value?.room),
    code: sanitizeInput(value?.code || value?.roomCode),
    building: sanitizeInput(value?.building),
    type: sanitizeInput(value?.type),
    capacity: Number(value?.capacity) || 0,
    status: value?.status === "inactive" ? "inactive" : "active",
    notes: sanitizeInput(value?.notes),
  } as Room;
}

function rooms12NormalizeRooms(rows: any[]): Room[] {
  return (Array.isArray(rows) ? rows : [])
    .map(rooms12NormalizeRoom)
    .filter((room) => room.roomName);
}

function rooms12NormalizeRoomBlock(value: any): RoomBlock {
  const session =
    value?.session === "الفترة الأولى" || value?.session === "الفترة الثانية" || value?.session === "full-day"
      ? value.session
      : "full-day";

  const status =
    value?.status === "cancelled" || value?.status === "expired" || value?.status === "active"
      ? value.status
      : "active";

  return {
    id: rooms12Clean(value?.id) || createId("block"),
    roomId: rooms12Clean(value?.roomId),
    roomName: sanitizeInput(value?.roomName),
    reason: sanitizeInput(value?.reason),
    reasonType: rooms12Clean(value?.reasonType) || "maintenance",
    blockType: value?.blockType === "partial" ? "partial" : "full",
    startDate: rooms12Clean(value?.startDate) || new Date().toISOString().slice(0, 10),
    endDate: rooms12Clean(value?.endDate) || rooms12Clean(value?.startDate) || new Date().toISOString().slice(0, 10),
    session,
    status,
    createdBy: rooms12Clean(value?.createdBy) || undefined,
  } as RoomBlock;
}

function rooms12NormalizeRoomBlocks(rows: any[]): RoomBlock[] {
  return (Array.isArray(rows) ? rows : [])
    .map(rooms12NormalizeRoomBlock)
    .filter((block) => block.roomId);
}

function rooms12ReadLegacyRooms(): Room[] {
  if (typeof window === "undefined") return [];

  const keys = [
    ROOMS12_LEGACY_ROOMS_CACHE_KEY,
    "rooms",
    "rooms12",
    "exam-manager:rooms",
    "exam-manager:rooms12",
  ];

  let best: Room[] = [];

  for (const key of keys) {
    const parsed = rooms12NormalizeRooms(rooms12SafeParseArray<any>(key));
    if (parsed.length > best.length) best = parsed;
  }

  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i) || "";
      if (!/room|rooms|قاع|قاعة|قاعات/i.test(key)) continue;
      const parsed = rooms12NormalizeRooms(rooms12SafeParseArray<any>(key));
      if (parsed.length > best.length) best = parsed;
    }
  } catch {
    // ignore scan errors
  }

  return best;
}

function rooms12ReadLegacyRoomBlocks(): RoomBlock[] {
  if (typeof window === "undefined") return [];

  const keys = [
    ROOMS12_LEGACY_BLOCKS_CACHE_KEY,
    "roomBlocks",
    "roomBlocks12",
    "exam-manager:roomBlocks",
    "exam-manager:roomBlocks12",
  ];

  let best: RoomBlock[] = [];

  for (const key of keys) {
    const parsed = rooms12NormalizeRoomBlocks(rooms12SafeParseArray<any>(key));
    if (parsed.length > best.length) best = parsed;
  }

  return best;
}

function rooms12CacheRooms(rows: Room[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ROOMS12_LEGACY_ROOMS_CACHE_KEY, JSON.stringify(rows));
  } catch {
    // cache must not break page
  }
}

function rooms12CacheRoomBlocks(rows: RoomBlock[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ROOMS12_LEGACY_BLOCKS_CACHE_KEY, JSON.stringify(rows));
  } catch {
    // cache must not break page
  }
}



type SearchableDropdownOption = { value: string; label: string };

function SearchableDropdown({
  value,
  options,
  placeholder,
  onChange,
  inputStyle,
  direction = "rtl",
  zIndex = 2147483647,
}: {
  value: string;
  options: SearchableDropdownOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  inputStyle: React.CSSProperties;
  direction?: "rtl" | "ltr";
  zIndex?: number;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const rootRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const selected = options.find((option) => String(option.value) === String(value));
  const selectedLabel = selected?.label || placeholder || "—";
  const normalizedSearch = search.trim().toLowerCase();
  const filteredOptions = useMemo(
    () =>
      !normalizedSearch
        ? options
        : options.filter((option) =>
            `${option.label} ${option.value}`.toLowerCase().includes(normalizedSearch)
          ),
    [normalizedSearch, options]
  );

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      if (rootRef.current) setMenuRect(rootRef.current.getBoundingClientRect());
    };

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("mousedown", closeOnOutsideClick);

    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 30);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, [open]);

  const menu =
    open && menuRect && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            dir={direction}
            style={{
              position: "fixed",
              top: Math.min(menuRect.bottom + 6, window.innerHeight - 380),
              left: menuRect.left,
              width: Math.max(menuRect.width, 260),
              maxWidth: "min(92vw, 520px)",
              background: "#fffdf7",
              color: "#000000",
              WebkitTextFillColor: "#000000",
              border: "3px solid #d4af37",
              borderRadius: 18,
              boxShadow: "0 22px 70px rgba(0,0,0,0.34)",
              padding: 10,
              zIndex,
              overflow: "hidden",
            }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={direction === "rtl" ? "بحث داخل القائمة..." : "Search inside list..."}
              style={{
                width: "100%",
                boxSizing: "border-box",
                minHeight: 44,
                borderRadius: 14,
                border: "2px solid #d4af37",
                background: "#f8f4e8",
                color: "#000000",
                WebkitTextFillColor: "#000000",
                caretColor: "#000000",
                fontWeight: 1000,
                fontSize: 15,
                outline: "none",
                padding: "10px 12px",
                marginBottom: 8,
              }}
            />

            <div style={{ maxHeight: 280, overflowY: "auto", display: "grid", gap: 6 }}>
              {filteredOptions.length ? (
                filteredOptions.map((option) => (
                  <button
                    key={`${option.value || "__empty__"}-${option.label}`}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onChange(option.value);
                      setSearch("");
                      setOpen(false);
                    }}
                    style={{
                      border: option.value === value ? "3px solid #16a34a" : "2px solid rgba(212,175,55,0.55)",
                      borderRadius: 14,
                      background: option.value === value ? "#ecfdf5" : "#f8f4e8",
                      color: "#000000",
                      WebkitTextFillColor: "#000000",
                      fontWeight: 1000,
                      textAlign: direction === "rtl" ? "right" : "left",
                      padding: "10px 12px",
                      cursor: "pointer",
                      minHeight: 42,
                    }}
                  >
                    {option.label}
                  </button>
                ))
              ) : (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    background: "#f8f4e8",
                    border: "2px solid rgba(212,175,55,0.55)",
                    color: "#000000",
                    WebkitTextFillColor: "#000000",
                    fontWeight: 1000,
                  }}
                >
                  {direction === "rtl" ? "لا توجد نتائج" : "No results"}
                </div>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={rootRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        style={{
          ...inputStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          cursor: "pointer",
          textAlign: direction === "rtl" ? "right" : "left",
          background: "#f8f4e8",
          color: "#000000",
          WebkitTextFillColor: "#000000",
          fontWeight: 1000,
          position: "relative",
          zIndex: Math.min(zIndex - 2, 2147483645),
        }}
      >
        <span style={{ color: "#000000", WebkitTextFillColor: "#000000", overflow: "hidden", textOverflow: "ellipsis" }}>
          {selectedLabel}
        </span>
        <span style={{ color: "#000000", WebkitTextFillColor: "#000000", fontWeight: 1000 }}>⌄</span>
      </button>
      {menu}
    </>
  );
}

export default function Rooms() {
  const { lang, isRTL } = useI18n();
  const auth = useAuth() as any;
  const user = auth?.user;
  const tr = React.useCallback((ar: string, en: string) => (lang === "ar" ? ar : en), [lang]);
  const tenantId = useMemo(() => rooms12TenantIdFromAuth(auth), [auth]);
  const currentUserId = String(user?.email || user?.uid || "").trim();

  const [officialCenterData, setOfficialCenterData] = useState<Rooms12ExamCenterData>(() =>
    rooms12ReadExamCenterData()
  );
  const [officialLogo, setOfficialLogo] = useState<string>(() => rooms12ReadOfficialLogo());

  const BUILDING_OPTIONS = useMemo(() => (lang === "ar" ? BUILDING_OPTIONS_AR : BUILDING_OPTIONS_EN), [lang]);
  const ROOM_TYPE_OPTIONS = useMemo(() => (lang === "ar" ? ROOM_TYPE_OPTIONS_AR : ROOM_TYPE_OPTIONS_EN), [lang]);
  const ROOM_STATUS_OPTIONS = useMemo(() => (lang === "ar" ? ROOM_STATUS_OPTIONS_AR : ROOM_STATUS_OPTIONS_EN), [lang]);
  const BLOCK_REASON_OPTIONS = useMemo(() => (lang === "ar" ? BLOCK_REASON_OPTIONS_AR : BLOCK_REASON_OPTIONS_EN), [lang]);
  const BLOCK_SESSION_OPTIONS = useMemo(() => (lang === "ar" ? BLOCK_SESSION_OPTIONS_AR : BLOCK_SESSION_OPTIONS_EN), [lang]);

  const [rooms, setRoomsLocal] = useState<Room[]>(() => rooms12ReadLegacyRooms());
  const roomsRef = useRef<Room[]>(rooms);
  const [roomBlocks, setRoomBlocksLocal] = useState<RoomBlock[]>(() => rooms12ReadLegacyRoomBlocks());
  const roomBlocksRef = useRef<RoomBlock[]>(roomBlocks);

  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const persistRooms = React.useCallback(
    async (nextRooms: Room[], summary = "saved rooms collection") => {
      const normalized = rooms12NormalizeRooms(nextRooms);
      roomsRef.current = normalized;
      setRoomsLocal(normalized);
      rooms12CacheRooms(normalized);

      setSaving(true);
      setSyncMessage(tr("جاري حفظ القاعات في السحابة...", "Saving rooms to cloud..."));

      try {
        await replaceTenantArray(tenantId, ROOMS12_SUBCOLLECTION, normalized as any[], {
          by: currentUserId || undefined,
          audit: {
            entity: ROOMS12_SUBCOLLECTION,
            meta: {
              summary,
              count: normalized.length,
            },
          },
        });
        setSyncMessage(tr("تم حفظ القاعات في السحابة.", "Rooms saved to cloud."));
      } catch (err) {
        setError(tr("تعذر حفظ القاعات في السحابة. تحقق من الاتصال والصلاحيات.", "Could not save rooms to cloud. Check connection and permissions."));
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [tenantId, currentUserId, tr]
  );

  const persistRoomBlocks = React.useCallback(
    async (nextBlocks: RoomBlock[], summary = "saved room blocks collection") => {
      const normalized = rooms12NormalizeRoomBlocks(nextBlocks);
      roomBlocksRef.current = normalized;
      setRoomBlocksLocal(normalized);
      rooms12CacheRoomBlocks(normalized);

      try {
        await replaceTenantArray(tenantId, ROOMS12_BLOCKS_SUBCOLLECTION, normalized as any[], {
          by: currentUserId || undefined,
          audit: {
            entity: ROOMS12_BLOCKS_SUBCOLLECTION,
            meta: {
              summary,
              count: normalized.length,
            },
          },
        });
      } catch {
        setError(tr("تعذر حفظ حظر القاعات في السحابة.", "Could not save room blocks to cloud."));
      }
    },
    [tenantId, currentUserId, tr]
  );

  const setRoomBlocks = React.useCallback(
    (nextValue: React.SetStateAction<RoomBlock[]>) => {
      const previous = roomBlocksRef.current;
      const next =
        typeof nextValue === "function"
          ? (nextValue as (prev: RoomBlock[]) => RoomBlock[])(previous)
          : nextValue;

      void persistRoomBlocks(next, "updated room blocks");
    },
    [persistRoomBlocks]
  );

  async function reloadRooms() {
    setLoading(true);
    setError("");
    try {
      const cloudRooms = rooms12NormalizeRooms(
        await loadTenantArray<Room>(tenantId, ROOMS12_SUBCOLLECTION, { cacheFallback: true })
      );
      roomsRef.current = cloudRooms;
      setRoomsLocal(cloudRooms);
      rooms12CacheRooms(cloudRooms);

      const cloudBlocks = rooms12NormalizeRoomBlocks(
        await loadTenantArray<RoomBlock>(tenantId, ROOMS12_BLOCKS_SUBCOLLECTION, { cacheFallback: true })
      );
      roomBlocksRef.current = cloudBlocks;
      setRoomBlocksLocal(cloudBlocks);
      rooms12CacheRoomBlocks(cloudBlocks);

      setLoaded(true);
      setSyncMessage(tr("تم تحميل القاعات من السحابة.", "Rooms loaded from cloud."));
    } catch {
      setError(tr("تعذر تحميل القاعات من السحابة؛ يتم عرض آخر نسخة محفوظة.", "Could not load rooms from cloud; showing last saved copy."));
    } finally {
      setLoading(false);
    }
  }

  async function createRoom(nextRoom: Room) {
    const normalized = rooms12NormalizeRoom({
      ...nextRoom,
      id: nextRoom.id || createId("room"),
      status: nextRoom.status || "active",
    });

    await persistRooms([normalized, ...roomsRef.current], "created room");
  }

  async function updateRoom(nextRoom: Room) {
    const normalized = rooms12NormalizeRoom({
      ...nextRoom,
      status: nextRoom.status || "active",
    });

    await persistRooms(
      roomsRef.current.map((room) => (room.id === normalized.id ? normalized : room)),
      "updated room"
    );
  }

  async function deleteRoom(id: string) {
    const roomId = rooms12Clean(id);
    await persistRooms(
      roomsRef.current.filter((room) => room.id !== roomId),
      "deleted room"
    );

    await persistRoomBlocks(
      roomBlocksRef.current.filter((block) => block.roomId !== roomId),
      "deleted room related blocks"
    );
  }

  async function deleteAllRooms() {
    await persistRooms([], "deleted all rooms");
  }

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "blocked">("all");
  const [adding, setAdding] = useState(false);
  const [row, setRow] = useState<Room>({ ...emptyRoom, id: createId("room") });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Room>({ ...emptyRoom });
  const [quickBlock, setQuickBlock] = useState<QuickBlockState>({
    open: false,
    roomId: "",
    roomName: "",
    reason: "",
    reasonType: "maintenance",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    session: "full-day",
  });

  useEffect(() => {
    const refreshOfficialHeader = () => {
      setOfficialCenterData(rooms12ReadExamCenterData());
      setOfficialLogo(rooms12ReadOfficialLogo());
    };

    async function refreshOfficialHeaderFromCloud() {
      try {
        const cloud = await loadTenantSettings<Rooms12ExamCenterData>(
          tenantId,
          DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID,
          {}
        );

        const hasCloudData = Boolean(
          cloud?.name ||
            cloud?.examCenterCode ||
            cloud?.centerCode ||
            cloud?.governorate ||
            cloud?.semester ||
            cloud?.phone ||
            cloud?.address ||
            cloud?.controlHeadName ||
            cloud?.academicYear ||
            cloud?.logo
        );

        if (!hasCloudData) return;

        const nextData: Rooms12ExamCenterData = {
          ...cloud,
          examCenterCode: rooms12Clean(cloud.examCenterCode || cloud.centerCode || ""),
          centerCode: rooms12Clean(cloud.examCenterCode || cloud.centerCode || ""),
          controlHeadName: rooms12Clean(cloud.controlHeadName || ""),
        };

        const nextLogo = rooms12Clean(cloud.logo || rooms12ReadOfficialLogo()) || ROOMS12_DEFAULT_LOGO_URL;

        setOfficialCenterData(nextData);
        setOfficialLogo(nextLogo);

        localStorage.setItem(ROOMS12_EXAM_CENTER_DATA_KEY, JSON.stringify(nextData));
        localStorage.setItem(ROOMS12_EXAM_CENTER_LOGO_KEY, nextLogo);
        localStorage.setItem(ROOMS12_CONTROL_HEAD_NAME_KEY, nextData.controlHeadName || "");
      } catch {
        refreshOfficialHeader();
      }
    }

    refreshOfficialHeader();
    void refreshOfficialHeaderFromCloud();

    window.addEventListener("storage", refreshOfficialHeader);
    window.addEventListener("exam-manager:changed", refreshOfficialHeader);
    window.addEventListener("exam-manager:control-head-changed", refreshOfficialHeader);

    return () => {
      window.removeEventListener("storage", refreshOfficialHeader);
      window.removeEventListener("exam-manager:changed", refreshOfficialHeader);
      window.removeEventListener("exam-manager:control-head-changed", refreshOfficialHeader);
    };
  }, [tenantId]);

  useEffect(() => {
    let mounted = true;

    async function loadCloudData() {
      setLoading(true);
      setError("");
      setSyncMessage(tr("جاري تحميل القاعات من السحابة...", "Loading rooms from cloud..."));

      try {
        const cloudRooms = rooms12NormalizeRooms(
          await loadTenantArray<Room>(tenantId, ROOMS12_SUBCOLLECTION, { cacheFallback: true })
        );

        const cloudBlocks = rooms12NormalizeRoomBlocks(
          await loadTenantArray<RoomBlock>(tenantId, ROOMS12_BLOCKS_SUBCOLLECTION, { cacheFallback: true })
        );

        if (!mounted) return;

        if (cloudRooms.length) {
          roomsRef.current = cloudRooms;
          setRoomsLocal(cloudRooms);
          rooms12CacheRooms(cloudRooms);
          setSyncMessage(tr("تم تحميل القاعات من السحابة.", "Rooms loaded from cloud."));
        } else {
          const legacyRooms = rooms12NormalizeRooms(rooms12ReadLegacyRooms());

          if (legacyRooms.length) {
            roomsRef.current = legacyRooms;
            setRoomsLocal(legacyRooms);
            rooms12CacheRooms(legacyRooms);

            await replaceTenantArray(tenantId, ROOMS12_SUBCOLLECTION, legacyRooms as any[], {
              by: currentUserId || undefined,
              audit: {
                entity: ROOMS12_SUBCOLLECTION,
                meta: {
                  summary: "migrated rooms from localStorage to cloud",
                  count: legacyRooms.length,
                },
              },
            });

            setSyncMessage(tr("تم ترحيل القاعات من هذا الجهاز إلى السحابة.", "Rooms migrated from this device to cloud."));
          } else {
            roomsRef.current = [];
            setRoomsLocal([]);
            rooms12CacheRooms([]);
            setSyncMessage(tr("لا توجد قاعات محفوظة بعد.", "No rooms saved yet."));
          }
        }

        if (cloudBlocks.length) {
          roomBlocksRef.current = cloudBlocks;
          setRoomBlocksLocal(cloudBlocks);
          rooms12CacheRoomBlocks(cloudBlocks);
        } else {
          const legacyBlocks = rooms12NormalizeRoomBlocks(rooms12ReadLegacyRoomBlocks());

          if (legacyBlocks.length) {
            roomBlocksRef.current = legacyBlocks;
            setRoomBlocksLocal(legacyBlocks);
            rooms12CacheRoomBlocks(legacyBlocks);

            await replaceTenantArray(tenantId, ROOMS12_BLOCKS_SUBCOLLECTION, legacyBlocks as any[], {
              by: currentUserId || undefined,
              audit: {
                entity: ROOMS12_BLOCKS_SUBCOLLECTION,
                meta: {
                  summary: "migrated room blocks from localStorage to cloud",
                  count: legacyBlocks.length,
                },
              },
            });
          }
        }

        setLoaded(true);
      } catch {
        if (!mounted) return;
        const legacyRooms = rooms12NormalizeRooms(rooms12ReadLegacyRooms());
        const legacyBlocks = rooms12NormalizeRoomBlocks(rooms12ReadLegacyRoomBlocks());

        roomsRef.current = legacyRooms;
        setRoomsLocal(legacyRooms);
        roomBlocksRef.current = legacyBlocks;
        setRoomBlocksLocal(legacyBlocks);

        setError(tr("تعذر تحميل القاعات من السحابة؛ يتم عرض نسخة الجهاز المؤقتة.", "Could not load rooms from cloud; showing local cache."));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadCloudData();

    return () => {
      mounted = false;
    };
  }, [tenantId, currentUserId, tr]);
  const [historyRoomId, setHistoryRoomId] = useState<string | null>(null);
  const [roomsTableFullScreen, setRoomsTableFullScreen] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    if (!roomsTableFullScreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRoomsTableFullScreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [roomsTableFullScreen]);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      .roomsTableLuxury {
        position: relative;
        background: linear-gradient(180deg, rgba(255,253,246,0.98) 0%, rgba(248,242,223,0.98) 100%);
        border: 1.5px solid rgba(212,175,55,0.34);
        border-radius: 30px;
        padding: 16px;
        box-shadow: 0 18px 42px rgba(108,82,12,0.14);
        overflow: auto;
      }
      .roomsTableLuxury::before {
        content: "";
        position: sticky;
        top: 0;
        display: block;
        height: 0;
      }
      .roomsTableLuxury table {
        width: 100%;
        min-width: 1560px;
        border-collapse: separate;
        border-spacing: 0 12px;
      }
      .roomsTableLuxury thead th {
        position: sticky;
        top: 0;
        z-index: 6;
        background: linear-gradient(180deg, #9a7200 0%, #6f5100 100%) !important;
        color: #fff3cf !important;
        text-align: right;
        font-weight: 1000;
        font-size: 17px;
        padding: 18px 18px;
        border-top: 1px solid rgba(255,214,102,0.35) !important;
        border-bottom: 1px solid rgba(255,214,102,0.20) !important;
        white-space: nowrap;
        box-shadow:
          inset 0 2px 0 rgba(255,255,255,0.08),
          0 12px 24px rgba(0,0,0,0.30);
      }
      .roomsTableLuxury thead th:first-child {
        border-right: 1px solid rgba(255,214,102,0.35) !important;
        border-top-right-radius: 22px;
        border-bottom-right-radius: 22px;
      }
      .roomsTableLuxury thead th:last-child {
        border-left: 1px solid rgba(255,214,102,0.35) !important;
        border-top-left-radius: 22px;
        border-bottom-left-radius: 22px;
      }
      .roomsTableLuxury tbody tr {
        position: relative;
      }
      .roomsTableLuxury tbody tr td:first-child {
        border-top-right-radius: 22px;
        border-bottom-right-radius: 22px;
      }
      .roomsTableLuxury tbody tr td:last-child {
        border-top-left-radius: 22px;
        border-bottom-left-radius: 22px;
      }
      .roomsTableLuxury tbody td {
        background: linear-gradient(180deg, #fffdf6 0%, #fff8e6 100%) !important;
        color: #111827 !important;
        padding: 16px 16px;
        border-top: 1.5px solid rgba(212,175,55,0.34);
        border-bottom: 1.5px solid rgba(212,175,55,0.34);
        white-space: nowrap;
        vertical-align: middle;
        box-shadow: none;
        transition: transform .18s ease, filter .18s ease, border-color .18s ease;
      }
      .roomsTableLuxury tbody td:first-child {
        border-right: 1px solid rgba(212,175,55,0.12);
      }
      .roomsTableLuxury tbody td:last-child {
        border-left: 1px solid rgba(212,175,55,0.12);
      }
      .roomsTableLuxury tbody tr:hover td {
        transform: translateY(-2px);
        box-shadow: none;
        filter: brightness(1.01);
        border-top-color: rgba(212,175,55,0.58);
        border-bottom-color: rgba(212,175,55,0.58);
      }
      .roomsTableLuxury .cell-main {
        font-size: 18px;
        font-weight: 900;
        color: #111827 !important;
      }
      .roomsTableLuxury .cell-subtle {
        color: #111827 !important;
        opacity: 0.96;
        font-weight: 800;
      }
      .roomsTableLuxury .cell-muted {
        color: rgba(17,24,39,0.72) !important;
        font-size: 13px;
        font-weight: 700;
        margin-top: 4px;
      }
      .roomsTableLuxury .cell-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 96px;
        padding: 10px 16px;
        border-radius: 999px;
        font-weight: 1000;
        font-size: 14px;
        border: 1px solid rgba(255,255,255,0.08);
        box-shadow: 0 8px 18px rgba(0,0,0,0.28);
      }
      .roomsTableLuxury .badge-capacity {
        background: linear-gradient(180deg, #111827, #0b1220);
        color: #f2cf63;
        border-color: rgba(212,175,55,0.22);
      }
      .roomsTableLuxury .badge-active {
        background: linear-gradient(180deg, #102415, #0b1a10);
        color: #bbf7d0;
        border-color: rgba(34,197,94,0.24);
      }
      .roomsTableLuxury .badge-inactive {
        background: linear-gradient(180deg, #4b5563, #374151);
        color: #fff;
      }
      .roomsTableLuxury .badge-blocked {
        background: linear-gradient(180deg, #ef4444, #dc2626);
        color: #fff;
      }
      .roomsTableLuxury .badge-open {
        background: linear-gradient(180deg, #111827, #0b1220);
        color: #f2cf63;
        border-color: rgba(212,175,55,0.22);
      }
      .roomsTableLuxury .actionStack {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .roomsTableLuxury .actionBtn {
        border: none;
        border-radius: 18px;
        padding: 12px 16px;
        font-weight: 1000;
        font-size: 14px;
        cursor: pointer;
        box-shadow: 0 10px 22px rgba(0,0,0,0.28);
        transition: transform .15s ease, filter .15s ease, box-shadow .15s ease;
      }
      .roomsTableLuxury .actionBtn:hover {
        transform: translateY(-1px);
        filter: brightness(1.03);
        box-shadow: 0 14px 26px rgba(0,0,0,0.34);
      }
      .roomsTableLuxury .btnEdit {
        background: linear-gradient(180deg, #6daeff, #5b95e6);
        color: #07101f;
      }
      .roomsTableLuxury .btnBlock {
        background: linear-gradient(180deg, #f0b316, #d89a00);
        color: #07101f;
      }
      .roomsTableLuxury .btnHistory {
        background: linear-gradient(180deg, #334155, #1f2937);
        color: #f8e7a7;
      }
      .roomsTableLuxury .btnDelete {
        background: linear-gradient(180deg, #ff5151, #ef4444);
        color: #07101f;
      }
      .roomsTableLuxury .emptyCell {
        text-align: center;
        font-size: 18px;
        font-weight: 900;
        color: #111827 !important;
        padding: 24px !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const roomsById = useMemo(() => new Map(rooms.map((room, index) => [room.id, room])), [rooms]);

  const normalizedBlocks = useMemo<RoomBlock[]>(
    () =>
      roomBlocks.map((block, index) => {
        const normalizedStatus: RoomBlock["status"] =
          block.status === "cancelled"
            ? "cancelled"
            : block.endDate < todayISO
            ? "expired"
            : "active";
        return {
          ...block,
          status: normalizedStatus,
        };
      }),
    [roomBlocks, todayISO]
  );

  const blockedRoomIdsToday = useMemo(
    () =>
      new Set(
        rooms
          .filter((room) => isRoomBlockedToday(room.id, todayISO, normalizedBlocks as any))
          .map((room, index) => room.id)
      ),
    [rooms, todayISO, normalizedBlocks]
  );


  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-fullscreen-dropdown-black-text-fix", "true");
    style.innerHTML = `
      /* ✅ تثبيت لون نص القوائم المنسدلة بالأسود داخل وخارج ملء الشاشة */
      body select,
      body select option,
      body select optgroup,
      body [role="combobox"],
      body [aria-haspopup="listbox"],
      body [role="button"][aria-haspopup="listbox"],
      body [role="listbox"],
      body [role="option"],
      body .gold-dropdown,
      body .goldDropdown,
      body [class*="GoldDropdown"],
      body [class*="goldDropdown"],
      body [class*="gold-dropdown"],
      body [class*="dropdown"],
      body [class*="Dropdown"] {
        color: #000000 !important;
        -webkit-text-fill-color: #000000 !important;
        font-weight: 1000 !important;
        text-shadow: none !important;
        caret-color: #000000 !important;
        color-scheme: light !important;
      }

      body select option,
      body select optgroup,
      body [role="listbox"],
      body [role="option"],
      body .gold-dropdown,
      body .goldDropdown,
      body [class*="GoldDropdown"],
      body [class*="goldDropdown"],
      body [class*="gold-dropdown"] {
        background: #f8f4e8 !important;
        background-color: #f8f4e8 !important;
      }

      body [role="combobox"] *,
      body [aria-haspopup="listbox"] *,
      body [role="button"][aria-haspopup="listbox"] *,
      body [role="listbox"] *,
      body [role="option"] *,
      body .gold-dropdown *,
      body .goldDropdown *,
      body [class*="GoldDropdown"] *,
      body [class*="goldDropdown"] *,
      body [class*="gold-dropdown"] *,
      body [class*="dropdown"] *,
      body [class*="Dropdown"] * {
        color: #000000 !important;
        -webkit-text-fill-color: #000000 !important;
        font-weight: 1000 !important;
        text-shadow: none !important;
      }

      .teachers12PreviousChangesScope select,
      .teachers12PreviousChangesScope select option,
      .teachers12PreviousChangesScope [role="listbox"],
      .teachers12PreviousChangesScope [role="option"],
      .rooms12PageRoot select,
      .rooms12PageRoot select option,
      .rooms12PageRoot [role="listbox"],
      .rooms12PageRoot [role="option"],
      .teachersFullscreenOverlay select,
      .teachersFullscreenOverlay select option,
      .roomsFullscreenOverlay select,
      .roomsFullscreenOverlay select option {
        color: #000000 !important;
        -webkit-text-fill-color: #000000 !important;
        font-weight: 1000 !important;
        text-shadow: none !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim();
    return rooms
      .filter((r) => {
        const matchesQuery =
          !q ||
          [r.roomName, r.code || "", r.building, r.type, String(r.capacity), r.notes].some((x) =>
            String(x).includes(q)
          );
        const isBlocked = blockedRoomIdsToday.has(r.id);
        const effectiveStatus = r.status || "active";
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "blocked" && isBlocked) ||
          (statusFilter === "active" && effectiveStatus === "active" && !isBlocked) ||
          (statusFilter === "inactive" && effectiveStatus === "inactive");
        return matchesQuery && matchesStatus;
      })
      .sort((a, b) =>
        String(a.code || "").localeCompare(String(b.code || ""), lang === "ar" ? "ar" : "en", {
          numeric: true,
          sensitivity: "base",
        })
      );
  }, [rooms, query, statusFilter, blockedRoomIdsToday, lang]);

  const historyBlocks = useMemo(() => {
    if (!historyRoomId) return [] as RoomBlock[];
    return normalizedBlocks
      .filter((block) => block.roomId === historyRoomId)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [normalizedBlocks, historyRoomId]);

  const stats = useMemo(() => {
    const total = rooms.length;
    const active = rooms.filter((r) => (r.status || "active") === "active").length;
    const blocked = rooms.filter((r) => blockedRoomIdsToday.has(r.id)).length;
    const capacity = rooms.reduce((sum, room) => sum + (Number(room.capacity) || 0), 0);
    return { total, active, blocked, capacity };
  }, [rooms, blockedRoomIdsToday]);

  const officialAcademicYear =
    officialCenterData.academicYear || rooms12AcademicYearFromSystemDate(new Date());
  const officialGovernorate =
    officialCenterData.governorate || tr("المديرية العامة للتعليم", "Directorate General of Education");
  const officialCenterName =
    officialCenterData.name || tr("مركز الامتحانات", "Exam Center");
  const officialCenterCode =
    officialCenterData.examCenterCode || officialCenterData.centerCode || "—";
  const officialSemester =
    officialCenterData.semester || tr("الفصل الدراسي", "Semester");
  const officialCenterHead =
    officialCenterData.controlHeadName || tr("رئيس المركز", "Center Head");

  const pageStyle: React.CSSProperties = {
    padding: 18,
    color: "#000000",
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 520px at 50% -10%, rgba(212,175,55,0.18), transparent 62%), linear-gradient(180deg, #fffdf7 0%, #f7f3e7 48%, #fffaf0 100%)",
    position: "relative",
    overflowX: "hidden",
    direction: isRTL ? "rtl" : "ltr",
  };

  const card: React.CSSProperties = {
    background: "linear-gradient(180deg, #fffaf0 0%, #f3e8c5 100%)",
    border: "4px solid #d4af37",
    borderRadius: 28,
    padding: 20,
    boxShadow: "0 0 0 5px rgba(212,175,55,0.13) inset, 0 16px 34px rgba(126,98,18,0.12)",
    marginBottom: 16,
    backdropFilter: "none",
    color: "#000000",
  };

  const header: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    background: "linear-gradient(180deg, #f2dc8a 0%, #d4af37 100%)",
    color: "#000000",
    border: "4px solid #111827",
    borderRadius: 24,
    padding: 18,
    boxShadow: "0 14px 30px rgba(126,98,18,0.16)",
    marginBottom: 16,
  };

  const btn = (bg: string, fg = "#000000"): React.CSSProperties => ({
    background: bg,
    color: "#000000",
    border: "3px solid #d4af37",
    borderRadius: 16,
    padding: "11px 16px",
    cursor: "pointer",
    fontWeight: 1000,
    boxShadow: "0 10px 22px rgba(126,98,18,0.13)",
    textShadow: "none",
  });

  const inputStyle: React.CSSProperties = {
    background: "linear-gradient(180deg, #fffaf0 0%, #f3e8c5 100%)",
    color: "#000000",
    WebkitTextFillColor: "#000000",
    border: "3px solid #d4af37",
    borderRadius: 16,
    padding: "12px 14px",
    outline: "none",
    width: "100%",
    fontWeight: 1000,
    fontSize: 16,
  };

  const tableWrap: React.CSSProperties = {
    maxHeight: "70vh",
    overflow: "auto",
    borderRadius: 26,
    border: "4px solid #d4af37",
    background: "linear-gradient(180deg, #fffaf0 0%, #f3e8c5 100%)",
    boxShadow: "0 0 0 5px rgba(212,175,55,0.13) inset",
  };

  const thStyle: React.CSSProperties = {
    textAlign: isRTL ? "right" : "left",
    whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    whiteSpace: "nowrap",
  };

  const modalOverlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    zIndex: 2147483647,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  };

  const modalCard: React.CSSProperties = {
    width: "min(820px, 96vw)",
    maxHeight: "90vh",
    overflow: "auto",
    background: "linear-gradient(180deg, #fffaf0 0%, #f3e8c5 100%)",
    border: "4px solid #d4af37",
    borderRadius: 24,
    padding: 18,
    boxShadow: "0 22px 70px rgba(108,82,12,0.22)",
    color: "#000000",
    direction: isRTL ? "rtl" : "ltr",
  };

  function toCSV(rows: Room[]) {
    const header =
      lang === "ar"
        ? ["اسم القاعة", "الكود", "المبنى", "النوع", "السعة", "الحالة", "ملاحظات"]
        : ["Room Name", "Code", "Building", "Type", "Capacity", "Status", "Notes"];

    const escape = (s: string) => {
      const v = (s ?? "").replace(/\r?\n/g, " ").trim();
      if (/[",]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
      return v;
    };

    const lines = [
      header.join(","),
      ...rows.map((r, index) =>
        [
          r.roomName,
          r.code || "",
          r.building,
          r.type,
          String(r.capacity),
          r.status || "active",
          r.notes,
        ]
          .map(escape)
          .join(",")
      ),
    ];
    return lines.join("\n");
  }

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setRow({ ...emptyRoom, id: createId("room") });
    if (!roomsTableFullScreen) {
      setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }

  function validate(r: Room) {
    if (!r.roomName.trim()) return tr("اسم القاعة مطلوب.", "Room name is required.");
    if (!r.building.trim()) return tr("المبنى مطلوب.", "Building is required.");
    if (!r.type.trim()) return tr("نوع القاعة مطلوب.", "Room type is required.");
    if (!r.capacity || r.capacity <= 0) return tr("السعة مطلوبة.", "Capacity is required.");
    const duplicateCode = String(r.code || "").trim();
    if (duplicateCode) {
      const exists = rooms.some(
        (room) => String(room.code || "").trim() === duplicateCode && room.id !== r.id
      );
      if (exists) return tr("كود القاعة مكرر.", "Room code is duplicated.");
    }
    return "";
  }

  async function saveAdd() {
    const msg = validate(row);
    if (msg) {
      alert(msg);
      return;
    }
    try {
      // ✅ تطبيق الحماية على الإدخال اليدوي 
      await createRoom({
        ...row,
        roomName: sanitizeInput(row.roomName),
        code: sanitizeInput(row.code),
        building: sanitizeInput(row.building),
        type: sanitizeInput(row.type),
        notes: sanitizeInput(row.notes),
        status: row.status || "active",
      });
      setAdding(false);
      setRow({ ...emptyRoom, id: createId("room") });
      alert(tr("✅ تم حفظ القاعة بنجاح", "✅ Room saved successfully"));
    } catch {
      alert(tr("❌ فشل حفظ القاعة", "❌ Failed to save room"));
    }
  }

  function startEdit(r: Room) {
    setEditingId(r.id);
    setAdding(false);
    setEdit({ ...r, status: r.status || "active" });
    if (!roomsTableFullScreen) {
      setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }

  async function saveEdit() {
    if (!editingId) return;
    const msg = validate(edit);
    if (msg) {
      alert(msg);
      return;
    }
    try {
      // ✅ تطبيق الحماية على التعديل اليدوي 
      await updateRoom({
        ...edit,
        roomName: sanitizeInput(edit.roomName),
        code: sanitizeInput(edit.code),
        building: sanitizeInput(edit.building),
        type: sanitizeInput(edit.type),
        notes: sanitizeInput(edit.notes),
        status: edit.status || "active",
      });
      setEditingId(null);
      setEdit({ ...emptyRoom });
      alert(tr("✅ تم تحديث القاعة بنجاح", "✅ Room updated successfully"));
    } catch {
      alert(tr("❌ فشل تحديث القاعة", "❌ Failed to update room"));
    }
  }

  async function removeRoom(id: string) {
    if (!confirm(tr("هل تريد حذف هذه القاعة؟ سيتم حذف أي حظر مرتبط بها أيضًا.", "Do you want to delete this room? Any related blocks will also be deleted."))) return;
    try {
      await deleteRoom(id);
      alert(tr("✅ تم حذف القاعة", "✅ Room deleted"));
    } catch {
      alert(tr("❌ فشل حذف القاعة", "❌ Failed to delete room"));
    }
  }

  async function deleteAll() {
    if (!rooms.length) return;
    const ok = confirm(tr("⚠️ هل أنت متأكد من حذف جدول القاعات كاملًا؟ لا يمكن التراجع.", "⚠️ Are you sure you want to delete the entire rooms table? This cannot be undone."));
    if (!ok) return;
    try {
      const roomIds = new Set(rooms.map((room, index) => room.id));
      await deleteAllRooms();
      await persistRoomBlocks(
        roomBlocksRef.current.filter((block) => !roomIds.has(block.roomId)),
        "deleted all room related blocks"
      );
      alert(tr("✅ تم حذف جميع القاعات", "✅ All rooms deleted"));
    } catch {
      alert(tr("❌ فشل حذف جميع القاعات", "❌ Failed to delete all rooms"));
    }
  }

  function exportCSV() {
    downloadText("rooms.csv", toCSV(rooms));
  }

  async function exportExcel() {
    try {
      const XLSX = await import("xlsx");
      const rows = rooms.map((r, index) =>
        lang === "ar"
          ? {
              "اسم القاعة": r.roomName,
              "الكود": r.code || "",
              "المبنى": r.building,
              "النوع": r.type,
              "السعة": r.capacity,
              "الحالة": r.status || "active",
              "ملاحظات": r.notes,
            }
          : {
              "Room Name": r.roomName,
              "Code": r.code || "",
              "Building": r.building,
              "Type": r.type,
              "Capacity": r.capacity,
              "Status": r.status || "active",
              "Notes": r.notes,
            }
      );
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Rooms");
      XLSX.writeFile(wb, "rooms.xlsx");
    } catch {
      alert(tr("مكتبة xlsx غير متوفرة. استخدم CSV أو ثبّت xlsx.", "xlsx library is not available. Use CSV or install xlsx."));
    }
  }

  async function importCSV(file: File) {
    const text = await file.text();
    const objs = parseCSV(text);
    const incoming = parseRoomsFromObjects(objs);
    if (!incoming.length) {
      alert(tr("لا توجد بيانات صالحة للاستيراد.", "No valid data found for import."));
      return;
    }
    try {
      for (const room of incoming) {
        await createRoom(room);
      }
      await reloadRooms();
      alert(tr("✅ تم استيراد القاعات.", "✅ Rooms imported."));
    } catch {
      alert(tr("❌ حدث خطأ أثناء استيراد CSV", "❌ An error occurred while importing CSV"));
    }
  }

  async function importExcel(file: File) {
    const json = await tryReadExcel(file);
    if (!json) {
      alert(tr("تعذر قراءة Excel. ثبّت xlsx أو استخدم CSV.", "Unable to read Excel. Install xlsx or use CSV."));
      return;
    }
    const incoming = parseRoomsFromObjects(json);
    if (!incoming.length) {
      alert(tr("لا توجد بيانات صالحة للاستيراد.", "No valid data found for import."));
      return;
    }
    try {
      for (const room of incoming) {
        await createRoom(room);
      }
      await reloadRooms();
      alert(tr("✅ تم استيراد القاعات.", "✅ Rooms imported."));
    } catch {
      alert(tr("❌ حدث خطأ أثناء استيراد Excel", "❌ An error occurred while importing Excel"));
    }
  }

  const current = editingId ? edit : row;
  const setCurrent = (patch: Partial<Room>) => {
    if (editingId) {
      setEdit((prev) => ({ ...prev, ...patch }));
    } else {
      setRow((prev) => ({ ...prev, ...patch }));
    }
  };


  const renderFullscreenSafeRoomDropdown = (
    value: string,
    options: { value: string; label: string }[],
    onChange: (value: string) => void,
    placeholder?: string
  ) => (
    <SearchableDropdown
      value={value}
      options={placeholder && !options.some((option) => option.value === "") ? [{ value: "", label: placeholder }, ...options] : options}
      placeholder={placeholder}
      onChange={onChange}
      inputStyle={inputStyle}
      direction={isRTL ? "rtl" : "ltr"}
      zIndex={roomsTableFullScreen ? 2147483647 : 999999}
    />
  );

  function openQuickBlock(room: Room) {
    setQuickBlock({
      open: true,
      roomId: room.id,
      roomName: room.roomName,
      reason: "",
      reasonType: "maintenance",
      startDate: todayISO,
      endDate: todayISO,
      session: "full-day",
    });
  }

  function saveQuickBlock() {
    if (!quickBlock.roomId) return;
    if (!quickBlock.reason.trim()) return alert(tr("سبب الحظر مطلوب.", "Block reason is required."));
    if (!quickBlock.startDate || !quickBlock.endDate) return alert(tr("تاريخ الحظر مطلوب.", "Block date is required."));
    if (quickBlock.endDate < quickBlock.startDate) return alert(tr("تاريخ النهاية يجب أن يكون بعد البداية.", "End date must be after start date."));
    const overlap = roomBlocks.some(
      (block) =>
        block.roomId === quickBlock.roomId &&
        block.status === "active" &&
        !(quickBlock.endDate < block.startDate || quickBlock.startDate > block.endDate) &&
        (block.session === "full-day" ||
          quickBlock.session === "full-day" ||
          block.session === quickBlock.session)
    );
    if (overlap) return alert(tr("يوجد حظر متداخل لهذه القاعة في نفس الفترة.", "There is an overlapping block for this room in the same period."));
    const nextBlock: RoomBlock = {
      id: createId("block"),
      roomId: quickBlock.roomId,
      roomName: sanitizeInput(quickBlock.roomName), // ✅ الحماية مطبقة
      reason: sanitizeInput(quickBlock.reason.trim()), // ✅ الحماية مطبقة
      reasonType: quickBlock.reasonType,
      blockType: quickBlock.session === "full-day" ? "full" : "partial",
      startDate: quickBlock.startDate,
      endDate: quickBlock.endDate,
      session: quickBlock.session,
      status: "active" as RoomBlock["status"],
      createdBy: String(user?.email || "").trim() || undefined,
    };
    setRoomBlocks((prev) => [nextBlock, ...prev]);
    setQuickBlock((prev) => ({ ...prev, open: false }));
  }


  const roomFormNode = (adding || editingId) ? (
          <div
            className={roomsTableFullScreen ? "fullscreenEditDropdownFix" : undefined}
            style={{
              ...card,
              marginBottom: roomsTableFullScreen ? 14 : card.marginBottom,
              position: roomsTableFullScreen ? "sticky" : "relative",
              top: roomsTableFullScreen ? 0 : "auto",
              zIndex: roomsTableFullScreen ? 2147483647 : "auto",
              maxHeight: roomsTableFullScreen ? "none" : "none",
              overflow: "visible",
              background: roomsTableFullScreen
                ? "linear-gradient(180deg, #fffaf0 0%, #f3e8c5 100%)"
                : card.background,
              border: roomsTableFullScreen ? "4px solid #d4af37" : card.border,
              boxShadow: roomsTableFullScreen
                ? "0 14px 34px rgba(108,82,12,0.18), 0 0 0 4px rgba(212,175,55,0.12) inset"
                : card.boxShadow,
            }}
          >
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(4, minmax(220px, 1fr))" }}>
              <div>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#000000" }}>{tr("اسم القاعة", "Room Name")}</div>
                <input
                  style={inputStyle}
                  value={current.roomName}
                  onChange={(e) => setCurrent({ roomName: e.target.value })}
                />
              </div>
              <div>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#000000" }}>{tr("كود القاعة", "Room Code")}</div>
                <input
                  style={inputStyle}
                  value={current.code || ""}
                  onChange={(e) => setCurrent({ code: e.target.value })}
                />
              </div>
              <div>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#000000" }}>{tr("المبنى", "Building")}</div>
                {renderFullscreenSafeRoomDropdown(
                  current.building,
                  BUILDING_OPTIONS,
                  (v) => setCurrent({ building: v }),
                  tr("— اختر المبنى —", "— Select Building —")
                )}
              </div>
              <div>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#000000" }}>{tr("نوع القاعة", "Room Type")}</div>
                {renderFullscreenSafeRoomDropdown(
                  current.type,
                  ROOM_TYPE_OPTIONS,
                  (v) => setCurrent({ type: v }),
                  tr("— اختر النوع —", "— Select Type —")
                )}
              </div>
              <div>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#000000" }}>{tr("السعة", "Capacity")}</div>
                <input
                  style={inputStyle}
                  type="number"
                  value={String(current.capacity)}
                  onChange={(e) => setCurrent({ capacity: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#000000" }}>{tr("الحالة", "Status")}</div>
                {renderFullscreenSafeRoomDropdown(
                  current.status || "active",
                  ROOM_STATUS_OPTIONS,
                  (v) => setCurrent({ status: v as Room["status"] })
                )}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#000000" }}>{tr("ملاحظات", "Notes")}</div>
                <textarea
                  style={{ ...inputStyle, minHeight: 80 }}
                  value={current.notes}
                  onChange={(e) => setCurrent({ notes: e.target.value })}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              {editingId ? (
                <>
                  <button
                    style={{ ...btn("#10b981", "#07101f"), opacity: saving ? 0.7 : 1 }}
                    onClick={() => void saveEdit()}
                    disabled={saving}
                  >
                    {saving ? tr("جارٍ الحفظ...", "Saving...") : tr("حفظ التعديل", "Save Changes")}
                  </button>
                  <button
                    style={btn("#1f2937", "#d4af37")}
                    onClick={() => setEditingId(null)}
                    disabled={saving}
                  >
                    {tr("إلغاء", "Cancel")}
                  </button>
                </>
              ) : (
                <>
                  <button
                    style={{ ...btn("#10b981", "#07101f"), opacity: saving ? 0.7 : 1 }}
                    onClick={() => void saveAdd()}
                    disabled={saving}
                  >
                    {saving ? tr("جارٍ الحفظ...", "Saving...") : tr("حفظ", "Save")}
                  </button>
                  <button
                    style={btn("#1f2937", "#d4af37")}
                    onClick={() => setAdding(false)}
                    disabled={saving}
                  >
                    {tr("إلغاء", "Cancel")}
                  </button>
                </>
              )}
            </div>
          </div>
  ) : null;

  const roomsTableNode = (
        <div
          style={
            roomsTableFullScreen
              ? {
                  ...card,
                  position: "fixed",
                  inset: 0,
                  width: "100vw",
                  height: "100dvh",
                  zIndex: 2147483400,
                  margin: 0,
                  padding: 14,
                  borderRadius: 0,
                  background: "linear-gradient(180deg, #fffdf7 0%, #f7f3e7 100%)",
                  boxShadow: "0 30px 90px rgba(0,0,0,0.42)",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }
              : {
                  ...card,
                  padding: 12,
                  borderRadius: 28,
                  background: "linear-gradient(180deg, rgba(255,253,246,0.96), rgba(255,248,230,0.98))",
                  boxShadow: "0 22px 60px rgba(0,0,0,0.42)",
                }
          }
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 14,
              padding: "4px 6px 0 6px",
            }}
          >
            <div style={{ fontWeight: 1000, fontSize: 20, color: "#f2cf63" }}>{tr("القاعات", "Rooms")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 900, color: "#000000", opacity: 0.9 }}>
                {tr("جدول القاعات", "Rooms Table")}
              </div>
              <button
                type="button"
                style={btn(roomsTableFullScreen ? "#ef4444" : "#fffdf7", "#000000")}
                onClick={() => setRoomsTableFullScreen((value) => !value)}
              >
                {roomsTableFullScreen ? tr("إغلاق ملء الشاشة", "Close Full Screen") : tr("ملء الشاشة", "Full Screen")}
              </button>
            </div>
          </div>

          {roomsTableFullScreen && roomFormNode}

          <div
            className="roomsTableLuxury"
            style={
              roomsTableFullScreen
                ? {
                    ...tableWrap,
                    flex: 1,
                    maxHeight: "none",
                    minHeight: 0,
                    overflow: "auto",
                    position: "relative",
                    zIndex: 2147483401,
                    isolation: "isolate",
                  }
                : tableWrap
            }
          >
            <table>
              <thead>
                <tr>
                  <th style={thStyle}>{tr("اسم القاعة", "Room Name")}</th>
                  <th style={thStyle}>{tr("الكود", "Code")}</th>
                  <th style={thStyle}>{tr("المبنى", "Building")}</th>
                  <th style={thStyle}>{tr("النوع", "Type")}</th>
                  <th style={thStyle}>{tr("السعة", "Capacity")}</th>
                  <th style={thStyle}>{tr("الحالة", "Status")}</th>
                  <th style={thStyle}>{tr("الحظر الحالي", "Current Block")}</th>
                  <th style={thStyle}>{tr("ملاحظات", "Notes")}</th>
                  <th style={thStyle}>{tr("إجراءات", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td style={tdStyle} className="emptyCell" colSpan={9}>
                      {tr("لا توجد بيانات", "No data found")}
                    </td>
                  </tr>
                ) : (
                  filtered.map((r, index) => {
                    const blockedNow = blockedRoomIdsToday.has(r.id);
                    const roomStatus = (r.status || "active") === "active" ? tr("نشطة", "Active") : tr("موقوفة", "Inactive");
                    return (
                      <tr key={r.id}>
                        <td style={tdStyle}>
                          <div className="cell-main">{r.roomName}</div>
                          <div className="cell-muted">{r.code ? `${tr("رمز القاعة", "Room Code")}: ${r.code}` : tr("بدون كود", "No Code")}</div>
                        </td>
                        <td style={tdStyle} className="cell-subtle">
                          {r.code || "—"}
                        </td>
                        <td style={tdStyle} className="cell-subtle">
                          {r.building}
                        </td>
                        <td style={tdStyle} className="cell-subtle">
                          {r.type}
                        </td>
                        <td style={tdStyle}>
                          <span className="cell-badge badge-capacity">{r.capacity}</span>
                        </td>
                        <td style={tdStyle}>
                          <span
                            className={`cell-badge ${
                              (r.status || "active") === "active" ? "badge-active" : "badge-inactive"
                            }`}
                          >
                            {roomStatus}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span className={`cell-badge ${blockedNow ? "badge-blocked" : "badge-open"}`}>
                            {blockedNow ? tr("محظورة اليوم", "Blocked Today") : tr("متاحة", "Available")}
                          </span>
                        </td>
                        <td style={tdStyle} title={r.notes}>
                          <div className="cell-subtle">{r.notes || "—"}</div>
                        </td>
                        <td style={tdStyle}>
                          <div className="actionStack">
                            <button className="actionBtn btnEdit" onClick={() => startEdit(r)}>
                              {tr("تعديل ✏️", "Edit ✏️")}
                            </button>
                            <button className="actionBtn btnBlock" onClick={() => openQuickBlock(r)}>
                              {tr("حظر ⛔", "Block ⛔")}
                            </button>
                            <button className="actionBtn btnHistory" onClick={() => setHistoryRoomId(r.id)}>
                              {tr("السجل 📜", "History 📜")}
                            </button>
                            <button className="actionBtn btnDelete" onClick={() => void removeRoom(r.id)}>
                              {tr("حذف 🗑", "Delete 🗑")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
  );

  const roomsTableRender =
    roomsTableFullScreen && typeof document !== "undefined"
      ? createPortal(roomsTableNode, document.body)
      : roomsTableNode;

  return (
    <div style={pageStyle} ref={topRef} className="rooms12PageRoot rooms12ColoredBordersScope rooms12BlackTextScope rooms12ForceBlackText rooms12NoBlackTableCellsScope">
      <style>{`
        .rooms12PageRoot,
        .rooms12PageRoot * {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          text-shadow: none !important;
          font-weight: 900 !important;
          font-family: Tahoma, Arial, sans-serif !important;
        }

        .rooms12PageRoot input,
        .rooms12PageRoot select,
        .rooms12PageRoot textarea,
        .rooms12PageRoot option {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          background: #fffaf0 !important;
          font-weight: 1000 !important;
        }

        .rooms12PageRoot input::placeholder,
        .rooms12PageRoot textarea::placeholder {
          color: #000000 !important;
          opacity: 0.72 !important;
        }


        /* ✅ إصلاح القوائم المنسدلة داخل وضع ملء الشاشة */
        body [role="listbox"],
        body [role="option"],
        body [role="combobox"],
        body [aria-haspopup="listbox"],
        body .gold-dropdown,
        body .goldDropdown,
        body [class*="GoldDropdown"],
        body [class*="goldDropdown"],
        body [class*="gold-dropdown"],
        body [class*="dropdown"],
        body [class*="Dropdown"] {
          pointer-events: auto !important;
          z-index: 2147483647 !important;
        }

        .fullscreenEditDropdownFix,
        .fullscreenEditDropdownFix * {
          pointer-events: auto !important;
        }
      `}</style>

      <style>{`
        .rooms12NoBlackTableCellsScope table,
        .rooms12NoBlackTableCellsScope table tbody,
        .rooms12NoBlackTableCellsScope table tr,
        .rooms12NoBlackTableCellsScope table th,
        .rooms12NoBlackTableCellsScope table td {
          background: #fffdf7 !important;
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          text-shadow: none !important;
          font-weight: 900 !important;
        }

        .rooms12NoBlackTableCellsScope table th {
          background: linear-gradient(180deg, #fff4c4 0%, #ead077 100%) !important;
        }

        .rooms12NoBlackTableCellsScope table td *,
        .rooms12NoBlackTableCellsScope table th * {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          text-shadow: none !important;
          font-weight: 900 !important;
        }

        .rooms12NoBlackTableCellsScope table td div,
        .rooms12NoBlackTableCellsScope table td span,
        .rooms12NoBlackTableCellsScope table td button,
        .rooms12NoBlackTableCellsScope table td [style*="background"],
        .rooms12NoBlackTableCellsScope table td [style*="#0"],
        .rooms12NoBlackTableCellsScope table td [style*="rgba(15"],
        .rooms12NoBlackTableCellsScope table td [style*="rgba(30"],
        .rooms12NoBlackTableCellsScope table td [style*="rgba(2"] {
          background: #fffdf7 !important;
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          box-shadow: none !important;
          text-shadow: none !important;
        }

        .rooms12NoBlackTableCellsScope table td button {
          background: linear-gradient(180deg, #dbeafe 0%, #93c5fd 100%) !important;
          border: 2px solid #2563eb !important;
          border-radius: 18px !important;
        }

        .rooms12NoBlackTableCellsScope table th,
        .rooms12NoBlackTableCellsScope table td {
          border-width: 2px !important;
          border-style: solid !important;
        }

        .rooms12NoBlackTableCellsScope table th:nth-child(10n + 1),
        .rooms12NoBlackTableCellsScope table td:nth-child(10n + 1) { border-color: #2563eb !important; }

        .rooms12NoBlackTableCellsScope table th:nth-child(10n + 2),
        .rooms12NoBlackTableCellsScope table td:nth-child(10n + 2) { border-color: #16a34a !important; }

        .rooms12NoBlackTableCellsScope table th:nth-child(10n + 3),
        .rooms12NoBlackTableCellsScope table td:nth-child(10n + 3) { border-color: #dc2626 !important; }

        .rooms12NoBlackTableCellsScope table th:nth-child(10n + 4),
        .rooms12NoBlackTableCellsScope table td:nth-child(10n + 4) { border-color: #9333ea !important; }

        .rooms12NoBlackTableCellsScope table th:nth-child(10n + 5),
        .rooms12NoBlackTableCellsScope table td:nth-child(10n + 5) { border-color: #ea580c !important; }

        .rooms12NoBlackTableCellsScope table th:nth-child(10n + 6),
        .rooms12NoBlackTableCellsScope table td:nth-child(10n + 6) { border-color: #0891b2 !important; }

        .rooms12NoBlackTableCellsScope table th:nth-child(10n + 7),
        .rooms12NoBlackTableCellsScope table td:nth-child(10n + 7) { border-color: #4f46e5 !important; }

        .rooms12NoBlackTableCellsScope table th:nth-child(10n + 8),
        .rooms12NoBlackTableCellsScope table td:nth-child(10n + 8) { border-color: #db2777 !important; }

        .rooms12NoBlackTableCellsScope table th:nth-child(10n + 9),
        .rooms12NoBlackTableCellsScope table td:nth-child(10n + 9) { border-color: #ca8a04 !important; }

        .rooms12NoBlackTableCellsScope table th:nth-child(10n + 10),
        .rooms12NoBlackTableCellsScope table td:nth-child(10n + 10) { border-color: #059669 !important; }
      `}</style>


      <style>{`
        .rooms12ForceBlackText,
        .rooms12ForceBlackText * {
          color: #000000 !important;
          text-shadow: none !important;
        }

        .rooms12ForceBlackText h1,
        .rooms12ForceBlackText h2,
        .rooms12ForceBlackText h3,
        .rooms12ForceBlackText h4,
        .rooms12ForceBlackText p,
        .rooms12ForceBlackText div,
        .rooms12ForceBlackText span,
        .rooms12ForceBlackText label,
        .rooms12ForceBlackText button,
        .rooms12ForceBlackText input,
        .rooms12ForceBlackText select,
        .rooms12ForceBlackText textarea,
        .rooms12ForceBlackText option,
        .rooms12ForceBlackText th,
        .rooms12ForceBlackText td,
        .rooms12ForceBlackText strong,
        .rooms12ForceBlackText b {
          color: #000000 !important;
          font-weight: 900 !important;
          text-shadow: none !important;
        }

        .rooms12ForceBlackText [style*="#d4af37"],
        .rooms12ForceBlackText [style*="#D4AF37"],
        .rooms12ForceBlackText [style*="gold"],
        .rooms12ForceBlackText [style*="rgb(212, 175, 55)"] {
          color: #000000 !important;
          font-weight: 900 !important;
          text-shadow: none !important;
        }
      `}</style>


      <style>{`
        .rooms12BlackTextScope,
        .rooms12BlackTextScope * {
          color: #000000 !important;
          text-shadow: none !important;
        }

        .rooms12BlackTextScope button,
        .rooms12BlackTextScope input,
        .rooms12BlackTextScope select,
        .rooms12BlackTextScope textarea,
        .rooms12BlackTextScope option,
        .rooms12BlackTextScope label,
        .rooms12BlackTextScope th,
        .rooms12BlackTextScope td,
        .rooms12BlackTextScope div,
        .rooms12BlackTextScope span,
        .rooms12BlackTextScope p,
        .rooms12BlackTextScope h1,
        .rooms12BlackTextScope h2,
        .rooms12BlackTextScope h3 {
          color: #000000 !important;
          font-weight: 800;
        }

        .rooms12BlackTextScope th,
        .rooms12BlackTextScope td {
          color: #000000 !important;
          font-weight: 800;
        }
      `}</style>

      <style>{`
        .rooms12ColoredBordersScope table th:nth-child(10n + 1),
        .rooms12ColoredBordersScope table td:nth-child(10n + 1) { border-color: #2563eb !important; }
        .rooms12ColoredBordersScope table th:nth-child(10n + 2),
        .rooms12ColoredBordersScope table td:nth-child(10n + 2) { border-color: #16a34a !important; }
        .rooms12ColoredBordersScope table th:nth-child(10n + 3),
        .rooms12ColoredBordersScope table td:nth-child(10n + 3) { border-color: #dc2626 !important; }
        .rooms12ColoredBordersScope table th:nth-child(10n + 4),
        .rooms12ColoredBordersScope table td:nth-child(10n + 4) { border-color: #9333ea !important; }
        .rooms12ColoredBordersScope table th:nth-child(10n + 5),
        .rooms12ColoredBordersScope table td:nth-child(10n + 5) { border-color: #ea580c !important; }

        .rooms12ColoredBordersScope table th,
        .rooms12ColoredBordersScope table td {
          border-width: 2px !important;
          border-style: solid !important;
        }
      `}</style>

      <style>{`
        html,
        body,
        #root {
          margin: 0 !important;
          min-height: 100% !important;
          background:
            radial-gradient(1200px 520px at 50% -10%, rgba(212, 175, 55, 0.18), transparent 62%),
            linear-gradient(180deg, #fffdf7 0%, #f7f3e7 48%, #fffaf0 100%) !important;
        }

        body {
          background-color: #f7f3e7 !important;
        }

        .rooms12PageRoot {
          position: relative;
          z-index: 1;
          background:
            radial-gradient(1200px 520px at 50% -10%, rgba(212, 175, 55, 0.18), transparent 62%),
            linear-gradient(180deg, #fffdf7 0%, #f7f3e7 48%, #fffaf0 100%) !important;
        }

        .rooms12FixedLightBg {
          position: fixed;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background:
            radial-gradient(1200px 520px at 50% -10%, rgba(212, 175, 55, 0.18), transparent 62%),
            linear-gradient(180deg, #fffdf7 0%, #f7f3e7 48%, #fffaf0 100%) !important;
        }
      `}</style>
      <div className="rooms12FixedLightBg" aria-hidden="true" />

      <div
        style={{
          position: "absolute",
          top: -180,
          left: "50%",
          transform: "translateX(-50%)",
          width: 620,
          height: 620,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212,175,55,0.18) 0%, rgba(212,175,55,0.05) 38%, transparent 72%)",
          filter: "blur(12px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: isRTL ? -120 : "auto",
          left: !isRTL ? -120 : "auto",
          top: 260,
          width: 340,
          height: 340,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,185,129,0.10), transparent 72%)",
          filter: "blur(12px)",
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: 1500, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <section
          style={{
            background: "linear-gradient(180deg, #fffaf0 0%, #f4ead0 100%)",
            border: "5px solid #111827",
            borderRadius: 30,
            padding: "22px 26px",
            boxShadow:
              "0 0 0 6px rgba(212,175,55,0.26) inset, 0 18px 38px rgba(150,120,20,0.16)",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(260px, 1fr) 150px minmax(260px, 1fr)",
              gap: 22,
              alignItems: "center",
              borderBottom: "3px solid #111827",
              paddingBottom: 18,
            }}
          >
            <div style={{ display: "grid", gap: 6, textAlign: "right", lineHeight: 1.45 }}>
              <div style={{ fontSize: 24, fontWeight: 1000 }}>سلطنة عمان</div>
              <div style={{ fontSize: 24, fontWeight: 1000 }}>وزارة التعليم</div>
              <div style={{ fontSize: 17, fontWeight: 1000 }}>{officialGovernorate}</div>
              <div style={{ fontSize: 21, fontWeight: 1000 }}>{officialCenterName}</div>
            </div>

            <div
              style={{
                width: 132,
                height: 132,
                margin: "0 auto",
                borderRadius: 28,
                border: "4px solid #d4af37",
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 14px 28px rgba(150,120,20,0.14)",
              }}
            >
              <img
                src={officialLogo || ROOMS12_DEFAULT_LOGO_URL}
                alt="official logo"
                style={{ width: "82%", height: "82%", objectFit: "contain" }}
              />
            </div>

            <div style={{ display: "grid", gap: 6, textAlign: "left", lineHeight: 1.45 }}>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 1000,
                  textDecoration: "underline",
                  textUnderlineOffset: 8,
                }}
              >
                إدارة قاعات مركز الامتحانات
              </div>
              <div style={{ fontSize: 17, fontWeight: 1000 }}>{officialSemester}</div>
              <div style={{ fontSize: 17, fontWeight: 1000 }}>
                العام الدراسي {officialAcademicYear} م
              </div>
              <div style={{ fontSize: 17, fontWeight: 1000 }}>
                رمز مركز الامتحان: {officialCenterCode}
              </div>
              <div style={{ fontSize: 17, fontWeight: 1000 }}>
                رئيس المركز: {officialCenterHead}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 12,
              border: "3px solid #111827",
              borderRadius: 18,
              padding: "10px 16px",
              background: "rgba(255,255,255,0.62)",
              fontWeight: 1000,
              fontSize: 16,
            }}
          >
            <span>اسم المركز: {officialCenterName}</span>
            <span>رمز المركز: {officialCenterCode}</span>
            <span>إجمالي القاعات: {stats.total}</span>
            <span>السعة الإجمالية: {stats.capacity}</span>
          </div>
        </section>

        <div
          style={{
            display: "none",
          }}
          aria-hidden="true"
        />

        {quickBlock.open && (
          <div style={modalOverlay} onClick={() => setQuickBlock((prev) => ({ ...prev, open: false }))}>
            <div style={modalCard} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontWeight: 1000, fontSize: 18, marginBottom: 12, color: "#000000" }}>
                {tr("حظر سريع للقاعة:", "Quick block for room:")} {quickBlock.roomName}
              </div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(220px, 1fr))" }}>
                <div>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>{tr("السبب", "Reason")}</div>
                  <textarea
                    style={{ ...inputStyle, minHeight: 90 }}
                    value={quickBlock.reason}
                    onChange={(e) => setQuickBlock((prev) => ({ ...prev, reason: e.target.value }))}
                  />
                </div>
                <div>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>{tr("نوع السبب", "Reason Type")}</div>
                  <SearchableDropdown
                    value={quickBlock.reasonType}
                    options={BLOCK_REASON_OPTIONS}
                    onChange={(v) => setQuickBlock((prev) => ({ ...prev, reasonType: v }))}
                    inputStyle={inputStyle}
                    direction={isRTL ? "rtl" : "ltr"}
                    zIndex={2147483647}
                  />
                  <div style={{ fontWeight: 900, marginBottom: 6, marginTop: 10 }}>{tr("الفترة", "Session")}</div>
                  <SearchableDropdown
                    value={quickBlock.session}
                    options={BLOCK_SESSION_OPTIONS}
                    onChange={(v) =>
                      setQuickBlock((prev) => ({
                        ...prev,
                        session: v as QuickBlockState["session"],
                      }))
                    }
                    inputStyle={inputStyle}
                    direction={isRTL ? "rtl" : "ltr"}
                    zIndex={2147483647}
                  />
                </div>
                <div>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>{tr("تاريخ البداية", "Start Date")}</div>
                  <input
                    style={inputStyle}
                    type="date"
                    value={quickBlock.startDate}
                    onChange={(e) => setQuickBlock((prev) => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>{tr("تاريخ النهاية", "End Date")}</div>
                  <input
                    style={inputStyle}
                    type="date"
                    value={quickBlock.endDate}
                    onChange={(e) => setQuickBlock((prev) => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button style={btn("#10b981", "#07101f")} onClick={saveQuickBlock}>
                  {tr("حفظ الحظر", "Save Block")}
                </button>
                <button style={btn("#1f2937", "#d4af37")} onClick={() => setQuickBlock((prev) => ({ ...prev, open: false }))}>
                  {tr("إلغاء", "Cancel")}
                </button>
              </div>
            </div>
          </div>
        )}

        {historyRoomId && (
          <div style={modalOverlay} onClick={() => setHistoryRoomId(null)}>
            <div style={modalCard} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontWeight: 1000, fontSize: 18, marginBottom: 12, color: "#000000" }}>
                {tr("سجل الحظر:", "Block History:")} {roomsById.get(historyRoomId)?.roomName || tr("القاعة", "Room")}
              </div>
              <div style={tableWrap}>
                <table style={{ width: "100%", minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th style={{ border: "2px solid #2563eb",  ...thStyle, position: "sticky", top: 0, background: "#d4af37", color: "#111827", zIndex: 2, padding: 10, borderBottom: "1px solid rgba(212,175,55,0.2)" }}>{tr("السبب", "Reason")}</th>
                      <th style={{ border: "2px solid #16a34a",  ...thStyle, position: "sticky", top: 0, background: "#d4af37", color: "#111827", zIndex: 2, padding: 10, borderBottom: "1px solid rgba(212,175,55,0.2)" }}>{tr("النوع", "Type")}</th>
                      <th style={{ border: "2px solid #dc2626",  ...thStyle, position: "sticky", top: 0, background: "#d4af37", color: "#111827", zIndex: 2, padding: 10, borderBottom: "1px solid rgba(212,175,55,0.2)" }}>{tr("من", "From")}</th>
                      <th style={{ border: "2px solid #9333ea",  ...thStyle, position: "sticky", top: 0, background: "#d4af37", color: "#111827", zIndex: 2, padding: 10, borderBottom: "1px solid rgba(212,175,55,0.2)" }}>{tr("إلى", "To")}</th>
                      <th style={{ border: "2px solid #ea580c",  ...thStyle, position: "sticky", top: 0, background: "#d4af37", color: "#111827", zIndex: 2, padding: 10, borderBottom: "1px solid rgba(212,175,55,0.2)" }}>{tr("الفترة", "Session")}</th>
                      <th style={{ border: "2px solid #0891b2",  ...thStyle, position: "sticky", top: 0, background: "#d4af37", color: "#111827", zIndex: 2, padding: 10, borderBottom: "1px solid rgba(212,175,55,0.2)" }}>{tr("الحالة", "Status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyBlocks.length === 0 ? (
                      <tr>
                        <td style={{ border: "2px solid #4f46e5",  padding: 10, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#e6c76a" }} colSpan={6}>
                          {tr("لا يوجد سجل حظر لهذه القاعة.", "There is no block history for this room.")}
                        </td>
                      </tr>
                    ) : (
                      historyBlocks.map((block, index) => (
                        <tr key={block.id}>
                          <td style={{ border: "2px solid #db2777",  padding: 10, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#e6c76a" }}>{block.reason}</td>
                          <td style={{ border: "2px solid #ca8a04",  padding: 10, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#e6c76a" }}>{block.reasonType}</td>
                          <td style={{ border: "2px solid #059669",  padding: 10, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#e6c76a" }}>{block.startDate}</td>
                          <td style={{ border: "2px solid #2563eb",  padding: 10, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#e6c76a" }}>{block.endDate}</td>
                          <td style={{ border: "2px solid #16a34a",  padding: 10, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#e6c76a" }}>
                            {block.session === "full-day" ? tr("اليوم كامل", "Full Day") : block.session === "الفترة الأولى" ? tr("الفترة الأولى", "First Period") : tr("الفترة الثانية", "Second Period")}
                          </td>
                          <td style={{ border: "2px solid #dc2626",  padding: 10, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#e6c76a" }}>
                            {block.status === "active" ? tr("نشط", "Active") : block.status === "expired" ? tr("منتهي", "Expired") : tr("ملغي", "Cancelled")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button style={btn("#1f2937", "#d4af37")} onClick={() => setHistoryRoomId(null)}>
                  {tr("إغلاق", "Close")}
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={header}>
          <div>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>{APP_NAME}</div>
            <div style={{ fontWeight: 900, opacity: 0.75 }}>{tr("القاعات", "Rooms")}</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button style={btn("#1f2937", "#d4af37")} onClick={() => history.back()}>
              {tr("← رجوع", "← Back")}
            </button>
            <button
              style={{ ...btn("#3b82f6", "#07101f"), opacity: saving ? 0.7 : 1 }}
              onClick={startAdd}
              disabled={saving}
            >
              {tr("+ إضافة قاعة", "+ Add Room")}
            </button>
            <button
              style={{ ...btn("#ef4444", "#07101f"), opacity: saving ? 0.7 : 1 }}
              onClick={() => void deleteAll()}
              disabled={saving}
            >
              {tr("🗑 حذف الكل", "🗑 Delete All")}
            </button>
          </div>
        </div>

        <div
          style={{
            ...card,
            marginBottom: 12,
            padding: "12px 16px",
            fontWeight: 1000,
            border: "3px solid #111827",
          }}
        >
          {loading ? tr("تحميل من السحابة...", "Loading from cloud...") : syncMessage}
        </div>

        {loading && !loaded && (
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 12,
              background: "rgba(59,130,246,0.12)",
              border: "1px solid rgba(59,130,246,0.35)",
              color: "#bfdbfe",
              fontWeight: 900,
            }}
          >
            {tr("جار تحميل بيانات القاعات...", "Loading rooms data...")}
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 12,
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.35)",
              color: "#fecaca",
              fontWeight: 900,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(4, minmax(180px, 1fr))", marginBottom: 14 }}>
          {[
            [tr("إجمالي القاعات", "Total Rooms"), String(stats.total)],
            [tr("القاعات النشطة", "Active Rooms"), String(stats.active)],
            [tr("القاعات المحظورة اليوم", "Blocked Rooms Today"), String(stats.blocked)],
            [tr("السعة الإجمالية", "Total Capacity"), String(stats.capacity)],
          ].map(([label, value]) => (
            <div key={label} style={{ ...card, marginBottom: 0 }}>
              <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 28, fontWeight: 1000, color: "#f1d27a" }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              style={{ ...inputStyle, maxWidth: 340 }}
              placeholder={tr("بحث...", "Search...")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <SearchableDropdown
              value={statusFilter}
              options={[
                { value: "all", label: tr("كل الحالات", "All Statuses") },
                { value: "active", label: tr("نشطة", "Active") },
                { value: "inactive", label: tr("موقوفة", "Inactive") },
                { value: "blocked", label: tr("محظورة اليوم", "Blocked Today") },
              ]}
              onChange={(v) => setStatusFilter(v as typeof statusFilter)}
              inputStyle={{ ...inputStyle, maxWidth: 260 }}
              direction={isRTL ? "rtl" : "ltr"}
              zIndex={999999}
            />
            <button style={btn("#22c55e", "#07101f")} onClick={exportCSV}>
              {tr("تصدير CSV", "Export CSV")}
            </button>
            <button style={btn("#10b981", "#07101f")} onClick={exportExcel}>
              {tr("تصدير Excel", "Export Excel")}
            </button>
            <label style={btn("#60a5fa", "#07101f")}>
              {tr("استيراد CSV ⬆️", "Import CSV ⬆️")}
              <input
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importCSV(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <label style={btn("#93c5fd", "#07101f")}>
              {tr("استيراد Excel ⬆️", "Import Excel ⬆️")}
              <input
                type="file"
                accept=".xlsx,.xls"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importExcel(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <div style={{ marginInlineStart: "auto", fontWeight: 900, color: "#000000" }}>
              {tr("إجمالي", "Total")}: {rooms.length} — {tr("المعروض", "Shown")}: {filtered.length}
            </div>
          </div>
        </div>

        {!roomsTableFullScreen && roomFormNode}

        {roomsTableRender}

      </div>
    </div>
  );
}