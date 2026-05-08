import React from "react";

type Props = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export default function Modal3D({ title, open, onClose, children }: Props) {
  if (!open) return null;

  return (
    <div
      style={backdrop}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={modal}>
        <div style={header}>
          <div style={titleStyle}>{title}</div>
          <button style={closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={body}>{children}</div>
      </div>
    </div>
  );
}

/* ================== styles ================== */

const backdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};

const modal: React.CSSProperties = {
  width: "min(600px, 95%)",
  background: "#fff",
  borderRadius: 22,
  boxShadow: "0 30px 80px rgba(0,0,0,.35)",
  transform: "translateY(-6px)",
};

const header: React.CSSProperties = {
  padding: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid #eee",
};

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
};

const closeBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 14,
  border: "none",
  cursor: "pointer",
  fontSize: 18,
  background: "#f3f4f6",
};

const body: React.CSSProperties = {
  padding: 18,
};
