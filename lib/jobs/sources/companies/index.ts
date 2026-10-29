import { cacheLife } from "next/cache";
import type { JobSearchParams, JobSource, NormalizedJob } from "../../types";
import { SOURCE_CREDITS } from "../credits";
import { ashby } from "./ashby";
import { greenhouse } from "./greenhouse";
import { lever } from "./lever";
import { matchesSearch, type CompanyJobFilters } from "./match";
import { recruitee } from "./recruitee";
import { smartRecruiters } from "./smartrecruiters";
import { ATS_IDS, MAX_FOLLOWED, type AtsId, type CompanyBoard, type CompanyJob, type CompanyRef, type FeedHint } from "./types";
import { workable } from "./workable";

export { ATS_IDS, MAX_FOLLOWED, type AtsId, type CompanyRef } from "./types";
export type { CompanyJobFilters } from "./match";

export const BOARDS: Record<AtsId, CompanyBoard> = { greenhouse, lever, ashby, smartrecruiters: smartRecruiters, workable, recruitee };

/** How many company feeds load at once. */
const CONCURRENCY = 6;

/** One company's feed, cached for a few hours (public data, so shared between users). */
async function readFeed(ats: AtsId, slug: string, hint: FeedHint): Promise<{ name: string | null; jobs: CompanyJob[] }> {
  "use cache";
  cacheLife("hours");
  return BOARDS[ats].fetchJobs(slug, hint);
}

export async function fetchCompanyFeed(ref: Pick<CompanyRef, "ats" | "slug">, params?: JobSearchParams) {
  const board = BOARDS[ref.ats];
  const hint: FeedHint = board.filtersOnServer && params ? { query: params.query.trim() || undefined, country: params.country } : {};
  return readFeed(ref.ats, ref.slug, hint);
}

async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason) => ({ status: "rejected" as const, reason }),
      );
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Drops the filter-only fields, so they aren't stored with the job. */
function toNormalized(job: CompanyJob, company: string): NormalizedJob {
  const normalized: NormalizedJob & Partial<Pick<CompanyJob, "countries" | "team">> = { ...job, company };
  delete normalized.countries;
  delete normalized.team;
  return normalized;
}

/**
 * The open jobs at these companies (all on `board`) that pass `filters`. A search passes its
 * params as `hint` too, so hiring software that filters on its side gets the words and country.
 */
export async function readCompanyJobs(board: AtsId, companies: CompanyRef[], filters: CompanyJobFilters, hint?: JobSearchParams): Promise<NormalizedJob[]> {
  const mine = companies.filter((c) => c.ats === board).slice(0, MAX_FOLLOWED);
  const settled = await mapLimited(mine, CONCURRENCY, (c) => fetchCompanyFeed(c, hint));
  const failures = settled.filter((s) => s.status === "rejected");
  // One company's feed failing shouldn't hide the others; all of them failing is a source failure.
  if (failures.length === settled.length && failures.length > 0) throw (failures[0] as PromiseRejectedResult).reason;
  return settled.flatMap((s, i) =>
    s.status === "fulfilled" ? s.value.jobs.filter((j) => matchesSearch(j, filters)).map((j) => toNormalized(j, mine[i].name)) : [],
  );
}

/**
 * One search source per hiring software. Each reads the feeds of the companies the user follows
 * on it and keeps the jobs that fit the search. Hidden from the source list until the user
 * follows a company there.
 */
function companySource(board: CompanyBoard): JobSource {
  return {
    id: board.id,
    label: board.label,
    attribution: SOURCE_CREDITS[board.id],
    enabled: (ctx) => ctx.companies.some((c) => c.ats === board.id),
    listWhenOff: false,
    covers: () => true,
    search: (params, ctx) => readCompanyJobs(board.id, ctx.companies, params, params),
  };
}

export const COMPANY_SOURCES: JobSource[] = ATS_IDS.map((id) => companySource(BOARDS[id]));

/** Which hiring software a link points to, and the company's slug there. */
export function boardFromUrl(url: URL): { ats: AtsId; slug: string } | null {
  for (const id of ATS_IDS) {
    const slug = BOARDS[id].slugFromUrl(url);
    if (slug) return { ats: id, slug };
  }
  return null;
}

// Links to a hiring system that a careers page embeds or links to.
const BOARD_LINK =
  /https?:\/\/(?:[a-z0-9-]+\.)*(?:greenhouse\.io|lever\.co|ashbyhq\.com|smartrecruiters\.com|workable\.com|recruitee\.com)[^\s"'<>)\\]*/gi;

/** Finds the hiring software from a careers page's HTML: embedded boards and links to it. */
export function boardFromHtml(html: string): { ats: AtsId; slug: string } | null {
  for (const match of html.replace(/&amp;/g, "&").matchAll(BOARD_LINK)) {
    try {
      const found = boardFromUrl(new URL(match[0]));
      if (found) return found;
    } catch {
      // not a URL after all
    }
  }
  return null;
}
