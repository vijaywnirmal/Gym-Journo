"use client";

import Icon from "@/components/Icon";

// An on/off choice inside a set (muscle groups, weekdays) — a button with aria-pressed rather than
// a styled checkbox, so it looks and works the same everywhere.
export default function ToggleChip({
  pressed,
  onChange,
  children,
  className = "",
}: {
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors ${
        pressed
          ? "border-transparent bg-accent text-on-accent"
          : "border-separator bg-surface text-label hover:bg-fill"
      } ${className}`}
    >
      {pressed && <Icon name="checkmark" className="-ml-0.5 size-3.5" strokeWidth={2.75} />}
      {children}
    </button>
  );
}
