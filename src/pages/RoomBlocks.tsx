import React, { useDeferredValue, useMemo, useRef, useState } from "react";
import GoldDropdown from "../components/GoldDropdown";
import { useAuth } from "../auth/AuthContext";
import { useRoomBlocksData } from "../hooks/useRoomBlocksData";
import { useRoomsData } from "../hooks/useRoomsData";
import { blockStatusLabel, createId } from "../lib/roomScheduling";
import type { Room } from "../services/rooms.service";
import type { RoomBlock } from "../services/roomBlocks.service";

const APP_NAME = "نظام إدارة الامتحانات المطوّر";

const REASON_OPTIONS = [
  { value: "maintenance", label: "صيانة" },
  { value: "reserved", label: "محجوزة" },
  { value: "conflict", label: "تعارض" },
  { value: "admin", label: "قرار إداري" },
];

const SESSION_OPTIONS = [
  { value: "full-day", label: "اليوم كامل" },
  { value: "الفترة الأولى", label: "الفترة الأولى" },
  { value: "الفترة الثانية", label: "الفترة الثانية" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "كل الحالات" },
  { value: "active", label: "نشطة" },
  { value: "expired", label: "منتهية" },
  { value: "cancelled", label: "ملغاة" },
];

const emptyBlock: RoomBlock = {
  id: "",
  roomId: "",
  roomName: "",
  reason: "",
  reasonType: "maintenance",
  blockType: "full",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  session: "full-day",
  status: "active",
};

export default function RoomBlocks() {
  const roomBlocksApi = useRoomBlocksData() as any;
  const roomsApi = useRoomsData() as any;
  const { user } = useAuth() as any;

  const roomBlocks: RoomBlock[] = roomBlocksApi.roomBlocks ?? [];
  const setRoomBlocks = roomBlocksApi.setRoomBlocks ?? (() => {});
  const roomBlocksLoading: boolean =
    roomBlocksApi.loading ?? roomBlocksApi.roomBlocksLoading ?? false;
  const roomBlocksLoaded: boolean =
    roomBlocksApi.loaded ?? roomBlocksApi.roomBlocksLoaded ?? true;
  const roomBlocksError: string =
    roomBlocksApi.error ?? roomBlocksApi.roomBlocksError ?? "";
  const roomBlocksSaving: boolean = roomBlocksApi.saving ?? false;

  const createRoomBlock = roomBlocksApi.createRoomBlock;
  const updateRoomBlock = roomBlocksApi.updateRoomBlock;
  const deleteRoomBlock = roomBlocksApi.deleteRoomBlock;
  const reloadRoomBlocks = roomBlocksApi.reloadRoomBlocks ?? roomBlocksApi.reload ?? (async () => {});

  const rooms: Room[] = roomsApi.rooms ?? [];
  const roomsLoading: boolean = roomsApi.loading ?? roomsApi.roomsLoading ?? false;
  const roomsLoaded: boolean = roomsApi.loaded ?? roomsApi.roomsLoaded ?? true;
  const roomsError: string = roomsApi.error ?? roomsApi.roomsError ?? "";

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "expired" | "cancelled"
  >("all");

  const [adding, setAdding] = useState(false);
  const [row, setRow] = useState<RoomBlock>({ ...emptyBlock, id: createId("block") });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<RoomBlock>({ ...emptyBlock });

  const topRef = useRef<HTMLDivElement>(null);
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const roomsMap = useMemo(() => {
    const map = new Map<string, Room>();
    for (const room of rooms) map.set(room.id, room);
    return map;
  }, [rooms]);

  const roomsOptions = useMemo(
    () => [
      { value: "", label: "— اختر القاعة —" },
      ...rooms.map((room) => ({ value: room.id, label: room.roomName })),
    ],
    [rooms]
  );

  const normalizedBlocks = useMemo<RoomBlock[]>(
    () =>
      roomBlocks.map((block) => ({
        ...block,
        status: blockStatusLabel(block, todayISO) as RoomBlock["status"],
      })),
    [roomBlocks, todayISO]
  );

  const filtered = useMemo(() => {
    const q = deferredQuery.trim();

    return normalizedBlocks
      .filter((block) => {
        const matchesQuery =
          !q ||
          [
            block.roomName,
            block.reason,
            block.reasonType,
            block.startDate,
            block.endDate,
            block.session,
          ].some((x) => String(x).includes(q));

        const matchesStatus =
          statusFilter === "all" || block.status === statusFilter;

        return matchesQuery && matchesStatus;
      })
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [normalizedBlocks, deferredQuery, statusFilter]);

  const stats = useMemo(
    () => ({
      total: normalizedBlocks.length,
      active: normalizedBlocks.filter((b) => b.status === "active").length,
      expired: normalizedBlocks.filter((b) => b.status === "expired").length,
      cancelled: normalizedBlocks.filter((b) => b.status === "cancelled").length,
    }),
    [normalizedBlocks]
  );

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

  const current = editingId ? edit : row;

  const setCurrent = (patch: Partial<RoomBlock>) => {
    if (editingId) {
      setEdit((prev) => ({ ...prev, ...patch }));
    } else {
      setRow((prev) => ({ ...prev, ...patch }));
    }
  };

  function validate(block: RoomBlock) {
    if (!block.roomId) return "يجب اختيار القاعة.";
    if (!block.reason.trim()) return "سبب الحظر مطلوب.";
    if (!block.startDate || !block.endDate) return "التاريخ مطلوب.";
    if (block.endDate < block.startDate) return "تاريخ النهاية يجب أن يكون بعد البداية.";

    const overlap = roomBlocks.some(
      (existing) =>
        existing.id !== block.id &&
        existing.roomId === block.roomId &&
        existing.status === "active" &&
        !(block.endDate < existing.startDate || block.startDate > existing.endDate) &&
        (existing.session === "full-day" ||
          block.session === "full-day" ||
          existing.session === block.session)
    );

    if (overlap) return "يوجد حظر متداخل لنفس القاعة في نفس الفترة.";
    return "";
  }

  function hydrateBlock(block: RoomBlock): RoomBlock {
    const room = roomsMap.get(block.roomId);
    return {
      ...block,
      roomName: room?.roomName || block.roomName,
      blockType: block.session === "full-day" ? "full" : "partial",
    };
  }

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setRow({ ...emptyBlock, id: createId("block") });
    setTimeout(() => {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  async function saveAdd() {
    const prepared = {
      ...hydrateBlock(row),
      createdBy: String(user?.email || "").trim() || row.createdBy,
    };

    const msg = validate(prepared);
    if (msg) return alert(msg);

    try {
      if (typeof createRoomBlock === "function") {
        await createRoomBlock(prepared);
      } else {
        setRoomBlocks((prev: RoomBlock[]) => [prepared, ...prev]);
      }

      setAdding(false);
      setRow({ ...emptyBlock, id: createId("block") });
    } catch {
      alert("تعذر حفظ الحظر");
    }
  }

  function startEdit(block: RoomBlock) {
    setAdding(false);
    setEditingId(block.id);
    setEdit({ ...block });
    setTimeout(() => {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  async function saveEdit() {
    if (!editingId) return;

    const prepared = {
      ...hydrateBlock(edit),
      createdBy: edit.createdBy || String(user?.email || "").trim() || undefined,
    };

    const msg = validate(prepared);
    if (msg) return alert(msg);

    try {
      if (typeof updateRoomBlock === "function") {
        await updateRoomBlock(prepared);
      } else {
        setRoomBlocks((prev: RoomBlock[]) =>
          prev.map((block) => (block.id === editingId ? prepared : block))
        );
      }

      setEditingId(null);
      setEdit({ ...emptyBlock });
    } catch {
      alert("تعذر تحديث الحظر");
    }
  }

  async function cancelBlock(id: string) {
    if (!confirm("هل تريد إلغاء هذا الحظر؟")) return;

    try {
      const target = roomBlocks.find((block) => block.id === id);
      if (!target) return;

      const cancelled: RoomBlock = {
        ...target,
        status: "cancelled",
      };

      if (typeof updateRoomBlock === "function") {
        await updateRoomBlock(cancelled);
      } else {
        setRoomBlocks((prev: RoomBlock[]) =>
          prev.map((block) => (block.id === id ? cancelled : block))
        );
      }
    } catch {
      alert("تعذر إلغاء الحظر");
    }
  }

  async function removeBlock(id: string) {
    if (!confirm("هل تريد حذف هذا السجل؟")) return;

    try {
      if (typeof deleteRoomBlock === "function") {
        await deleteRoomBlock(id);
      } else {
        setRoomBlocks((prev: RoomBlock[]) =>
          prev.filter((block) => block.id !== id)
        );
      }
    } catch {
      alert("تعذر حذف السجل");
    }
  }

  const pageBusy = roomBlocksSaving;
  const stillLoading =
    (roomsLoading && !roomsLoaded) || (roomBlocksLoading && !roomBlocksLoaded);

  return (
    <div style={pageStyle} ref={topRef}>
      <div style={header}>
        <div>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>{APP_NAME}</div>
          <div style={{ fontWeight: 900, opacity: 0.75 }}>حظر القاعات</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button style={btn("#1f2937", "#d4af37")} onClick={() => history.back()}>
            ← رجوع
          </button>

          <button
            style={{ ...btn("#ef4444", "#07101f"), opacity: pageBusy ? 0.7 : 1 }}
            onClick={startAdd}
            disabled={pageBusy}
          >
            + إضافة حظر
          </button>
        </div>
      </div>

      {stillLoading && (
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
          جار تحميل بيانات القاعات والحظر...
        </div>
      )}

      {(roomsError || roomBlocksError) && (
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
          {roomsError || roomBlocksError}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
          marginBottom: 14,
        }}
      >
        {[
          ["إجمالي السجلات", String(stats.total)],
          ["الحظر النشط", String(stats.active)],
          ["الحظر المنتهي", String(stats.expired)],
          ["الحظر الملغي", String(stats.cancelled)],
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
            options={STATUS_FILTER_OPTIONS}
            onChange={(v) => setStatusFilter(v as typeof statusFilter)}
          />

          <div style={{ marginInlineStart: "auto", fontWeight: 900, color: "#d4af37" }}>
            إجمالي: {roomBlocks.length} — المعروض: {filtered.length}
          </div>
        </div>
      </div>

      {(adding || editingId) && (
        <div style={card}>
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(4, minmax(220px, 1fr))",
            }}
          >
            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>القاعة</div>
              <GoldDropdown
                value={current.roomId}
                options={roomsOptions}
                onChange={(v) => {
                  const room = roomsMap.get(v);
                  setCurrent({ roomId: v, roomName: room?.roomName || "" });
                }}
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>نوع السبب</div>
              <GoldDropdown
                value={current.reasonType}
                options={REASON_OPTIONS}
                onChange={(v) => setCurrent({ reasonType: v })}
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>الفترة</div>
              <GoldDropdown
                value={current.session}
                options={SESSION_OPTIONS}
                onChange={(v) => setCurrent({ session: v as RoomBlock["session"] })}
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>الحالة</div>
              <GoldDropdown
                value={current.status}
                options={[
                  { value: "active", label: "نشط" },
                  { value: "cancelled", label: "ملغي" },
                ]}
                onChange={(v) => setCurrent({ status: v as RoomBlock["status"] })}
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>تاريخ البداية</div>
              <input
                style={inputStyle}
                type="date"
                value={current.startDate}
                onChange={(e) => setCurrent({ startDate: e.target.value })}
              />
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>تاريخ النهاية</div>
              <input
                style={inputStyle}
                type="date"
                value={current.endDate}
                onChange={(e) => setCurrent({ endDate: e.target.value })}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>سبب الحظر</div>
              <textarea
                style={{ ...inputStyle, minHeight: 90 }}
                value={current.reason}
                onChange={(e) => setCurrent({ reason: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            {editingId ? (
              <>
                <button
                  style={{ ...btn("#10b981", "#07101f"), opacity: pageBusy ? 0.7 : 1 }}
                  onClick={() => void saveEdit()}
                  disabled={pageBusy}
                >
                  {pageBusy ? "جارٍ الحفظ..." : "حفظ التعديل"}
                </button>

                <button
                  style={btn("#1f2937", "#d4af37")}
                  onClick={() => setEditingId(null)}
                  disabled={pageBusy}
                >
                  إلغاء
                </button>
              </>
            ) : (
              <>
                <button
                  style={{ ...btn("#10b981", "#07101f"), opacity: pageBusy ? 0.7 : 1 }}
                  onClick={() => void saveAdd()}
                  disabled={pageBusy}
                >
                  {pageBusy ? "جارٍ الحفظ..." : "حفظ"}
                </button>

                <button
                  style={btn("#1f2937", "#d4af37")}
                  onClick={() => setAdding(false)}
                  disabled={pageBusy}
                >
                  إلغاء
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div style={card}>
        <div style={tableWrap}>
          <table style={{ width: "100%", minWidth: 1120 }}>
            <thead>
              <tr>
                <th style={thStyle}>اسم القاعة</th>
                <th style={thStyle}>سبب الحظر</th>
                <th style={thStyle}>نوع السبب</th>
                <th style={thStyle}>من</th>
                <th style={thStyle}>إلى</th>
                <th style={thStyle}>الفترة</th>
                <th style={thStyle}>الحالة</th>
                <th style={thStyle}>أنشئ بواسطة</th>
                <th style={thStyle}>إجراءات</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={9}>
                    لا توجد بيانات.
                  </td>
                </tr>
              ) : (
                filtered.map((block) => (
                  <tr key={block.id}>
                    <td style={tdStyle}>{block.roomName}</td>
                    <td style={tdStyle}>{block.reason}</td>
                    <td style={tdStyle}>{block.reasonType}</td>
                    <td style={tdStyle}>{block.startDate}</td>
                    <td style={tdStyle}>{block.endDate}</td>
                    <td style={tdStyle}>{block.session}</td>
                    <td style={tdStyle}>
                      {block.status === "active"
                        ? "نشط"
                        : block.status === "expired"
                        ? "منتهي"
                        : "ملغي"}
                    </td>
                    <td style={tdStyle}>{block.createdBy || "—"}</td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button style={btn("#60a5fa", "#07101f")} onClick={() => startEdit(block)}>
                          ✏️ تعديل
                        </button>

                        {block.status === "active" && (
                          <button
                            style={btn("#f59e0b", "#07101f")}
                            onClick={() => void cancelBlock(block.id)}
                          >
                            إلغاء الحظر
                          </button>
                        )}

                        <button
                          style={btn("#ef4444", "#07101f")}
                          onClick={() => void removeBlock(block.id)}
                        >
                          🗑 حذف
                        </button>
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