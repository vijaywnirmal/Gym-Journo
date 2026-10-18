"use client";

import { useId, useState, type ReactNode } from "react";
import Icon from "@/components/Icon";

// Show/hide a section without the browser's <details> marker. The panel height animates via a
// grid-rows transition (no measuring), and content stays mounted so form state survives a collapse.
export default function Disclosure({
  summary,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className = "",
  summaryClassName = "",
  panelClassName = "",
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  summaryClassName?: string;
  panelClassName?: string;
}) {
  const id = useId();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;

  function toggle() {
    const next = !open;
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={toggle}
        className={`flex w-full items-center justify-between gap-3 text-left ${summaryClassName}`}
      >
        <span className="min-w-0 flex-1">{summary}</span>
        <Icon
          name="chevronDown"
          className={`size-4 shrink-0 text-label-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          strokeWidth={2.25}
        />
      </button>
      <div
        id={`${id}-panel`}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={panelClassName}>{children}</div>
        </div>
      </div>
    </div>
  );
}
