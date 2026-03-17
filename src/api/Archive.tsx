import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { formatArchiveTitle, type ArchivedDistributionRun } from "../utils/taskDistributionStorage";
import { useArchiveItems } from "../features/archive/hooks/useArchiveItems";
import { removeArchivedItem, restoreArchivedRun } from "../features/archive/services/archiveService";
import type { ArchiveItem } from "../features/archive/types";
import { useTenant } from "../tenant/TenantContext";

const page = {
  minHeight: "100vh",
  background: "#0b1020",
  color: "#f5e7b2",
  direction: "rtl" as const,
  padding: 18,
};

const card = {
  border: "1px solid rgba(212,175,55,0.25)",
  borderRadius: 14,
  padding: 14,
  background: "rgba(255,255,255,0.03)",
  boxShadow: "0 10px 28px rgba(0,0,0,0.35)",
};

const btn = (kind: "soft" | "danger" | "brand") => {
  const base: React.CSSProperties = {
    borderRadius: 12,
    padding: "10px 12px",
    border: "1px solid rgba(212,175,55,0.25)",
    fontWeight: 900,
    cursor: "pointer",
    color: "#f5e7b2",
    background: "rgba(255,255,255,0.04)",
  };
  if (kind === "brand") return { ...base, background: "rgba(212,175,55,0.16)", borderColor: "rgba(212,175,55,0.45)" };
  if (kind === "danger") return { ...base, background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.35)" };
  return base;
};

function sourceLabel(src?: ArchiveItem["__source"]) {
  if (src === "both") return "محلي + سحابي";
  if (src === "cloud") return "سحابي";
  return "محلي";
}

const badgeStyle = (src?: ArchiveItem["__source"]): React.CSSProperties => {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    border: "1px solid rgba(212,175,55,0.25)",
    background: "rgba(255,255,255,0.04)",
    color: "#f5e7b2",
  };
  if (src === "cloud") return { ...base, borderColor: "rgba(99,102,241,0.40)", background: "rgba(99,102,241,0.12)" };
  if (src === "both") return { ...base, borderColor: "rgba(34,197,94,0.40)", background: "rgba(34,197,94,0.12)" };
  return { ...base, borderColor: "rgba(212,175,55,0.30)", background: "rgba(212,175,55,0.10)" };
};

export default function Archive() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { tenantId: tenantFromContext } = useTenant() as any;
  const tenantId = String(tenantFromContext || user?.tenantId || "default").trim() || "default";

  const [tick, setTick] = useState(0);
  const { items, cloudOk, cloudErr, cloudStatus, checkCloud } = useArchiveItems(tenantId, tick);

  const restore = (it: ArchiveItem) => {
    if (restoreArchivedRun(tenantId, it)) nav("/task-distribution/results");
  };

  const remove = async (it: ArchiveItem) => {
    if (!it?.archiveId) return;
    if (!window.confirm("حذف هذه النسخة من الأرشيف؟")) return;
    await removeArchivedItem(tenantId, it);
    setTick((x) => x + 1);
  };

  return (
    <div style={page}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 950, letterSpacing: 0.2 }}>الأرشيف</h1>
            <div style={{ marginTop: 6, color: "rgba(245,231,178,0.8)", fontWeight: 800, fontSize: 13 }}>
              هنا يتم حفظ نسخ من الجدول الشامل، ويمكن استعادتها لاحقًا. (يعرض المحلي + السحابي)
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={btn("soft")} onClick={() => nav("/task-distribution/results")}>العودة للجدول الشامل</button>
            <button style={btn("soft")} onClick={() => setTick((x) => x + 1)}>تحديث</button>
          </div>
        </div>

        <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ color: "rgba(245,231,178,0.75)", fontWeight: 850, fontSize: 12 }}>
            حالة السحابة: {cloudOk ? "متصل" : ("غير متاح" + (cloudErr ? " (" + cloudErr + ")" : ""))} • المحلي: متاح
            <span style={{ marginInlineStart: 10, opacity: 0.9 }}>
              — فحص:{" "}
              <span style={{ color: cloudStatus.ok ? "#b7ffcf" : "#ffb4b4", fontWeight: 950 }}>
                {cloudStatus.ok ? "OK" : "X"}
              </span>
              <span style={{ marginInlineStart: 8, opacity: 0.9 }}>{cloudStatus.note}</span>
            </span>
          </div>

          <button style={btn("soft")} onClick={checkCloud}>فحص الاتصال السحابي</button>
        </div>

        <div style={{ marginTop: 14 }}>
          {items.length === 0 ? (
            <div style={{ ...card, padding: 18, textAlign: "center" }}>لا توجد نسخ محفوظة بعد.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
              {items.map((it) => {
                const title = formatArchiveTitle(it as ArchivedDistributionRun);
                const created = it?.createdAtISO ? new Date(it.createdAtISO).toLocaleString("ar", { hour12: true }) : "—";
                const count = (it?.run?.assignments || []).length;
                return (
                  <div key={it.archiveId} style={card}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 950, fontSize: 16, lineHeight: 1.25 }}>{title}</div>
                      <span style={badgeStyle(it.__source)} title="مصدر النسخة">{sourceLabel(it.__source)}</span>
                    </div>

                    <div style={{ marginTop: 6, color: "rgba(245,231,178,0.78)", fontWeight: 800, fontSize: 12 }}>
                      {created} • Run: {String(it?.run?.runId || "—").slice(0, 18)} • عناصر: {count}
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                      <button style={btn("brand")} onClick={() => restore(it)}>استعادة للجدول الشامل</button>
                      <button style={btn("danger")} onClick={() => remove(it)}>حذف</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
