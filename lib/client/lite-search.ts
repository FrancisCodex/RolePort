import { getBrowserDb } from "@/lib/db/browser";
import { LOCAL_USER } from "@/lib/db/local-user";
import { storeJobs, type KeyedJob } from "@/lib/jobs/queries";
import type { JobSearchParams, SourceStatus } from "@/lib/jobs/types";
import { readSettings } from "@/lib/settings/queries";
import { readKey } from "./lite-keys";

/*
 * Lite edition: run a job search through the stateless /api/lite/search route and keep
 * the results in the browser database, the same way the server's searchJobs() stores
 * them. Load with import(): it opens PGlite.
 */

export type LiteSearchResult = { ids: string[]; statuses: SourceStatus[] };

// The same search within a few minutes reuses its results (moving between pages, going back).
const REUSE_MS = 5 * 60_000;
const recent = new Map<string, { at: number; result: Promise<LiteSearchResult> }>();

export function liteSearch(params: JobSearchParams): Promise<LiteSearchResult> {
  const key = JSON.stringify(params);
  const hit = recent.get(key);
  if (hit && Date.now() - hit.at < REUSE_MS) return hit.result;

  const result = run(params);
  recent.set(key, { at: Date.now(), result });
  result.catch(() => recent.delete(key)); // a failed search runs again next time
  return result;
}

async function run(params: JobSearchParams): Promise<LiteSearchResult> {
  const db = await getBrowserDb();
  // The user's own JSearch key, if any, goes along for this one request and isn't kept by the server.
  const rapidApiKey = readKey((await readSettings(db, LOCAL_USER.id))?.rapidApiKeyEnc);

  const res = await fetch("/api/lite/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(rapidApiKey ? { "x-rapidapi-key": rapidApiKey } : {}) },
    body: JSON.stringify(params),
  });
  const body = (await res.json().catch(() => ({}))) as { jobs?: KeyedJob[]; statuses?: SourceStatus[]; error?: string };
  if (!res.ok) throw new Error(body.error ?? `The search failed (${res.status}). Please try again.`);

  const rows = await storeJobs(db, body.jobs ?? []);
  return { ids: rows.map((r) => r.id), statuses: body.statuses ?? [] };
}
