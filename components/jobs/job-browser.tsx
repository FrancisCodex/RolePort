"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { createContext, use, useCallback, useRef, useState, type ReactNode } from "react";
import type { JobListItem } from "@/lib/jobs/data";
import { cn } from "@/lib/utils";
import { JobDetailView, type SourceCredit } from "./job-detail";
import { JobPanel } from "./job-panel";

/**
 * Job board split view: the results on the left and the selected job's details on the right
 * (a drawer on smaller screens). The page already has every result's data, so switching jobs
 * is instant and never leaves the list. "Open full page" links to /jobs/[id].
 * The list shows one page of cards at a time so long searches stay quick to render.
 */

export const PAGE_SIZE = 20;

type JobBrowserState = {
  selectedId: string | null;
  /** Show this job in the panel (and open the drawer on small screens). */
  select: (id: string) => void;
};

const JobBrowserContext = createContext<JobBrowserState | null>(null);

/** The split view's state, or null outside it (a job card then just links to the job page). */
export function useJobBrowser() {
  return use(JobBrowserContext);
}

export function JobBrowser({
  jobs,
  aiEnabled,
  sources,
  cards,
}: {
  jobs: JobListItem[];
  aiEnabled: boolean;
  sources: Record<string, SourceCredit>;
  /** One result card per job, in the same order as `jobs`. */
  cards: ReactNode[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(jobs[0]?.id ?? null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(0);
  const listTop = useRef<HTMLDivElement>(null);

  const pages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE));
  // After a refresh the list may be shorter: stay on a page that exists.
  const current = Math.min(page, pages - 1);
  const start = current * PAGE_SIZE;
  const pageJobs = jobs.slice(start, start + PAGE_SIZE);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setDrawerOpen(true);
  }, []);
  const close = useCallback(() => setDrawerOpen(false), []);

  function goTo(next: number) {
    setPage(next);
    // The panel follows to the new page, so it never shows a job that isn't listed.
    setSelectedId(jobs[next * PAGE_SIZE]?.id ?? null);
    listTop.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  // After a refresh (e.g. a new evaluation) the list may change: fall back to the page's first job.
  const job = jobs.find((j) => j.id === selectedId) ?? pageJobs[0];

  return (
    <JobBrowserContext value={{ selectedId: job?.id ?? null, select }}>
      <div ref={listTop} data-wide className="scroll-mt-4 xl:grid xl:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] xl:items-start xl:gap-5">
        <div className="flex flex-col gap-3">
          {cards.slice(start, start + PAGE_SIZE)}
          {pages > 1 && <Pager page={current} pages={pages} total={jobs.length} onChange={goTo} />}
        </div>
        {job && (
          <JobPanel jobId={job.id} drawerOpen={drawerOpen} onClose={close}>
            <JobDetailView job={job} aiEnabled={aiEnabled} variant="panel" source={sources[job.source] ?? null} />
          </JobPanel>
        )}
      </div>
    </JobBrowserContext>
  );
}

/** Page numbers with the first, last and neighbours of the current page; gaps become "…". */
function pageList(page: number, pages: number): (number | "gap")[] {
  const keep = new Set([0, pages - 1, page - 1, page, page + 1].filter((p) => p >= 0 && p < pages));
  const sorted = [...keep].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ["gap" as const, p] : [p]));
}

function Pager({ page, pages, total, onChange }: { page: number; pages: number; total: number; onChange: (page: number) => void }) {
  const from = page * PAGE_SIZE + 1;
  const to = Math.min(total, from + PAGE_SIZE - 1);
  const step = "grid h-8 min-w-8 place-items-center rounded-md px-2 text-[13px] font-medium transition-colors";

  return (
    <nav aria-label="Result pages" className="flex flex-wrap items-center justify-between gap-2 pt-1">
      <span className="text-xs text-subtle tabular-nums">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page === 0}
          aria-label="Previous page"
          className={cn(step, "text-muted hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-40")}
        >
          <ChevronLeft className="size-4" />
        </button>
        {pageList(page, pages).map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} className="px-1 text-xs text-subtle">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(step, "tabular-nums", p === page ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg")}
            >
              {p + 1}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page === pages - 1}
          aria-label="Next page"
          className={cn(step, "text-muted hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-40")}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  );
}
