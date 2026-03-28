import type { CSSProperties } from "react";
import type { SuperPortalActionCard } from "../types";

export default function SuperPortalCard({ card }: { card: SuperPortalActionCard }) {
  const wrapper: CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(212, 175, 55, 0.22)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.35))",
    boxShadow: "0 14px 35px rgba(0,0,0,0.55)",
    padding: 18,
    transform: "translateZ(0)",
  };

  const button: CSSProperties = {
    background: "rgba(0,0,0,0.6)",
    border: "1px solid rgba(212,175,55,0.35)",
    color: "#fff",
    borderRadius: 14,
    padding: "10px 16px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(0,0,0,0.45)",
  };

  return (
    <div style={wrapper}>
      <div style={{ color: "#d4af37", fontWeight: 800, fontSize: 22 }}>{card.title}</div>
      <div style={{ color: "rgba(255,255,255,0.82)", marginTop: 8, lineHeight: 1.7 }}>{card.description}</div>
      <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 14 }}>
        <button onClick={card.onClick} style={button}>{card.cta}</button>
      </div>
    </div>
  );
}
