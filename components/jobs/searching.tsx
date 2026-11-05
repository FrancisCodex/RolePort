"use client";

import { Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";

/*
 * What a job search shows while it runs. Searches ask many job boards at once and some are slow,
 * so instead of grey boxes alone: what's being searched, a moving bar, the seconds so far and what
 * RolePort is doing, then a list taking shape below.
 */

const STEPS = [
  "Asking the job boards that cover this search",
  "Checking remote-job feeds and official boards",
  "Searching the bigger job sites",
  "Removing postings listed on more than one board",
  "Leaving out old and expired postings",
  "Ranking what's left by how well it fits you",
];

/** Seconds since this mounted, ticking once a second. */
function useSeconds() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  return seconds;
}

/** The full loading screen for a job search: nothing has come back yet. */
export function SearchingJobs({ query, place }: { query?: string; place?: string }) {
  const seconds = useSeconds();
  const step = STEPS[Math.min(STEPS.length - 1, Math.floor(seconds / 2.5))];

  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite" aria-label="Searching for jobs">
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-soft)]">
        <div className="flex items-start gap-3.5 p-4">
          <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink">
            <span className="absolute inset-0 animate-[ping-soft_1.6s_ease-out_infinite] rounded-full bg-brand/30" />
            <Search className="relative size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-pretty">
              {query ? (
                <>
                  Searching for <span className="text-brand-ink">{query}</span> jobs{place ? ` in ${place}` : ""}
                </>
              ) : (
                `Searching for jobs${place ? ` in ${place}` : ""}`
              )}
            </p>
            <p key={step} className="mt-0.5 animate-[rise_0.4s_var(--ease-snappy)_both] text-[13px] text-muted">
              {step}…
            </p>
          </div>
          <span className="shrink-0 text-xs text-subtle tabular-nums">{seconds}s</span>
        </div>
        <div className="h-1 overflow-hidden bg-surface-3">
          <div className="h-full w-2/5 animate-[searching_1.4s_ease-in-out_infinite] rounded-full bg-brand" />
        </div>
        {seconds >= 8 && (
          <p className="border-t border-border px-4 py-2 text-xs text-muted">
            Some job sites are slow to answer. Results from the quick ones show first, and the rest join the list when they&apos;re in.
          </p>
        )}
      </div>
      <CardsTakingShape />
    </div>
  );
}

/** Placeholder result cards, fading in one after another. */
function CardsTakingShape() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="flex animate-[rise_0.6s_var(--ease-snappy)_both] gap-3 rounded-xl border border-border bg-surface p-4"
          style={{ animationDelay: `${150 + i * 120}ms` }}
        >
          <span className="size-9 animate-pulse rounded-md bg-surface-3" />
          <div className="flex flex-1 flex-col gap-2">
            <span className="h-4 w-2/3 animate-pulse rounded-full bg-surface-3" />
            <span className="h-3 w-1/3 animate-pulse rounded-full bg-surface-3" />
            <span className="h-3 w-1/2 animate-pulse rounded-full bg-surface-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Above results that are already showing: the boards still being searched. */
export function StillSearching({ sources }: { sources: string[] }) {
  const seconds = useSeconds();
  const names =
    sources.length <= 3 ? sources.join(", ") : `${sources.slice(0, 3).join(", ")} and ${sources.length - 3} more`;
  return (
    <div role="status" aria-live="polite" className="overflow-hidden rounded-lg border border-brand/25 bg-brand-soft/50">
      <p className="flex items-center gap-2 px-3 py-2 text-[13px] text-fg">
        <Loader2 className="size-3.5 shrink-0 animate-spin text-brand-ink" />
        <span className="min-w-0 flex-1">
          Still searching <span className="font-medium">{names}</span>. More jobs join this list when they&apos;re in.
        </span>
        <span className="shrink-0 text-xs text-subtle tabular-nums">{seconds}s</span>
      </p>
      <div className="h-0.5 overflow-hidden">
        <div className="h-full w-2/5 animate-[searching_1.4s_ease-in-out_infinite] bg-brand" />
      </div>
    </div>
  );
}
