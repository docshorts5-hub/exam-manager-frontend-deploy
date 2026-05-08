import React, { useDeferredValue, useMemo, useRef, useState } from "react";
import GoldDropdown from "../components/GoldDropdown";
import { useAuth } from "../auth/AuthContext";
import { useRoomBlocksData } from "../hooks/useRoomBlocksData";
import { useRoomsData } from "../hooks/useRoomsData";
import { useI18n } from "../i18n/I18nProvider";
import { blockStatusLabel, createId } from "../lib/roomScheduling";
import type { Room } from "../services/rooms.service";
import type { RoomBlock } from "../services/roomBlocks.service";

const APP_NAME = "   ";

const REASON_OPTIONS_AR = [
  { value: "maintenance", label: "صيانة" },
  { value: "reserved", label: "محجوزة" },
  { value: "conflict", label: "تعارض" },
  { value: "admin", label: "قرار إداري" },
];

const REASON_OPTIONS_EN = [
  { value: "maintenance", label: "Maintenance" },
  { value: "reserved", label: "Reserved" },
  { value: "conflict", label: "Conflict" },
  { value: "admin", label: "Administrative Decision" },
];

const SESSION_OPTIONS_AR = [
  { value: "full-day", label: "اليوم كامل" },
  { value: "الفترة الأولى", label: "الفترة الأولى" },
  { value: "الفترة الثانية", label: "الفترة الثانية" },
];

const SESSION_OPTIONS_EN = [
  { value: "full-day", label: "Full Day" },
  { value: "الفترة الأولى", label: "First Period" },
  { value: "الفترة الثانية", label: "Second Period" },
];

const STATUS_FILTER_OPTIONS_AR = [
  { value: "all", label: "كل الحالات" },
  { value: "active", label: "نشطة" },
  { value: "expired", label: "منتهية" },
  { value: "cancelled", label: "ملغاة" },
];

const STATUS_FILTER_OPTIONS_EN = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
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
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const REASON_OPTIONS = useMemo(() => (lang === "ar" ? REASON_OPTIONS_AR : REASON_OPTIONS_EN), [lang]);
  const SESSION_OPTIONS = useMemo(() => (lang === "ar" ? SESSION_OPTIONS_AR : SESSION_OPTIONS_EN), [lang]);
  const STATUS_FILTER_OPTIONS = useMemo(() => (lang === "ar" ? STATUS_FILTER_OPTIONS_AR : STATUS_FILTER_OPTIONS_EN), [lang]);

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

  React.useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      .roomBlocksLuxury table {
        width: 100%;
        min-width: 1180px;
        border-collapse: separate;
        border-spacing: 0 12px;
      }
      .roomBlocksLuxury thead th {
        position: sticky;
        top: 0;
        z-index: 6;
        background: linear-gradient(180deg, #9a7200 0%, #6f5100 100%) !important;
        color: #fff3cf !important;
        text-align: ${isRTL ? "right" : "left"};
        font-weight: 1000;
        font-size: 16px;
        padding: 16px 16px;
        border-top: 1px solid rgba(255,214,102,0.35) !important;
        border-bottom: 1px solid rgba(255,214,102,0.20) !important;
        white-space: nowrap;
        box-shadow: inset 0 2px 0 rgba(255,255,255,0.08), 0 12px 24px rgba(0,0,0,0.30);
      }
      .roomBlocksLuxury thead th:first-child {
        border-right: 1px solid rgba(255,214,102,0.35) !important;
        border-top-right-radius: 20px;
        border-bottom-right-radius: 20px;
      }
      .roomBlocksLuxury thead th:last-child {
        border-left: 1px solid rgba(255,214,102,0.35) !important;
        border-top-left-radius: 20px;
        border-bottom-left-radius: 20px;
      }
      .roomBlocksLuxury tbody td {
        background: linear-gradient(90deg, rgba(9,12,18,0.98) 0%, rgba(13,16,23,0.96) 60%, rgba(10,13,19,0.98) 100%) !important;
        color: #f0c94d !important;
        padding: 14px 16px;
        border-top: 1px solid rgba(212,175,55,0.12);
        border-bottom: 1px solid rgba(212,175,55,0.12);
        white-space: nowrap;
        vertical-align: middle;
        box-shadow: 0 10px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03);
        transition: transform .18s ease, box-shadow .18s ease, filter .18s ease;
      }
      .roomBlocksLuxury tbody td:first-child {
        border-right: 1px solid rgba(212,175,55,0.12);
        border-top-right-radius: 20px;
        border-bottom-right-radius: 20px;
      }
      .roomBlocksLuxury tbody td:last-child {
        border-left: 1px solid rgba(212,175,55,0.12);
        border-top-left-radius: 20px;
        border-bottom-left-radius: 20px;
      }
      .roomBlocksLuxury tbody tr:hover td {
        transform: translateY(-2px);
        box-shadow: 0 18px 34px rgba(0,0,0,0.46), inset 0 1px 0 rgba(255,255,255,0.04);
        filter: brightness(1.04);
      }
      .rbBadge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 94px;
        padding: 9px 14px;
        border-radius: 999px;
        font-weight: 1000;
        font-size: 14px;
        border: 1px solid rgba(255,255,255,0.08);
        box-shadow: 0 8px 18px rgba(0,0,0,0.28);
      }
      .rbActive { background: linear-gradient(180deg, #102415, #0b1a10); color: #bbf7d0; border-color: rgba(34,197,94,0.24); }
      .rbExpired { background: linear-gradient(180deg, #334155, #1f2937); color: #e5e7eb; }
      .rbCancelled { background: linear-gradient(180deg, #ef4444, #dc2626); color: #fff; }
    `;
    document.head.appendChild(styleEl);
    return () => {
      try {
        document.head.removeChild(styleEl);
      } catch {}
    };
  }, [isRTL]);

  const roomsMap = useMemo(() => {
    const map = new Map<string, Room>();
    for (const room of rooms) map.set(room.id, room);
    return map;
  }, [rooms]);

  const roomsOptions = useMemo(
    () => [
      { value: "", label: tr("— اختر القاعة —", "— Select Room —") },
      ...rooms.map((room) => ({ value: room.id, label: room.roomName })),
    ],
    [rooms, lang]
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

  const pageStyle: React.CSSProperties = {
    padding: 18,
    color: "#e6c76a",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, rgba(212,175,55,0.14), transparent 24%), radial-gradient(circle at 88% 18%, rgba(59,130,246,0.10), transparent 24%), linear-gradient(180deg, #070b12 0%, #0b1220 42%, #060a12 100%)",
    position: "relative",
    overflowX: "hidden",
    direction: isRTL ? "rtl" : "ltr",
  };
  const card: React.CSSProperties = {
    background: "linear-gradient(180deg, rgba(11,18,32,0.94), rgba(9,16,29,0.96))",
    border: "1px solid rgba(212,175,55,0.15)",
    borderRadius: 24,
    padding: 18,
    boxShadow: "0 22px 60px rgba(0,0,0,0.36)",
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
    borderRadius: 24,
    border: "1px solid rgba(212,175,55,0.12)",
    background: "linear-gradient(180deg, rgba(8,12,19,0.98) 0%, rgba(7,10,16,0.98) 100%)",
    boxShadow:
      "0 28px 70px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.03)",
    padding: 10,
  };
  const thStyle: React.CSSProperties = {
    position: "sticky",
    top: 0,
    background: "#0b1220",
    color: "#d4af37",
    zIndex: 2,
    padding: 10,
    textAlign: isRTL ? "right" : "left",
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
    if (!block.roomId) return tr("يجب اختيار القاعة.", "You must select a room.");
    if (!block.reason.trim()) return tr("سبب الحظر مطلوب.", "Block reason is required.");
    if (!block.startDate || !block.endDate) return tr("التاريخ مطلوب.", "Date is required.");
    if (block.endDate < block.startDate) return tr("تاريخ النهاية يجب أن يكون بعد البداية.", "End date must be after start date.");

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

    if (overlap) return tr("يوجد حظر متداخل لنفس القاعة في نفس الفترة.", "There is an overlapping block for the same room in the same period.");
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
      alert(tr("تعذر حفظ الحظر", "Unable to save block"));
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
      alert(tr("تعذر تحديث الحظر", "Unable to update block"));
    }
  }

  async function cancelBlock(id: string) {
    if (!confirm(tr("هل تريد إلغاء هذا الحظر؟", "Do you want to cancel this block?"))) return;

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
      alert(tr("تعذر إلغاء الحظر", "Unable to cancel block"));
    }
  }

  async function removeBlock(id: string) {
    if (!confirm(tr("هل تريد حذف هذا السجل؟", "Do you want to delete this record?"))) return;

    try {
      if (typeof deleteRoomBlock === "function") {
        await deleteRoomBlock(id);
      } else {
        setRoomBlocks((prev: RoomBlock[]) =>
          prev.filter((block) => block.id !== id)
        );
      }
    } catch {
      alert(tr("تعذر حذف السجل", "Unable to delete record"));
    }
  }

  const pageBusy = roomBlocksSaving;
  const stillLoading =
    (roomsLoading && !roomsLoaded) || (roomBlocksLoading && !roomBlocksLoaded);

  return (
    <div style={pageStyle} ref={topRef}>
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
            border: "1px solid rgba(212,175,55,0.18)",
            borderRadius: 34,
            padding: 28,
            background:
              "linear-gradient(135deg, rgba(30,22,2,0.95), rgba(8,8,8,0.98), rgba(27,21,3,0.94))",
            boxShadow:
              "0 32px 100px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(255,255,255,0.03)",
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
                {tr("إدارة الحظر التشغيلي للقاعات", "Operational room block management")}
              </div>

              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,241,196,0.88)", marginBottom: 10 }}>
                  {APP_NAME}
                </div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "clamp(34px, 5vw, 64px)",
                    lineHeight: 1.05,
                    fontWeight: 950,
                    color: "#fff1c4",
                    letterSpacing: "-0.03em",
                    textShadow: "0 8px 28px rgba(212,175,55,0.16)",
                  }}
                >
                  {tr("مركز حظر القاعات", "Room Blocks Center")}
                </h1>
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: 16,
                  lineHeight: 2,
                  color: "rgba(255,241,196,0.82)",
                  maxWidth: 940,
                }}
              >
                {tr(
                  "تمنح هذه الصفحة الإدارة تحكمًا دقيقًا وفوريًا في حالات حظر القاعات، مع واجهة فاخرة لإضافة السجلات وتعديلها ومراجعتها، وجدول تنفيذي أنيق يوضح الفترات والأسباب والحالة التشغيلية بوضوح.",
                  "This page gives the administration precise and immediate control over room block cases, with a premium interface for adding, editing, and reviewing records, and an elegant executive table that clearly shows periods, reasons, and operational status."
                )}
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                  { label: tr("إجمالي السجلات", "Total Records"), value: stats.total },
                  { label: tr("الحظر النشط", "Active Blocks"), value: stats.active },
                  { label: tr("المعروض الآن", "Currently Shown"), value: filtered.length },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                      borderRadius: 18,
                      padding: "12px 14px",
                      minWidth: 190,
                      boxShadow: "0 14px 28px rgba(0,0,0,0.22)",
                    }}
                  >
                    <div style={{ fontSize: 12, color: "rgba(255,241,196,0.64)", fontWeight: 800 }}>{item.label}</div>
                    <div style={{ marginTop: 6, fontSize: 16, color: "#fff8dc", fontWeight: 900 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                minWidth: 300,
                maxWidth: 390,
                width: "100%",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 28,
                padding: 22,
                background: "linear-gradient(180deg, rgba(212,175,55,0.08), rgba(255,255,255,0.02))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
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
                  background: stats.active ? "rgba(239,68,68,0.14)" : "rgba(16,185,129,0.14)",
                  border: stats.active ? "1px solid rgba(239,68,68,0.24)" : "1px solid rgba(16,185,129,0.24)",
                  color: stats.active ? "#fecaca" : "#a7f3d0",
                  fontWeight: 900,
                  fontSize: 12,
                }}
              >
                {stats.active ? tr("توجد قيود نشطة تحت المتابعة", "There are active restrictions under follow-up") : tr("لا توجد قيود نشطة الآن", "There are no active restrictions now")}
              </div>

              <div style={{ fontSize: 28, lineHeight: 1.5, fontWeight: 950, color: "#fff1c4" }}>
                {tr("واجهة أكثر فخامة ووضوحًا لإدارة الحظر والتداخلات التشغيلية للقاعات.", "A more premium and clearer interface for managing room blocks and operational conflicts.")}
              </div>

              <div style={{ fontSize: 14, lineHeight: 1.95, color: "rgba(255,241,196,0.78)" }}>
                {tr(
                  "يمكنك من هنا إضافة الحظر أو تعديله أو إلغاؤه ومراجعة السجلات في تدفق بصري أنيق يعطي انطباعًا قويًا من أول لحظة.",
                  "From here you can add, edit, or cancel blocks and review records in an elegant visual flow that gives a strong impression from the first moment."
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={header}>
          <div>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>{APP_NAME}</div>
            <div style={{ fontWeight: 900, opacity: 0.75 }}> </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button style={btn("#1f2937", "#d4af37")} onClick={() => history.back()}>
              {tr("← رجوع", "← Back")}
            </button>

            <button
              style={{ ...btn("#ef4444", "#07101f"), opacity: pageBusy ? 0.7 : 1 }}
              onClick={startAdd}
              disabled={pageBusy}
            >
              {tr("+ إضافة حظر", "+ Add Block")}
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
            {tr("جار تحميل بيانات القاعات والحظر...", "Loading rooms and blocks data...")}
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
            [tr("إجمالي السجلات", "Total Records"), String(stats.total)],
            [tr("الحظر النشط", "Active Blocks"), String(stats.active)],
            [tr("الحظر المنتهي", "Expired Blocks"), String(stats.expired)],
            [tr("الحظر الملغي", "Cancelled Blocks"), String(stats.cancelled)],
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
              options={STATUS_FILTER_OPTIONS}
              onChange={(v) => setStatusFilter(v as typeof statusFilter)}
            />

            <div style={{ marginInlineStart: "auto", fontWeight: 900, color: "#d4af37" }}>
              {tr("إجمالي", "Total")}: {roomBlocks.length} — {tr("المعروض", "Shown")}: {filtered.length}
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
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("القاعة", "Room")}</div>
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
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("نوع السبب", "Reason Type")}</div>
                <GoldDropdown
                  value={current.reasonType}
                  options={REASON_OPTIONS}
                  onChange={(v) => setCurrent({ reasonType: v })}
                />
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("الفترة", "Session")}</div>
                <GoldDropdown
                  value={current.session}
                  options={SESSION_OPTIONS}
                  onChange={(v) => setCurrent({ session: v as RoomBlock["session"] })}
                />
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("الحالة", "Status")}</div>
                <GoldDropdown
                  value={current.status}
                  options={[
                    { value: "active", label: tr("نشط", "Active") },
                    { value: "cancelled", label: tr("ملغي", "Cancelled") },
                  ]}
                  onChange={(v) => setCurrent({ status: v as RoomBlock["status"] })}
                />
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("تاريخ البداية", "Start Date")}</div>
                <input
                  style={inputStyle}
                  type="date"
                  value={current.startDate}
                  onChange={(e) => setCurrent({ startDate: e.target.value })}
                />
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("تاريخ النهاية", "End Date")}</div>
                <input
                  style={inputStyle}
                  type="date"
                  value={current.endDate}
                  onChange={(e) => setCurrent({ endDate: e.target.value })}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "#d4af37" }}>{tr("سبب الحظر", "Block Reason")}</div>
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
                    {pageBusy ? tr("جارٍ الحفظ...", "Saving...") : tr("حفظ التعديل", "Save Changes")}
                  </button>

                  <button
                    style={btn("#1f2937", "#d4af37")}
                    onClick={() => setEditingId(null)}
                    disabled={pageBusy}
                  >
                    {tr("إلغاء", "Cancel")}
                  </button>
                </>
              ) : (
                <>
                  <button
                    style={{ ...btn("#10b981", "#07101f"), opacity: pageBusy ? 0.7 : 1 }}
                    onClick={() => void saveAdd()}
                    disabled={pageBusy}
                  >
                    {pageBusy ? tr("جارٍ الحفظ...", "Saving...") : tr("حفظ", "Save")}
                  </button>

                  <button
                    style={btn("#1f2937", "#d4af37")}
                    onClick={() => setAdding(false)}
                    disabled={pageBusy}
                  >
                    {tr("إلغاء", "Cancel")}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <div style={card}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 14,
              padding: "6px 8px 2px 8px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontWeight: 1000, fontSize: 22, color: "#f2cf63" }}>{tr("جدول حظر القاعات التنفيذي", "Executive Room Blocks Table")}</div>
              <div style={{ fontWeight: 800, color: "rgba(230,199,106,0.74)", marginTop: 4 }}>
                {tr("عرض احترافي يوضح السبب والفترة والحالة والإجراءات في بنية مؤسسية واضحة", "A professional view showing reason, period, status, and actions in a clear institutional structure")}
              </div>
            </div>
            <div style={{ fontWeight: 900, color: "#d4af37", opacity: 0.9 }}>
              {tr("عدد الصفوف المعروضة", "Rows Shown")}: {filtered.length}
            </div>
          </div>

          <div style={tableWrap} className="roomBlocksLuxury">
            <table style={{ width: "100%", minWidth: 1120 }}>
              <thead>
                <tr>
                  <th style={thStyle}>{tr("اسم القاعة", "Room Name")}</th>
                  <th style={thStyle}>{tr("سبب الحظر", "Block Reason")}</th>
                  <th style={thStyle}>{tr("نوع السبب", "Reason Type")}</th>
                  <th style={thStyle}>{tr("من", "From")}</th>
                  <th style={thStyle}>{tr("إلى", "To")}</th>
                  <th style={thStyle}>{tr("الفترة", "Session")}</th>
                  <th style={thStyle}>{tr("الحالة", "Status")}</th>
                  <th style={thStyle}>{tr("أنشئ بواسطة", "Created By")}</th>
                  <th style={thStyle}>{tr("إجراءات", "Actions")}</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td style={tdStyle} colSpan={9}>
                      {tr("لا توجد بيانات.", "No data found.")}
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
                      <td style={tdStyle}>
                        {block.session === "full-day"
                          ? tr("اليوم كامل", "Full Day")
                          : block.session === "الفترة الأولى"
                          ? tr("الفترة الأولى", "First Period")
                          : tr("الفترة الثانية", "Second Period")}
                      </td>
                      <td style={tdStyle}>
                        <span
                          className={
                            "rbBadge " +
                            (block.status === "active"
                              ? "rbActive"
                              : block.status === "expired"
                              ? "rbExpired"
                              : "rbCancelled")
                          }
                        >
                          {block.status === "active"
                            ? tr("نشط", "Active")
                            : block.status === "expired"
                            ? tr("منتهي", "Expired")
                            : tr("ملغي", "Cancelled")}
                        </span>
                      </td>
                      <td style={tdStyle}>{block.createdBy || "—"}</td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button style={btn("#60a5fa", "#07101f")} onClick={() => startEdit(block)}>
                            {tr("✏️ تعديل", "✏️ Edit")}
                          </button>

                          {block.status === "active" && (
                            <button
                              style={btn("#f59e0b", "#07101f")}
                              onClick={() => void cancelBlock(block.id)}
                            >
                              {tr("إلغاء الحظر", "Cancel Block")}
                            </button>
                          )}

                          <button
                            style={btn("#ef4444", "#07101f")}
                            onClick={() => void removeBlock(block.id)}
                          >
                            {tr("🗑 حذف", "🗑 Delete")}
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
    </div>
  );
}
