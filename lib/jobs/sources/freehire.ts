import { cacheLife } from "next/cache";
import { countryOrDefault } from "@/lib/geo/countries";
import { findLocation } from "@/lib/ph-locations";
import { cleanDescription } from "../html";
import type { EmploymentType, JobSearchParams, JobSource, NormalizedJob, SalaryPeriod, WorkSetup } from "../types";
import { SOURCE_CREDITS } from "./credits";
import { fetchJson } from "./http";

const BASE_URL = process.env.FREEHIRE_API_URL ?? "https://freehire.me";
const PAGE_SIZE = 30;

type FreehireJob = {
  public_slug: string;
  url: string;
  title: string;
  company: string | null;
  location: string | null;
  description: string | null;
  skills?: string[];
  work_mode?: string;
  cities?: string[];
  posted_at: string | null;
  enrichment?: {
    summary?: string;
    employment_type?: string;
    salary_min?: number;
    salary_max?: number;
    salary_currency?: string;
    salary_period?: string;
    requirements?: { text: string; priority: string }[];
  };
  reality?: { class?: string; fake_freshness?: boolean };
};

const EMPLOYMENT: Record<string, EmploymentType> = {
  full_time: "full_time",
  part_time: "part_time",
  contract: "contract",
  internship: "internship",
  freelance: "freelance",
};
const PERIODS: Record<string, SalaryPeriod> = { hour: "hour", day: "day", month: "month", year: "year" };

function buildQuery(params: JobSearchParams): URLSearchParams {
  const q = new URLSearchParams({ limit: String(PAGE_SIZE), description_format: "html" });
  if (params.query) q.set("q", params.query);
  if (params.postedWithinDays) q.set("posted_within_days", String(params.postedWithinDays));

  // freehire ORs countries and cities together, so send exactly one geography facet.
  const location = params.country === "PH" ? findLocation(params.locationId) : undefined;
  if (location) {
    for (const city of location.cities) q.append("cities", city);
  } else if (params.city && params.locationId !== "remote") {
    q.append("cities", params.city);
  } else {
    q.set("countries", params.country.toLowerCase());
  }

  const workMode = params.locationId === "remote" ? "remote" : params.workSetup;
  if (workMode) q.set("work_mode", workMode);
  return q;
}

async function fetchFreehire(query: string): Promise<FreehireJob[]> {
  "use cache";
  cacheLife("hours");

  const body = await fetchJson<{ data?: FreehireJob[] }>(`${BASE_URL}/api/v1/agent/jobs/search?${query}`, {
    allowedHosts: [new URL(BASE_URL).hostname],
  });
  return body.data ?? [];
}

function normalize(job: FreehireJob, fallbackCurrency: string): NormalizedJob {
  const e = job.enrichment ?? {};
  return {
    source: "freehire",
    sourceId: job.public_slug,
    url: job.url,
    title: job.title,
    company: job.company ?? "Unknown company",
    companyLogo: null,
    location: job.location,
    city: job.cities?.[0] ?? null,
    workSetup: (["onsite", "hybrid", "remote"] as const).includes(job.work_mode as WorkSetup)
      ? (job.work_mode as WorkSetup)
      : null,
    employmentType: EMPLOYMENT[e.employment_type ?? ""] ?? null,
    salaryMin: e.salary_min ?? null,
    salaryMax: e.salary_max ?? null,
    salaryCurrency: e.salary_currency ?? fallbackCurrency,
    salaryPeriod: PERIODS[e.salary_period ?? ""] ?? null,
    description: cleanDescription(job.description),
    summary: e.summary ?? null,
    skills: job.skills ?? [],
    requirements: (e.requirements ?? []).map((r) => ({
      text: r.text,
      priority: r.priority === "preferred" ? "preferred" : "required",
    })),
    postedAt: job.posted_at,
    possiblyStale: job.reality?.class === "stale" || Boolean(job.reality?.fake_freshness),
  };
}

export const freehireSource: JobSource = {
  id: "freehire",
  label: "freehire",
  kind: "board",
  coverage: "Every country",
  attribution: SOURCE_CREDITS.freehire,
  enabled: () => true,
  covers: () => true,
  async search(params) {
    const jobs = await fetchFreehire(buildQuery(params).toString());
    const currency = countryOrDefault(params.country).currency;
    return jobs.map((job) => normalize(job, currency));
  },
};
