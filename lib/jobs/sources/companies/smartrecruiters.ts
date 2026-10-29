import { fetchJson, fetchPages } from "../http";
import { blankJob, firstSegment, isoDate, type CompanyBoard } from "./types";
import { leverEmployment } from "./lever";

type SmartRecruitersJob = {
  id: string;
  name: string;
  releasedDate?: string;
  company?: { identifier?: string; name?: string };
  location?: { city?: string; country?: string; remote?: boolean; hybrid?: boolean; fullLocation?: string };
  typeOfEmployment?: { label?: string };
  department?: { label?: string };
  function?: { label?: string };
};
type Page = { totalFound?: number; offset?: number; content?: SmartRecruitersJob[] };

const PAGE_SIZE = 100;
// Large employers list thousands of jobs, so the board filters by query and country itself.
const MAX_PAGES = 3;

export const smartRecruiters: CompanyBoard = {
  id: "smartrecruiters",
  label: "SmartRecruiters",
  hosts: ["api.smartrecruiters.com"],
  filtersOnServer: true,
  slugFromUrl(url) {
    const host = url.hostname.toLowerCase();
    if (host === "jobs.smartrecruiters.com" || host === "careers.smartrecruiters.com") return firstSegment(url);
    if (host === "api.smartrecruiters.com") return firstSegment(new URL(url.pathname.replace(/^\/v1\/companies/, ""), url));
    return null;
  },
  async fetchJobs(slug, hint) {
    let name: string | null = null;
    const raw = await fetchPages<SmartRecruitersJob>(
      async (page) => {
        const q = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
        if (hint.query) q.set("q", hint.query);
        if (hint.country) q.set("country", hint.country.toLowerCase());
        const body = await fetchJson<Page>(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?${q}`, { allowedHosts: this.hosts });
        const items = body.content ?? [];
        name ??= items[0]?.company?.name ?? null;
        return { items, done: (page + 1) * PAGE_SIZE >= (body.totalFound ?? 0) };
      },
      { maxPages: MAX_PAGES },
    );
    const jobs = raw.map((j) => {
      const loc = j.location ?? {};
      return {
        ...blankJob("smartrecruiters"),
        sourceId: `${slug}:${j.id}`,
        url: `https://jobs.smartrecruiters.com/${encodeURIComponent(j.company?.identifier ?? slug)}/${encodeURIComponent(j.id)}`,
        title: j.name,
        company: j.company?.name ?? slug,
        location: loc.fullLocation ?? null,
        city: loc.city ?? null,
        workSetup: loc.remote ? ("remote" as const) : loc.hybrid ? ("hybrid" as const) : null,
        employmentType: leverEmployment(j.typeOfEmployment?.label),
        postedAt: isoDate(j.releasedDate),
        countries: loc.country ? [loc.country.toUpperCase()] : [],
        team: j.department?.label ?? j.function?.label ?? null,
      };
    });
    return { name, jobs };
  },
};
