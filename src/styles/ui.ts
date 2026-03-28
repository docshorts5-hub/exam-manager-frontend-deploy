// src/styles/ui.ts
import type React from "react";

/**
 * ✅ Design System (Commercial / Formal)
 * - ألوان متناسقة (Navy + Gold) مناسبة للهوية الرسمية
 * - Tokens موحّدة للواجهات والأزرار والجداول
 */

export const ui = {
  dir: "rtl" as const,

  // Brand (Navy + Gold)
  navy: "#0b1220",
  navy2: "#111827",
  gold: "#d4af37",
  gold2: "#fbbf24",

  // Backgrounds
  bgApp: "#ffffff",
  bgDark: "#0b1220",
  bgSoft: "rgba(255,255,255,.06)",
  bgMuted: "rgba(255,255,255,.10)",
  bgCardDark: "rgba(17,24,39,.65)",

  // Text
  text: "#0b1220",
  textSoft: "rgba(0,0,0,.58)",
  textOnDark: "#ffffff",
  textOnDarkSoft: "rgba(255,255,255,.78)",

  // Semantic
  primary: "#d4af37",
  primary2: "#fbbf24",
  info: "#0284c7",
  success: "#16a34a",
  danger: "#ef4444",
  warning: "#f59e0b",

  // Table columns colors
  col: {
    subject: { bg: "rgba(212,175,55,.14)", fg: "#8a6a12" },
    date: { bg: "rgba(2,132,199,.12)", fg: "#0369a1" },
    day: { bg: "rgba(16,185,129,.12)", fg: "#047857" },
    time: { bg: "rgba(245,158,11,.12)", fg: "#b45309" },
    period: { bg: "rgba(99,102,241,.12)", fg: "#4338ca" },
    grades: { bg: "rgba(236,72,153,.12)", fg: "#be185d" },
    rooms: { bg: "rgba(34,197,94,.12)", fg: "#15803d" },

    name: { bg: "rgba(17,24,39,.06)", fg: "#111827" },
    monitor: { bg: "rgba(2,132,199,.10)", fg: "#0369a1" },
    reserve: { bg: "rgba(234,88,12,.10)", fg: "#c2410c" },
    review: { bg: "rgba(109,40,217,.10)", fg: "#6d28d9" },
    correct: { bg: "rgba(4,120,87,.10)", fg: "#047857" },
    total: { bg: "rgba(185,28,28,.10)", fg: "#b91c1c" },
  },
} as const;

/* =========================
 * Page Layout
 * ========================= */
export const pageWhite: React.CSSProperties = {
  direction: ui.dir,
  minHeight: "100vh",
  background: ui.bgApp,
};

export const pageDark: React.CSSProperties = {
  direction: ui.dir,
  minHeight: "100vh",
  background:
    "radial-gradient(1200px 700px at 70% -10%, rgba(212,175,55,.22), transparent 60%), #0b1220",
  padding: "18px 18px 40px",
  color: ui.textOnDark,
};

export const container: React.CSSProperties = {
  width: "min(1240px, 100%)",
  margin: "0 auto",
  padding: "18px",
};

export const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(0,0,0,.08)",
  borderRadius: 22,
  boxShadow: "0 18px 55px rgba(0,0,0,.12)",
  padding: 18,
};

export const cardDark: React.CSSProperties = {
  background: ui.bgCardDark,
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 22,
  boxShadow: "0 18px 55px rgba(0,0,0,.35)",
  padding: 18,
  color: ui.textOnDark,
};

export const cardHeaderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

export const cardTitle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: ui.text,
};

export const cardTitleOnDark: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: ui.textOnDark,
};

export const cardSub: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: ui.textSoft,
};

export const cardSubOnDark: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: ui.textOnDarkSoft,
};

/* =========================
 * Hero
 * ========================= */
export const hero: React.CSSProperties = {
  borderRadius: 26,
  padding: "22px 22px",
  background: `linear-gradient(135deg, ${ui.navy}, ${ui.navy2})`,
  boxShadow: "0 24px 70px rgba(0,0,0,.35)",
  border: `1px solid rgba(212,175,55,.28)`,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
};

export const heroTitle: React.CSSProperties = {
  color: "#fff",
  fontSize: 32,
  fontWeight: 900,
  letterSpacing: 0.2,
};

export const heroSub: React.CSSProperties = {
  color: "rgba(255,255,255,.82)",
  marginTop: 6,
  fontSize: 13,
};

/* =========================
 * Buttons
 * ========================= */
type BtnVariant = "brand" | "primary" | "ghost" | "success" | "dark" | "danger" | "soft" | "outline";

export function btn(variant: BtnVariant = "primary"): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 14,
    padding: "10px 14px",
    border: "1px solid rgba(0,0,0,.08)",
    cursor: "pointer",
    fontWeight: 900,
    transition: "transform .12s ease, box-shadow .12s ease, opacity .12s ease",
    userSelect: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    whiteSpace: "nowrap",
  };

  const variants: Record<BtnVariant, React.CSSProperties> = {
    brand: {
      background: `linear-gradient(135deg, ${ui.gold}, ${ui.gold2})`,
      color: "#1b1607",
      border: "1px solid rgba(255,255,255,.22)",
      boxShadow: "0 12px 26px rgba(212,175,55,.25)",
    },
    primary: {
      background: `linear-gradient(135deg, ${ui.navy}, ${ui.navy2})`,
      color: "#fff",
      border: "1px solid rgba(255,255,255,.12)",
      boxShadow: "0 12px 26px rgba(0,0,0,.25)",
    },
    success: {
      background: "linear-gradient(135deg, #16a34a, #22c55e)",
      color: "#fff",
      border: "1px solid rgba(255,255,255,.18)",
      boxShadow: "0 12px 26px rgba(34,197,94,.22)",
    },
    danger: {
      background: "linear-gradient(135deg, #ef4444, #fb7185)",
      color: "#fff",
      border: "1px solid rgba(255,255,255,.18)",
      boxShadow: "0 12px 26px rgba(239,68,68,.20)",
    },
    dark: {
      background: "rgba(17,24,39,.92)",
      color: "#fff",
      border: "1px solid rgba(255,255,255,.12)",
      boxShadow: "0 12px 26px rgba(0,0,0,.25)",
    },
    ghost: {
      background: "rgba(255,255,255,.92)",
      color: ui.text,
      border: "1px solid rgba(0,0,0,.08)",
      boxShadow: "0 10px 24px rgba(0,0,0,.08)",
    },
    soft: {
      background: "rgba(255,255,255,.12)",
      color: "#fff",
      border: "1px solid rgba(255,255,255,.14)",
      boxShadow: "0 10px 24px rgba(0,0,0,.18)",
    },
    outline: {
      background: "transparent",
      color: ui.text,
      border: `1px solid rgba(212,175,55,.55)`,
      boxShadow: "0 10px 24px rgba(0,0,0,.06)",
    },
  };

  return { ...base, ...(variants[variant] ?? variants.primary) };
}

export const btnDisabled: React.CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
};

export function pressableStyle(isPressed: boolean): React.CSSProperties {
  return isPressed
    ? { transform: "translateY(1px) scale(0.99)", boxShadow: "none" }
    : { transform: "translateY(0) scale(1)" };
}

/* =========================
 * Inputs (3D)
 * ========================= */
export const input3D: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(0,0,0,.10)",
  outline: "none",
  boxShadow: "inset 0 2px 6px rgba(0,0,0,.08), 0 10px 22px rgba(0,0,0,.06)",
  fontWeight: 800,
  fontSize: 14,
};

export const inputDark: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,.14)",
  outline: "none",
  background: "rgba(255,255,255,.08)",
  color: "#fff",
  boxShadow: "inset 0 2px 8px rgba(0,0,0,.35)",
  fontWeight: 800,
  fontSize: 14,
};

/* =========================
 * Table
 * ========================= */
export const tableCard: React.CSSProperties = {
  // Dark container to avoid white table background in dark theme
  background: "rgba(11,18,32,.92)",
  border: "1px solid rgba(212,175,55,.18)",
  borderRadius: 18,
  boxShadow: "0 18px 55px rgba(0,0,0,.35)",
  overflow: "hidden",
};

export const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  fontSize: 13,
};

export const thBase: React.CSSProperties = {
  padding: 14,
  textAlign: "right",
  fontSize: 14,
  fontWeight: 900,
  whiteSpace: "nowrap",
  borderBottom: "1px solid rgba(212,175,55,.22)",
};

export function thColored(bg: string, fg: string): React.CSSProperties {
  return { ...thBase, background: bg, color: fg };
}

export const tdBase: React.CSSProperties = {
  padding: 14,
  textAlign: "right",
  borderBottom: "1px solid rgba(255,255,255,.06)",
  whiteSpace: "nowrap",
  fontSize: 14,
  fontWeight: 800,
  verticalAlign: "middle",
};

/* =========================
 * Chips / Badges
 * ========================= */
export function chip(bg: string, fg: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    background: bg,
    color: fg,
    border: "1px solid rgba(0,0,0,.08)",
    fontWeight: 900,
    fontSize: 12,
    whiteSpace: "nowrap",
  };
}

export function badge(bg: string, fg: string): React.CSSProperties {
  return {
    minWidth: 52,
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 16,
    background: bg,
    color: fg,
    fontWeight: 900,
    border: "1px solid rgba(0,0,0,.06)",
  };
}
