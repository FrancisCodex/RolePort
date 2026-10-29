import { cacheLife } from "next/cache";
import { jobSpyUrl } from "@/lib/env";
import { countryOrDefault } from "@/lib/geo/countries";
import type { JobSource } from "../types";
import { SOURCE_CREDITS } from "./credits";
import { JOBSPY_BOARDS, JOBSPY_TIMEOUT_MS, jobSpyQuery, normalizeJobSpyJob, readJobSpyResponse, type JobSpyJob } from "./jobspy-boards";

/*
 * Self-hosted: the JobSpy boards, called from the server through the sidecar (services/jobspy).
 * Opt-in, self-host only, and cached for hours to keep request volume at personal-search levels.
 * The boards themselves are described in ./jobspy-boards.ts, shared with the lite edition.
 */

async function fetchJobSpy(baseUrl: string, query: string): Promise<JobSpyJob[]> {
  "use cache";
  cacheLife("hours");

  const res = await fetch(`${baseUrl}/search?${query}`, { signal: AbortSignal.timeout(JOBSPY_TIMEOUT_MS) });
  return readJobSpyResponse(res.status, await res.json().catch(() => ({})));
}

export const jobSpySources: JobSource[] = JOBSPY_BOARDS.map(({ board, label, covers }) => ({
  id: board,
  label,
  kind: "opt-in",
  coverage: "Depends on the board: see the JobSpy section",
  needs: "Self-hosted only: run the JobSpy service and turn it on in Settings",
  attribution: SOURCE_CREDITS[board],
  enabled: (ctx) => Boolean(jobSpyUrl) && ctx.jobspyEnabled,
  disabledNote: "Turn on JobSpy in Settings (self-hosted only) to search this board",
  covers,
  async search(params) {
    const jobs = await fetchJobSpy(jobSpyUrl!, jobSpyQuery(board, params));
    return jobs.map((job) => normalizeJobSpyJob(board, job, countryOrDefault(params.country).currency));
  },
}));
