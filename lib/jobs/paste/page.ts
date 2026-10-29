import sanitizeHtml from "sanitize-html";
import { cleanDescription } from "@/lib/jobs/html";
import { findCountry } from "@/lib/geo/countries";
import { decodeEntities } from "@/lib/jobs/sources/companies/greenhouse";
import { isoDate, setupFromText } from "@/lib/jobs/sources/companies/types";
import type { EmploymentType, SalaryPeriod, WorkSetup } from "@/lib/jobs/types";
import { emptyPastedJob, PASTED_SOURCE, type PastedJob } from "./types";

/*
 * Reading one job page: the schema.org JobPosting most careers pages include for Google
 * (https://schema.org/JobPosting), the page's readable text when it has none, and the words
 * that say a posting is closed. Plain functions over HTML, so they're tested without a network.
 */

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);

function hasType(node: Json, type: string): boolean {
  return list(node["@type"]).some((t) => typeof t === "string" && t.toLowerCase() === type.toLowerCase());
}

/** Every JSON-LD block on the page, parsed; blocks that aren't valid JSON are skipped. */
function jsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  for (const match of html.matchAll(/<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      blocks.push(JSON.parse(match[1].trim().replace(/^<!\[CDATA\[|\]\]>$/g, "")));
    } catch {
      // some sites emit broken JSON-LD; the page text is the fallback
    }
  }
  return blocks;
}

/** The first schema.org JobPosting on the page, also inside @graph and arrays. */
export function findJobPosting(html: string): Json | null {
  const queue = jsonLdBlocks(html);
  for (let i = 0; i < queue.length && i < 500; i++) {
    const node = queue[i];
    if (Array.isArray(node)) queue.push(...node);
    else if (isObject(node)) {
      if (hasType(node, "JobPosting")) return node;
      if (node["@graph"]) queue.push(node["@graph"]);
    }
  }
  return null;
}

const EMPLOYMENT: Record<string, EmploymentType> = {
  FULL_TIME: "full_time",
  FULLTIME: "full_time",
  PART_TIME: "part_time",
  PARTTIME: "part_time",
  CONTRACTOR: "contract",
  CONTRACT: "contract",
  TEMPORARY: "contract",
  INTERN: "internship",
  INTERNSHIP: "internship",
  PER_DIEM: "freelance",
  FREELANCE: "freelance",
};

const PERIODS: Record<string, SalaryPeriod> = { HOUR: "hour", DAY: "day", MONTH: "month", YEAR: "year", ANNUAL: "year" };

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[,\s]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

/** A jobLocation as one line of text: "Makati, Metro Manila, Philippines". */
function place(node: unknown): string | null {
  const address = isObject(node) ? node.address : null;
  if (typeof address === "string") return address.trim() || null;
  if (!isObject(address)) return isObject(node) ? str(node.name) : null;
  const country = isObject(address.addressCountry) ? str(address.addressCountry.name) : str(address.addressCountry);
  // Pages often give the country as a code ("PH").
  const countryLabel = country && country.length === 2 ? (findCountry(country.toUpperCase())?.name ?? country) : country;
  return [str(address.addressLocality), str(address.addressRegion), countryLabel].filter(Boolean).join(", ") || null;
}

/** A pasted job from a page's JobPosting. `pageUrl` is where it was read, the fallback link. */
export function jobFromJsonLd(posting: Json, pageUrl: string): PastedJob {
  const org = isObject(posting.hiringOrganization) ? posting.hiringOrganization : null;
  const logo = org && (isObject(org.logo) ? str(org.logo.url) : str(org.logo));
  const places = list(posting.jobLocation).map(place);
  const remote = list(posting.jobLocationType).some((t) => typeof t === "string" && /telecommute/i.test(t));
  const types = list(posting.employmentType).flatMap((t) => (typeof t === "string" ? t.split(/[,\s]+/) : []));
  const employmentType = types.map((t) => EMPLOYMENT[t.toUpperCase().replace(/-/g, "_")]).find(Boolean) ?? null;

  const salary = isObject(posting.baseSalary) ? posting.baseSalary : null;
  const value = salary && (isObject(salary.value) ? salary.value : { value: salary.value });
  const salaryMin = value ? (num(value.minValue) ?? num(value.value)) : null;
  const salaryMax = value ? (num(value.maxValue) ?? num(value.value)) : null;
  const unit = value && str(value.unitText)?.toUpperCase();

  const skills = list(posting.skills)
    .flatMap((s) => (typeof s === "string" ? s.split(/\s*[,;]\s*/) : isObject(s) ? [str(s.name) ?? ""] : []))
    .map((s) => s.trim())
    .filter((s) => s && s.length <= 60);

  const raw = str(posting.description);
  // Some sites escape the HTML inside the JSON ("&lt;p&gt;").
  const description = cleanDescription(raw && /&lt;\/?[a-z]/i.test(raw) ? decodeEntities(raw) : raw);
  const link = str(posting.url);
  const url = link && /^https?:\/\//i.test(link) ? link : pageUrl;
  const setup: WorkSetup | null = remote ? "remote" : setupFromText(str(posting.title), ...places);

  return {
    ...emptyPastedJob(url),
    source: PASTED_SOURCE,
    sourceId: url,
    title: decodeEntities(str(posting.title) ?? "").slice(0, 200),
    company: decodeEntities((org && str(org.name)) ?? (typeof posting.hiringOrganization === "string" ? posting.hiringOrganization : "")).slice(0, 200),
    companyLogo: logo && /^https:\/\//i.test(logo) ? logo : null,
    location: places.filter(Boolean).join(" · ").slice(0, 200) || (remote ? "Remote" : null),
    workSetup: setup,
    employmentType,
    salaryMin,
    salaryMax,
    salaryCurrency: (salary && str(salary.currency)?.toUpperCase().slice(0, 10)) || "",
    salaryPeriod: unit ? (PERIODS[unit] ?? null) : null,
    description,
    skills: [...new Set(skills)].slice(0, 40),
    postedAt: isoDate(str(posting.datePosted)),
    expiresAt: isoDate(str(posting.validThrough)),
  };
}

const BLOCK_END = /<\/(p|div|li|h[1-6]|tr|section|article|ul|ol|header|footer)>|<br\s*\/?>/gi;

/**
 * The page's readable text, for the AI to read when there's no JobPosting: the <main> or
 * <article> when there is one, without scripts, styles and navigation.
 */
export function pageText(html: string, maxChars = 20_000): string {
  const main = html.match(/<main[\s>][\s\S]*?<\/main>/i)?.[0] ?? html.match(/<article[\s>][\s\S]*?<\/article>/i)?.[0] ?? html;
  const stripped = main
    .replace(/<(script|style|noscript|svg|nav|header|footer|form|template)[\s>][\s\S]*?<\/\1>/gi, " ")
    .replace(BLOCK_END, "\n");
  const text = decodeEntities(sanitizeHtml(stripped, { allowedTags: [], allowedAttributes: {} }));
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, maxChars);
}

/** The page's <title>, as a hint for the user when nothing else names the job. */
export function pageTitle(html: string): string | null {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? decodeEntities(title).replace(/\s+/g, " ").trim().slice(0, 200) || null : null;
}

// Wording careers pages use once a job is gone. Kept narrow: "applications close on 30 May" is still open.
const CLOSED_WORDS = [
  /no longer (?:accepting|taking|receiving) (?:applications|applicants|candidates)/i,
  /(?:this|the) (?:job|position|role|vacancy|posting|opening|job posting|job ad) (?:is no longer|has been|was) (?:available|open|filled|closed|removed|expired)/i,
  /(?:this|the) (?:job|position|role|vacancy|posting|opening) (?:has )?(?:expired|closed)/i,
  /(?:position|role|vacancy) (?:has been |is )?filled/i,
  /applications? (?:are|is) (?:now )?closed/i,
  /(?:job|posting) (?:not found|is unavailable)/i,
];

/** The sentence on a page that says the posting is closed, or null. */
export function closedNotice(text: string): string | null {
  for (const pattern of CLOSED_WORDS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}

/** Whether a closing date (ISO) is in the past. */
export function isPastDate(iso: string | null, now = Date.now()): boolean {
  if (!iso) return false;
  const ms = Date.parse(iso);
  // A date without a time means the whole day, so it closes at the end of it.
  return Number.isFinite(ms) && ms + (/T00:00:00(\.000)?Z$/.test(iso) ? 86_400_000 : 0) < now;
}
