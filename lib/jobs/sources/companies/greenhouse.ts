import { cleanDescription } from "../../html";
import { fetchJson, SourceHttpError } from "../http";
import { blankJob, firstSegment, isoDate, segmentAfter, setupFromText, validSlug, type CompanyBoard, type CompanyJob } from "./types";

type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url: string;
  company_name?: string;
  location?: { name?: string };
  content?: string;
  departments?: { name: string }[];
  first_published?: string;
  updated_at?: string;
};

/** Greenhouse sends descriptions as escaped HTML ("&lt;p&gt;"). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|quot|apos|#39|amp|nbsp);/gi, (_, code: string) => {
    const c = code.toLowerCase();
    if (c.startsWith("#x")) return String.fromCodePoint(parseInt(c.slice(2), 16));
    if (c.startsWith("#")) return String.fromCodePoint(Number(c.slice(1)));
    return { lt: "<", gt: ">", quot: '"', apos: "'", amp: "&", nbsp: " " }[c] ?? "";
  });
}

function toJob(slug: string, j: GreenhouseJob): CompanyJob {
  const location = j.location?.name?.trim() || null;
  return {
    ...blankJob("greenhouse"),
    sourceId: `${slug}:${j.id}`,
    url: j.absolute_url,
    title: j.title,
    company: j.company_name ?? slug,
    location,
    workSetup: setupFromText(location, j.title),
    description: cleanDescription(j.content ? decodeEntities(j.content) : null),
    postedAt: isoDate(j.first_published ?? j.updated_at),
    team: j.departments?.[0]?.name ?? null,
  };
}

export const greenhouse: CompanyBoard = {
  id: "greenhouse",
  label: "Greenhouse",
  hosts: ["boards-api.greenhouse.io"],
  slugFromUrl(url) {
    const host = url.hostname.toLowerCase();
    if (!/^(boards|job-boards)(\.eu)?\.greenhouse\.io$/.test(host) && host !== "boards-api.greenhouse.io") return null;
    // Embedded boards: boards.greenhouse.io/embed/job_board?for=acme
    const embedded = validSlug(url.searchParams.get("for"));
    if (embedded) return embedded;
    const segments = url.pathname.split("/").filter(Boolean);
    if (host === "boards-api.greenhouse.io") return validSlug(segments[2]); // /v1/boards/acme/jobs
    return segments[0] === "embed" ? null : firstSegment(url);
  },
  postingId(url) {
    // job-boards.greenhouse.io/acme/jobs/123, or a company's own careers page with the board embedded (?gh_jid=123).
    const id = url.searchParams.get("gh_jid") ?? url.searchParams.get("token") ?? segmentAfter(url, "jobs");
    return id && /^\d+$/.test(id) ? id : null;
  },
  async fetchJobs(slug) {
    const body = await fetchJson<{ jobs?: GreenhouseJob[] }>(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`, {
      allowedHosts: this.hosts,
    });
    return { name: body.jobs?.[0]?.company_name ?? null, jobs: (body.jobs ?? []).map((j) => toJob(slug, j)) };
  },
  async fetchPosting(slug, id) {
    try {
      return toJob(slug, await fetchJson<GreenhouseJob>(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs/${id}`, { allowedHosts: this.hosts }));
    } catch (error) {
      if (error instanceof SourceHttpError && error.status === 404) return null;
      throw error;
    }
  },
};
