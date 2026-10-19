"use client";

import { Maximize2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const DURATION_MS = 320;
const DESKTOP = "(min-width: 1280px)";

/**
 * The selected job beside the results, like a job board's split view. On large screens
 * it's a sticky pane next to the list; on smaller ones the same content slides in as a
 * drawer that closes by going back in history, so the URL and back button stay in sync.
 */
export function JobPanel({
  children,
  jobId,
  closable = true,
  desktopOnly = false,
}: {
  children: ReactNode;
  jobId: string;
  /** Opened by a click (an intercepted /jobs/[id]): on small screens it can be closed. */
  closable?: boolean;
  /** The first result shown by default: only in the desktop pane, never as a drawer. */
  desktopOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const closing = useRef(false);
  const panel = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    if (closing.current || window.matchMedia(DESKTOP).matches) return;
    closing.current = true;
    setOpen(false);
    setTimeout(() => router.back(), DURATION_MS);
  }, [router]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true));
    // A drawer locks the page behind it; the desktop pane scrolls on its own.
    const isDrawer = !desktopOnly && !window.matchMedia(DESKTOP).matches;
    const previous = document.body.style.overflow;
    if (isDrawer) {
      document.body.style.overflow = "hidden";
      panel.current?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closable) close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [close, closable, desktopOnly]);

  return (
    <div
      className={cn("fixed inset-0 z-50 xl:sticky xl:inset-auto xl:top-6 xl:z-auto", desktopOnly && "hidden xl:block")}
      role="presentation"
    >
      <div
        aria-hidden
        onClick={closable ? close : undefined}
        className={cn(
          "absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none xl:hidden",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        ref={panel}
        role="region"
        aria-label="Job details"
        tabIndex={-1}
        style={{ transitionDuration: `${DURATION_MS}ms` }}
        className={cn(
          // Drawer (small screens)
          "absolute inset-y-0 right-0 flex w-full flex-col bg-bg shadow-[var(--shadow-lift)] outline-none sm:max-w-xl sm:rounded-l-3xl sm:border-l sm:border-border",
          "transition-transform ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform motion-reduce:transition-none",
          open ? "translate-x-0" : "translate-x-full",
          // Pane (desktop)
          "xl:relative xl:inset-auto xl:h-[calc(100dvh-3rem)] xl:max-w-none xl:translate-x-0 xl:overflow-hidden xl:rounded-3xl xl:border xl:border-border xl:bg-surface xl:shadow-[var(--shadow-soft)] xl:transition-none",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-3 sm:px-4">
          {closable ? (
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="grid size-10 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-fg xl:hidden"
            >
              <X className="size-5" />
            </button>
          ) : (
            <span />
          )}
          <span className="hidden text-xs font-semibold tracking-wider text-subtle uppercase xl:block">Job details</span>
          {/* A plain link on purpose: a client-side navigation would be intercepted into the panel again. */}
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
