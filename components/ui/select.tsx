"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useAnchoredPanel, useDismiss } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string; disabled?: boolean };

/** Lists longer than this get a filter box at the top of the menu. */
const SEARCH_THRESHOLD = 12;

const triggerSize = {
  md: "h-9 rounded-md border px-3 text-sm shadow-[var(--shadow-soft)]",
  sm: "h-7 rounded-md border px-2 text-xs font-medium",
};

/**
 * Listbox-style dropdown that matches the app's fields. Controlled (`value` + `onValueChange`)
 * or uncontrolled (`defaultValue`); pass `name` to submit the value with a form.
 */
export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  id,
  placeholder = "Select…",
  disabled,
  size = "md",
  searchable,
  className,
  "aria-label": ariaLabel,
}: {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: keyof typeof triggerSize;
  searchable?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = value ?? inner;
  const selected = options.find((o) => o.value === current);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", at: 0 });
  const listId = useId();

  const withSearch = searchable ?? options.length > SEARCH_THRESHOLD;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  function openMenu(at?: number) {
    if (disabled) return;
    setActive(at ?? Math.max(0, options.findIndex((o) => o.value === current)));
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    setQuery("");
    if (refocus) triggerRef.current?.focus();
  }

  function choose(opt: SelectOption | undefined) {
    if (!opt || opt.disabled) return;
    if (value === undefined) setInner(opt.value);
    if (opt.value !== current) onValueChange?.(opt.value);
    close();
  }

  function step(from: number, dir: 1 | -1) {
    for (let i = from + dir; i >= 0 && i < filtered.length; i += dir) {
      if (!filtered[i].disabled) return i;
    }
    return from;
  }

  /** Native-select style type-to-jump: repeated keystrokes build a prefix for a short moment. */
  function jump(char: string, from: number) {
    const now = Date.now();
    const t = typeahead.current;
    t.text = now - t.at > 600 ? char : t.text + char;
    t.at = now;
    const prefix = t.text.toLowerCase();
    const start = t.text.length === 1 ? from + 1 : from;
    for (let k = 0; k < filtered.length; k++) {
      const i = (start + k + filtered.length) % filtered.length;
      if (!filtered[i].disabled && filtered[i].label.toLowerCase().startsWith(prefix)) return i;
    }
    return -1;
  }

  function onKeyDown(e: KeyboardEvent) {
    const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      } else if (printable && !withSearch) {
        const base = Math.max(0, options.findIndex((o) => o.value === current));
        const hit = jump(e.key, base);
        openMenu(hit >= 0 ? hit : base);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => step(i, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => step(i, -1));
        break;
      case "Home":
        e.preventDefault();
        setActive(step(-1, 1));
        break;
      case "End":
        e.preventDefault();
        setActive(step(filtered.length, -1));
        break;
      case "Enter":
        e.preventDefault();
        choose(filtered[active]);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        close(false);
        break;
      default:
        if (e.key === " " && !withSearch) {
          e.preventDefault();
          choose(filtered[active]);
        } else if (printable && !withSearch) {
          const hit = jump(e.key, active);
          if (hit >= 0) setActive(hit);
        }
    }
  }

  const menuStyle = useAnchoredPanel(open, triggerRef, { minWidth: size === "sm" ? 176 : 0 });
  useDismiss(open, [triggerRef, menuRef], () => close(false));

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, menuStyle]);

  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && !withSearch && filtered[active] ? optionId(active) : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        className={cn(
          "flex w-full min-w-0 items-center justify-between gap-2 border-border bg-surface text-left text-fg outline-none transition-[border-color,box-shadow] hover:border-border-strong focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/15 disabled:pointer-events-none disabled:opacity-60",
          triggerSize[size],
          size === "sm" && "text-muted",
          open && "border-brand ring-3 ring-brand/15 hover:border-brand",
          className,
        )}
      >
        <span className={cn("truncate", !selected && "text-subtle")}>{selected?.label ?? placeholder}</span>
        <ChevronDown
          className={cn(
            "shrink-0 text-subtle transition-transform duration-200 ease-[var(--ease-snappy)]",
            size === "sm" ? "size-3.5" : "size-4",
            open && "rotate-180",
          )}
        />
      </button>
      {name && <input type="hidden" name={name} value={current} />}

      {open &&
        menuStyle &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            onMouseDown={(e) => {
              // Keep focus on the trigger (or search box) while clicking options.
              if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
            }}
            className="z-50 flex animate-[menu-in_120ms_var(--ease-snappy)] flex-col overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-[var(--shadow-lift)]"
          >
            {withSearch && (
              <div className="relative -mx-1 -mt-1 mb-1 shrink-0 border-b border-border">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-subtle" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onKeyDown}
                  placeholder="Search…"
                  aria-label="Filter options"
                  aria-controls={listId}
                  aria-activedescendant={filtered[active] ? optionId(active) : undefined}
                  className="h-9 w-full bg-transparent pr-3 pl-8 text-[13px] text-fg outline-none placeholder:text-subtle"
                />
              </div>
            )}
            <ul ref={listRef} id={listId} role="listbox" aria-label={ariaLabel} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {filtered.map((opt, i) => {
                const isSelected = opt.value === current;
                return (
                  <li
                    key={opt.value}
                    id={optionId(i)}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled || undefined}
                    data-index={i}
                    onPointerMove={() => !opt.disabled && active !== i && setActive(i)}
                    onClick={() => choose(opt)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-[13px] text-fg",
                      size === "sm" && "py-1 text-xs",
                      i === active && "bg-surface-2",
                      isSelected && "font-medium",
                      opt.disabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check className="size-3.5 shrink-0 text-brand" strokeWidth={2.5} />}
                  </li>
                );
              })}
              {filtered.length === 0 && <li className="px-3 py-5 text-center text-[13px] text-subtle">No matches</li>}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}
