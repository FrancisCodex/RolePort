import { cleanDescription } from "../../html";
import { fetchJson } from "../http";
import { blankJob, firstSegment, isoDate, setupFromText, type CompanyBoard } from "./types";
import { leverEmployment } from "./lever";

type WorkableJob = {
  title: string;
  shortcode: string;
  employment_type?: string;
  telecommuting?: boolean;
  department?: string;
  url?: string;
  shortlink?: string;
  published_on?: string;
  created_at?: string;
  country?: string;
  city?: string;
  state?: string;
  locations?: { country?: string; countryCode?: string; city?: string; region?: string; hidden?: boolean }[];
  description?: string;
};

export const workable: CompanyBoard = {
  id: "workable",
  label: "Workable",
  hosts: ["apply.workable.com"],
  slugFromUrl(url) {
    const host = url.hostname.toLowerCase();
    if (host !== "apply.workable.com") return null;
    const segments = url.pathname.split("/").filter(Boolean);
    // apply.workable.com/api/v1/widget/accounts/acme; /j/<code> links don't name the company.
    if (segments[0] === "api") return segments[4] && /^[A-Za-z0-9._-]+$/.test(segments[4]) ? segments[4] : null;
    return segments[0] === "j" ? null : firstSegment(url);
  },
  async fetchJobs(slug) {
    const body = await fetchJson<{ name?: string; jobs?: WorkableJob[] }>(`https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`, {
      allowedHosts: this.hosts,
    });
    const jobs = (body.jobs ?? []).map((j) => {
      const places = (j.locations ?? []).filter((l) => !l.hidden);
      const location = places.length
        ? places.map((l) => [l.city, l.region, l.country].filter(Boolean).join(", ")).join(" · ")
        : [j.city, j.state, j.country].filter(Boolean).join(", ") || null;
      return {
        ...blankJob("workable"),
        sourceId: `${slug}:${j.shortcode}`,
        url: j.url ?? j.shortlink ?? `https://apply.workable.com/${slug}/j/${j.shortcode}/`,
        title: j.title,
        company: body.name ?? slug,
        location,
        city: places[0]?.city ?? j.city ?? null,
        workSetup: j.telecommuting ? ("remote" as const) : setupFromText(j.title),
        employmentType: leverEmployment(j.employment_type),
        description: cleanDescription(j.description),
        postedAt: isoDate(j.published_on ?? j.created_at),
        countries: [...new Set(places.map((l) => l.countryCode?.toUpperCase()).filter(Boolean) as string[])],
        team: j.department ?? null,
      };
    });
    return { name: body.name ?? null, jobs };
  },
};
