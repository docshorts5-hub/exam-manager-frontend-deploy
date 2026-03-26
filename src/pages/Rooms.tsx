import React, { useEffect, useMemo, useRef, useState } from "react";
import GoldDropdown from "../components/GoldDropdown";
import { useAuth } from "../auth/AuthContext";
import { useRoomsData } from "../hooks/useRoomsData";
import { useRoomBlocksData } from "../hooks/useRoomBlocksData";
import { createId, isRoomBlockedToday } from "../lib/roomScheduling";
import type { Room } from "../services/rooms.service";
import type { RoomBlock } from "../services/roomBlocks.service";

const APP_NAME = "نظام إدارة الامتحانات المطوّر";

const BUILDING_OPTIONS = [
  { value: "", label: "— اختر المبنى —" },
  { value: "المبنى A", label: "المبنى A" },
  { value: "المبنى B", label: "المبنى B" },
  { value: "المبنى C", label: "المبنى C" },
  { value: "الدور الأرضي", label: "الدور الأرضي" },
  { value: "الدور الأول", label: "الدور الأول" },
  { value: "الدور الثاني", label: "الدور الثاني" },
];

const ROOM_TYPE_OPTIONS = [
  { value: "", label: "— اختر النوع —" },
  { value: "قاعة دراسية", label: "قاعة دراسية" },
  { value: "مختبر", label: "مختبر" },
  { value: "قاعة حاسب", label: "قاعة حاسب" },
  { value: "قاعة متعددة", label: "قاعة متعددة" },
];

const ROOM_STATUS_OPTIONS = [
  { value: "active", label: "نشطة" },
  { value: "inactive", label: "موقوفة" },
];

const BLOCK_REASON_OPTIONS = [
  { value: "maintenance", label: "صيانة" },
  { value: "reserved", label: "محجوزة" },
  { value: "conflict", label: "تعارض" },
  { value: "admin", label: "قرار إداري" },
];

const BLOCK_SESSION_OPTIONS = [
  { value: "full-day", label: "اليوم كامل" },
  { value: "الفترة الأولى", label: "الفترة الأولى" },
  { value: "الفترة الثانية", label: "الفترة الثانية" },
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

function toCSV(rows: Room[]) {
  const header = ["اسم القاعة", "الكود", "المبنى", "النوع", "السعة", "الحالة", "ملاحظات"];
  const escape = (s: string) => {
    const v = (s ?? "").replace(/\r?\n/g, " ").trim();
    if (/[",]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [r.roomName, r.code || "", r.building, r.type, String(r.capacity), r.status || "active", r.notes]
        .map(escape)
        .join(",")
    ),
  ];
  return lines.join("\n");
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
    .map((r) => {
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
        background: linear-gradient(180deg, #0a0d14 0%, #090c13 100%);
        border: 1px solid rgba(212,175,55,0.18);
        border-radius: 26px;
        padding: 14px;
        box-shadow:
          0 24px 60px rgba(0,0,0,0.45),
          inset 0 1px 0 rgba(255,255,255,0.03);
        overflow: auto;
      }

      .roomsTableLuxury table {
        width: 100%;
        min-width: 1500px;
        border-collapse: separate;
        border-spacing: 10px 12px;
      }

      .roomsTableLuxury thead th {
        position: sticky;
        top: 0;
        z-index: 5;
        background: linear-gradient(180deg, #8a6500 0%, #6f5100 100%) !important;
        color: #fff3cf !important;
        text-align: right;
        font-weight: 1000;
        font-size: 18px;
        padding: 18px 20px;
        border: 1px solid rgba(255, 214, 102, 0.35) !important;
        border-radius: 22px;
        white-space: nowrap;
        box-shadow:
          inset 0 2px 0 rgba(255,255,255,0.08),
          0 10px 20px rgba(0,0,0,0.28);
      }

      .roomsTableLuxury tbody td {
        background:
          linear-gradient(90deg, rgba(9,12,18,0.98) 0%, rgba(13,16,23,0.96) 60%, rgba(10,13,19,0.98) 100%) !important;
        color: #f0c94d !important;
        padding: 14px 16px;
        border-radius: 22px;
        border: 1px solid rgba(212,175,55,0.16);
        white-space: nowrap;
        vertical-align: middle;
        box-shadow:
          0 10px 24px rgba(0,0,0,0.35),
          inset 0 1px 0 rgba(255,255,255,0.03);
        transition: transform .18s ease, box-shadow .18s ease, filter .18s ease;
      }

      .roomsTableLuxury tbody tr:hover td {
        transform: translateY(-2px);
        box-shadow:
          0 16px 30px rgba(0,0,0,0.42),
          inset 0 1px 0 rgba(255,255,255,0.04);
        filter: brightness(1.03);
      }

      .roomsTableLuxury .cell-main {
        font-size: 18px;
        font-weight: 900;
        color: #f2cf63 !important;
      }

      .roomsTableLuxury .cell-subtle {
        color: #e8c65a !important;
        opacity: 0.95;
        font-weight: 800;
      }

      .roomsTableLuxury .cell-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 92px;
        padding: 10px 16px;
        border-radius: 18px;
        font-weight: 1000;
        font-size: 15px;
        border: 1px solid rgba(255,255,255,0.08);
        box-shadow: 0 8px 18px rgba(0,0,0,0.28);
      }

      .roomsTableLuxury .badge-active {
        background: linear-gradient(180deg, #111827, #0b1220);
        color: #f2cf63;
        border-color: rgba(212,175,55,0.22);
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
        border-radius: 20px;
        padding: 14px 20px;
        font-weight: 1000;
        font-size: 15px;
        cursor: pointer;
        box-shadow: 0 10px 22px rgba(0,0,0,0.28);
        transition: transform .15s ease, filter .15s ease;
      }

      .roomsTableLuxury .actionBtn:hover {
        transform: translateY(-1px);
        filter: brightness(1.03);
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
        color: #f2cf63 !important;
        padding: 22px !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const roomsById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);

  const normalizedBlocks = useMemo<RoomBlock[]>(
    () =>
      roomBlocks.map((block) => {
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
          .map((room) => room.id)
      ),
    [rooms, todayISO, normalizedBlocks]
  );

  const filtered = useMemo(() => {
    const q = query.trim();

    return rooms.filter((r) => {
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
    });
  }, [rooms, query, statusFilter, blockedRoomIdsToday]);

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

  const pageStyle: React.CSSProperties = { padding: 16, color: "#e6c76a" };
  const card: React.CSSProperties = {
    background: "linear-gradient(180deg, #0b1220, #09101d)",
    border: "1px solid rgba(212,175,55,0.15)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    marginBottom: 14,
  };
  const header: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    background: "linear-gradient(135deg, #f1d27a, #d4af37, #b8962e)",
    color: "#0b1220",
    borderRadius: 18,
    padding: 14,
    boxShadow: "0 14px 60px rgba(212,175,55,0.25)",
    marginBottom: 14,
  };
  const btn = (bg: string, fg = "#0b1220"): React.CSSProperties => ({
    background: bg,
    color: fg,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 800,
    boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
  });
  const inputStyle: React.CSSProperties = {
    background: "#0b1220",
    color: "#e6c76a",
    border: "1px solid rgba(212,175,55,0.25)",
    borderRadius: 12,
    padding: "10px 12px",
    outline: "none",
    width: "100%",
  };
  const tableWrap: React.CSSProperties = {
    maxHeight: "70vh",
    overflow: "auto",
    borderRadius: 24,
    border: "1px solid rgba(212,175,55,0.12)",
    background: "transparent",
  };
  const thStyle: React.CSSProperties = {
    textAlign: "right",
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
    background: "linear-gradient(180deg, #0b1220, #09101d)",
    border: "1px solid rgba(212,175,55,0.25)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 22px 80px rgba(0,0,0,0.55)",
    color: "#e6c76a",
  };

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setRow({ ...emptyRoom, id: createId("room") });
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function validate(r: Room) {
    if (!r.roomName.trim()) return "اسم القاعة مطلوب.";
    if (!r.building.trim()) return "المبنى مطلوب.";
    if (!r.type.trim()) return "نوع القاعة مطلوب.";
    if (!r.capacity || r.capacity <= 0) return "السعة مطلوبة.";

    const duplicateCode = String(r.code || "").trim();
    if (duplicateCode) {
      const exists = rooms.some(
        (room) => String(room.code || "").trim() === duplicateCode && room.id !== r.id
      );
      if (exists) return "كود القاعة مكرر.";
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
      alert("✅ تم حفظ القاعة بنجاح");
    } catch {
      alert("❌ فشل حفظ القاعة");
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
      alert("✅ تم تحديث القاعة بنجاح");
    } catch {
      alert("❌ فشل تحديث القاعة");
    }
  }

  async function removeRoom(id: string) {
    if (!confirm("هل تريد حذف هذه القاعة؟ سيتم حذف أي حظر مرتبط بها أيضًا.")) return;

    try {
      await deleteRoom(id);
      setRoomBlocks((prev) => prev.filter((block) => block.roomId !== id));
      alert("✅ تم حذف القاعة");
    } catch {
      alert("❌ فشل حذف القاعة");
    }
  }

  async function deleteAll() {
    if (!rooms.length) return;

    const ok = confirm("⚠️ هل أنت متأكد من حذف جدول القاعات كاملًا؟ لا يمكن التراجع.");
    if (!ok) return;

    try {
      const roomIds = new Set(rooms.map((room) => room.id));
      await deleteAllRooms();
      setRoomBlocks((prev) => prev.filter((block) => !roomIds.has(block.roomId)));
      alert("✅ تم حذف جميع القاعات");
    } catch {
      alert("❌ فشل حذف جميع القاعات");
    }
  }

  function exportCSV() {
    downloadText("rooms.csv", toCSV(rooms));
  }

  async function exportExcel() {
    try {
      const XLSX = await import("xlsx");
      const rows = rooms.map((r) => ({
        "اسم القاعة": r.roomName,
        "الكود": r.code || "",
        "المبنى": r.building,
        "النوع": r.type,
        "السعة": r.capacity,
        "الحالة": r.status || "active",
        "ملاحظات": r.notes,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Rooms");
      XLSX.writeFile(wb, "rooms.xlsx");
    } catch {
      alert("مكتبة xlsx غير متوفرة. استخدم CSV أو ثبّت xlsx.");
    }
  }

  async function importCSV(file: File) {
    const text = await file.text();
    const objs = parseCSV(text);
    const incoming = parseRoomsFromObjects(objs);

    if (!incoming.length) {
      alert("لا توجد بيانات صالحة للاستيراد.");
      return;
    }

    try {
      for (const room of incoming) {
        await createRoom(room);
      }
      await reloadRooms();
      alert("✅ تم استيراد القاعات.");
    } catch {
      alert("❌ حدث خطأ أثناء استيراد CSV");
    }
  }

  async function importExcel(file: File) {
    const json = await tryReadExcel(file);
    if (!json) {
      alert("تعذر قراءة Excel. ثبّت xlsx أو استخدم CSV.");
      return;
    }

    const incoming = parseRoomsFromObjects(json);
    if (!incoming.length) {
      alert("لا توجد بيانات صالحة للاستيراد.");
      return;
    }

    try {
      for (const room of incoming) {
        await createRoom(room);
      }
      await reloadRooms();
      alert("✅ تم استيراد القاعات.");
    } catch {
      alert("❌ حدث خطأ أثناء استيراد Excel");
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
    if (!quickBlock.reason.trim()) return alert("سبب الحظر مطلوب.");
    if (!quickBlock.startDate || !quickBlock.endDate) return alert("تاريخ الحظر مطلوب.");
    if (quickBlock.endDate < quickBlock.startDate) return alert("تاريخ النهاية يجب أن يكون بعد البداية.");

    const overlap = roomBlocks.some(
      (block) =>
        block.roomId === quickBlock.roomId &&
        block.status === "active" &&
        !(quickBlock.endDate < block.startDate || quickBlock.startDate > block.endDate) &&
        (block.session === "full-day" ||
          quickBlock.session === "full-day" ||
          block.session === quickBlock.session)
    );

    if (overlap) return alert("يوجد حظر متداخل لهذه القاعة في نفس الفترة.");

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
    <div style={pageStyle} ref={topRef}>
      {quickBlock.open && (
        <div style={modalOverlay} onClick={() => setQuickBlock((prev) => ({ ...prev, open: false }))}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 1000, fontSize: 18, marginBottom: 12, color: "#d4af37" }}>
              حظر سريع للقاعة: {quickBlock.roomName}
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(220px, 1fr))" }}>
              <div>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>السبب</div>
                <textarea
                  style={{ ...inputStyle, minHeight: 90 }}
                  value={quickBlock.reason}
                  onChange={(e) => setQuickBlock((prev) => ({ ...prev, reason: e.target.value }))}
                />
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>نوع السبب</div>
                <GoldDropdown
                  value={quickBlock.reasonType}
                  options={BLOCK_REASON_OPTIONS}
                  onChange={(v) => setQuickBlock((prev) => ({ ...prev, reasonType: v }))}
                />

                <div style={{ fontWeight: 900, marginBottom: 6, marginTop: 10 }}>الفترة</div>
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
                <div style={{ fontWeight: 900, marginBottom: 6 }}>تاريخ البداية</div>
                <input
                  style={inputStyle}
                  type="date"
                  value={quickBlock.startDate}
                  onChange={(e) => setQuickBlock((prev) => ({ ...prev, startDate: e.target.value }))}
                />
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>تاريخ النهاية</div>
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
                حفظ الحظر
              </button>
              <button style={btn("#1f2937", "#d4af37")} onClick={() => setQuickBlock((prev) => ({ ...prev, open: false }))}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {historyRoomId && (
        <div style={modalOverlay} onClick={() => setHistoryRoomId(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 1000, fontSize: 18, marginBottom: 12, color: "#d4af37" }}>
              سجل الحظر: {roomsById.get(historyRoomId)?.roomName || "القاعة"}
            </div>

            <div style={tableWrap}>
              <table style={{ width: "100%", minWidth: 720 }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, position: "sticky", top: 0, background: "#0b1220", color: "#d4af37", zIndex: 2, padding: 10, borderBottom: "1px solid rgba(212,175,55,0.2)" }}>السبب</th>
                    <th style={{ ...thStyle, position: "sticky", top: 0, background: "#0b1220", color: "#d4af37", zIndex: 2, padding: 10, borderBottom: "1px solid rgba(212,175,55,0.2)" }}>النوع</th>
                    <th style={{ ...thStyle, position: "sticky", top: 0, background: "#0b1220", color: "#d4af37", zIndex: 2, padding: 10, borderBottom: "1px solid rgba(212,175,55,0.2)" }}>من</th>
                    <th style={{ ...thStyle, position: "sticky", top: 0, background: "#0b1220", color: "#d4af37", zIndex: 2, padding: 10, borderBottom: "1px solid rgba(212,175,55,0.2)" }}>إلى</th>
                    <th style={{ ...thStyle, position: "sticky", top: 0, background: "#0b1220", color: "#d4af37", zIndex: 2, padding: 10, borderBottom: "1px solid rgba(212,175,55,0.2)" }}>الفترة</th>
                    <th style={{ ...thStyle, position: "sticky", top: 0, background: "#0b1220", color: "#d4af37", zIndex: 2, padding: 10, borderBottom: "1px solid rgba(212,175,55,0.2)" }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {historyBlocks.length === 0 ? (
                    <tr>
                      <td style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#e6c76a" }} colSpan={6}>
                        لا يوجد سجل حظر لهذه القاعة.
                      </td>
                    </tr>
                  ) : (
                    historyBlocks.map((block) => (
                      <tr key={block.id}>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#e6c76a" }}>{block.reason}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#e6c76a" }}>{block.reasonType}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#e6c76a" }}>{block.startDate}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#e6c76a" }}>{block.endDate}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#e6c76a" }}>{block.session}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#e6c76a" }}>
                          {block.status === "active" ? "نشط" : block.status === "expired" ? "منتهي" : "ملغي"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button style={btn("#1f2937", "#d4af37")} onClick={() => setHistoryRoomId(null)}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={header}>
        <div>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>{APP_NAME}</div>
          <div style={{ fontWeight: 900, opacity: 0.75 }}>القاعات</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button style={btn("#1f2937", "#d4af37")} onClick={() => history.back()}>
            ← رجوع
          </button>

          <button
            style={{ ...btn("#3b82f6", "#07101f"), opacity: saving ? 0.7 : 1 }}
            onClick={startAdd}
            disabled={saving}
          >
            + إضافة قاعة
          </button>

          <button
            style={{ ...btn("#ef4444", "#07101f"), opacity: saving ? 0.7 : 1 }}
            onClick={() => void deleteAll()}
            disabled={saving}
          >
            🗑 حذف الكل
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
            fontWeight: 800,
          }}
        >
          جار تحميل بيانات القاعات...
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
            fontWeight: 800,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(4, minmax(180px, 1fr))", marginBottom: 14 }}>
        {[
          ["إجمالي القاعات", String(stats.total)],
          ["القاعات النشطة", String(stats.active)],
          ["القاعات المحظورة اليوم", String(stats.blocked)],
          ["السعة الإجمالية", String(stats.capacity)],
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
            placeholder="بحث..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <GoldDropdown
            value={statusFilter}
            options={[
              { value: "all", label: "كل الحالات" },
              { value: "active", label: "نشطة" },
              { value: "inactive", label: "موقوفة" },
              { value: "blocked", label: "محظورة اليوم" },
            ]}
            onChange={(v) => setStatusFilter(v as typeof statusFilter)}
          />

          <button style={btn("#22c55e", "#07101f")} onClick={exportCSV}>
            تصدير CSV
          </button>

          <button style={btn("#10b981", "#07101f")} onClick={exportExcel}>
            تصدير Excel
          </button>

          <label style={btn("#60a5fa", "#07101f")}>
            استيراد CSV ⬆️
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
            استيراد Excel ⬆️
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

          <div style={{ marginInlineStart: "auto", fontWeight: 900, color: "#d4af37" }}>
            إجمالي: {rooms.length} — المعروض: {filtered.length}
          </div>
        </div>
      </div>

      {(adding || editingId) && (
        <div style={card}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(4, minmax(220px, 1fr))" }}>
            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>اسم القاعة</div>
              <input
                style={inputStyle}
                value={current.roomName}
                onChange={(e) => setCurrent({ roomName: e.target.value })}
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>كود القاعة</div>
              <input
                style={inputStyle}
                value={current.code || ""}
                onChange={(e) => setCurrent({ code: e.target.value })}
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>المبنى</div>
              <GoldDropdown
                value={current.building}
                options={BUILDING_OPTIONS}
                placeholder="— اختر المبنى —"
                onChange={(v) => setCurrent({ building: v })}
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>نوع القاعة</div>
              <GoldDropdown
                value={current.type}
                options={ROOM_TYPE_OPTIONS}
                placeholder="— اختر النوع —"
                onChange={(v) => setCurrent({ type: v })}
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>السعة</div>
              <input
                style={inputStyle}
                type="number"
                value={String(current.capacity)}
                onChange={(e) => setCurrent({ capacity: Number(e.target.value) || 0 })}
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>الحالة</div>
              <GoldDropdown
                value={current.status || "active"}
                options={ROOM_STATUS_OPTIONS}
                onChange={(v) => setCurrent({ status: v as Room["status"] })}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>ملاحظات</div>
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
                  {saving ? "جارٍ الحفظ..." : "حفظ التعديل"}
                </button>

                <button
                  style={btn("#1f2937", "#d4af37")}
                  onClick={() => setEditingId(null)}
                  disabled={saving}
                >
                  إلغاء
                </button>
              </>
            ) : (
              <>
                <button
                  style={{ ...btn("#10b981", "#07101f"), opacity: saving ? 0.7 : 1 }}
                  onClick={() => void saveAdd()}
                  disabled={saving}
                >
                  {saving ? "جارٍ الحفظ..." : "حفظ"}
                </button>

                <button
                  style={btn("#1f2937", "#d4af37")}
                  onClick={() => setAdding(false)}
                  disabled={saving}
                >
                  إلغاء
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
          background: "linear-gradient(180deg, #0a0d14 0%, #09101d 100%)",
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
          <div style={{ fontWeight: 1000, fontSize: 20, color: "#f2cf63" }}>القاعات</div>
          <div style={{ fontWeight: 900, color: "#d4af37", opacity: 0.9 }}>
            جدول القاعات
          </div>
        </div>

        <div className="roomsTableLuxury" style={tableWrap}>
          <table>
            <thead>
              <tr>
                <th style={thStyle}>اسم القاعة</th>
                <th style={thStyle}>الكود</th>
                <th style={thStyle}>المبنى</th>
                <th style={thStyle}>النوع</th>
                <th style={thStyle}>السعة</th>
                <th style={thStyle}>الحالة</th>
                <th style={thStyle}>الحظر الحالي</th>
                <th style={thStyle}>ملاحظات</th>
                <th style={thStyle}>إجراءات</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td style={tdStyle} className="emptyCell" colSpan={9}>
                    لا توجد بيانات
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const blockedNow = blockedRoomIdsToday.has(r.id);
                  const roomStatus = (r.status || "active") === "active" ? "نشطة" : "موقوفة";

                  return (
                    <tr key={r.id}>
                      <td style={tdStyle} className="cell-main">
                        {r.roomName}
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
                        <span className="cell-badge badge-open">{r.capacity}</span>
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
                          {blockedNow ? "محظورة اليوم" : "متاحة"}
                        </span>
                      </td>

                      <td style={tdStyle} className="cell-subtle" title={r.notes}>
                        {r.notes || "—"}
                      </td>

                      <td style={tdStyle}>
                        <div className="actionStack">
                          <button className="actionBtn btnEdit" onClick={() => startEdit(r)}>
                            تعديل ✏️
                          </button>

                          <button className="actionBtn btnBlock" onClick={() => openQuickBlock(r)}>
                            حظر ⛔
                          </button>

                          <button className="actionBtn btnHistory" onClick={() => setHistoryRoomId(r.id)}>
                            السجل 📜
                          </button>

                          <button className="actionBtn btnDelete" onClick={() => void removeRoom(r.id)}>
                            حذف 🗑
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
  );
}