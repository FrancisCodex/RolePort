import type { SalaryPeriod } from "../../types";
import { cleanDescription } from "../../html";
import { fetchJson } from "../http";
import { blankJob, isoDate, validSlug, type CompanyBoard } from "./types";
import { leverEmployment } from "./lever";

type RecruiteeOffer = {
  id: number;
  title: string;
  status?: string;
  description?: string;
  requirements?: string;
  location?: string;
  city?: string;
  country_code?: string;
  locations?: { city?: string; country_code?: string }[];
  remote?: boolean;
  hybrid?: boolean;
  on_site?: boolean;
  employment_type_code?: string;
  careers_url?: string;
  published_at?: string;
  created_at?: string;
  company_name?: string;
  department?: string;
  salary?: { min?: number | string | null; max?: number | string | null; currency?: string | null; period?: string | null };
};

const PERIODS: Record<string, SalaryPeriod> = { year: "year", month: "month", week: "month", day: "day", hour: "hour" };
const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

export const recruitee: CompanyBoard = {
  id: "recruitee",
  label: "Recruitee",
  hosts: ["*.recruitee.com"],
  slugFromUrl(url) {
    const match = url.hostname.toLowerCase().match(/^([a-z0-9-]+)\.recruitee\.com$/);
    return match && match[1] !== "www" && match[1] !== "api" ? validSlug(match[1]) : null;
  },
  async fetchJobs(slug) {
    const body = await fetchJson<{ offers?: RecruiteeOffer[] }>(`https://${slug.toLowerCase()}.recruitee.com/api/offers/`, {
      allowedHosts: this.hosts,
    });
    const jobs = (body.offers ?? [])
      .filter((o) => !o.status || o.status === "published")
      .map((o) => ({
        ...blankJob("recruitee"),
        sourceId: `${slug}:${o.id}`,
        url: o.careers_url ?? `https://${slug}.recruitee.com/o/${o.id}`,
        title: o.title,
        company: o.company_name ?? slug,
        location: o.location ?? null,
        city: o.city ?? null,
        workSetup: o.remote ? ("remote" as const) : o.hybrid ? ("hybrid" as const) : o.on_site ? ("onsite" as const) : null,
        employmentType: leverEmployment(o.employment_type_code?.replace("fulltime", "full")),
        salaryMin: num(o.salary?.min),
        salaryMax: num(o.salary?.max),
        salaryCurrency: o.salary?.currency ?? "USD",
        salaryPeriod: PERIODS[o.salary?.period ?? ""] ?? null,
        description: cleanDescription(`${o.description ?? ""}${o.requirements ?? ""}`),
        postedAt: isoDate(o.published_at ?? o.created_at),
        countries: [
          ...new Set([o.country_code, ...(o.locations ?? []).map((l) => l.country_code)].filter(Boolean).map((c) => c!.toUpperCase())),
        ],
        team: o.department ?? null,
      }));
    return { name: body.offers?.[0]?.company_name ?? null, jobs };
  },
};
