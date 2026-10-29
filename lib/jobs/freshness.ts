import type { NormalizedJob } from "./types";

/*
 * Old and ghost postings are left out of every search, whatever the source: a job posted months
 * ago is rarely still open, and one a source flags as stale or reposted wastes an application.
 * Runs in the browser too (the lite edition's JobSpy boards).
 */

/** Nothing older than this is ever shown, even when no date filter is set. */
export const MAX_POSTED_DAYS = 90;

/** Whether a posting is recent enough to show. One without a date is kept: there's no telling its age. */
export function isFresh(job: Pick<NormalizedJob, "postedAt" | "possiblyStale">, postedWithinDays?: number, now = Date.now()): boolean {
  if (job.possiblyStale) return false;
  if (!job.postedAt) return true;
  const posted = Date.parse(job.postedAt);
  if (Number.isNaN(posted)) return true;
  return posted >= now - Math.min(postedWithinDays ?? MAX_POSTED_DAYS, MAX_POSTED_DAYS) * 86_400_000;
}
