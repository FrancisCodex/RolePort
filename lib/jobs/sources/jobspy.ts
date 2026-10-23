import { cacheLife } from "next/cache";
import { isLocalMode, jobSpyUrl } from "@/lib/env";
import { countryOrDefault, type Country, type JobSpyBoard } from "@/lib/geo/countries";
import { findLocation } from "@/lib/ph-locations";
import { cleanDescription } from "../html";
import type { EmploymentType, JobSearchParams, JobSource, NormalizedJob, SalaryPeriod, WorkSetup } from "../types";
import { SOURCE_CREDITS } from "./credits";

/*
 * Job boards read through the JobSpy sidecar (services/jobspy, MIT). These boards forbid
 * automated access in their terms, so the sources are opt-in, self-host only, and cached
 * for hours to keep request volume at personal-search levels.
 */

/** One row of JobSpy's output (JobPost flattened by its serializer). */
type JobSpyJob = {
  id: string | null;
  job_url: string;
  title: string;
  company: string | null;
  location: string | null;
  date_posted: string | null;
  job_type: string | null;
  interval: string | null;
  min_amount: number | null;
  max_amount: number | null;
  currency: string | null;
  is_remote: boolean | null;
  work_from_home_type: string | null;
  description: string | null;
  company_logo: string | null;
  skills: string | null;
};

type Board = "linkedin" | "indeed" | "google" | JobSpyBoard;

const TYPES: Record<string, EmploymentType> = {
  fulltime: "full_time",
  parttime: "part_time",
  contract: "contract",
  internship: "internship",
};
const PERIODS: Record<string, SalaryPeriod> = { hourly: "hour", daily: "day", monthly: "month", yearly: "year" };

// JobSpy waits a few seconds between result pages and may open every posting.
const TIMEOUT_MS = 90_000;
const RESULTS = 20;

async function fetchJobSpy(baseUrl: string, query: string): Promise<JobSpyJob[]> {
  "use cache";
  cacheLife("hours");

  const res = await fetch(`${baseUrl}/search?${query}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  const body = (await res.json().catch(() => ({}))) as { jobs?: JobSpyJob[]; error?: string | null };
  if (!res.ok) throw new Error(`JobSpy responded ${res.status}: ${body.error ?? "no details"}`);
  const jobs = body.jobs ?? [];
  // A board that errors with nothing to show is unavailable; partial results still count.
  if (body.error && jobs.length === 0) throw new Error(body.error);
  return jobs;
}

/** Where to search, in the form each board understands. */
function locationFor(board: Board, params: JobSearchParams, country: Country): string {
  if (params.locationId === "remote") return country.name;
  const area = params.country === "PH" ? findLocation(params.locationId)?.label : params.city;
  // Single-country boards take a city on its own.
  if (board === "naukri" || board === "bdjobs" || board === "hellowork") return area ?? "";
  return area ? `${area}, ${country.name}` : country.name;
}

function workSetupOf(job: JobSpyJob): WorkSetup | null {
  const wfh = (job.work_from_home_type ?? "").toLowerCase();
  if (wfh.includes("hybrid")) return "hybrid";
  if (job.is_remote || wfh.includes("remote")) return "remote";
  return null;
}

function normalize(board: Board, job: JobSpyJob, fallbackCurrency: string): NormalizedJob {
  const location = job.location || null;
  return {
    source: board,
    sourceId: job.id || job.job_url,
    url: job.job_url,
    title: job.title,
    company: job.company || "Unknown company",
    companyLogo: job.company_logo || null,
    location,
    city: location?.split(",")[0]?.trim() || null,
    workSetup: workSetupOf(job),
    employmentType: TYPES[(job.job_type ?? "").split(",")[0].trim()] ?? null,
    salaryMin: job.min_amount != null ? Math.round(job.min_amount) : null,
    salaryMax: job.max_amount != null ? Math.round(job.max_amount) : null,
    salaryCurrency: job.currency || fallbackCurrency,
    salaryPeriod: PERIODS[job.interval ?? ""] ?? null,
    description: cleanDescription(job.description),
    summary: null,
    skills: (job.skills ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    requirements: [],
    postedAt: job.date_posted,
    possiblyStale: false,
  };
}

function boardSource(board: Board, covers: (country: Country) => boolean): JobSource {
  const remoteBoard = board === "linkedin" || board === "indeed";
  return {
    id: board,
    label: SOURCE_CREDITS[board].name,
    attribution: SOURCE_CREDITS[board],
    enabled: (ctx) => isLocalMode && Boolean(jobSpyUrl) && ctx.jobspyEnabled,
    disabledNote: "Turn on JobSpy in Settings (self-hosted only) to search this board",
    covers: (params) => covers(countryOrDefault(params.country)) && (params.locationId !== "remote" || remoteBoard),
    async search(params) {
      const country = countryOrDefault(params.country);
      const q = new URLSearchParams({
        site: board,
        term: params.query,
        location: locationFor(board, params, country),
        country_indeed: country.jobspy?.indeed ?? "",
        is_remote: String(params.locationId === "remote" || params.workSetup === "remote"),
        results: String(RESULTS),
      });
      if (params.postedWithinDays) q.set("hours_old", String(params.postedWithinDays * 24));
      const jobs = await fetchJobSpy(jobSpyUrl!, q.toString());
      return jobs.map((job) => normalize(board, job, country.currency));
    },
  };
}

const hasBoard = (board: JobSpyBoard) => (country: Country) => Boolean(country.jobspy?.boards?.includes(board));

export const jobSpySources: JobSource[] = [
  boardSource("linkedin", () => true),
  boardSource("indeed", (c) => Boolean(c.jobspy?.indeed)),
  boardSource("google", () => true),
  boardSource("glassdoor", hasBoard("glassdoor")),
  boardSource("bayt", hasBoard("bayt")),
  boardSource("naukri", hasBoard("naukri")),
  boardSource("bdjobs", hasBoard("bdjobs")),
  boardSource("zip_recruiter", hasBoard("zip_recruiter")),
  boardSource("hellowork", hasBoard("hellowork")),
];
