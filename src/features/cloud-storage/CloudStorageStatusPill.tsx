import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

type Lang = "ar" | "en";

type Props = {
  collapsed?: boolean;
  lang?: Lang;
};

function safeStorageGet(key: string): string {
  try {
    return String(window.localStorage.getItem(key) || window.sessionStorage.getItem(key) || "");
  } catch {
    return "";
  }
}

function isTruth(value: string): boolean {
  return ["1", "true", "yes", "readonly", "read-only"].includes(String(value || "").trim().toLowerCase());
}

function getReadOnlyState(): boolean {
  if (typeof window === "undefined") return false;

  const directFlags = [
    safeStorageGet("viewAsReadOnly"),
    safeStorageGet("governorateSuperReadOnly"),
    safeStorageGet("exam-manager:viewAsReadOnly"),
    safeStorageGet("exam-manager:readonly"),
  ];

  if (directFlags.some(isTruth)) return true;

  try {
    const raw = window.sessionStorage.getItem("exam-manager:viewAs") || window.localStorage.getItem("exam-manager:viewAs") || "";
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.readOnly || parsed?.viewAsReadOnly || parsed?.governorateSuperReadOnly);
  } catch {
    return false;
  }
}

function getLastSyncLabel(lang: Lang): string {
  const value = safeStorageGet("exam-manager:cloud-storage:last-success-at");
  if (!value) return lang === "ar" ? "فحص متاح" : "Check available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return lang === "ar" ? "فحص متاح" : "Check available";

  return lang === "ar"
    ? `آخر مزامنة: ${date.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}`
    : `Last sync: ${date.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function CloudStorageStatusPill({ collapsed = false, lang = "ar" }: Props) {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((v) => v + 1);
    window.addEventListener("storage", refresh);
    window.addEventListener("exam-manager:cloud-storage:changed", refresh as EventListener);
    window.addEventListener("exam-manager:readonly:changed", refresh as EventListener);
    const timer = window.setInterval(refresh, 20000);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("exam-manager:cloud-storage:changed", refresh as EventListener);
      window.removeEventListener("exam-manager:readonly:changed", refresh as EventListener);
      window.clearInterval(timer);
    };
  }, []);

  const readOnly = useMemo(() => getReadOnlyState(), [tick]);
  const subtitle = useMemo(() => getLastSyncLabel(lang), [lang, tick]);
  const label = readOnly ? (lang === "ar" ? "مشاهدة فقط" : "Read only") : lang === "ar" ? "التخزين السحابي" : "Cloud storage";
  const action = lang === "ar" ? "فحص" : "Check";

  const openHealth = () => {
    if (!tenantId) return;
    navigate(`/t/${tenantId}/cloud-health`);
  };

  if (!tenantId) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={openHealth}
        title={`${label} - ${subtitle}`}
        style={{
          width: 48,
          height: 48,
          borderRadius: 16,
          border: readOnly ? "2px solid rgba(37,99,235,0.55)" : "2px solid rgba(16,185,129,0.50)",
          background: readOnly ? "linear-gradient(180deg,#dbeafe,#eff6ff)" : "linear-gradient(180deg,#dcfce7,#f0fdf4)",
          color: readOnly ? "#1d4ed8" : "#047857",
          fontWeight: 900,
          cursor: "pointer",
          boxShadow: "0 10px 22px rgba(120,90,20,0.14)",
        }}
      >
        {readOnly ? "👁️" : "☁️"}
      </button>
    );
  }

  return (
    <div
      style={{
        borderRadius: 18,
        border: readOnly ? "2px solid rgba(37,99,235,0.38)" : "2px solid rgba(16,185,129,0.32)",
        background: readOnly ? "linear-gradient(180deg,#eff6ff,#dbeafe)" : "linear-gradient(180deg,#f0fdf4,#dcfce7)",
        color: readOnly ? "#1e3a8a" : "#065f46",
        padding: 12,
        boxShadow: "0 12px 24px rgba(120,90,20,0.12)",
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 950, display: "flex", alignItems: "center", gap: 8 }}>
          <span>{readOnly ? "👁️" : "☁️"}</span>
          <span>{label}</span>
        </div>
        <button
          type="button"
          onClick={openHealth}
          style={{
            border: "1px solid rgba(0,0,0,0.12)",
            background: "rgba(255,255,255,0.72)",
            color: "inherit",
            borderRadius: 12,
            padding: "7px 10px",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {action}
        </button>
      </div>
      <div style={{ fontSize: 12, opacity: 0.86, fontWeight: 800 }}>{subtitle}</div>
      {readOnly && (
        <div style={{ fontSize: 12, opacity: 0.92, fontWeight: 800 }}>
          {lang === "ar" ? "التعديل والحفظ معطلان أثناء دخول مشرف المحافظة." : "Editing and saving are disabled in governorate supervisor view."}
        </div>
      )}
    </div>
  );
}
