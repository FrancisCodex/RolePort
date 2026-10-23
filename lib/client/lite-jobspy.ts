import { jobKey } from "@/lib/jobs/job-key";
import type { KeyedJob } from "@/lib/jobs/queries";
import {
  JOBSPY_BOARDS,
  JOBSPY_TIMEOUT_MS,
  jobSpyQuery,
  normalizeJobSpyJob,
  readJobSpyResponse,
  type JobSpyJob,
} from "@/lib/jobs/sources/jobspy-boards";
import type { JobSearchParams, SourceStatus } from "@/lib/jobs/types";
import { countryOrDefault } from "@/lib/geo/countries";

/*
 * Lite edition: the JobSpy boards, searched from this browser through the JobSpy service on
 * the user's computer (services/jobspy, started with JOBSPY_ALLOWED_ORIGINS set to this site).
 * Results go straight from the service to the browser; HireMe's server never sees them.
 */

export const DEFAULT_JOBSPY_URL = "http://127.0.0.1:8765";
const URL_KEY = "hireme:jobspy-url";

/** The service's address. Kept per browser: it's about this computer, not the user's data. */
export function jobSpyUrl(): string {
  try {
    return localStorage.getItem(URL_KEY) || DEFAULT_JOBSPY_URL;
  } catch {
    return DEFAULT_JOBSPY_URL;
  }
}

export function setJobSpyUrl(url: string): void {
  try {
    localStorage.setItem(URL_KEY, url.trim().replace(/\/+$/, ""));
  } catch {}
}

/** Whether the service answers this site, and if not, the likely reason. */
export async function checkJobSpy(baseUrl: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${baseUrl}/health`, { cache: "no-store", signal: AbortSignal.timeout(4_000) });
    if (res.ok) return { ok: true };
    if (res.status === 403) return { ok: false, error: `JobSpy is running but doesn't allow this site. Restart it with JOBSPY_ALLOWED_ORIGINS=${location.origin}.` };
    return { ok: false, error: `JobSpy answered ${res.status}. Is the address right?` };
  } catch {
    // A CORS refusal and "nothing listening" look the same; a no-cors request resolves if something answers.
    try {
      await fetch(`${baseUrl}/health`, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(4_000) });
      return { ok: false, error: `JobSpy is running but doesn't allow this site. Restart it with JOBSPY_ALLOWED_ORIGINS=${location.origin}.` };
    } catch {
      return {
        ok: false,
        error: `Couldn't reach JobSpy at ${baseUrl}. Is it running? If your browser asked to let this site access devices on your local network, allow it.`,
      };
    }
  }
}

/** Statuses for the boards a search would cover while JobSpy isn't connected. */
export function jobSpyOffStatuses(params: JobSearchParams): SourceStatus[] {
  return JOBSPY_BOARDS.filter((b) => b.covers(params)).map(({ board, label }) => ({
    id: board,
    label,
    count: 0,
    note: "Connect JobSpy on this computer in Settings to search this board",
  }));
}

/** Search every board that covers `params`, one request each so each reports its own result. */
export async function searchJobSpy(baseUrl: string, params: JobSearchParams): Promise<{ jobs: KeyedJob[]; statuses: SourceStatus[] }> {
  const boards = JOBSPY_BOARDS.filter((b) => b.covers(params));
  const currency = countryOrDefault(params.country).currency;
  const settled = await Promise.allSettled(
    boards.map(async ({ board }) => {
      const res = await fetch(`${baseUrl}/search?${jobSpyQuery(board, params)}`, { signal: AbortSignal.timeout(JOBSPY_TIMEOUT_MS) });
      const body = (await res.json().catch(() => ({}))) as { jobs?: JobSpyJob[]; error?: string | null };
      return readJobSpyResponse(res.status, body).map((job) => normalizeJobSpyJob(board, job, currency));
    }),
  );

  const seen = new Set<string>();
  const jobs: KeyedJob[] = [];
  const statuses: SourceStatus[] = [];
  boards.forEach(({ board, label }, i) => {
    const result = settled[i];
    if (result.status === "rejected") {
      console.warn(`[jobspy] ${board} failed`, result.reason);
      statuses.push({ id: board, label, count: 0, failed: true, note: "Couldn't reach this board through JobSpy" });
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
    statuses.push({ id: board, label, count });
  });
  return { jobs, statuses };
}
