import React from "react";

export function ConfirmModal(props: {
  title: string;
  subtitle?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={modalStyles.backdrop} onClick={props.onCancel} role="dialog" aria-modal="true">
      <div style={modalStyles.card} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.title}>{props.title}</div>
        {props.subtitle && <div style={modalStyles.sub}>{props.subtitle}</div>}

        <div style={modalStyles.row}>
          <button style={modalStyles.btnCancel} onClick={props.onCancel}>
            {props.cancelText || "اغلاق"}
          </button>
          <button style={modalStyles.btnConfirm} onClick={props.onConfirm}>
            {props.confirmText || "نعم"}
          </button>
        </div>
      </div>
    </div>
  );
}

const modalStyles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 14,
    direction: "rtl",
  },
  card: {
    width: "min(560px, 96vw)",
    background: "linear-gradient(180deg,#0b1224,#020617)",
    border: "1px solid rgba(184,134,11,0.45)",
    borderRadius: 18,
    boxShadow: "0 28px 70px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)",
    padding: 16,
    color: "#fff",
  },
  title: { fontSize: 16, fontWeight: 900, color: "#fbbf24", marginBottom: 8 },
  sub: {
    whiteSpace: "pre-wrap",
    fontSize: 13,
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 14,
    fontWeight: 700,
  },
  row: { display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" },
  btnCancel: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  btnConfirm: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(251,191,36,0.55)",
    background: "linear-gradient(180deg, rgba(251,191,36,0.95), rgba(184,134,11,0.95))",
    color: "#111827",
    fontWeight: 900,
    cursor: "pointer",
  },
};
