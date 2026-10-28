"use client";

import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAnchoredPanel, useDismiss, usePortalTarget } from "@/components/ui/popover";
import {
  MIN_YEAR,
  MONTH_NAMES,
  formatMonthYear,
  maxYear,
  monthIndex,
  parseMonthYear,
  toStored,
  type MonthYear,
} from "@/lib/profile/dates";
import { cn } from "@/lib/utils";

const YEARS_PER_PAGE = 12;

/**
 * Month + year picker for CV-style dates. Values are "YYYY-MM" or "YYYY" strings.
 * `onChange(null)` means cleared, or "Present" when `allowPresent` is set.
 */
export function MonthPicker({
  value,
  onChange,
  id,
  placeholder = "Pick a month",
  allowPresent,
  min,
  invalid,
  "aria-label": ariaLabel,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  id?: string;
  placeholder?: string;
  /** For end dates: offers "Present", and shows an empty value as "Present". */
  allowPresent?: boolean;
  /** Months before this one are disabled (e.g. an end date before its start). */
  min?: string | null;
  invalid?: boolean;
  "aria-label"?: string;
}) {
  const parsed = parseMonthYear(value);
  const minDate = parseMonthYear(min);
  const today = new Date();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"months" | "years">("months");
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const panelStyle = useAnchoredPanel(open, triggerRef, { width: 296, maxHeight: 420, roomNeeded: 340 });
  const portalTarget = usePortalTarget(open, triggerRef);
  useDismiss(open, [triggerRef, panelRef], () => setOpen(false));

  function openPanel() {
    setViewYear(parsed?.year ?? minDate?.year ?? today.getFullYear());
    setMode("months");
    setOpen(true);
    // Land keyboard focus on the chosen month (or this month) once the panel renders.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const grid = gridRef.current;
        (grid?.querySelector<HTMLButtonElement>("[aria-pressed=true]") ??
          grid?.querySelector<HTMLButtonElement>("[data-today]") ??
          grid?.querySelector<HTMLButtonElement>("button:not(:disabled)"))?.focus();
      }),
    );
  }

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function pick(next: string | null) {
    onChange(next);
    close();
  }

  const beforeMin = (d: MonthYear) => !!minDate && monthIndex(d, "end") < monthIndex(minDate, "start");

  /** Arrow keys move through the grid like a calendar; Escape closes. */
  function onGridKeyDown(e: KeyboardEvent) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[e.key];
    if (!step) return;
    const buttons = [...(gridRef.current?.querySelectorAll<HTMLButtonElement>("[data-cell]") ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    let i = at + step;
    while (buttons[i]?.disabled) i += step;
    buttons[i]?.focus();
  }

  const display = formatMonthYear(value) ?? (allowPresent && !value ? "Present" : value || null);
  const yearPageStart = viewYear - ((viewYear - MIN_YEAR) % YEARS_PER_PAGE);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={(e) => {
          if (!open && e.key === "ArrowDown") {
            e.preventDefault();
            openPanel();
          }
        }}
        className={cn(
          "flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-border bg-surface px-3 text-left text-sm text-fg shadow-[var(--shadow-soft)] outline-none transition-[border-color,box-shadow] hover:border-border-strong focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/15",
          open && "border-brand ring-3 ring-brand/15 hover:border-brand",
          invalid && "border-danger hover:border-danger",
        )}
      >
        <CalendarDays className="size-3.5 shrink-0 text-subtle" />
        <span className={cn("flex-1 truncate", !display && "text-subtle")}>
          {display === "Present" ? (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="size-1.5 rounded-full bg-success" /> Present
            </span>
          ) : (
            (display ?? placeholder)
          )}
        </span>
      </button>

      {open &&
        panelStyle &&
        portalTarget &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={ariaLabel ?? "Choose a month"}
            style={panelStyle}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                close();
              }
            }}
            className="z-50 flex animate-[menu-in_120ms_var(--ease-snappy)] flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-surface p-2 shadow-[var(--shadow-lift)]"
          >
            <div className="flex items-center justify-between gap-2">
              <NavButton
                label={mode === "months" ? "Previous year" : "Earlier years"}
                disabled={mode === "months" ? viewYear <= MIN_YEAR : yearPageStart <= MIN_YEAR}
                onClick={() => setViewYear((y) => Math.max(MIN_YEAR, y - (mode === "months" ? 1 : YEARS_PER_PAGE)))}
              >
                <ChevronLeft />
              </NavButton>
              <button
                type="button"
                onClick={() => setMode(mode === "months" ? "years" : "months")}
                aria-label={mode === "months" ? `${viewYear}, choose a year` : "Back to months"}
                className="rounded-md px-2.5 py-1 text-[13px] font-semibold tabular-nums transition-colors hover:bg-surface-2"
              >
                {mode === "months" ? viewYear : `${yearPageStart} – ${Math.min(yearPageStart + YEARS_PER_PAGE - 1, maxYear())}`}
              </button>
              <NavButton
                label={mode === "months" ? "Next year" : "Later years"}
                disabled={mode === "months" ? viewYear >= maxYear() : yearPageStart + YEARS_PER_PAGE > maxYear()}
                onClick={() => setViewYear((y) => Math.min(maxYear(), y + (mode === "months" ? 1 : YEARS_PER_PAGE)))}
              >
                <ChevronRight />
              </NavButton>
            </div>

            <div ref={gridRef} onKeyDown={onGridKeyDown} className="grid grid-cols-3 gap-1">
              {mode === "months"
                ? MONTH_NAMES.map((name, i) => {
                    const d = { year: viewYear, month: i + 1 };
                    const selected = parsed?.year === viewYear && parsed.month === i + 1;
                    const isToday = viewYear === today.getFullYear() && i === today.getMonth();
                    return (
                      <Cell
                        key={name}
                        selected={selected}
                        today={isToday}
                        disabled={beforeMin(d)}
                        onClick={() => pick(toStored(d))}
                        label={`${name} ${viewYear}`}
                      >
                        {name}
                      </Cell>
                    );
                  })
                : Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearPageStart + i).map((year) => (
                    <Cell
                      key={year}
                      selected={parsed?.year === year}
                      today={year === today.getFullYear()}
                      disabled={year > maxYear() || (!!minDate && year < minDate.year)}
                      onClick={() => {
                        setViewYear(year);
                        setMode("months");
                      }}
                    >
                      {year}
                    </Cell>
                  ))}
            </div>

            <div className="flex items-center gap-1 border-t border-border pt-2">
              <FooterButton
                onClick={() => pick(String(viewYear))}
                disabled={beforeMin({ year: viewYear, month: null })}
                active={!!parsed && parsed.month == null && parsed.year === viewYear}
              >
                Just {viewYear}
              </FooterButton>
              <span className="flex-1" />
              {allowPresent ? (
                <FooterButton onClick={() => pick(null)} active={!value}>
                  Present
                </FooterButton>
              ) : (
                value && <FooterButton onClick={() => pick(null)}>Clear</FooterButton>
              )}
            </div>
          </div>,
          portalTarget,
        )}
    </>
  );
}

/** Start and end months side by side; the end can be "Present" and can't come before the start. */
export function MonthRangePicker({
  start,
  end,
  onChange,
  startLabel = "Start",
  endLabel = "End",
}: {
  start: string;
  end: string | null;
  onChange: (range: { start: string; end: string | null }) => void;
  startLabel?: string;
  endLabel?: string;
}) {
  const s = parseMonthYear(start);
  const e = parseMonthYear(end);
  const backwards = !!s && !!e && monthIndex(e, "end") < monthIndex(s, "start");
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <MonthPicker aria-label={startLabel} placeholder={startLabel} value={start || null} onChange={(v) => onChange({ start: v ?? "", end })} />
        <ArrowRight className="size-4 text-subtle" aria-hidden />
        <MonthPicker aria-label={endLabel} allowPresent min={start || null} invalid={backwards} value={end} onChange={(v) => onChange({ start, end: v })} />
      </div>
      {backwards && <p className="text-xs text-danger">The end date is before the start date.</p>}
    </div>
  );
}

function Cell({
  selected,
  today,
  disabled,
  onClick,
  label,
  children,
}: {
  selected: boolean;
  today: boolean;
  disabled: boolean;
  onClick: () => void;
  label?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-cell
      data-today={today || undefined}
      aria-pressed={selected}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-8 rounded-md text-[13px] font-medium tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 disabled:pointer-events-none disabled:opacity-30",
        selected
          ? "bg-brand text-brand-fg"
          : cn("text-fg hover:bg-surface-2", today && "text-brand-ink ring-1 ring-border-strong ring-inset"),
      )}
    >
      {children}
    </button>
  );
}

function NavButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-30 [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

function FooterButton({ onClick, disabled, active, children }: { onClick: () => void; disabled?: boolean; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-30",
        active ? "bg-brand-soft text-brand-ink" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
