import "server-only";
import { mergeDuplicates } from "./dedupe";
import { isFresh } from "./freshness";
import { jobKey } from "./job-key";
import { ATS_IDS, BOARDS, COMPANY_SOURCES, readCompanyJobs, type CompanyJobFilters, type CompanyRef } from "./sources/companies";
import { freehireSource } from "./sources/freehire";
import { jobicySource } from "./sources/jobicy";
import { jobSpySources } from "./sources/jobspy";
import { jsearchSource } from "./sources/jsearch";
import type { KeyedJob } from "./queries";
import type { JobSearchParams, JobSource, NormalizedJob, SourceContext, SourceStatus } from "./types";

/** Order matters: when two sources carry the same posting, the earlier one is shown and links to the others. */
// Company feeds come first: a posting straight from the employer beats a copy on a job board.
export const JOB_SOURCES = [...COMPANY_SOURCES, jsearchSource, ...jobSpySources, freehireSource, jobicySource];

/**
 * What the hosted lite edition searches from its server: never the JobSpy boards, whose
 * terms forbid automated access (lite users connect JobSpy on their own computer instead).
 */
export const HOSTED_SOURCES = JOB_SOURCES.filter((s) => !jobSpySources.includes(s));

export { sourceCredit } from "./sources/credits";

export type { KeyedJob } from "./queries";

/** Keys each source's recent jobs (old and ghost postings left out), merges duplicates and counts what each source shows. */
function collect(
  sources: Pick<JobSource, "id" | "label">[],
  settled: PromiseSettledResult<NormalizedJob[]>[],
  postedWithinDays: number | undefined,
): { jobs: KeyedJob[]; statuses: SourceStatus[] } {
  const found: KeyedJob[] = [];
  const statuses: SourceStatus[] = [];

  sources.forEach((source, i) => {
    const result = settled[i];
    if (result.status === "rejected") {
      console.error(`[jobs] ${source.id} failed`, result.reason);
      statuses.push({ id: source.id, label: source.label, count: 0, failed: true, note: "Couldn't reach this source" });
      return;
    }
    for (const job of result.value.filter((j) => isFresh(j, postedWithinDays))) found.push({ ...job, jobKey: jobKey(job.company, job.title, `${job.source}-${job.sourceId}`) });
    statuses.push({ id: source.id, label: source.label, count: 0 });
  });

  // The same opening from several boards becomes one result; each board counts the ones it shows.
  const jobs = mergeDuplicates(found);
  for (const status of statuses) if (!status.failed) status.count = jobs.filter((j) => j.source === status.id).length;
  return { jobs, statuses };
}

/** The most jobs one look through the followed companies shows, newest first. */
export const MAX_COMPANY_JOBS = 500;

/**
 * Every open job at these companies that passes the filters, with no search words or country
 * needed: the "Jobs at companies you follow" view.
 */
export async function browseCompanyJobs(companies: CompanyRef[], filters: CompanyJobFilters): Promise<{ jobs: KeyedJob[]; statuses: SourceStatus[] }> {
  const boards = ATS_IDS.filter((id) => companies.some((c) => c.ats === id)).map((id) => BOARDS[id]);
  const settled = await Promise.allSettled(boards.map((b) => readCompanyJobs(b.id, companies, filters)));
  const { jobs, statuses } = collect(boards, settled, filters.postedWithinDays);
  const newest = jobs.sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? "")).slice(0, MAX_COMPANY_JOBS);
  return { jobs: newest, statuses };
}

/** `sources` narrows the search, e.g. the lite search route leaves out the JobSpy boards. */
export async function searchAllSources(
  params: JobSearchParams,
  ctx: SourceContext,
  sources: JobSource[] = JOB_SOURCES,
): Promise<{ jobs: KeyedJob[]; statuses: SourceStatus[] }> {
  const active = sources.filter((s) => s.enabled(ctx) && s.covers(params));
  const { jobs, statuses } = collect(active, await Promise.allSettled(active.map((s) => s.search(params, ctx))), params.postedWithinDays);

  for (const source of sources) {
    // Boards that don't cover this search's country stay out of the list, even when switched off.
    if (!source.enabled(ctx) && source.listWhenOff !== false && source.covers(params)) statuses.push({ id: source.id, label: source.label, count: 0, note: source.disabledNote });
  }

  return { jobs, statuses };
}
