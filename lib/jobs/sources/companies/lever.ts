import type { EmploymentType, SalaryPeriod } from "../../types";
import { cleanDescription } from "../../html";
import { fetchJson } from "../http";
import { blankJob, firstSegment, isoDate, setupFromText, type CompanyBoard } from "./types";

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
  async fetchJobs(slug) {
    const body = await fetchJson<LeverJob[]>(`https://api.lever.co/v0/postings/${slug}?mode=json`, { allowedHosts: this.hosts });
    const jobs = (Array.isArray(body) ? body : []).map((j) => {
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
    });
    return { name: null, jobs };
  },
};
