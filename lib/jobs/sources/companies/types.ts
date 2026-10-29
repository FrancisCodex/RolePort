import type { NormalizedJob } from "../../types";

/** Hiring software whose public job feeds RolePort reads, one company at a time. */
export const ATS_IDS = ["greenhouse", "lever", "ashby", "smartrecruiters", "workable", "recruitee"] as const;
export type AtsId = (typeof ATS_IDS)[number];

/** Jobs from a company feed ("From the company" in the results), by their source id. */
export function isCompanySource(source: string): boolean {
  return (ATS_IDS as readonly string[]).includes(source);
}

/** Display names, kept here (not on the boards) so pages in both editions can show them. */
export const ATS_LABELS: Record<AtsId, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  workable: "Workable",
  recruitee: "Recruitee",
};

/** A company the user follows: which hiring software it uses and its name there. */
export type CompanyRef = { ats: AtsId; slug: string; name: string };

/** A posting from a company feed, with what the search filter needs beyond NormalizedJob. */
export type CompanyJob = NormalizedJob & {
  /** ISO codes when the feed states the country; empty when it only gives location text. */
  countries: string[];
  team: string | null;
};

/** Narrows a request on boards that filter on their side (SmartRecruiters); the others return everything. */
export type FeedHint = { query?: string; country?: string };

export type CompanyBoard = {
  id: AtsId;
  label: string;
  /** Hosts its feed may be read from (lib/jobs/sources/http.ts). */
  hosts: string[];
  /** Whether the board filters by FeedHint itself. */
  filtersOnServer?: boolean;
  /** The company's slug when `url` is a link to its board on this software, else null. */
  slugFromUrl(url: URL): string | null;
  /** All the company's open jobs, and its name when the feed gives one. */
  fetchJobs(slug: string, hint: FeedHint): Promise<{ name: string | null; jobs: CompanyJob[] }>;
};

/** Slugs are path segments or subdomains; anything else never reaches a URL. */
export const SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

export function validSlug(slug: string | undefined | null): string | null {
  return slug && SLUG_PATTERN.test(slug) ? slug : null;
}

/** First path segment of a URL, e.g. jobs.lever.co/acme/123 → "acme". */
export function firstSegment(url: URL): string | null {
  return validSlug(decodeURIComponent(url.pathname.split("/").filter(Boolean)[0] ?? ""));
}

/** "Remote", "Hybrid" or on-site, from the words a feed uses. */
export function setupFromText(...texts: (string | null | undefined)[]): "remote" | "hybrid" | null {
  const text = texts.filter(Boolean).join(" ");
  if (/\bhybrid\b/i.test(text)) return "hybrid";
  if (/\bremote\b|work from home|\bwfh\b/i.test(text)) return "remote";
  return null;
}

/** Feeds give dates as ISO strings, epoch milliseconds, or "2026-10-27 12:11:34 UTC". */
export function isoDate(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const ms = typeof value === "number" ? value : Date.parse(String(value).replace(" UTC", "Z").replace(" ", "T"));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function blankJob(source: AtsId): Omit<CompanyJob, "sourceId" | "url" | "title" | "company"> {
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

/** Most companies a user can follow (and one search reads). */
export const MAX_FOLLOWED = 100;
