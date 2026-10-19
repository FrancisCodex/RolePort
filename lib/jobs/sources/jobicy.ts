import { cacheLife } from "next/cache";
import { cleanDescription } from "../html";
import type { EmploymentType, JobSource, NormalizedJob, SalaryPeriod } from "../types";

// Jobicy's terms: credit Jobicy with a link, and send applicants to the original job URL.
type JobicyJob = {
  id: number;
  url: string;
  jobTitle: string;
  companyName: string;
  companyLogo?: string;
  jobType?: string[];
  jobGeo?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
};

const TYPES: Record<string, EmploymentType> = {
  "full-time": "full_time",
  "part-time": "part_time",
  contract: "contract",
  internship: "internship",
  freelance: "freelance",
};
const PERIODS: Record<string, SalaryPeriod> = {
  hourly: "hour",
  daily: "day",
  monthly: "month",
  yearly: "year",
  annual: "year",
};

async function fetchJobicy(tag: string): Promise<JobicyJob[]> {
  "use cache";
  cacheLife("hours");

  const q = new URLSearchParams({ count: "30", geo: "philippines" });
  if (tag) q.set("tag", tag);
  const res = await fetch(`https://jobicy.com/api/v2/remote-jobs?${q}`, {
    headers: { Accept: "application/json", "User-Agent": "HireMe/0.1 (job search for the Philippines)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Jobicy responded ${res.status}`);
  const body = (await res.json()) as { jobs?: JobicyJob[] };
  return body.jobs ?? [];
}

function normalize(job: JobicyJob): NormalizedJob {
  return {
    source: "jobicy",
    sourceId: String(job.id),
    url: job.url,
    title: job.jobTitle,
    company: job.companyName,
    companyLogo: job.companyLogo ?? null,
    location: job.jobGeo ? `Remote · ${job.jobGeo}` : "Remote",
    city: null,
    workSetup: "remote",
    employmentType: TYPES[(job.jobType?.[0] ?? "").toLowerCase()] ?? null,
    salaryMin: job.salaryMin ?? null,
    salaryMax: job.salaryMax ?? null,
    salaryCurrency: job.salaryCurrency ?? "USD",
    salaryPeriod: PERIODS[(job.salaryPeriod ?? "").toLowerCase()] ?? null,
    description: cleanDescription(job.jobDescription ?? job.jobExcerpt),
    summary: null,
    skills: [],
    requirements: [],
    postedAt: job.pubDate ?? null,
    possiblyStale: false,
  };
}

export const jobicySource: JobSource = {
  id: "jobicy",
  label: "Jobicy",
  attribution: { name: "Jobicy", url: "https://jobicy.com" },
  enabled: true,
  // Jobicy only lists remote roles.
  covers: (params) =>
    (params.locationId === undefined || params.locationId === "remote") &&
    (params.workSetup === undefined || params.workSetup === "remote"),
  async search(params) {
    const jobs = await fetchJobicy(params.query.trim().toLowerCase());
    const cutoff = params.postedWithinDays ? Date.now() - params.postedWithinDays * 86_400_000 : 0;
    return jobs.map(normalize).filter((j) => !cutoff || !j.postedAt || Date.parse(j.postedAt) >= cutoff);
  },
};
