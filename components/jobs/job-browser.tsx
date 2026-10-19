"use client";

import { createContext, use, useCallback, useState, type ReactNode } from "react";
import type { JobListItem } from "@/lib/jobs/data";
import { JobDetailView, type SourceCredit } from "./job-detail";
import { JobPanel } from "./job-panel";

/**
 * Job board split view: the results on the left and the selected job's details on the right
 * (a drawer on smaller screens). The page already has every result's data, so switching jobs
 * is instant and never leaves the list. "Open full page" links to /jobs/[id].
 */

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
  children,
}: {
  jobs: JobListItem[];
  aiEnabled: boolean;
  sources: Record<string, SourceCredit>;
  /** The result cards. */
  children: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(jobs[0]?.id ?? null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setDrawerOpen(true);
  }, []);
  const close = useCallback(() => setDrawerOpen(false), []);

  // After a refresh (e.g. a new evaluation) the list may change: fall back to the first job.
  const job = jobs.find((j) => j.id === selectedId) ?? jobs[0];

  return (
    <JobBrowserContext value={{ selectedId: job?.id ?? null, select }}>
      <div data-wide className="xl:grid xl:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] xl:items-start xl:gap-5">
        <div className="flex flex-col gap-3">{children}</div>
        {job && (
          <JobPanel jobId={job.id} drawerOpen={drawerOpen} onClose={close}>
            <JobDetailView job={job} aiEnabled={aiEnabled} variant="panel" source={sources[job.source] ?? null} />
          </JobPanel>
        )}
      </div>
    </JobBrowserContext>
  );
}
