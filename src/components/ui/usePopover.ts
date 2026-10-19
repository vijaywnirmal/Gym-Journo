"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type Placement = { top: number; left: number; width: number; maxHeight: number; above: boolean };

const GAP = 6;
const VIEWPORT_MARGIN = 12;

// Shared open/close and positioning for every floating panel (selects, date picker).
// The panel is `position: fixed` and measured from the trigger, so a card with overflow hidden
// never clips it. It flips above the trigger when there is more room there, closes on outside
// press or Escape, and hands focus back to the trigger on close.
export function usePopover<T extends HTMLElement = HTMLButtonElement>({
  preferredHeight = 320,
  minWidth = 0,
}: { preferredHeight?: number; minWidth?: number } = {}) {
  const triggerRef = useRef<T>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN - GAP;
    const spaceAbove = rect.top - VIEWPORT_MARGIN - GAP;
    const above = spaceBelow < Math.min(preferredHeight, 220) && spaceAbove > spaceBelow;
    const width = Math.max(rect.width, minWidth);
    const left = Math.min(Math.max(VIEWPORT_MARGIN, rect.left), window.innerWidth - width - VIEWPORT_MARGIN);
    const maxHeight = Math.min(preferredHeight, above ? spaceAbove : spaceBelow);
    setPlacement({
      top: above ? rect.top - GAP : rect.bottom + GAP,
      left,
      width,
      maxHeight: Math.max(maxHeight, 160),
      above,
    });
  }, [preferredHeight, minWidth]);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (open) measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, close, measure]);

  const panelStyle: React.CSSProperties | undefined = placement
    ? {
        position: "fixed",
        left: placement.left,
        width: placement.width,
        maxHeight: placement.maxHeight,
        ...(placement.above
          ? { bottom: window.innerHeight - placement.top, transformOrigin: "bottom" }
          : { top: placement.top, transformOrigin: "top" }),
      }
    : { position: "fixed", visibility: "hidden" };

  return { triggerRef, panelRef, open, setOpen, close, panelStyle };
}
