import { cacheLife } from "next/cache";
import { cleanDescription } from "../html";
import type { EmploymentType, JobSource } from "../types";
import { decodeEntities } from "./companies/greenhouse";
import { isoDate, setupFromText } from "./companies/types";
import { SOURCE_CREDITS } from "./credits";
import { emptyJob, keepMatching, type FeedJob } from "./feed";
import { fetchJson } from "./http";

// Arbeitnow: a free job board API for Germany, newest first. Credit Arbeitnow and link to the posting there.
export type ArbeitnowJob = {
  slug: string;
  company_name: string;
  title: string;
  description?: string | null;
  remote?: boolean;
  url: string;
  tags?: string[];
  job_types?: string[];
  location?: string | null;
  created_at?: number | null;
};

/** Pages of the newest postings to read (100 each). */
const PAGES = 2;

function employment(types: string[] = []): EmploymentType | null {
  const text = types.join(" ").toLowerCase();
  if (/intern|praktik/.test(text)) return "internship";
  if (/werkstudent|working student|part[ -]?time|teilzeit/.test(text)) return "part_time";
  if (/freelance|freiberuf/.test(text)) return "freelance";
  if (/contract|befrist/.test(text)) return "contract";
  if (/full[ -]?time|vollzeit/.test(text)) return "full_time";
  return null;
}

async function fetchArbeitnow(): Promise<ArbeitnowJob[]> {
  "use cache";
  cacheLife("hours");
  const jobs: ArbeitnowJob[] = [];
  for (let page = 1; page <= PAGES; page++) {
    const body = await fetchJson<{ data?: ArbeitnowJob[] }>(`https://www.arbeitnow.com/api/job-board-api?page=${page}`, {
      allowedHosts: ["www.arbeitnow.com"],
    });
    jobs.push(...(body.data ?? []));
  }
  return jobs;
}

export function normalizeArbeitnow(job: ArbeitnowJob): FeedJob {
  return {
    ...emptyJob("arbeitnow"),
    sourceId: job.slug,
    url: job.url,
    title: job.title,
    company: job.company_name,
    location: !job.location ? "Germany" : /\bgermany\b|\bdeutschland\b/i.test(job.location) ? job.location : `${job.location}, Germany`,
    city: job.location?.split(/[;,]/)[0]?.trim() || null,
    workSetup: job.remote ? "remote" : setupFromText(job.title, job.location),
    employmentType: employment(job.job_types),
    salaryCurrency: "EUR",
    // The feed escapes its HTML once more.
    description: cleanDescription(job.description ? decodeEntities(job.description) : null),
    skills: job.tags ?? [],
    postedAt: job.created_at ? isoDate(job.created_at * 1000) : null,
    countries: ["DE"],
  };
}

export const arbeitnowSource: JobSource = {
  id: "arbeitnow",
  label: "Arbeitnow",
  kind: "board",
  coverage: "Germany",
  attribution: SOURCE_CREDITS.arbeitnow,
  enabled: () => true,
  covers: (params) => params.country === "DE",
  async search(params) {
    return keepMatching((await fetchArbeitnow()).map(normalizeArbeitnow), params);
  },
};
