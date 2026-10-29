import { companyRefs, readFollowedCompanies } from "@/lib/companies/queries";
import { getBrowserDb, type BrowserDb } from "@/lib/db/browser";
import { ATS_IDS, type CompanyRef } from "@/lib/jobs/sources/companies/types";
import { LOCAL_USER } from "@/lib/db/local-user";
import { mergeDuplicates } from "@/lib/jobs/dedupe";
import { storeJobs, type KeyedJob } from "@/lib/jobs/queries";
import type { JobSearchParams, SourceStatus } from "@/lib/jobs/types";
import { readSettings } from "@/lib/settings/queries";
import { jobSpyOffStatuses, jobSpyUrl, searchJobSpy } from "./lite-jobspy";
import { readKey } from "./lite-keys";

/*
 * Lite edition: run a job search through the stateless /api/lite/search route, plus the
 * JobSpy boards on the user's computer when connected, and keep the results in the browser
 * database, the same way the server's searchJobs() stores them. Load with import(): it opens PGlite.
 */

export type LiteSearchResult = { ids: string[]; statuses: SourceStatus[] };

// The same search within a few minutes reuses its results (moving between pages, going back).
const REUSE_MS = 5 * 60_000;
const recent = new Map<string, { at: number; result: Promise<LiteSearchResult> }>();

export async function liteSearch(params: JobSearchParams): Promise<LiteSearchResult> {
  const db = await getBrowserDb();
  const settings = await readSettings(db, LOCAL_USER.id);
  // The user's own JSearch key, if any, goes along for this one request and isn't kept by the server.
  const rapidApiKey = readKey(settings?.rapidApiKeyEnc);
  const jobspy = settings?.jobspyEnabled ? jobSpyUrl() : null;
  const companies = companyRefs(await readFollowedCompanies(db, LOCAL_USER.id));

  const key = JSON.stringify([params, Boolean(rapidApiKey), jobspy, companies]);
  const hit = recent.get(key);
  if (hit && Date.now() - hit.at < REUSE_MS) return hit.result;

  const result = run(db, params, rapidApiKey, jobspy, companies);
  recent.set(key, { at: Date.now(), result });
  result.catch(() => recent.delete(key)); // a failed search runs again next time
  return result;
}

async function searchHosted(
  params: JobSearchParams,
  rapidApiKey: string | null,
  companies: CompanyRef[],
): Promise<{ jobs: KeyedJob[]; statuses: SourceStatus[] }> {
  const res = await fetch("/api/lite/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(rapidApiKey ? { "x-rapidapi-key": rapidApiKey } : {}) },
    body: JSON.stringify({ ...params, companies }),
  });
  const body = (await res.json().catch(() => ({}))) as { jobs?: KeyedJob[]; statuses?: SourceStatus[]; error?: string };
  if (!res.ok) throw new Error(body.error ?? `The search failed (${res.status}). Please try again.`);
  return { jobs: body.jobs ?? [], statuses: body.statuses ?? [] };
}

async function run(
  db: BrowserDb,
  params: JobSearchParams,
  rapidApiKey: string | null,
  jobspy: string | null,
  companies: CompanyRef[],
): Promise<LiteSearchResult> {
  const [hosted, local] = await Promise.all([
    searchHosted(params, rapidApiKey, companies),
    jobspy ? searchJobSpy(jobspy, params) : { jobs: [], statuses: jobSpyOffStatuses(params) },
  ]);

  // Same precedence as the server (lib/jobs/search.ts): company feeds and JSearch, then the JobSpy boards, then the rest.
  const first = (s: { source?: string; id?: string }) => {
    const id = s.source ?? s.id ?? "";
    return id === "jsearch" || (ATS_IDS as readonly string[]).includes(id);
  };
  const ordered = [...hosted.jobs.filter(first), ...local.jobs, ...hosted.jobs.filter((j) => !first(j))];
  const jobs = mergeDuplicates(ordered);

  // Counts after merging, so a posting found twice is counted once, where it's shown.
  const statuses = [...hosted.statuses.filter(first), ...local.statuses, ...hosted.statuses.filter((s) => !first(s))].map((s) =>
    s.note ? s : { ...s, count: jobs.filter((j) => j.source === s.id).length },
  );

  const rows = await storeJobs(db, jobs);
  return { ids: rows.map((r) => r.id), statuses };
}
