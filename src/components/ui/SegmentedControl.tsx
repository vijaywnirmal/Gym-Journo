"use client";

import { useRef, type KeyboardEvent } from "react";

// A small set of mutually exclusive choices shown side by side (kg / lb, workout / rest).
// Behaves as a radio group: one tab stop, arrow keys move the choice.
export default function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = "md",
  className = "",
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onKeyDown(e: KeyboardEvent) {
    const index = options.findIndex((o) => o.value === value);
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    ref.current?.querySelectorAll<HTMLButtonElement>("[role=radio]")[next]?.focus();
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={`inline-flex rounded-[10px] bg-fill p-0.5 ${className}`}
    >
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`flex-1 whitespace-nowrap rounded-lg font-medium transition-colors ${
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3 text-sm"
            } ${checked ? "bg-surface-raised text-label shadow-sm" : "text-label-2 hover:text-label"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
