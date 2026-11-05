import { ArrowLeft, Bookmark } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { AnalyzeProvider } from "@/components/jobs/analyze-jobs";
import { JobBrowser } from "@/components/jobs/job-browser";
import { JobCard } from "@/components/jobs/job-card";
import { buttonVariants } from "@/components/ui/button";
import type { JobListItem } from "@/lib/jobs/queries";
import { sourceCredit } from "@/lib/jobs/sources/credits";

/**
 * Saved jobs: the ones the user bookmarked and hasn't applied to yet, in the same split view as
 * search results, so each opens as the full job. They're stored with the user's data, so they open
 * without a connection. Applying moves a job to Applied jobs. Shared by the server page and the lite edition.
 */
export function SavedJobsView({ results }: { results: ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link href="/jobs" className="inline-flex w-fit items-center gap-1 text-xs font-medium text-muted hover:text-fg">
          <ArrowLeft className="size-3.5" /> Back to job search
        </Link>
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <Bookmark className="size-4 text-brand-ink" />
          Saved jobs
        </h2>
        <p className="text-[13px] text-muted">
          Jobs you saved to come back to. Each is kept with your data, so you can read it even offline. When you apply, it moves to Applied
          jobs.
        </p>
      </div>
      {results}
    </div>
  );
}

/** The saved jobs in the same split view as search results. */
export function SavedResults({ jobs, aiEnabled }: { jobs: JobListItem[]; aiEnabled: boolean }) {
  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title="No saved jobs"
        body="Press the bookmark on any job in your search results to keep it here for later."
        action={
          <Link href="/jobs" className={buttonVariants({ variant: "secondary" })}>
            Search jobs
          </Link>
        }
      />
    );
  }

  const sources = Object.fromEntries(
    [...new Set(jobs.map((j) => j.source))].flatMap((id) => {
      const credit = sourceCredit(id);
      return credit ? [[id, credit] as const] : [];
    }),
  );
  return (
    <AnalyzeProvider>
      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium text-fg">
          {jobs.length} saved job{jobs.length === 1 ? "" : "s"}
        </p>
        <JobBrowser jobs={jobs} aiEnabled={aiEnabled} sources={sources} cards={jobs.map((job) => <JobCard key={job.id} job={job} />)} />
      </div>
    </AnalyzeProvider>
  );
}
