import React, { useEffect, useMemo, useRef, useState } from "react"; 
import GoldDropdown from "../components/GoldDropdown";
import { useAuth } from "../auth/AuthContext";
import { useRoomsData } from "../hooks/useRoomsData";
import { useRoomBlocksData } from "../hooks/useRoomBlocksData";
import { useI18n } from "../i18n/I18nProvider";
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

function parseRoomsFromObjects(rows: Record<string, unknown>[]): Room[] {
  return rows
    .map((r, index) => {
      const roomName = getCell(r, ["اسم القاعة", "القاعة", "room", "roomname", "name"]);
      const code = getCell(r, ["الكود", "code", "roomCode", "رقم القاعة"]);
      const building = getCell(r, ["المبنى", "building", "block", "الدور"]);
      const type = getCell(r, ["النوع", "type"]);
      const capacity = Number(getCell(r, ["السعة", "capacity", "cap"])) || 0;
      const status = (getCell(r, ["الحالة", "status"]) || "active") as Room["status"];
      const notes = getCell(r, ["ملاحظات", "notes", "note"]);
      return {
        id: createId("room"),
        roomName: roomName.trim(),
        code: code.trim(),
        building: building.trim(),
        type: type.trim(),
        capacity,
        status: status === "inactive" ? "inactive" : "active",
        notes: notes.trim(),
      } as Room;
    })
    .filter((x) => x.roomName);
}

export default function Rooms() {
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const BUILDING_OPTIONS = useMemo(() => (lang === "ar" ? BUILDING_OPTIONS_AR : BUILDING_OPTIONS_EN), [lang]);
  const ROOM_TYPE_OPTIONS = useMemo(() => (lang === "ar" ? ROOM_TYPE_OPTIONS_AR : ROOM_TYPE_OPTIONS_EN), [lang]);
  const ROOM_STATUS_OPTIONS = useMemo(() => (lang === "ar" ? ROOM_STATUS_OPTIONS_AR : ROOM_STATUS_OPTIONS_EN), [lang]);
  const BLOCK_REASON_OPTIONS = useMemo(() => (lang === "ar" ? BLOCK_REASON_OPTIONS_AR : BLOCK_REASON_OPTIONS_EN), [lang]);
  const BLOCK_SESSION_OPTIONS = useMemo(() => (lang === "ar" ? BLOCK_SESSION_OPTIONS_AR : BLOCK_SESSION_OPTIONS_EN), [lang]);

  const {
    rooms,
    setRooms,
    loading,
    loaded,
    error,
    saving,
    createRoom,
    updateRoom,
    deleteRoom,
    deleteAllRooms,
    reloadRooms,
  } = useRoomsData();

  const { roomBlocks, setRoomBlocks } = useRoomBlocksData();
  const { user } = useAuth() as any;

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
  const [historyRoomId, setHistoryRoomId] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

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
          .filter((room) => isRoomBlockedToday(room.id, todayISO, normalizedBlocks))
          .map((room, index) => room.id)
      ),
    [rooms, todayISO, normalizedBlocks]
  );

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

  const pageStyle: React.CSSProperties = {
    padding: 18,
    color: "#111827",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, rgba(212,175,55,0.20), transparent 26%), radial-gradient(circle at 88% 18%, rgba(212,175,55,0.12), transparent 24%), linear-gradient(180deg, #fffdf6 0%, #f8f2df 46%, #fffaf0 100%)",
    position: "relative",
    overflowX: "hidden",
    direction: isRTL ? "rtl" : "ltr",
  };

  const card: React.CSSProperties = {
    background: "linear-gradient(180deg, rgba(255,253,246,0.96), rgba(255,248,230,0.98))",
    border: "1.5px solid rgba(212,175,55,0.30)",
    borderRadius: 24,
    padding: 18,
    boxShadow: "0 18px 42px rgba(108,82,12,0.12)",
    marginBottom: 14,
    backdropFilter: "blur(6px)",
  };

  const header: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    background: "linear-gradient(135deg, #f1d27a, #d4af37, #b8962e)",
    color: "#0b1220",
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 18px 60px rgba(212,175,55,0.25)",
    marginBottom: 14,
  };

  const btn = (bg: string, fg = "#0b1220"): React.CSSProperties => ({
    background: bg,
    color: fg,
    border: "3px solid #2563eb",
    borderRadius: 14,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 900,
    boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
  });

  const inputStyle: React.CSSProperties = {
    background: "#fffdf6",
    color: "#111827",
    border: "3px solid #16a34a",
    borderRadius: 12,
    padding: "10px 12px",
    outline: "none",
    width: "100%",
  };

  const tableWrap: React.CSSProperties = {
    maxHeight: "70vh",
    overflow: "auto",
    borderRadius: 24,
    border: "3px solid #dc2626",
    background: "transparent",
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
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  };

  const modalCard: React.CSSProperties = {
    width: "min(820px, 96vw)",
    maxHeight: "90vh",
    overflow: "auto",
    background: "linear-gradient(180deg, #fffdf6, #fff8e6)",
    border: "1.5px solid rgba(212,175,55,0.32)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 22px 70px rgba(108,82,12,0.22)",
    color: "#111827",
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
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
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
      await createRoom({
        ...row,
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
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  async function saveEdit() {
    if (!editingId) return;
    const msg = validate(edit);
    if (msg) {
      alert(msg);
      return;
    }
    try {
      await updateRoom({
        ...edit,
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
      setRoomBlocks((prev) => prev.filter((block) => block.roomId !== id));
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
      setRoomBlocks((prev) => prev.filter((block) => !roomIds.has(block.roomId)));
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
      roomName: quickBlock.roomName,
      reason: quickBlock.reason.trim(),
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

  return (
    <div style={pageStyle} ref={topRef} className="rooms12PageRoot rooms12ColoredBordersScope rooms12BlackTextScope rooms12ForceBlackText rooms12NoBlackTableCellsScope">
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
        <div
          style={{
            display: "grid",
            gap: 18,
            border: "3px solid #9333ea",
            borderRadius: 34,
            padding: 28,
            background:
              "linear-gradient(135deg, rgba(255,253,246,0.98), rgba(248,242,223,0.98), rgba(255,250,240,0.98))",
            boxShadow:
              "0 26px 70px rgba(108,82,12,0.16), inset 0 1px 0 rgba(255,255,255,0.75)",
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "start" }}>
            <div style={{ display: "grid", gap: 14, maxWidth: 900 }}>
              <div
                style={{
                  display: "inline-flex",
                  width: "fit-content",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.22)",
                  color: "#a7f3d0",
                  fontWeight: 900,
                  fontSize: 12,
                }}
              >
                {tr("إدارة تشغيلية مباشرة للقاعات والحظر", "Direct operational management for rooms and blocking")}
              </div>

              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#6f5100", marginBottom: 10 }}>
                  {APP_NAME}
                </div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "clamp(34px, 5vw, 64px)",
                    lineHeight: 1.05,
                    fontWeight: 950,
                    color: "#111827",
                    letterSpacing: "-0.03em",
                    textShadow: "0 8px 28px rgba(212,175,55,0.16)",
                  }}
                >
                  {tr(" إدارة قاعات مركز إمتحانات الدبلوم", "Rooms Management Center")}
                </h1>
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: 16,
                  lineHeight: 2,
                  color: "rgba(17,24,39,0.78)",
                  maxWidth: 940,
                }}
              >
                {tr(
                  "تمنح هذه الصفحة الإدارة رؤية تنفيذية فاخرة لحالة القاعات، والسعة، والحظر الحالي، مع تجربة منظمة لإضافة القاعات وتعديلها واستيرادها وتصديرها وإدارة سجل الحظر في واجهة مؤسسية أنيقة وسريعة.",
                  "This page gives the administration a premium executive view of room status, capacity, and current blocks, with an organized experience for adding, editing, importing, and exporting rooms, and managing block history in a fast and elegant institutional interface."
                )}
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                  { label: tr("حالة البيانات", "Data Status"), value: loaded ? tr("مرتبطة ببيانات فعلية", "Connected to live data") : tr("جاري التحميل", "Loading") },
                  { label: tr("البحث الحالي", "Current Search"), value: query.trim() || tr("بدون فلترة", "No Filter") },
                  { label: tr("الحالة المختارة", "Selected Status"), value: statusFilter === "all" ? tr("كل الحالات", "All Statuses") : statusFilter === "active" ? tr("نشطة", "Active") : statusFilter === "inactive" ? tr("موقوفة", "Inactive") : tr("محظورة اليوم", "Blocked Today") },
                ].map((item, index) => (
                  <div
                    key={item.label}
                    style={{
                      border: "3px solid #ea580c",
                      background: "linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,248,230,0.88))",
                      borderRadius: 18,
                      padding: "12px 14px",
                      minWidth: 190,
                      boxShadow: "0 12px 24px rgba(108,82,12,0.10)",
                    }}
                  >
                    <div style={{ fontSize: 12, color: "rgba(17,24,39,0.62)", fontWeight: 900 }}>{item.label}</div>
                    <div style={{ marginTop: 6, fontSize: 16, color: "#111827", fontWeight: 900 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                minWidth: 300,
                maxWidth: 390,
                width: "100%",
                border: "3px solid #0891b2",
                borderRadius: 28,
                padding: 22,
                background: "linear-gradient(180deg, rgba(255,255,255,0.82), rgba(255,248,230,0.90))",
                boxShadow: "0 14px 32px rgba(108,82,12,0.10)",
                display: "grid",
                gap: 16,
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  width: "fit-content",
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: stats.blocked > 0 ? "rgba(239,68,68,0.14)" : "rgba(16,185,129,0.14)",
                  border: stats.blocked > 0 ? "1px solid rgba(239,68,68,0.24)" : "1px solid rgba(16,185,129,0.24)",
                  color: stats.blocked > 0 ? "#fecaca" : "#a7f3d0",
                  fontWeight: 900,
                  fontSize: 12,
                }}
              >
                {stats.blocked > 0 ? tr("يوجد حظر نشط يحتاج متابعة", "There is an active block that needs follow-up") : tr("الوضع التشغيلي مستقر", "Operational status is stable")}
              </div>

              <div style={{ fontSize: 28, lineHeight: 1.5, fontWeight: 950, color: "#111827" }}>
                {tr(
                  "",
                  "From here you can manage rooms, apply quick blocks, review block history, and import or export data with a premium visual flow that reflects the quality of an institutional product."
                )}
              </div>

              <div style={{ fontSize: 14, lineHeight: 1.95, color: "rgba(17,24,39,0.72)" }} />
            </div>
          </div>
        </div>

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
                  <GoldDropdown
                    value={quickBlock.reasonType}
                    options={BLOCK_REASON_OPTIONS}
                    onChange={(v) => setQuickBlock((prev) => ({ ...prev, reasonType: v }))}
                  />
                  <div style={{ fontWeight: 900, marginBottom: 6, marginTop: 10 }}>{tr("الفترة", "Session")}</div>
                  <GoldDropdown
                    value={quickBlock.session}
                    options={BLOCK_SESSION_OPTIONS}
                    onChange={(v) =>
                      setQuickBlock((prev) => ({
                        ...prev,
                        session: v as QuickBlockState["session"],
                      }))
                    }
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
            <GoldDropdown
              value={statusFilter}
              options={[
                { value: "all", label: tr("كل الحالات", "All Statuses") },
                { value: "active", label: tr("نشطة", "Active") },
                { value: "inactive", label: tr("موقوفة", "Inactive") },
                { value: "blocked", label: tr("محظورة اليوم", "Blocked Today") },
              ]}
              onChange={(v) => setStatusFilter(v as typeof statusFilter)}
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

        {(adding || editingId) && (
          <div style={card}>
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
                <GoldDropdown
                  value={current.building}
                  options={BUILDING_OPTIONS}
                  placeholder={tr("— اختر المبنى —", "— Select Building —")}
                  onChange={(v) => setCurrent({ building: v })}
                />
              </div>
              <div>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#000000" }}>{tr("نوع القاعة", "Room Type")}</div>
                <GoldDropdown
                  value={current.type}
                  options={ROOM_TYPE_OPTIONS}
                  placeholder={tr("— اختر النوع —", "— Select Type —")}
                  onChange={(v) => setCurrent({ type: v })}
                />
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
                <GoldDropdown
                  value={current.status || "active"}
                  options={ROOM_STATUS_OPTIONS}
                  onChange={(v) => setCurrent({ status: v as Room["status"] })}
                />
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
        )}

        <div
          style={{
            ...card,
            padding: 12,
            borderRadius: 28,
            background: "linear-gradient(180deg, rgba(255,253,246,0.96), rgba(255,248,230,0.98))",
            boxShadow: "0 22px 60px rgba(0,0,0,0.42)",
          }}
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
            <div style={{ fontWeight: 900, color: "#000000", opacity: 0.9 }}>
              {tr("جدول القاعات", "Rooms Table")}
            </div>
          </div>
          <div className="roomsTableLuxury" style={tableWrap}>
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
      </div>
    </div>
  );
}