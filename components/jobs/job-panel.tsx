"use client";

import { Maximize2, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const DESKTOP = "(min-width: 1280px)";

/**
 * The selected job beside the results, like a job board's split view. On wide screens it's
 * a sticky pane next to the list; on smaller ones the same panel slides in as a drawer when
 * a job is opened and slides away on close.
 */
export function JobPanel({
  jobId,
  drawerOpen,
  onClose,
  children,
}: {
  jobId: string;
  /** Small screens only: whether the drawer is showing. The desktop pane is always visible. */
  drawerOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!drawerOpen || window.matchMedia(DESKTOP).matches) return;
    // The drawer locks the page behind it; the desktop pane scrolls on its own.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 xl:sticky xl:inset-auto xl:top-6 xl:z-auto",
        // Closed drawer: no clicks, and hidden from keyboard and screen readers once it has slid away.
        !drawerOpen && "pointer-events-none max-xl:invisible max-xl:transition-[visibility] max-xl:delay-300 xl:pointer-events-auto",
      )}
    >
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none xl:hidden",
          drawerOpen ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        ref={panel}
        role="region"
        aria-label="Job details"
        tabIndex={-1}
        className={cn(
          // Drawer (small screens)
          "absolute inset-y-0 right-0 flex w-full flex-col bg-bg shadow-[var(--shadow-lift)] outline-none sm:max-w-xl sm:rounded-l-3xl sm:border-l sm:border-border",
          "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform motion-reduce:transition-none",
          drawerOpen ? "translate-x-0" : "translate-x-full",
          // Pane (wide screens)
          "xl:relative xl:inset-auto xl:h-[calc(100dvh-3rem)] xl:max-w-none xl:translate-x-0 xl:overflow-hidden xl:rounded-3xl xl:border xl:border-border xl:bg-surface xl:shadow-[var(--shadow-soft)] xl:transition-none",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-3 sm:px-4">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-10 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-fg xl:hidden"
          >
            <X className="size-5" />
          </button>
          <span className="hidden text-xs font-semibold tracking-wider text-subtle uppercase xl:block">Job details</span>
          <a
            href={`/jobs/${jobId}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <Maximize2 className="size-4" /> Open full page
          </a>
        </div>
        {/* Keyed by job so the scroll position resets and the content eases in when the selection changes. */}
        <div
          key={jobId}
          className="flex-1 animate-[pane-in_240ms_ease-out] overflow-y-auto overscroll-contain px-3 py-4 motion-reduce:animate-none sm:px-5 sm:py-5 xl:bg-bg"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
