import { findLocation } from "@/lib/ph-locations";
import { cleanDescription } from "../html";
import type { EmploymentType, JobSource, NormalizedJob, SalaryPeriod } from "../types";

// JSearch (RapidAPI) returns Google for Jobs listings: JobStreet, Indeed, LinkedIn, Kalibrr and company sites.
// Not yet verified against a live key — field names follow JSearch's public docs.
type JSearchJob = {
  job_id: string;
  job_title: string;
  employer_name: string;
  employer_logo?: string | null;
  job_publisher?: string;
  job_employment_type?: string;
  job_apply_link: string;
  job_description?: string;
  job_is_remote?: boolean;
  job_posted_at_datetime_utc?: string | null;
  job_city?: string | null;
  job_state?: string | null;
  job_country?: string | null;
  job_min_salary?: number | null;
  job_max_salary?: number | null;
  job_salary_currency?: string | null;
  job_salary_period?: string | null;
  job_highlights?: { Qualifications?: string[] };
};

const TYPES: Record<string, EmploymentType> = {
  FULLTIME: "full_time",
  PARTTIME: "part_time",
  CONTRACTOR: "contract",
  INTERN: "internship",
};
const PERIODS: Record<string, SalaryPeriod> = { HOUR: "hour", DAY: "day", MONTH: "month", YEAR: "year" };

function datePosted(days?: number) {
  if (!days) return "all";
  if (days <= 1) return "today";
  if (days <= 3) return "3days";
  if (days <= 7) return "week";
  return "month";
}

// The API key must not become part of a "use cache" key, so cache results in memory instead.
const CACHE_TTL_MS = 60 * 60_000;
const memo = new Map<string, { at: number; jobs: JSearchJob[] }>();

async function fetchJSearch(apiKey: string, query: string, remoteOnly: boolean, posted: string): Promise<JSearchJob[]> {
  const cacheKey = JSON.stringify([query, remoteOnly, posted]);
  const hit = memo.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.jobs;

  const q = new URLSearchParams({ query, page: "1", num_pages: "1", country: "ph", date_posted: posted });
  if (remoteOnly) q.set("work_from_home", "true");
  const res = await fetch(`https://jsearch.p.rapidapi.com/search?${q}`, {
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "jsearch.p.rapidapi.com",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`JSearch responded ${res.status}`);
  const body = (await res.json()) as { data?: JSearchJob[] };
  const jobs = body.data ?? [];
  memo.set(cacheKey, { at: Date.now(), jobs });
  if (memo.size > 200) memo.delete(memo.keys().next().value!);
  return jobs;
}

function normalize(job: JSearchJob): NormalizedJob {
  const place = [job.job_city, job.job_state, job.job_country].filter(Boolean).join(", ");
  return {
    source: "jsearch",
    sourceId: job.job_id,
    url: job.job_apply_link,
    title: job.job_title,
    company: job.employer_name,
    companyLogo: job.employer_logo ?? null,
    location: job.job_is_remote ? `Remote${place ? ` · ${place}` : ""}` : place || null,
    city: job.job_city ?? null,
    workSetup: job.job_is_remote ? "remote" : null,
    employmentType: TYPES[job.job_employment_type ?? ""] ?? null,
    salaryMin: job.job_min_salary ?? null,
    salaryMax: job.job_max_salary ?? null,
    salaryCurrency: job.job_salary_currency ?? "PHP",
    salaryPeriod: PERIODS[job.job_salary_period ?? ""] ?? null,
    // JSearch descriptions are plain text; keep paragraphs.
    description: cleanDescription(
      (job.job_description ?? "")
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`)
        .join(""),
    ),
    summary: null,
    skills: [],
    requirements: (job.job_highlights?.Qualifications ?? []).map((text) => ({ text, priority: "required" as const })),
    postedAt: job.job_posted_at_datetime_utc ?? null,
    possiblyStale: false,
  };
}

export const jsearchSource: JobSource = {
  id: "jsearch",
  label: "JSearch",
  attribution: { name: "Google for Jobs via JSearch", url: "https://rapidapi.com/letscrunch/api/jsearch" },
  enabled: (ctx) => Boolean(ctx.rapidApiKey),
  disabledNote: "Add a RapidAPI key in Settings to include JobStreet, Indeed, LinkedIn and Kalibrr listings",
  covers: () => true,
  async search(params, ctx) {
    const location = findLocation(params.locationId);
    const where = location ? ` in ${location.label}, Philippines` : params.locationId === "remote" ? "" : " in Philippines";
    const remoteOnly = params.locationId === "remote" || params.workSetup === "remote";
    const jobs = await fetchJSearch(ctx.rapidApiKey!, `${params.query}${where}`, remoteOnly, datePosted(params.postedWithinDays));
    return jobs.map(normalize);
  },
};
