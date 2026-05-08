import type { CSSProperties } from "react";

export const theme12 = {
  logoUrl: "https://i.imgur.com/vdDhSMh.png",

  colors: {
    pageBg: "#f3efe4",
    pageBg2: "#ece7d8",
    cardBg: "#f8f4e8",
    cardBg2: "#f2eddf",
    panelBg: "#faf7ee",
    panelBg2: "#f5f0e1",
    gold: "#d4af37",
    goldLight: "#ead98b",
    goldSoft: "rgba(212,175,55,0.18)",
    goldGlow: "rgba(212,175,55,0.28)",
    ink: "#000000",
    mutedInk: "#111111",
    blueSoft: "#dce9ff",
    blueSoft2: "#ebf3ff",
    greenSoft: "rgba(16,185,129,0.10)",
    greenBorder: "rgba(16,185,129,0.25)",
    white: "#ffffff",
    danger: "#dc2626",
  },

  radius: {
    sm: 16,
    md: 22,
    lg: 30,
    xl: 40,
    pill: 999,
  },

  border: {
    gold1: "1px solid rgba(212,175,55,0.22)",
    gold2: "2px solid #d4af37",
    gold3: "3px solid #d4af37",
    gold4: "4px solid #d4af37",
    gold5: "5px solid #d4af37",
  },

  shadow: {
    card: "0 18px 38px rgba(150,120,20,0.14)",
    panel: "0 12px 28px rgba(150,120,20,0.10)",
    soft: "0 10px 24px rgba(150,120,20,0.08)",
    insetGold: "0 0 0 10px rgba(212,175,55,0.12) inset",
    button: "0 14px 30px rgba(150,120,20,0.18)",
  },

  gradient: {
    page: "linear-gradient(180deg, #f3efe4 0%, #ece7d8 100%)",
    card: "linear-gradient(180deg, #f8f4e8 0%, #f2eddf 100%)",
    panel: "linear-gradient(180deg, #faf7ee 0%, #f5f0e1 100%)",
    goldButton: "linear-gradient(180deg, #f2dc8a 0%, #d4af37 100%)",
    blueButton: "linear-gradient(180deg, #ebf3ff 0%, #dce9ff 100%)",
  },
};

export const page12Style: CSSProperties = {
  minHeight: "100vh",
  padding: 18,
  background: theme12.gradient.page,
  boxSizing: "border-box",
  color: theme12.colors.ink,
};

export const shell12Style: CSSProperties = {
  maxWidth: 1880,
  margin: "0 auto",
  display: "grid",
  gap: 24,
};

export const goldCard12Style: CSSProperties = {
  background: theme12.gradient.card,
  border: theme12.border.gold5,
  borderRadius: theme12.radius.xl,
  boxShadow: `${theme12.shadow.insetGold}, ${theme12.shadow.card}`,
  color: theme12.colors.ink,
};

export const goldPanel12Style: CSSProperties = {
  background: theme12.gradient.panel,
  border: theme12.border.gold4,
  borderRadius: theme12.radius.lg,
  boxShadow: theme12.shadow.panel,
  color: theme12.colors.ink,
};

export const hero12Style: CSSProperties = {
  ...goldCard12Style,
  padding: 28,
  display: "grid",
  gap: 24,
};

export const section12Style: CSSProperties = {
  ...goldCard12Style,
  padding: 28,
  display: "grid",
  gap: 28,
};

export const sectionTitleWrap12Style: CSSProperties = {
  display: "grid",
  gap: 10,
};

export const sectionTitle12Style: CSSProperties = {
  margin: 0,
  color: theme12.colors.ink,
  fontWeight: 1000,
  fontSize: "clamp(24px, 3vw, 38px)",
};

export const sectionDescription12Style: CSSProperties = {
  margin: 0,
  color: theme12.colors.ink,
  fontWeight: 800,
  fontSize: 17,
  lineHeight: 1.9,
};

export const heroTitle12Style: CSSProperties = {
  margin: 0,
  color: theme12.colors.ink,
  fontWeight: 1000,
  fontSize: "clamp(36px, 5vw, 72px)",
  lineHeight: 1.18,
  textShadow: "0 10px 22px rgba(212,175,55,0.10)",
};

export const heroSubtitle12Style: CSSProperties = {
  color: theme12.colors.ink,
  fontWeight: 900,
  fontSize: 26,
};

export const heroText12Style: CSSProperties = {
  margin: 0,
  color: theme12.colors.ink,
  fontWeight: 800,
  fontSize: 18,
  lineHeight: 2,
};

export const pill12Style: CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  padding: "10px 18px",
  borderRadius: theme12.radius.pill,
  border: `2px solid ${theme12.colors.greenBorder}`,
  background: theme12.colors.greenSoft,
  color: theme12.colors.ink,
  fontWeight: 900,
  fontSize: 14,
};

export const blueBadge12Style: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "fit-content",
  padding: "12px 26px",
  borderRadius: theme12.radius.pill,
  background: theme12.gradient.blueButton,
  border: theme12.border.gold4,
  color: theme12.colors.ink,
  fontWeight: 900,
  fontSize: 20,
  boxShadow: "0 10px 22px rgba(40,70,120,0.08)",
};

export const statGrid12Style: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 20,
};

export const statCard12Style: CSSProperties = {
  background: theme12.gradient.card,
  border: theme12.border.gold4,
  borderRadius: theme12.radius.lg,
  padding: "24px 28px",
  boxShadow: theme12.shadow.panel,
  display: "grid",
  gap: 8,
  color: theme12.colors.ink,
};

export const statLabel12Style: CSSProperties = {
  color: theme12.colors.ink,
  fontWeight: 900,
  fontSize: 18,
};

export const statValue12Style: CSSProperties = {
  color: theme12.colors.ink,
  fontWeight: 1000,
  fontSize: 24,
};

export const formGrid12Style: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 22,
};

export const fieldCard12Style: CSSProperties = {
  background: theme12.gradient.panel,
  border: theme12.border.gold4,
  borderRadius: theme12.radius.lg,
  padding: 22,
  boxShadow: theme12.shadow.soft,
  display: "grid",
  gap: 14,
  color: theme12.colors.ink,
};

export const fieldLabel12Style: CSSProperties = {
  color: theme12.colors.ink,
  fontWeight: 1000,
  fontSize: 20,
};

export const input12Style: CSSProperties = {
  width: "100%",
  minHeight: 64,
  borderRadius: theme12.radius.md,
  border: theme12.border.gold3,
  background: theme12.colors.cardBg,
  color: theme12.colors.ink,
  fontWeight: 900,
  fontSize: 24,
  padding: "14px 20px",
  outline: "none",
  boxSizing: "border-box",
};

export const select12Style: CSSProperties = {
  ...input12Style,
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  cursor: "pointer",
};

export const textarea12Style: CSSProperties = {
  width: "100%",
  minHeight: 160,
  borderRadius: 24,
  border: theme12.border.gold3,
  background: theme12.colors.cardBg,
  color: theme12.colors.ink,
  fontWeight: 900,
  fontSize: 22,
  padding: "18px 20px",
  outline: "none",
  boxSizing: "border-box",
  resize: "vertical",
};

export const primaryButton12Style: CSSProperties = {
  minHeight: 62,
  minWidth: 320,
  padding: "0 28px",
  borderRadius: theme12.radius.md,
  border: theme12.border.gold4,
  background: theme12.gradient.goldButton,
  color: theme12.colors.ink,
  fontWeight: 1000,
  fontSize: 22,
  cursor: "pointer",
  boxShadow: theme12.shadow.button,
};

export const secondaryButton12Style: CSSProperties = {
  minHeight: 56,
  width: "fit-content",
  padding: "0 24px",
  borderRadius: 18,
  border: theme12.border.gold3,
  background: "#fffdf7",
  color: theme12.colors.ink,
  fontWeight: 1000,
  fontSize: 18,
  cursor: "pointer",
};

export const blueButton12Style: CSSProperties = {
  minHeight: 56,
  width: "fit-content",
  padding: "0 24px",
  borderRadius: 18,
  border: theme12.border.gold3,
  background: theme12.gradient.blueButton,
  color: theme12.colors.ink,
  fontWeight: 1000,
  fontSize: 18,
  cursor: "pointer",
  boxShadow: "0 10px 20px rgba(40,70,120,0.08)",
};

export const dangerButton12Style: CSSProperties = {
  minHeight: 56,
  width: "fit-content",
  padding: "0 24px",
  borderRadius: 18,
  border: "3px solid rgba(220,38,38,0.35)",
  background: "linear-gradient(180deg, #f87171 0%, #dc2626 100%)",
  color: "#ffffff",
  fontWeight: 1000,
  fontSize: 18,
  cursor: "pointer",
  boxShadow: "0 12px 26px rgba(220,38,38,0.20)",
};

export const table12Style: CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  background: theme12.colors.cardBg,
  border: theme12.border.gold3,
  borderRadius: theme12.radius.lg,
  overflow: "hidden",
  color: theme12.colors.ink,
};

export const th12Style: CSSProperties = {
  background: theme12.gradient.goldButton,
  color: theme12.colors.ink,
  fontWeight: 1000,
  fontSize: 17,
  padding: "16px 14px",
  borderBottom: theme12.border.gold3,
  textAlign: "center",
};

export const td12Style: CSSProperties = {
  color: theme12.colors.ink,
  fontWeight: 900,
  fontSize: 16,
  padding: "14px 12px",
  borderBottom: "1px solid rgba(212,175,55,0.35)",
  textAlign: "center",
};

export function withFullWidth(style: CSSProperties = {}): CSSProperties {
  return {
    ...style,
    gridColumn: "1 / -1",
  };
}

export function makeGoldCard12(overrides: CSSProperties = {}): CSSProperties {
  return {
    ...goldCard12Style,
    ...overrides,
  };
}

export function makeGoldPanel12(overrides: CSSProperties = {}): CSSProperties {
  return {
    ...goldPanel12Style,
    ...overrides,
  };
}

export function makePill12(overrides: CSSProperties = {}): CSSProperties {
  return {
    ...pill12Style,
    ...overrides,
  };
}

export function makeButton12(
  variant: "primary" | "secondary" | "blue" | "danger" = "primary",
  overrides: CSSProperties = {}
): CSSProperties {
  const base =
    variant === "secondary"
      ? secondaryButton12Style
      : variant === "blue"
        ? blueButton12Style
        : variant === "danger"
          ? dangerButton12Style
          : primaryButton12Style;

  return {
    ...base,
    ...overrides,
  };
}
