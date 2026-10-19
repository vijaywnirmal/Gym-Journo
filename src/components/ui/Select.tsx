"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/Icon";
import { usePopover } from "./usePopover";

export type SelectOption = {
  value: string;
  label: string;
  /** Secondary text shown under the label in the list (e.g. equipment). */
  hint?: string;
  /** Options sharing a group are listed under that heading. */
  group?: string;
};

type Size = "sm" | "md" | "lg";

const TRIGGER_SIZE: Record<Size, string> = {
  sm: "h-8 gap-1 rounded-lg px-2.5 text-sm",
  md: "h-10 gap-2 rounded-[10px] px-3 text-sm",
  lg: "h-11 gap-2 rounded-[10px] px-3.5 text-base",
};

// Long lists get a search box; short ones are picked with the keyboard or a tap.
const SEARCH_THRESHOLD = 12;

// A listbox in place of the browser's <select>: same look on every platform and in both themes,
// searchable when long, fully keyboard operable (arrows, Home/End, Enter, Escape, type-ahead) and
// announced as a combobox/listbox pair.
export default function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  ariaLabel,
  size = "md",
  className = "",
  disabled = false,
  searchable,
  searchPlaceholder = "Search",
  emptyText = "No matches",
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  size?: Size;
  className?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const withSearch = searchable ?? options.length > SEARCH_THRESHOLD;
  const { triggerRef, panelRef, open, setOpen, close, panelStyle } = usePopover({
    preferredHeight: withSearch ? 380 : 300,
    minWidth: withSearch ? 260 : 160,
  });
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", at: 0 });

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q));
  }, [options, query]);

  // Opening clears the search and highlights the current choice.
  function toggle() {
    if (!open) {
      setQuery("");
      const index = options.findIndex((o) => o.value === value);
      setActive(index >= 0 ? index : 0);
    }
    setOpen(!open);
  }

  // Once open, the search box (or the list) takes focus.
  useEffect(() => {
    if (open) requestAnimationFrame(() => (withSearch ? searchRef.current : listRef.current)?.focus());
  }, [open, withSearch]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(option: SelectOption | undefined) {
    if (!option) return;
    onChange(option.value);
    close();
  }

  function onListKey(e: KeyboardEvent) {
    const last = filtered.length - 1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(last, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(last);
    } else if (e.key === "Enter" || (e.key === " " && !withSearch)) {
      e.preventDefault();
      choose(filtered[active]);
    } else if (e.key === "Tab") {
      close(false);
    } else if (!withSearch && e.key.length === 1) {
      const now = Date.now();
      const t = typeahead.current;
      t.text = now - t.at > 600 ? e.key.toLowerCase() : t.text + e.key.toLowerCase();
      t.at = now;
      const match = filtered.findIndex((o) => o.label.toLowerCase().startsWith(t.text));
      if (match >= 0) setActive(match);
    }
  }

  function onTriggerKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) toggle();
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={onTriggerKey}
        className={`control inline-flex min-w-0 items-center justify-between text-left ${TRIGGER_SIZE[size]} ${className}`}
      >
        <span className={`truncate ${selected ? "text-label" : "text-label-3"}`}>
          {selected?.label ?? placeholder}
        </span>
        <Icon name="chevronUpDown" className="size-4 shrink-0 text-label-3" strokeWidth={2} />
      </button>

      {open &&
        createPortal(
          <div ref={panelRef} style={panelStyle} className="popover z-50 flex flex-col overflow-hidden">
            {withSearch && (
              <div className="border-b border-separator p-2">
                <div className="flex items-center gap-2 rounded-lg bg-fill px-2.5">
                  <Icon name="search" className="size-4 shrink-0 text-label-3" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActive(0);
                    }}
                    onKeyDown={onListKey}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    aria-controls={listId}
                    aria-activedescendant={filtered[active] ? `${id}-opt-${active}` : undefined}
                    className="h-9 w-full bg-transparent text-sm text-label placeholder-label-3 outline-none focus:shadow-none"
                  />
                </div>
              </div>
            )}
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-label={ariaLabel}
              aria-activedescendant={filtered[active] ? `${id}-opt-${active}` : undefined}
              onKeyDown={onListKey}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1 outline-none focus:shadow-none"
            >
              {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-label-3">{emptyText}</li>}
              {filtered.map((option, i) => {
                const heading = option.group && option.group !== filtered[i - 1]?.group ? option.group : null;
                const isSelected = option.value === value;
                return (
                  <li key={option.value || "__empty"} role="presentation">
                    {heading && (
                      <p className="px-2.5 pt-3 pb-1 text-xs font-medium text-label-3" aria-hidden>
                        {heading}
                      </p>
                    )}
                    <div
                      id={`${id}-opt-${i}`}
                      role="option"
                      aria-selected={isSelected}
                      data-index={i}
                      onPointerMove={() => setActive(i)}
                      onClick={() => choose(option)}
                      className={`flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm ${
                        i === active ? "bg-fill" : ""
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate ${isSelected ? "font-medium text-label" : "text-label"}`}>
                          {option.label}
                        </span>
                        {option.hint && <span className="block truncate text-xs text-label-3">{option.hint}</span>}
                      </span>
                      {isSelected && <Icon name="checkmark" className="size-4 shrink-0 text-link" strokeWidth={2.25} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
}
