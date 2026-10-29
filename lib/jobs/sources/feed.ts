import { COUNTRIES, findCountry } from "@/lib/geo/countries";
import type { JobSearchParams, NormalizedJob } from "../types";
import { matchesSearch } from "./companies/match";
import type { CompanyJob } from "./companies/types";

/*
 * Helpers for sources that return a whole feed (or a broad search) that RolePort filters itself:
 * the company boards and the remote and official feeds. Each maps its postings into FeedJob,
 * then keepMatching() applies the search's words, country, area, work setup and date.
 */

/** A posting with what the filter needs beyond NormalizedJob: ISO country codes (empty when only text says) and a team. */
export type FeedJob = CompanyJob;

/** An empty posting for `source`; each source fills in what its feed has. */
export function emptyJob(source: string): Omit<FeedJob, "sourceId" | "url" | "title" | "company"> {
  return {
    source,
    companyLogo: null,
    location: null,
    city: null,
    workSetup: null,
    employmentType: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: "USD",
    salaryPeriod: null,
    description: null,
    summary: null,
    skills: [],
    requirements: [],
    postedAt: null,
    possiblyStale: false,
    countries: [],
    team: null,
  };
}

/** Drops the filter-only fields, so they aren't stored with the job. `company` renames the employer. */
export function toNormalized(job: FeedJob, company = job.company): NormalizedJob {
  const normalized: NormalizedJob & Partial<Pick<FeedJob, "countries" | "team">> = { ...job, company };
  delete normalized.countries;
  delete normalized.team;
  return normalized;
}

/** The postings that fit the search, ready to store. */
export function keepMatching(jobs: FeedJob[], params: JobSearchParams): NormalizedJob[] {
  return jobs.filter((j) => matchesSearch(j, params)).map((j) => toNormalized(j));
}

/** Remote-only feeds have nothing for a search tied to a city, an area or on-site work. */
export function coversRemote(params: JobSearchParams): boolean {
  return (
    (params.locationId === undefined || params.locationId === "remote") &&
    !params.city &&
    (params.workSetup === undefined || params.workSetup === "remote")
  );
}

const NAME_ALIASES: Record<string, string> = {
  usa: "US",
  "united states of america": "US",
  us: "US",
  uk: "GB",
  "great britain": "GB",
  england: "GB",
  uae: "AE",
  "south korea": "KR",
  "korea, republic of": "KR",
  czech: "CZ",
  "czech republic": "CZ",
  turkey: "TR",
};
const BY_NAME = new Map(COUNTRIES.map((c) => [c.name.toLowerCase(), c.code]));

/** The ISO code for a country name or code a feed uses ("Philippines", "USA", "de"), or null. */
export function countryCode(name: string | null | undefined): string | null {
  const key = name?.trim().toLowerCase();
  if (!key) return null;
  return BY_NAME.get(key) ?? NAME_ALIASES[key] ?? (key.length === 2 ? (findCountry(key)?.code ?? null) : null);
}

/** ISO codes for the country names a feed lists; names RolePort doesn't know are skipped. */
export function countryCodes(names: readonly string[] | null | undefined): string[] {
  return [...new Set((names ?? []).flatMap((n) => countryCode(n) ?? []))];
}

/** Plain text (with blank lines between paragraphs) as the HTML the sanitizer expects. */
export function textToHtml(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((p) => `<p>${escape(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Hours of caching for feeds whose terms ask for few requests (Remotive: about four a day). */
export const SIX_HOURS = { stale: 6 * 3600, revalidate: 6 * 3600, expire: 24 * 3600 };
