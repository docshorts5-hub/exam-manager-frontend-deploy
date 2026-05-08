import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type GoldOption = { value: string; label: string; disabled?: boolean };

type Props = {
  value: string;
  options: GoldOption[];
  placeholder?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  width?: number | string;
};

const DARK_BG = "#0b1220";
const DARK_BG_2 = "#0a1630";
const GOLD = "#d4af37";
const BORDER = "rgba(212,175,55,0.22)";

export default function GoldDropdown({
  value,
  options,
  placeholder = "— اختر —",
  onChange,
  disabled,
  width = "100%",
}: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number }>({ left: 0, top: 0, width: 240 });

  const selectedLabel = useMemo(() => {
    const found = options.find((o) => o.value === value);
    return found?.label ?? "";
  }, [value, options]);

  const computePos = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: r.left,
      top: r.bottom + 6,
      width: r.width,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    computePos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  useEffect(() => {
    if (!open) return;

    const onResize = () => computePos();
    const onScroll = () => computePos();

    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("mousedown", onDown);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const btnStyle: React.CSSProperties = {
    width,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    background: DARK_BG,
    color: GOLD,
    border: `1px solid ${BORDER}`,
    borderRadius: 14,
    padding: "11px 12px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 900,
    boxShadow: "0 10px 26px rgba(0,0,0,0.35)",
    outline: "none",
  };

  const caretStyle: React.CSSProperties = {
    width: 0,
    height: 0,
    borderLeft: "6px solid transparent",
    borderRight: "6px solid transparent",
    borderTop: `8px solid ${GOLD}`,
    opacity: 0.95,
    transform: open ? "rotate(180deg)" : "rotate(0deg)",
    transition: "transform .15s ease",
  };

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            left: pos.left,
            top: pos.top,
            width: pos.width,
            maxHeight: 360,
            overflow: "auto",
            background: `linear-gradient(180deg, ${DARK_BG_2}, ${DARK_BG})`,
            border: `1px solid ${BORDER}`,
            borderRadius: 14,
            zIndex: 99999,
            boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
            padding: 6,
          }}
        >
          {/* عنوان صغير (اختياري) */}
          <div
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              background: "rgba(212,175,55,0.08)",
              color: GOLD,
              fontWeight: 1000,
              fontSize: 12,
              marginBottom: 6,
            }}
          >
            {placeholder}
          </div>

          {options.map((o) => {
            const isSelected = o.value === value;
            return (
              <button
                key={o.value + o.label}
                disabled={o.disabled}
                onClick={() => {
                  if (o.disabled) return;
                  onChange(o.value);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  textAlign: "right",
                  border: "none",
                  borderRadius: 12,
                  padding: "10px 10px",
                  background: isSelected ? "rgba(212,175,55,0.14)" : "transparent",
                  color: o.disabled ? "rgba(212,175,55,0.35)" : GOLD,
                  fontWeight: 900,
                  cursor: o.disabled ? "not-allowed" : "pointer",
                  transition: "background .12s ease",
                }}
                onMouseEnter={(e) => {
                  if (o.disabled) return;
                  (e.currentTarget.style.background = isSelected ? "rgba(212,175,55,0.18)" : "rgba(255,255,255,0.06)");
                }}
                onMouseLeave={(e) => {
                  if (o.disabled) return;
                  (e.currentTarget.style.background = isSelected ? "rgba(212,175,55,0.14)" : "transparent");
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        style={btnStyle}
        onClick={() => {
          if (disabled) return;
          setOpen((p) => !p);
        }}
      >
        <span style={{ opacity: selectedLabel ? 1 : 0.8 }}>{selectedLabel || placeholder}</span>
        <span style={caretStyle} />
      </button>
      {menu}
    </>
  );
}
