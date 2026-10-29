import { COUNTRIES } from "@/lib/geo/countries";
import type { EmploymentType, SalaryPeriod } from "../../types";
import { cleanDescription } from "../../html";
import { fetchJson } from "../http";
import { blankJob, firstSegment, isoDate, setupFromText, type CompanyBoard } from "./types";

type Address = { postalAddress?: { addressCountry?: string; addressLocality?: string } };
type AshbyJob = {
  id: string;
  title: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  secondaryLocations?: { location?: string; address?: Address }[];
  isListed?: boolean;
  isRemote?: boolean | null;
  workplaceType?: string | null;
  address?: Address;
  jobUrl: string;
  descriptionHtml?: string;
  publishedAt?: string;
  compensation?: {
    summaryComponents?: { compensationType?: string; interval?: string; currencyCode?: string; minValue?: number | null; maxValue?: number | null }[];
  };
};

const EMPLOYMENT: Record<string, EmploymentType> = {
  FullTime: "full_time",
  PartTime: "part_time",
  Intern: "internship",
  Contract: "contract",
  Temporary: "contract",
};
const SETUPS = { OnSite: "onsite", Remote: "remote", Hybrid: "hybrid" } as const;
const PERIODS: Record<string, SalaryPeriod> = { "1 YEAR": "year", "1 MONTH": "month", "1 WEEK": "month", "1 DAY": "day", "1 HOUR": "hour" };

/** Ashby names countries ("United Kingdom"); the search filter wants ISO codes. */
function countryCode(name: string | undefined): string | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  if (n === "usa" || n === "us") return "US";
  if (n === "uk") return "GB";
  return COUNTRIES.find((c) => c.name.toLowerCase() === n || c.code.toLowerCase() === n)?.code ?? null;
}

export const ashby: CompanyBoard = {
  id: "ashby",
  label: "Ashby",
  hosts: ["api.ashbyhq.com"],
  slugFromUrl(url) {
    const host = url.hostname.toLowerCase();
    if (host === "jobs.ashbyhq.com") return firstSegment(url);
    if (host === "api.ashbyhq.com") return firstSegment(new URL(url.pathname.replace(/^\/posting-api\/job-board/, ""), url));
    return null;
  },
  async fetchJobs(slug) {
    const body = await fetchJson<{ jobs?: AshbyJob[] }>(`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`, {
      allowedHosts: this.hosts,
    });
    const jobs = (body.jobs ?? [])
      .filter((j) => j.isListed !== false)
      .map((j) => {
        const salary = j.compensation?.summaryComponents?.find((c) => c.compensationType === "Salary");
        const locations = [j.location, ...(j.secondaryLocations ?? []).map((l) => l.location)].filter(Boolean) as string[];
        const addresses = [j.address, ...(j.secondaryLocations ?? []).map((l) => l.address)];
        const countries = [...new Set(addresses.map((a) => countryCode(a?.postalAddress?.addressCountry)).filter(Boolean) as string[])];
        const workplace = j.workplaceType ? SETUPS[j.workplaceType as keyof typeof SETUPS] : undefined;
        return {
          ...blankJob("ashby"),
          sourceId: `${slug}:${j.id}`,
          url: j.jobUrl,
          title: j.title,
          company: slug,
          location: locations.join(" · ") || null,
          city: j.address?.postalAddress?.addressLocality ?? null,
          workSetup: workplace ?? (j.isRemote ? "remote" : setupFromText(j.location)),
          employmentType: EMPLOYMENT[j.employmentType ?? ""] ?? null,
          salaryMin: salary?.minValue ?? null,
          salaryMax: salary?.maxValue ?? null,
          salaryCurrency: salary?.currencyCode ?? "USD",
          salaryPeriod: salary ? (PERIODS[salary.interval ?? ""] ?? null) : null,
          description: cleanDescription(j.descriptionHtml),
          postedAt: isoDate(j.publishedAt),
          countries,
          team: j.team ?? j.department ?? null,
        };
      });
    return { name: null, jobs };
  },
};
