import React from "react";

type Tone = "gold" | "green" | "blue" | "purple";

type Props = {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  tone: Tone;
  disabled?: boolean;
  selected?: boolean;
  showArrow?: boolean;
  arrowOpen?: boolean;
  onClick?: () => void;
};

const toneMap: Record<
  Tone,
  {
    background: string;
    border: string;
    bottomBorder: string;
    color: string;
    iconBackground: string;
    shadow: string;
  }
> = {
  gold: {
    background: "linear-gradient(180deg,#fffaf0 0%,#fff3d2 100%)",
    border: "#efd38b",
    bottomBorder: "#dcae43",
    color: "#805d05",
    iconBackground: "transparent",
    shadow: "rgba(181,127,22,.17)",
  },

  green: {
    background: "linear-gradient(180deg,#f3fff8 0%,#e5f9ed 100%)",
    border: "#9dddb8",
    bottomBorder: "#62bf89",
    color: "#087342",
    iconBackground: "transparent",
    shadow: "rgba(22,163,74,.16)",
  },

  blue: {
    background: "linear-gradient(180deg,#f4f9ff 0%,#e4f0ff 100%)",
    border: "#a6caf6",
    bottomBorder: "#6fa8e9",
    color: "#1d5db7",
    iconBackground: "transparent",
    shadow: "rgba(37,99,235,.16)",
  },

  purple: {
    background: "linear-gradient(180deg,#faf7ff 0%,#f0e9ff 100%)",
    border: "#d2bdf7",
    bottomBorder: "#aa83e7",
    color: "#6a2bc2",
    iconBackground: "transparent",
    shadow: "rgba(109,40,217,.16)",
  },
};

export default function OwnerGovernorateGuideStep({
  title,
  subtitle,
  icon,
  tone,
  disabled = false,
  selected = false,
  showArrow = false,
  arrowOpen = false,
  onClick,
}: Props) {
  const palette = toneMap[tone];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled}
      style={{
        width: "100%",
        minHeight: 78,
        borderRadius: 18,
        border: `1px solid ${palette.border}`,
        borderBottom: `4px solid ${palette.bottomBorder}`,
        background: palette.background,
        color: palette.color,
        boxShadow: selected
          ? `0 12px 22px ${palette.shadow}, 0 0 0 2px ${palette.border}`
          : `0 9px 18px ${palette.shadow}, inset 0 2px 0 rgba(255,255,255,.92)`,
        opacity: disabled ? 0.48 : 1,
        cursor: disabled ? "not-allowed" : onClick ? "pointer" : "default",
        padding: "9px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        direction: "rtl",
        fontFamily: "inherit",
        transition:
          "transform .18s ease, box-shadow .18s ease, opacity .18s ease",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 46,
          height: 46,
          flex: "0 0 46px",
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: palette.iconBackground,
          fontSize: 29,
          lineHeight: 1,
        }}
      >
        {icon}
      </span>

      <span
        style={{
          minWidth: 0,
          flex: 1,
          textAlign: "center",
        }}
      >
        <strong
          style={{
            display: "block",
            fontSize: 17,
            fontWeight: 1000,
            lineHeight: 1.35,
          }}
        >
          {title}
        </strong>

        <span
          style={{
            display: "block",
            marginTop: 3,
            fontSize: 12,
            fontWeight: 800,
            lineHeight: 1.45,
          }}
        >
          {subtitle}
        </span>
      </span>

      {showArrow ? (
        <span
          aria-hidden="true"
          style={{
            width: 27,
            height: 27,
            flex: "0 0 27px",
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,.72)",
            border: `1px solid ${palette.border}`,
            fontSize: 15,
            fontWeight: 1000,
          }}
        >
          {arrowOpen ? "▲" : "▼"}
        </span>
      ) : null}
    </button>
  );
}