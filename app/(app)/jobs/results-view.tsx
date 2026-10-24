import { AlertCircle, SearchX, Sparkles } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { AnalyzePanel, AnalyzeProvider } from "@/components/jobs/analyze-jobs";
import { JobBrowser } from "@/components/jobs/job-browser";
import { JobCard } from "@/components/jobs/job-card";
import { MAX_PER_RUN } from "@/lib/jobs/fit";
import type { JobListItem } from "@/lib/jobs/queries";
import { sourceCredit } from "@/lib/jobs/sources/credits";
import type { SourceStatus } from "@/lib/jobs/types";
import { cn } from "@/lib/utils";

export type ResultsData = { jobs: JobListItem[]; statuses: SourceStatus[]; hasSkills: boolean; aiEnabled: boolean };

/** One search's results: source chips, the analyze panel and the split job browser. Shared by both editions. */
export function ResultsView({ jobs, statuses, hasSkills, aiEnabled }: ResultsData) {
  const sources = Object.fromEntries(
    [...new Set(jobs.map((j) => j.source))].flatMap((id) => {
      const credit = sourceCredit(id);
      return credit ? [[id, credit] as const] : [];
    }),
  );
  // "Top N" analyzes the best-ranked results that don't have an AI score yet.
  const topIds = jobs
    .filter((j) => !j.fit)
    .slice(0, MAX_PER_RUN)
    .map((j) => j.id);

  return (
    <AnalyzeProvider>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-fg">
            {jobs.length} job{jobs.length === 1 ? "" : "s"}
          </span>
          <span className="text-subtle">from</span>
          {statuses.map((s) => (
            <span
              key={s.id}
              title={s.note}
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-[11px]",
                s.failed ? "border-danger/20 bg-danger-soft text-danger" : s.note ? "border-border text-subtle" : "border-border text-muted",
              )}
            >
              {s.label} {s.note ? (s.failed ? "· unavailable" : "· off") : `· ${s.count}`}
            </span>
          ))}
        </div>

        {!hasSkills && (
          <Link
            href="/profile"
            className="flex items-center gap-2.5 rounded-lg border border-brand/20 bg-brand-soft px-3 py-2 text-[13px] font-medium text-brand-ink hover:border-brand/40"
          >
            <Sparkles className="size-3.5 shrink-0" />
            Add your skills to your profile to see a match score on every job.
          </Link>
        )}

        {jobs.length > 0 && (
          <AnalyzePanel jobs={jobs.map((j) => ({ id: j.id, title: j.title }))} topIds={topIds} aiEnabled={aiEnabled} />
        )}

        {statuses.length > 0 && statuses.every((s) => s.failed || s.note) && (
          <p className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
            <AlertCircle className="size-4" /> No job source could be reached. Check your connection and try again.
          </p>
        )}

        {jobs.length === 0 ? (
          <EmptyState icon={SearchX} title="No jobs found" body="Try a broader title, another location, or a longer date range." />
        ) : (
          // Split view: the results, and the selected job beside them (a drawer on small screens).
          <JobBrowser jobs={jobs} aiEnabled={aiEnabled} sources={sources}>
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </JobBrowser>
        )}
      </div>
    </AnalyzeProvider>
  );
}

export function ResultsSkeleton({ withForm = false }: { withForm?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {withForm && <div className="mb-3 h-36 animate-pulse rounded-xl bg-surface-3" />}
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex gap-3 rounded-xl border border-border bg-surface p-4">
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
