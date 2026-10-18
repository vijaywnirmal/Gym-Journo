"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  addDays,
  addMonths,
  format,
  getDay,
  getDaysInMonth,
  parseISO,
  setYear,
  startOfMonth,
} from "date-fns";
import Icon from "@/components/Icon";
import { DATE_FMT, formatDateLong } from "@/lib/date";
import { usePopover } from "./usePopover";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

// A date picker that replaces <input type="date">: a calendar in a popover with month paging, a
// year list for far-away dates (birthdays), min/max bounds, and arrow-key navigation over the days.
// Value is yyyy-MM-dd, or "" for none.
export default function DateField({
  value,
  onChange,
  min,
  max,
  placeholder = "Select a date",
  ariaLabel,
  className = "",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { triggerRef, panelRef, open, setOpen, close, panelStyle } = usePopover({
    preferredHeight: 380,
    minWidth: 296,
  });
  const fallback = max && max < format(new Date(), DATE_FMT) ? max : format(new Date(), DATE_FMT);
  const [month, setMonth] = useState(() => startOfMonth(parseISO(value || fallback)));
  const [focusDate, setFocusDate] = useState(value || fallback);
  const [view, setView] = useState<"days" | "years">("days");
  const gridRef = useRef<HTMLDivElement>(null);
  const yearListRef = useRef<HTMLDivElement>(null);

  // Opening always starts on the selected date (or today) in the day grid.
  function toggle() {
    if (!open) {
      const start = value || fallback;
      setMonth(startOfMonth(parseISO(start)));
      setFocusDate(start);
      setView("days");
    }
    setOpen(!open);
  }

  useEffect(() => {
    if (!open) return;
    if (view === "days") {
      requestAnimationFrame(() =>
        gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`)?.focus()
      );
    } else {
      requestAnimationFrame(() =>
        yearListRef.current?.querySelector<HTMLElement>("[aria-current=true]")?.scrollIntoView({ block: "center" })
      );
    }
  }, [open, view, focusDate]);

  const inRange = (d: string) => (!min || d >= min) && (!max || d <= max);

  function pick(d: string) {
    if (!inRange(d)) return;
    onChange(d);
    close();
  }

  function moveFocus(days: number) {
    const next = format(addDays(parseISO(focusDate), days), DATE_FMT);
    setFocusDate(next);
    const nextMonth = startOfMonth(parseISO(next));
    if (nextMonth.getTime() !== month.getTime()) setMonth(nextMonth);
  }

  function onGridKey(e: KeyboardEvent) {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in moves) {
      e.preventDefault();
      moveFocus(moves[e.key]);
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const next = format(addMonths(parseISO(focusDate), e.key === "PageUp" ? -1 : 1), DATE_FMT);
      setFocusDate(next);
      setMonth(startOfMonth(parseISO(next)));
    }
  }

  const leading = getDay(month);
  const days = Array.from({ length: getDaysInMonth(month) }, (_, i) => format(addDays(month, i), DATE_FMT));
  const today = format(new Date(), DATE_FMT);
  const minYear = min ? parseISO(min).getFullYear() : month.getFullYear() - 100;
  const maxYear = max ? parseISO(max).getFullYear() : month.getFullYear() + 10;
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);
  const prevDisabled = !!min && format(addDays(month, -1), DATE_FMT) < min;
  const nextDisabled = !!max && format(addMonths(month, 1), DATE_FMT) > max;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ? `${ariaLabel}${value ? `: ${formatDateLong(value)}` : ""}` : undefined}
        disabled={disabled}
        onClick={toggle}
        className={`control inline-flex h-11 w-full items-center justify-between gap-2 rounded-[10px] px-3.5 text-left text-base ${className}`}
      >
        <span className={value ? "text-label" : "text-label-3"}>{value ? formatDateLong(value) : placeholder}</span>
        <Icon name="calendar" className="size-4 shrink-0 text-label-3" />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={panelStyle}
            role="dialog"
            aria-label={ariaLabel ?? "Choose a date"}
            className="popover z-50 flex flex-col p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setView(view === "days" ? "years" : "days")}
                aria-label={view === "days" ? "Choose year" : "Back to days"}
                className="flex h-8 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-label hover:bg-fill"
              >
                {format(month, "MMMM yyyy")}
                <Icon
                  name="chevronDown"
                  className={`size-3.5 text-label-3 transition-transform ${view === "years" ? "rotate-180" : ""}`}
                  strokeWidth={2.5}
                />
              </button>
              {view === "days" && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label="Previous month"
                    disabled={prevDisabled}
                    onClick={() => setMonth(addMonths(month, -1))}
                    className="grid size-8 place-items-center rounded-lg text-label-2 hover:bg-fill disabled:opacity-30"
                  >
                    <Icon name="chevronLeft" className="size-4" strokeWidth={2.25} />
                  </button>
                  <button
                    type="button"
                    aria-label="Next month"
                    disabled={nextDisabled}
                    onClick={() => setMonth(addMonths(month, 1))}
                    className="grid size-8 place-items-center rounded-lg text-label-2 hover:bg-fill disabled:opacity-30"
                  >
                    <Icon name="chevronRight" className="size-4" strokeWidth={2.25} />
                  </button>
                </div>
              )}
            </div>

            {view === "years" ? (
              <div ref={yearListRef} className="grid max-h-64 grid-cols-4 gap-1 overflow-y-auto overscroll-contain">
                {years.map((y) => {
                  const current = y === month.getFullYear();
                  return (
                    <button
                      key={y}
                      type="button"
                      aria-current={current}
                      onClick={() => {
                        const next = setYear(month, y);
                        setMonth(next);
                        setFocusDate(format(next, DATE_FMT));
                        setView("days");
                      }}
                      className={`h-9 rounded-lg text-sm tabular-nums ${
                        current ? "bg-accent font-semibold text-on-accent" : "text-label hover:bg-fill"
                      }`}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-label-3" aria-hidden>
                  {WEEKDAYS.map((d, i) => (
                    <span key={i} className="py-1">
                      {d}
                    </span>
                  ))}
                </div>
                <div ref={gridRef} role="grid" onKeyDown={onGridKey} className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: leading }, (_, i) => (
                    <span key={`pad-${i}`} />
                  ))}
                  {days.map((d) => {
                    const selected = d === value;
                    const allowed = inRange(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        role="gridcell"
                        data-date={d}
                        tabIndex={d === focusDate ? 0 : -1}
                        aria-selected={selected}
                        aria-label={formatDateLong(d)}
                        disabled={!allowed}
                        onClick={() => pick(d)}
                        className={`h-9 rounded-lg text-sm tabular-nums ${
                          selected
                            ? "bg-accent font-semibold text-on-accent"
                            : d === today
                              ? "font-semibold text-link hover:bg-fill"
                              : "text-label hover:bg-fill"
                        } disabled:pointer-events-none disabled:opacity-25`}
                      >
                        {parseISO(d).getDate()}
                      </button>
                    );
                  })}
                </div>
                {inRange(today) && (
                  <button
                    type="button"
                    onClick={() => pick(today)}
                    className="mt-2 h-8 self-start rounded-lg px-2 text-sm font-medium text-link hover:bg-fill"
                  >
                    Today
                  </button>
                )}
              </>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
