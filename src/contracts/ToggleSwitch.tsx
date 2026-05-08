import React from "react";

type ToggleSwitchProps = {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
};

export default function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
  hint,
}: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        {label ? <div className="text-sm font-semibold text-yellow-200">{label}</div> : null}
        {hint ? <div className="text-xs text-yellow-200/70 mt-1">{hint}</div> : null}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          "relative w-14 h-8 rounded-full transition-colors",
          "border border-white/10 shadow-inner",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
          checked ? "bg-green-600" : "bg-red-600",
        ].join(" ")}
        aria-pressed={checked}
      >
        <span
          className={[
            "absolute top-1 left-1 w-6 h-6 rounded-full bg-white transition-transform",
            checked ? "translate-x-6" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
