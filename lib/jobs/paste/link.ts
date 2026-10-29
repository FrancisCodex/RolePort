import "server-only";
import { boardCareersUrl } from "@/lib/companies/starters";
import { BOARDS, boardFromHtml, boardFromUrl } from "@/lib/jobs/sources/companies";
import { SourceHttpError } from "@/lib/jobs/sources/http";
import { isCompanySource, type AtsId, type CompanyJob } from "@/lib/jobs/sources/companies/types";
import { assertPublicUrl, safeFetchText, UnsafeUrlError, type SafeFetchResult } from "@/lib/net/safe-url";
import type { Result } from "@/lib/result";
import { closedNotice, findJobPosting, isPastDate, jobFromJsonLd, pageText } from "./page";
import { PASTED_SOURCE, type JobCheck, type LinkRead, type PasteReview, type PastedJob } from "./types";

/*
 * Server side of "Paste a job": reads a pasted link, and checks whether a saved job is still
 * open. Links go through the private-address guard (at most 3 redirects, 2 MB), and the same
 * page isn't fetched again within an hour. Used by the self-hosted actions and the lite
 * edition's /api/lite/job-link and /api/lite/job-check routes.
 */


// Sites whose terms don't allow reading their pages automatically. The user pastes the text instead.
const NOT_READ: [RegExp, string][] = [
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
  [/(^|\.)(facebook|fb)\.com$/, "Facebook"],
  [/(^|\.)indeed\.[a-z.]+$/, "Indeed"],
  [/(^|\.)glassdoor\.[a-z.]+$/, "Glassdoor"],
  [/(^|\.)onlinejobs\.ph$/, "OnlineJobs.ph"],
];

const PAGE_TTL_MS = 60 * 60_000;
const MAX_CACHED_PAGES = 200;
const pages = new Map<string, { at: number; page: Promise<SafeFetchResult> }>();

/** One page through the guard; the same link within the hour reuses the first answer. */
function fetchPage(url: URL): Promise<SafeFetchResult> {
  const key = url.toString();
  const hit = pages.get(key);
  if (hit && Date.now() - hit.at < PAGE_TTL_MS) return hit.page;
  if (pages.size >= MAX_CACHED_PAGES) pages.delete(pages.keys().next().value!);
  const page = safeFetchText(url);
  pages.set(key, { at: Date.now(), page });
  page.catch(() => pages.delete(key)); // a failed fetch can be tried again
  return page;
}

const now = () => new Date().toISOString();
const trimSlash = (path: string) => path.replace(/\/+$/, "");

function titleCase(slug: string): string {
  return slug.replace(/[-_.]+/g, " ").replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/** Whether a feed posting is the one `url` links to: by its id, or by its link (Recruitee's offer pages). */
function isPosting(job: CompanyJob, id: string, url: URL): boolean {
  if (job.sourceId.endsWith(`:${id}`)) return true;
  try {
    const link = new URL(job.url);
    const path = trimSlash(link.pathname);
    return link.hostname === url.hostname && path.length > 1 && (url.pathname === path || url.pathname.startsWith(`${path}/`));
  } catch {
    return false;
  }
}

/** The posting a link points to on a hiring system, null when it's gone, undefined when the link names no posting. */
async function postingOnBoard(ats: AtsId, slug: string, url: URL): Promise<CompanyJob | null | undefined> {
  const board = BOARDS[ats];
  const id = board.postingId(url);
  if (!id) return undefined;
  if (board.fetchPosting) return board.fetchPosting(slug, id);
  const { jobs } = await board.fetchJobs(slug, {});
  return jobs.find((j) => isPosting(j, id, url)) ?? null;
}

function boardReview(ats: AtsId, slug: string, found: CompanyJob): PasteReview {
  // Lever and Ashby feeds don't name the company, only its slug.
  const company = found.company === slug ? titleCase(slug) : found.company;
  const job: PastedJob = {
    source: ats,
    sourceId: found.sourceId,
    url: found.url,
    title: found.title,
    company,
    companyLogo: found.companyLogo,
    location: found.location,
    workSetup: found.workSetup,
    employmentType: found.employmentType,
    salaryMin: found.salaryMin,
    salaryMax: found.salaryMax,
    salaryCurrency: found.salaryMin || found.salaryMax ? found.salaryCurrency : "",
    salaryPeriod: found.salaryPeriod,
    description: found.description,
    requirements: found.requirements,
    skills: found.skills,
    postedAt: found.postedAt,
    expiresAt: null,
  };
  return {
    job,
    how: "board",
    board: { ats, label: BOARDS[ats].label, name: company, careersUrl: boardCareersUrl(ats, slug) },
    notes: [],
    check: { status: "open", reason: `Listed on ${company}'s careers page (${BOARDS[ats].label}).`, at: now() },
  };
}

const PASTE_TEXT = "Copy the job description from the page and paste the text here instead.";

/** Reads a pasted job link: from the company's hiring system when RolePort reads it, else from the page. */
export async function readJobLink(input: string): Promise<Result<LinkRead>> {
  let url: URL;
  try {
    url = await assertPublicUrl(input);
  } catch (error) {
    return { ok: false, error: error instanceof UnsafeUrlError ? error.message : "That isn't a valid link." };
  }
  const site = NOT_READ.find(([pattern]) => pattern.test(url.hostname.toLowerCase()));
  if (site) return { ok: false, error: `RolePort doesn't read ${site[1]} pages, since its terms don't allow it. ${PASTE_TEXT}` };

  // 1. A posting on a hiring system: structured data, and the company can be followed.
  const board = boardFromUrl(url);
  if (board) {
    try {
      const found = await postingOnBoard(board.ats, board.slug, url);
      if (found) return { ok: true, data: { kind: "review", review: boardReview(board.ats, board.slug, found) } };
      if (found === null) {
        return { ok: false, error: `That job isn't on the company's ${BOARDS[board.ats].label} careers page anymore, so it's probably closed.` };
      }
    } catch (error) {
      // The hiring system didn't answer; the page itself may still be readable.
      console.warn(`[paste] ${board.ats} lookup failed`, error);    }
  }

  // 2. Any other page.
  let page: SafeFetchResult;
  try {
    page = await fetchPage(url);
  } catch (error) {
    return { ok: false, error: error instanceof UnsafeUrlError ? error.message : `Couldn't open that page. Check the link, or ${PASTE_TEXT.charAt(0).toLowerCase()}${PASTE_TEXT.slice(1)}` };
  }
  if (page.status === 404 || page.status === 410) return { ok: false, error: "That page doesn't exist anymore, so the job is probably closed." };
  if (page.status >= 400) return { ok: false, error: `The site didn't let RolePort read the page (it answered ${page.status}). ${PASTE_TEXT}` };

  // A company's own careers site with a hiring system embedded (?gh_jid=123).
  const embedded = board ? null : boardFromHtml(page.body);
  if (embedded) {
    try {
      const found = await postingOnBoard(embedded.ats, embedded.slug, url);
      if (found) return { ok: true, data: { kind: "review", review: boardReview(embedded.ats, embedded.slug, found) } };
    } catch (error) {
      console.warn(`[paste] ${embedded.ats} lookup failed`, error);
    }
  }

  const text = pageText(page.body);
  const closed = closedNotice(text);
  const posting = findJobPosting(page.body);
  if (posting) {
    const job = jobFromJsonLd(posting, url.toString());
    if (job.title && job.company) {
      const expired = isPastDate(job.expiresAt);
      const check: JobCheck = closed
        ? { status: "closed", reason: `The page says "${closed}".`, at: now() }
        : expired
          ? { status: "closed", reason: `Its closing date (${job.expiresAt!.slice(0, 10)}) has passed.`, at: now() }
          : { status: "open", reason: "The page is up and doesn't say it's closed.", at: now() };
      return { ok: true, data: { kind: "review", review: { job, how: "page", board: null, notes: [], check } } };
    }
  }

  if (text.length < 200) {
    return { ok: false, error: `RolePort couldn't find a job description on that page (some sites only show it in a browser). ${PASTE_TEXT}` };
  }
  const check: JobCheck | null = closed ? { status: "closed", reason: `The page says "${closed}".`, at: now() } : null;
  return { ok: true, data: { kind: "text", url: url.toString(), text, check } };
}

/**
 * Whether a saved job is still open. A company feed's job is open while it's still in the feed;
 * a pasted link is closed when its page is gone, its closing date has passed, or it says so.
 */
export async function checkPosting(job: { source: string; sourceId: string | null; url: string }): Promise<JobCheck> {
  if (isCompanySource(job.source) && job.sourceId?.includes(":")) {
    const ats = job.source as AtsId;
    const board = BOARDS[ats];
    const [slug, ...rest] = job.sourceId.split(":");
    const id = rest.join(":");
    try {
      const open = board.fetchPosting ? (await board.fetchPosting(slug, id)) !== null : (await board.fetchJobs(slug, {})).jobs.some((j) => j.sourceId === job.sourceId);
      return open
        ? { status: "open", reason: `Still listed on the company's careers page (${board.label}).`, at: now() }
        : { status: "closed", reason: `No longer listed on the company's careers page (${board.label}).`, at: now() };
    } catch (error) {
      if (error instanceof SourceHttpError && error.status === 404) {
        return { status: "closed", reason: `The company's job board on ${board.label} is gone.`, at: now() };
      }
      return { status: "unknown", reason: `Couldn't reach ${board.label} right now. Try again later.`, at: now() };
    }
  }

  if (job.source !== PASTED_SOURCE || !/^https?:\/\//i.test(job.url)) {
    return { status: "unknown", reason: "RolePort can't check jobs from this source. Open the posting to see.", at: now() };
  }
  let page: SafeFetchResult;
  try {
    page = await fetchPage(await assertPublicUrl(job.url));
  } catch {
    return { status: "unknown", reason: "Couldn't open the page right now. Try again later.", at: now() };
  }
  if (page.status === 404 || page.status === 410) return { status: "closed", reason: "The page is gone.", at: now() };
  if (page.status >= 400) return { status: "unknown", reason: `The site didn't let RolePort check (it answered ${page.status}).`, at: now() };
  const posting = findJobPosting(page.body);
  const closesAt = posting ? jobFromJsonLd(posting, job.url).expiresAt : null;
  if (isPastDate(closesAt)) return { status: "closed", reason: `Its closing date (${closesAt!.slice(0, 10)}) has passed.`, at: now() };
  const closed = closedNotice(pageText(page.body));
  if (closed) return { status: "closed", reason: `The page says "${closed}".`, at: now() };
  return { status: "open", reason: "The page is up and doesn't say it's closed.", at: now() };
}
