import { countryOrDefault, type Country, type JobSpyBoard } from "@/lib/geo/countries";
import { findLocation } from "@/lib/ph-locations";
import { cleanDescription } from "../html";
import type { EmploymentType, JobSearchParams, NormalizedJob, SalaryPeriod, WorkSetup } from "../types";
import { SOURCE_CREDITS } from "./credits";

/*
 * The job boards read through the JobSpy service (services/jobspy, MIT): which boards cover
 * a search, the request for each, and how a result maps to a NormalizedJob. Shared by the
 * self-hosted server source (./jobspy.ts) and the lite edition, which calls the service on
 * the user's computer from the browser. These boards forbid automated access in their
 * terms, so both keep it opt-in and personal.
 */

/** One row of JobSpy's output (JobPost flattened by its serializer). */
export type JobSpyJob = {
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

export type Board = "linkedin" | "indeed" | "google" | JobSpyBoard;

const TYPES: Record<string, EmploymentType> = {
  fulltime: "full_time",
  parttime: "part_time",
  contract: "contract",
  internship: "internship",
};
const PERIODS: Record<string, SalaryPeriod> = { hourly: "hour", daily: "day", monthly: "month", yearly: "year" };

// JobSpy waits a few seconds between result pages and may open every posting.
export const JOBSPY_TIMEOUT_MS = 90_000;
const RESULTS = 20;

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

export function normalizeJobSpyJob(board: Board, job: JobSpyJob, fallbackCurrency: string): NormalizedJob {
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

const hasBoard = (board: JobSpyBoard) => (country: Country) => Boolean(country.jobspy?.boards?.includes(board));

/** The boards in the order their results rank when two carry the same posting. */
const BOARDS: { board: Board; covers: (country: Country) => boolean }[] = [
  { board: "linkedin", covers: () => true },
  { board: "indeed", covers: (c) => Boolean(c.jobspy?.indeed) },
  { board: "google", covers: () => true },
  { board: "glassdoor", covers: hasBoard("glassdoor") },
  { board: "bayt", covers: hasBoard("bayt") },
  { board: "naukri", covers: hasBoard("naukri") },
  { board: "bdjobs", covers: hasBoard("bdjobs") },
  { board: "zip_recruiter", covers: hasBoard("zip_recruiter") },
  { board: "hellowork", covers: hasBoard("hellowork") },
];

export const JOBSPY_BOARDS = BOARDS.map(({ board, covers }) => ({
  board,
  label: SOURCE_CREDITS[board].name,
  /** Whether this board has anything for the search (only LinkedIn and Indeed list remote roles). */
  covers: (params: JobSearchParams) =>
    covers(countryOrDefault(params.country)) && (params.locationId !== "remote" || board === "linkedin" || board === "indeed"),
}));

/** The service's /search query for one board. */
export function jobSpyQuery(board: Board, params: JobSearchParams): string {
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
  return q.toString();
}

/** The jobs in a /search response, or an error when the board failed with nothing to show. */
export function readJobSpyResponse(status: number, body: { jobs?: JobSpyJob[]; error?: string | null }): JobSpyJob[] {
  if (status < 200 || status >= 300) throw new Error(`JobSpy responded ${status}: ${body.error ?? "no details"}`);
  const jobs = body.jobs ?? [];
  // A board that errors with nothing to show is unavailable; partial results still count.
  if (body.error && jobs.length === 0) throw new Error(body.error);
  return jobs;
}
