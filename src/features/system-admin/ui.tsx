import React from "react";

export const GOLD = "#d4af37";
export const LINE = "rgba(212,175,55,0.18)";

export function Card(props: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${LINE}`,
        borderRadius: 18,
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
        padding: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 900, color: GOLD, fontSize: 18 }}>{props.title}</div>
        {props.right}
      </div>
      <div style={{ marginTop: 12 }}>{props.children}</div>
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(2,6,23,0.55)",
        color: "#e5e7eb",
        outline: "none",
        ...(props.style as any),
      }}
    />
  );
}

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "gold" | "danger" | "ghost" }) {
  const variant = props.variant ?? "gold";
  const base: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 900,
    border: "1px solid transparent",
  };
  const style: Record<string, React.CSSProperties> = {
    gold: {
      background: "rgba(212,175,55,0.12)",
      border: `1px solid rgba(212,175,55,0.32)`,
      color: GOLD,
    },
    danger: {
      background: "rgba(239,68,68,0.14)",
      border: "1px solid rgba(239,68,68,0.35)",
      color: "#fecaca",
    },
    ghost: {
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.14)",
      color: "#e5e7eb",
    },
  };
  return <button {...props} style={{ ...base, ...style[variant], ...(props.style as any) }} />;
}
