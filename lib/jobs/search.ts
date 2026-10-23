import "server-only";
import { jobKey } from "./job-key";
import { freehireSource } from "./sources/freehire";
import { jobicySource } from "./sources/jobicy";
import { jobSpySources } from "./sources/jobspy";
import { jsearchSource } from "./sources/jsearch";
import type { KeyedJob } from "./queries";
import type { JobSearchParams, JobSource, SourceContext, SourceStatus } from "./types";

/** Order matters: when two sources carry the same posting, the earlier one wins. */
export const JOB_SOURCES = [jsearchSource, ...jobSpySources, freehireSource, jobicySource];

/**
 * What the hosted lite edition searches from its server: never the JobSpy boards, whose
 * terms forbid automated access (lite users connect JobSpy on their own computer instead).
 */
export const HOSTED_SOURCES = JOB_SOURCES.filter((s) => !jobSpySources.includes(s));

export { sourceCredit } from "./sources/credits";

export type { KeyedJob } from "./queries";

/** `sources` narrows the search, e.g. the lite search route leaves out the JobSpy boards. */
export async function searchAllSources(
  params: JobSearchParams,
  ctx: SourceContext,
  sources: JobSource[] = JOB_SOURCES,
): Promise<{ jobs: KeyedJob[]; statuses: SourceStatus[] }> {
  const active = sources.filter((s) => s.enabled(ctx) && s.covers(params));
  const settled = await Promise.allSettled(active.map((s) => s.search(params, ctx)));

  const seen = new Set<string>();
  const jobs: KeyedJob[] = [];
  const statuses: SourceStatus[] = [];

  active.forEach((source, i) => {
    const result = settled[i];
    if (result.status === "rejected") {
      console.error(`[jobs] ${source.id} failed`, result.reason);
      statuses.push({ id: source.id, label: source.label, count: 0, failed: true, note: "Couldn't reach this source" });
      return;
    }
    let count = 0;
    for (const job of result.value) {
      const key = jobKey(job.company, job.title, `${job.source}-${job.sourceId}`);
      if (seen.has(key)) continue;
      seen.add(key);
      jobs.push({ ...job, jobKey: key });
      count++;
    }
    statuses.push({ id: source.id, label: source.label, count });
  });

  for (const source of sources) {
    // Boards that don't cover this search's country stay out of the list, even when switched off.
    if (!source.enabled(ctx) && source.covers(params)) statuses.push({ id: source.id, label: source.label, count: 0, note: source.disabledNote });
  }

  return { jobs, statuses };
}
