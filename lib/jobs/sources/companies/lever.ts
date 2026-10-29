import type { EmploymentType, SalaryPeriod } from "../../types";
import { cleanDescription } from "../../html";
import { fetchJson, SourceHttpError } from "../http";
import { blankJob, firstSegment, isoDate, secondSegment, setupFromText, type CompanyBoard, type CompanyJob } from "./types";

type LeverJob = {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  country?: string;
  workplaceType?: string;
  description?: string;
  lists?: { text: string; content: string }[];
  additional?: string;
  categories?: { location?: string; team?: string; commitment?: string; allLocations?: string[] };
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
};

export function leverEmployment(commitment: string | undefined): EmploymentType | null {
  const c = (commitment ?? "").toLowerCase();
  if (c.includes("intern")) return "internship";
  if (c.includes("part")) return "part_time";
  if (c.includes("contract") || c.includes("fixed") || c.includes("temp")) return "contract";
  if (c.includes("freelance")) return "freelance";
  if (c.includes("full")) return "full_time";
  return null;
}

function leverPeriod(interval: string | undefined): SalaryPeriod | null {
  const i = (interval ?? "").toLowerCase();
  if (i.includes("year")) return "year";
  if (i.includes("month")) return "month";
  if (i.includes("hour")) return "hour";
  if (i.includes("day")) return "day";
  return null;
}

const SETUPS = { remote: "remote", hybrid: "hybrid", onsite: "onsite", "on-site": "onsite" } as const;

function toJob(slug: string, j: LeverJob): CompanyJob {
  const c = j.categories ?? {};
  const html = [
    j.description ?? "",
    ...(j.lists ?? []).map((l) => `<h3>${l.text}</h3><ul>${l.content}</ul>`),
    j.additional ?? "",
  ].join("");
  const workplace = SETUPS[(j.workplaceType ?? "").toLowerCase() as keyof typeof SETUPS];
  return {
    ...blankJob("lever"),
    sourceId: `${slug}:${j.id}`,
    url: j.hostedUrl,
    title: j.text,
    company: slug,
    location: c.allLocations?.length ? c.allLocations.join(" · ") : (c.location ?? null),
    city: c.location?.split(",")[0]?.trim() || null,
    workSetup: workplace ?? setupFromText(c.location),
    employmentType: leverEmployment(c.commitment),
    salaryMin: j.salaryRange?.min ?? null,
    salaryMax: j.salaryRange?.max ?? null,
    salaryCurrency: j.salaryRange?.currency ?? "USD",
    salaryPeriod: leverPeriod(j.salaryRange?.interval),
    description: cleanDescription(html),
    postedAt: isoDate(j.createdAt),
    countries: j.country ? [j.country.toUpperCase()] : [],
    team: c.team ?? null,
  };
}

export const lever: CompanyBoard = {
  id: "lever",
  label: "Lever",
  hosts: ["api.lever.co"],
  slugFromUrl(url) {
    const host = url.hostname.toLowerCase();
    if (host === "jobs.lever.co") return firstSegment(url);
    if (host === "api.lever.co") return firstSegment(new URL(url.pathname.replace(/^\/v0\/postings/, ""), url));
    return null;
  },
  // jobs.lever.co/acme/<posting id>, also with /apply after it.
  postingId: (url) => (url.hostname.toLowerCase() === "jobs.lever.co" ? secondSegment(url) : null),
  async fetchJobs(slug) {
    const body = await fetchJson<LeverJob[]>(`https://api.lever.co/v0/postings/${slug}?mode=json`, { allowedHosts: this.hosts });
    return { name: null, jobs: (Array.isArray(body) ? body : []).map((j) => toJob(slug, j)) };
  },
  async fetchPosting(slug, id) {
    try {
      return toJob(slug, await fetchJson<LeverJob>(`https://api.lever.co/v0/postings/${slug}/${id}?mode=json`, { allowedHosts: this.hosts }));
    } catch (error) {
      if (error instanceof SourceHttpError && error.status === 404) return null;
      throw error;
    }
  },
};
