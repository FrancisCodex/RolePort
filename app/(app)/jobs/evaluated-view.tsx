import { ArrowLeft, Search, SearchX, Sparkles } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { AnalyzeProvider } from "@/components/jobs/analyze-jobs";
import { JobBrowser } from "@/components/jobs/job-browser";
import { JobCard } from "@/components/jobs/job-card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { JobListItem } from "@/lib/jobs/queries";
import { sourceCredit } from "@/lib/jobs/sources/credits";
import { FIT_FILTER_OPTIONS, type ParsedEvaluated } from "@/lib/jobs/search-params";

const SORT_OPTIONS = [
  { value: "score", label: "Best fit first" },
  { value: "recent", label: "Recently evaluated" },
];

/**
 * Jobs you've evaluated: every job with an AI fit evaluation, from a search, a pasted job or an
 * AI agent, to look back on without searching again. Shared by the server page and the lite edition.
 */
export function EvaluatedJobsView({ filter, results }: { filter: ParsedEvaluated; results: ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link href="/jobs" className="inline-flex w-fit items-center gap-1 text-xs font-medium text-muted hover:text-fg">
          <ArrowLeft className="size-3.5" /> Back to job search
        </Link>
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <Sparkles className="size-4 text-brand-ink" />
          Jobs you&apos;ve evaluated
        </h2>
        <p className="text-[13px] text-muted">
          Every job with an AI fit evaluation, whether you ran it here or an AI agent did. They stay here after they drop out of search
          results, so you can come back and decide.
        </p>
      </div>

      {/* Keyed by the filters, so the fields show them after following a link. */}
      <Form key={JSON.stringify(filter)} action="/jobs" className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-2 shadow-[var(--shadow-soft)] sm:flex-row">
        <input type="hidden" name="view" value="evaluated" />
        <label className="relative flex-1">
          <span className="sr-only">Filter by job title or company</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <input
            name="q"
            defaultValue={filter.query}
            placeholder="Filter by job title or company (optional)"
            className="h-10 w-full rounded-lg border border-transparent bg-surface-2 pr-3 pl-9 text-sm outline-none transition-[border-color,background-color,box-shadow] placeholder:text-subtle focus:border-brand focus:bg-surface focus:ring-3 focus:ring-brand/15"
          />
        </label>
        <div className="grid grid-cols-2 gap-1.5 sm:flex">
          <Select name="fit" defaultValue={filter.fit} aria-label="Fit" options={FIT_FILTER_OPTIONS} className="sm:w-48" />
          <Select name="sort" defaultValue={filter.sort} aria-label="Sort by" options={SORT_OPTIONS} className="sm:w-44" />
        </div>
        <Button type="submit" className="h-10 px-4">
          Show
        </Button>
      </Form>

      {results}
    </div>
  );
}

/** The evaluated jobs in the same split view as search results. */
export function EvaluatedResults({ jobs, total, aiEnabled, filtered }: { jobs: JobListItem[]; total: number; aiEnabled: boolean; filtered: boolean }) {
  if (total === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No evaluated jobs yet"
        body="Evaluate a job from your search results, or ask your AI agent to, and it's kept here to come back to."
      />
    );
  }
  if (jobs.length === 0) {
    return <EmptyState icon={SearchX} title="None of your evaluated jobs match" body="Try other words, or show every evaluated job." />;
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
          {filtered ? `${jobs.length} of ${total}` : jobs.length} evaluated job{(filtered ? total : jobs.length) === 1 ? "" : "s"}
        </p>
        <JobBrowser jobs={jobs} aiEnabled={aiEnabled} sources={sources} cards={jobs.map((job) => <JobCard key={job.id} job={job} />)} />
      </div>
    </AnalyzeProvider>
  );
}
