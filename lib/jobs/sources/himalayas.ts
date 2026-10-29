import { cacheLife } from "next/cache";
import { cleanDescription } from "../html";
import type { EmploymentType, JobSource, SalaryPeriod } from "../types";
import { isoDate } from "./companies/types";
import { SOURCE_CREDITS } from "./credits";
import { countryCodes, coversRemote, emptyJob, keepMatching, type FeedJob } from "./feed";
import { fetchJson } from "./http";

// Himalayas' terms: credit Himalayas and link to the posting there (applicationLink).
export type HimalayasJob = {
  title: string;
  excerpt?: string | null;
  companyName: string;
  companyLogo?: string | null;
  employmentType?: string | null;
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: string | null;
  currency?: string | null;
  locationRestrictions?: string[];
  parentCategories?: string[];
  categories?: string[];
  description?: string | null;
  pubDate?: number | null;
  expiryDate?: number | null;
  applicationLink: string;
  guid: string;
};

/** Search pages to read (20 jobs each). */
const PAGES = 2;

const TYPES: Record<string, EmploymentType> = {
  "full time": "full_time",
  "part time": "part_time",
  contractor: "contract",
  contract: "contract",
  intern: "internship",
  internship: "internship",
  freelance: "freelance",
};
const PERIODS: Record<string, SalaryPeriod> = { annual: "year", yearly: "year", monthly: "month", daily: "day", hourly: "hour" };

async function searchHimalayas(query: string): Promise<HimalayasJob[]> {
  "use cache";
  cacheLife("hours");
  const jobs: HimalayasJob[] = [];
  for (let page = 1; page <= PAGES; page++) {
    const q = new URLSearchParams({ q: query, page: String(page) });
    const body = await fetchJson<{ jobs?: HimalayasJob[] }>(`https://himalayas.app/jobs/api/search?${q}`, { allowedHosts: ["himalayas.app"] });
    jobs.push(...(body.jobs ?? []));
    if ((body.jobs?.length ?? 0) < 20) break;
  }
  return jobs;
}

export function normalizeHimalayas(job: HimalayasJob, now = Date.now()): FeedJob {
  const places = job.locationRestrictions ?? [];
  const codes = countryCodes(places);
  const shown = places.slice(0, 3).join(", ") + (places.length > 3 ? ` and ${places.length - 3} more` : "");
  return {
    ...emptyJob("himalayas"),
    sourceId: job.guid,
    url: job.applicationLink,
    title: job.title,
    company: job.companyName,
    companyLogo: job.companyLogo || null,
    location: places.length ? `Remote · ${shown}` : "Remote · Worldwide",
    workSetup: "remote",
    employmentType: TYPES[(job.employmentType ?? "").toLowerCase()] ?? null,
    salaryMin: job.minSalary ?? null,
    salaryMax: job.maxSalary ?? null,
    salaryCurrency: job.currency || "USD",
    salaryPeriod: job.minSalary || job.maxSalary ? (PERIODS[(job.salaryPeriod ?? "").toLowerCase()] ?? "year") : null,
    description: cleanDescription(job.description ?? job.excerpt),
    skills: job.categories?.map((c) => c.replace(/-/g, " ")) ?? [],
    postedAt: job.pubDate ? isoDate(job.pubDate * 1000) : null,
    // Past its closing date: treated like any stale posting.
    possiblyStale: Boolean(job.expiryDate && job.expiryDate * 1000 < now),
    // Limited to countries RolePort doesn't list: still limited, so not open worldwide.
    countries: places.length && !codes.length ? ["ZZ"] : codes,
    team: job.parentCategories?.[0] ?? null,
  };
}

export const himalayasSource: JobSource = {
  id: "himalayas",
  label: "Himalayas",
  kind: "remote",
  coverage: "Remote jobs, worldwide or for the countries each one lists",
  attribution: SOURCE_CREDITS.himalayas,
  enabled: () => true,
  covers: (params) => coversRemote(params) && Boolean(params.query.trim()),
  async search(params) {
    return keepMatching((await searchHimalayas(params.query.trim().toLowerCase())).map((j) => normalizeHimalayas(j)), params);
  },
};
