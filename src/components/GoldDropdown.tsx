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

const FIELD_BG = "#fffdf6";
const FIELD_BG_2 = "#f8f2df";
const TEXT = "#000000";
const GOLD = "#d4af37";
const BORDER = "rgba(120, 89, 14, 0.48)";

function normalizeSearchText(value: any) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ـ/g, "")
    .replace(/\s+/g, " ");
}

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
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState<{ left: number; top: number; width: number }>({ left: 0, top: 0, width: 240 });

  const selectedLabel = useMemo(() => {
    const found = options.find((o) => o.value === value);
    return found?.label ?? "";
  }, [value, options]);

  const filteredOptions = useMemo(() => {
    const q = normalizeSearchText(search);
    if (!q) return options;

    return options.filter((o) => {
      const haystack = normalizeSearchText(`${o.label || ""} ${o.value || ""}`);
      return haystack.includes(q);
    });
  }, [options, search]);

  const firstEnabledFilteredOption = useMemo(() => filteredOptions.find((o) => !o.disabled), [filteredOptions]);

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

    setSearch("");
    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 30);

    return () => window.clearTimeout(focusTimer);
  }, [open]);

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
    background: FIELD_BG,
    color: TEXT,
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
    borderTop: `8px solid ${TEXT}`,
    opacity: 0.95,
    transform: open ? "rotate(180deg)" : "rotate(0deg)",
    transition: "transform .15s ease",
  };

  const menu = open
    ? createPortal(
        <>
          <style>{`
            .gold-dropdown-search-input::placeholder {
              color: rgba(0,0,0,0.55) !important;
              -webkit-text-fill-color: rgba(0,0,0,0.55) !important;
            }
            .gold-dropdown-search-input::-webkit-input-placeholder {
              color: rgba(0,0,0,0.55) !important;
              -webkit-text-fill-color: rgba(0,0,0,0.55) !important;
            }
          `}</style>
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            left: pos.left,
            top: pos.top,
            width: pos.width,
            maxHeight: 420,
            overflow: "auto",
            background: `linear-gradient(180deg, ${FIELD_BG}, ${FIELD_BG_2})`,
            border: `1px solid ${BORDER}`,
            borderRadius: 14,
            zIndex: 2147483647,
            boxShadow: "0 22px 65px rgba(0,0,0,0.24)",
            padding: 6,
          }}
        >
          <div
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              background: "rgba(212,175,55,0.18)",
              color: TEXT,
              fontWeight: 1000,
              fontSize: 12,
              marginBottom: 6,
            }}
          >
            {placeholder}
          </div>

          <input
            className="gold-dropdown-search-input"
            ref={searchInputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
                btnRef.current?.focus();
                return;
              }

              if (e.key === "Enter" && firstEnabledFilteredOption) {
                e.preventDefault();
                onChange(firstEnabledFilteredOption.value);
                setSearch("");
                setOpen(false);
                btnRef.current?.focus();
              }
            }}
            placeholder="اكتب للبحث داخل المواد..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              marginBottom: 6,
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${BORDER}`,
              outline: "none",
              background: "#ffffff",
              color: "#000000",
              WebkitTextFillColor: "#000000",
              caretColor: "#000000",
              fontWeight: 900,
              fontSize: 13,
              direction: "rtl",
            }}
          />

          {filteredOptions.length ? (
            filteredOptions.map((o) => {
              const isSelected = o.value === value;
              return (
                <button
                  type="button"
                  key={o.value + o.label}
                  disabled={o.disabled}
                  onClick={() => {
                    if (o.disabled) return;
                    onChange(o.value);
                    setSearch("");
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "right",
                    border: "none",
                    borderRadius: 12,
                    padding: "10px 10px",
                    background: isSelected ? "rgba(212,175,55,0.14)" : "transparent",
                    color: o.disabled ? "rgba(0,0,0,0.35)" : TEXT,
                    WebkitTextFillColor: o.disabled ? "rgba(0,0,0,0.35)" : TEXT,
                    fontWeight: 900,
                    cursor: o.disabled ? "not-allowed" : "pointer",
                    transition: "background .12s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (o.disabled) return;
                    e.currentTarget.style.background = isSelected ? "rgba(212,175,55,0.26)" : "rgba(212,175,55,0.14)";
                  }}
                  onMouseLeave={(e) => {
                    if (o.disabled) return;
                    e.currentTarget.style.background = isSelected ? "rgba(212,175,55,0.14)" : "transparent";
                  }}
                >
                  {o.label}
                </button>
              );
            })
          ) : (
            <div
              style={{
                padding: "14px 10px",
                borderRadius: 12,
                background: "rgba(212,175,55,0.12)",
                color: TEXT,
                fontWeight: 900,
                textAlign: "center",
                opacity: 0.85,
              }}
            >
              لا توجد مواد مطابقة للبحث
            </div>
          )}
        </div>
        </>,
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
