import { cacheLife } from "next/cache";
import { cleanDescription } from "../html";
import type { EmploymentType, JobSource } from "../types";
import { isoDate } from "./companies/types";
import { SOURCE_CREDITS } from "./credits";
import { countryCodes, coversRemote, emptyJob, keepMatching, SIX_HOURS, type FeedJob } from "./feed";
import { fetchJson } from "./http";

// Remotive's terms: credit Remotive and link to the posting on Remotive, and call the API rarely
// (about four times a day). So RolePort reads the whole feed every six hours and searches it itself.
export type RemotiveJob = {
  id: number;
  url: string;
  title: string;
  company_name: string;
  company_logo?: string | null;
  category?: string | null;
  tags?: string[];
  job_type?: string | null;
  publication_date?: string | null;
  candidate_required_location?: string | null;
  description?: string | null;
};

const TYPES: Record<string, EmploymentType> = {
  full_time: "full_time",
  part_time: "part_time",
  contract: "contract",
  freelance: "freelance",
  internship: "internship",
};

async function fetchRemotive(): Promise<RemotiveJob[]> {
  "use cache";
  cacheLife(SIX_HOURS);
  const body = await fetchJson<{ jobs?: RemotiveJob[] }>("https://remotive.com/api/remote-jobs", { allowedHosts: ["remotive.com"] });
  return body.jobs ?? [];
}

/** Remotive gives times without a zone; they're UTC. */
function utc(date: string | null | undefined): string | null {
  if (!date) return null;
  return isoDate(/[zZ]|[+-]\d\d:?\d\d$/.test(date) ? date : `${date}Z`);
}

export function normalizeRemotive(job: RemotiveJob): FeedJob {
  const where = job.candidate_required_location?.trim() || "Worldwide";
  return {
    ...emptyJob("remotive"),
    sourceId: String(job.id),
    url: job.url,
    title: job.title,
    company: job.company_name,
    companyLogo: job.company_logo || null,
    location: `Remote · ${where}`,
    workSetup: "remote",
    employmentType: TYPES[job.job_type ?? ""] ?? null,
    description: cleanDescription(job.description),
    skills: job.tags ?? [],
    postedAt: utc(job.publication_date),
    countries: countryCodes(where.split(/\s*[,;/|]\s*/)),
    team: job.category ?? null,
  };
}

export const remotiveSource: JobSource = {
  id: "remotive",
  label: "Remotive",
  kind: "remote",
  coverage: "Remote jobs, worldwide or for the countries each one lists",
  attribution: SOURCE_CREDITS.remotive,
  enabled: () => true,
  covers: coversRemote,
  async search(params) {
    return keepMatching((await fetchRemotive()).map(normalizeRemotive), params);
  },
};
