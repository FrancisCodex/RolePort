import { cleanDescription } from "../../html";
import { fetchJson, fetchPages, SourceHttpError } from "../http";
import { blankJob, firstSegment, isoDate, secondSegment, type CompanyBoard, type CompanyJob } from "./types";
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
/** One posting by id adds the ad's text, which the list leaves out. */
type SmartRecruitersPosting = SmartRecruitersJob & {
  active?: boolean;
  postingUrl?: string;
  jobAd?: { sections?: Record<string, { title?: string; text?: string } | undefined> };
};

const PAGE_SIZE = 100;
// Large employers list thousands of jobs, so the board filters by query and country itself.
const MAX_PAGES = 3;
const SECTIONS = ["companyDescription", "jobDescription", "qualifications", "additionalInformation"];

function toJob(slug: string, j: SmartRecruitersJob): CompanyJob {
  const loc = j.location ?? {};
  return {
    ...blankJob("smartrecruiters"),
    sourceId: `${slug}:${j.id}`,
    url: `https://jobs.smartrecruiters.com/${encodeURIComponent(j.company?.identifier ?? slug)}/${encodeURIComponent(j.id)}`,
    title: j.name,
    company: j.company?.name ?? slug,
    location: loc.fullLocation ?? null,
    city: loc.city ?? null,
    workSetup: loc.remote ? "remote" : loc.hybrid ? "hybrid" : null,
    employmentType: leverEmployment(j.typeOfEmployment?.label),
    postedAt: isoDate(j.releasedDate),
    countries: loc.country ? [loc.country.toUpperCase()] : [],
    team: j.department?.label ?? j.function?.label ?? null,
  };
}

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
  postingId(url) {
    // jobs.smartrecruiters.com/Acme/744000012345678-backend-engineer
    if (url.hostname.toLowerCase() !== "jobs.smartrecruiters.com") return null;
    return secondSegment(url)?.match(/^\d+/)?.[0] ?? null;
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
    return { name, jobs: raw.map((j) => toJob(slug, j)) };
  },
  async fetchPosting(slug, id) {
    let posting: SmartRecruitersPosting;
    try {
      posting = await fetchJson<SmartRecruitersPosting>(`https://api.smartrecruiters.com/v1/companies/${slug}/postings/${id}`, { allowedHosts: this.hosts });
    } catch (error) {
      if (error instanceof SourceHttpError && (error.status === 404 || error.status === 410)) return null;
      throw error;
    }
    if (posting.active === false) return null;
    const sections = posting.jobAd?.sections ?? {};
    const html = SECTIONS.map((key) => sections[key])
      .filter((s) => s?.text)
      .map((s) => `${s!.title ? `<h3>${s!.title}</h3>` : ""}${s!.text}`)
      .join("");
    return { ...toJob(slug, posting), description: cleanDescription(html) };
  },
};
