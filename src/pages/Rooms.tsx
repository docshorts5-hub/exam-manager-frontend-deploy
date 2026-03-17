import React, { useEffect, useMemo, useRef, useState } from "react";
import GoldDropdown from "../components/GoldDropdown";
import { type Room } from "../services/rooms.service";
import { useRoomsData } from "../hooks/useRoomsData";


const APP_NAME = " ";
const SUBCOLLECTION = "rooms";

const BUILDING_OPTIONS = [
  { value: "", label: "— اختر المبنى —" },
  { value: "المبنى A", label: "المبنى A" },
  { value: "المبنى B", label: "المبنى B" },
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

const emptyRoom: Room = { id: "", roomName: "", building: "", type: "", capacity: 1, notes: "" };

function safeParseRooms(v: string | null): Room[] {
  if (!v) return [];
  try {
    const arr = JSON.parse(v);
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => ({
      id: String(x.id ?? crypto.randomUUID()),
      roomName: String(x.roomName ?? "").trim(),
      building: String(x.building ?? "").trim(),
      type: String(x.type ?? "").trim(),
      capacity: Number(x.capacity ?? 0) || 0,
      notes: String(x.notes ?? "").trim(),
    }));
  } catch {
    return [];
  }
}

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
  const header = ["اسم القاعة", "المبنى", "النوع", "السعة", "ملاحظات"];
  const escape = (s: string) => {
    const v = (s ?? "").replace(/\r?\n/g, " ").trim();
    if (/[",]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const lines = [
    header.join(","),
    ...rows.map((r) => [r.roomName, r.building, r.type, String(r.capacity), r.notes].map(escape).join(",")),
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
      } else inQ = !inQ;
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
        } else q = !q;
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
    const obj: any = {};
    headers.forEach((h, idx) => (obj[h] = cells[idx] ?? ""));
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

function getCell(row: any, keys: string[]) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== "") return String(row[k]).trim();
  }
  const map: Record<string, any> = {};
  Object.keys(row || {}).forEach((kk) => (map[normalizeHeader(kk)] = row[kk]));
  for (const nk of keys.map(normalizeHeader)) {
    if (map[nk] != null && String(map[nk]).trim() !== "") return String(map[nk]).trim();
  }
  return "";
}

async function tryReadExcel(file: File): Promise<any[] | null> {
  try {
    const XLSX = await import("xlsx");
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
    return json as any[];
  } catch {
    return null;
  }
}

function parseRoomsFromObjects(rows: any[]): Room[] {
  return rows
    .map((r) => {
      const roomName = getCell(r, ["اسم القاعة", "القاعة", "room", "roomname", "name"]);
      const building = getCell(r, ["المبنى", "building", "block", "الدور"]);
      const type = getCell(r, ["النوع", "type"]);
      const capacity = Number(getCell(r, ["السعة", "capacity", "cap"])) || 0;
      const notes = getCell(r, ["ملاحظات", "notes", "note"]);
      return {
        id: crypto.randomUUID(),
        roomName: roomName.trim(),
        building: building.trim(),
        type: type.trim(),
        capacity,
        notes: notes.trim(),
      } as Room;
    })
    .filter((x) => x.roomName);
}

export default function Rooms() {
  const { tenantId, rooms, setRooms } = useRoomsData();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [row, setRow] = useState<Room>({ ...emptyRoom });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Room>({ ...emptyRoom });

  const topRef = useRef<HTMLDivElement>(null);


  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return rooms;
    return rooms.filter((r) =>
      [r.roomName, r.building, r.type, String(r.capacity), r.notes].some((x) => String(x).includes(q))
    );
  }, [rooms, query]);

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
    maxHeight: "55vh",
    overflow: "auto",
    borderRadius: 16,
    border: "1px solid rgba(212,175,55,0.12)",
  };
  const thStyle: React.CSSProperties = {
    position: "sticky",
    top: 0,
    background: "#0b1220",
    color: "#d4af37",
    zIndex: 2,
    padding: 10,
    textAlign: "right",
    fontWeight: 900,
    borderBottom: "1px solid rgba(212,175,55,0.2)",
    whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    padding: 10,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    whiteSpace: "nowrap",
    color: "#e6c76a",
  };

  function startAdd() {
    setAdding(true);
    setRow({ ...emptyRoom, id: crypto.randomUUID(), capacity: 30 });
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function validate(r: Room) {
    if (!r.roomName.trim()) return "اسم القاعة مطلوب.";
    if (!r.building.trim()) return "المبنى مطلوب.";
    if (!r.type.trim()) return "نوع القاعة مطلوب.";
    if (!r.capacity || r.capacity <= 0) return "السعة مطلوبة.";
    return "";
  }

  function saveAdd() {
    const msg = validate(row);
    if (msg) return alert(msg);
    setRooms((prev) => [{ ...row }, ...prev]);
    setAdding(false);
    setRow({ ...emptyRoom });
  }

  function startEdit(r: Room) {
    setEditingId(r.id);
    setEdit({ ...r });
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function saveEdit() {
    if (!editingId) return;
    const msg = validate(edit);
    if (msg) return alert(msg);
    setRooms((prev) => prev.map((x) => (x.id === editingId ? { ...edit } : x)));
    setEditingId(null);
    setEdit({ ...emptyRoom });
  }

  function removeRoom(id: string) {
    if (!confirm("هل تريد حذف هذه القاعة؟")) return;
    setRooms((prev) => prev.filter((x) => x.id !== id));
  }

  function deleteAll() {
    if (!rooms.length) return;
    const ok = confirm("⚠️ هل أنت متأكد من حذف جدول القاعات كاملًا؟ لا يمكن التراجع.");
    if (!ok) return;
    setRooms([]);
  }

  function exportCSV() {
    downloadText("rooms.csv", toCSV(rooms));
  }

  async function exportExcel() {
    try {
      const XLSX = await import("xlsx");
      const rows = rooms.map((r) => ({
        "اسم القاعة": r.roomName,
        "المبنى": r.building,
        "النوع": r.type,
        "السعة": r.capacity,
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
    if (!incoming.length) return alert("لا توجد بيانات صالحة للاستيراد.");
    setRooms((prev) => [...incoming, ...prev]);
    alert("✅ تم استيراد القاعات.");
  }

  async function importExcel(file: File) {
    const json = await tryReadExcel(file);
    if (!json) return alert("تعذر قراءة Excel. ثبّت xlsx أو استخدم CSV.");
    const incoming = parseRoomsFromObjects(json);
    if (!incoming.length) return alert("لا توجد بيانات صالحة للاستيراد.");
    setRooms((prev) => [...incoming, ...prev]);
    alert("✅ تم استيراد القاعات.");
  }

  const current = editingId ? edit : row;
  const setCurrent = (patch: Partial<Room>) => {
    if (editingId) setEdit({ ...edit, ...patch });
    else setRow({ ...row, ...patch });
  };

  return (
    <div style={pageStyle} ref={topRef}>
      <div style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>{APP_NAME}</div>
            <div style={{ fontWeight: 900, opacity: 0.75 }}>القاعات</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button style={btn("#1f2937", "#d4af37")} onClick={() => history.back()}>
            ← رجوع
          </button>
          <button style={btn("#3b82f6", "#07101f")} onClick={startAdd}>
            + إضافة قاعة
          </button>
          <button style={btn("#ef4444", "#07101f")} onClick={deleteAll}>
            🗑 حذف الكل
          </button>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={{ ...inputStyle, maxWidth: 420 }}
            placeholder="بحث..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
                if (f) importCSV(f);
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
                if (f) importExcel(f);
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
              <input style={inputStyle} value={current.roomName} onChange={(e) => setCurrent({ roomName: e.target.value })} />
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
                <button style={btn("#10b981", "#07101f")} onClick={saveEdit}>حفظ التعديل</button>
                <button style={btn("#1f2937", "#d4af37")} onClick={() => setEditingId(null)}>إلغاء</button>
              </>
            ) : (
              <>
                <button style={btn("#10b981", "#07101f")} onClick={saveAdd}>حفظ</button>
                <button style={btn("#1f2937", "#d4af37")} onClick={() => setAdding(false)}>إلغاء</button>
              </>
            )}
          </div>
        </div>
      )}

      <div style={card}>
        <div style={tableWrap}>
          <table style={{ width: "100%", minWidth: 980 }}>
            <thead>
              <tr>
                <th style={thStyle}>اسم القاعة</th>
                <th style={thStyle}>المبنى</th>
                <th style={thStyle}>النوع</th>
                <th style={thStyle}>السعة</th>
                <th style={thStyle}>ملاحظات</th>
                <th style={thStyle}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={6}>لا توجد بيانات.</td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td style={tdStyle}>{r.roomName}</td>
                    <td style={tdStyle}>{r.building}</td>
                    <td style={tdStyle}>{r.type}</td>
                    <td style={tdStyle}>{r.capacity}</td>
                    <td style={tdStyle} title={r.notes}>{r.notes}</td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={btn("#60a5fa", "#07101f")} onClick={() => startEdit(r)}>✏️ تعديل</button>
                        <button style={btn("#ef4444", "#07101f")} onClick={() => removeRoom(r.id)}>🗑 حذف</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
