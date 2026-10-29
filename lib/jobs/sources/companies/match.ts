import { COUNTRIES, findCountry } from "@/lib/geo/countries";
import { findLocation } from "@/lib/ph-locations";
import { toPlainText } from "../../html";
import type { JobSearchParams } from "../../types";
import type { CompanyJob } from "./types";

/*
 * Company feeds return every open job, so RolePort filters them for the search in code:
 * the words searched for, the country (or remote), the area, the work setup and the date.
 */

const ALIASES: Record<string, string[]> = {
  US: ["united states", "usa", "u.s."],
  GB: ["united kingdom", "uk", "england", "scotland", "wales", "london"],
  AE: ["united arab emirates", "uae", "dubai", "abu dhabi"],
  PH: ["philippines", "metro manila", "manila"],
  SG: ["singapore"],
  HK: ["hong kong"],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mentions = (text: string, term: string) => new RegExp(`(^|[^\\p{L}])${escape(term)}($|[^\\p{L}])`, "iu").test(text);

function countryTerms(code: string): string[] {
  const name = findCountry(code)?.name.toLowerCase();
  return [...new Set([...(name ? [name] : []), ...(ALIASES[code] ?? [])])];
}

const EUROPE = "AT BE BG HR CY CZ DK EE FI FR DE GR HU IS IE IT LV LT LU MT NL NO PL PT RO SK SI ES SE CH GB UA RS".split(" ");
const LATAM = "AR BO BR CL CO CR DO EC GT HN MX NI PA PE PY SV UY VE".split(" ");
const ASIA = "PH SG MY TH VN ID JP KR CN HK TW IN PK BD LK KH".split(" ");
const MIDDLE_EAST = "AE SA QA KW BH OM IL JO LB EG TR".split(" ");
const AFRICA = "EG MA NG KE ZA GH TZ UG ET RW TN".split(" ");

/** Regions remote postings name instead of countries, and the countries in each. */
const REGIONS: [string[], string[]][] = [
  [["europe", "eu", "european union"], EUROPE],
  [["emea"], [...EUROPE, ...MIDDLE_EAST, ...AFRICA]],
  [["latam", "latin america", "south america"], LATAM],
  [["north america"], ["US", "CA", "MX"]],
  [["americas"], ["US", "CA", ...LATAM]],
  [["apac", "asia pacific", "asia-pacific", "asia"], [...ASIA, "AU", "NZ"]],
  [["southeast asia", "sea"], ["PH", "SG", "MY", "TH", "VN", "ID", "KH"]],
  [["middle east", "mena"], [...MIDDLE_EAST, "MA", "TN"]],
  [["africa"], AFRICA],
  [["oceania", "anz"], ["AU", "NZ"]],
];

/** The posting's location names this country, or (for remote jobs) names no other country or region without it. */
function inCountry(job: CompanyJob, code: string): boolean {
  if (job.countries.includes(code)) return true;
  const text = job.location ?? "";
  if (countryTerms(code).some((t) => mentions(text, t))) return true;
  if (job.countries.length > 0) return false;
  if (job.workSetup !== "remote") return false;
  // A region ("Remote · Europe", "APAC"): open to applicants here only if it includes this country.
  const regions = REGIONS.filter(([names]) => names.some((n) => mentions(text, n)));
  if (regions.length > 0) return regions.some(([, members]) => members.includes(code));
  // "Remote" with no country, or "Worldwide": open to applicants here.
  return !COUNTRIES.some((c) => c.code !== code && countryTerms(c.code).some((t) => mentions(text, t)));
}

function words(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}+#.]+/u)
    .map((w) => w.replace(/^\.+|\.+$/g, ""))
    .filter((w) => w.length > 1);
}

/** A search, or a look through the followed companies' jobs, where the words and the country are optional. */
export type CompanyJobFilters = Omit<JobSearchParams, "query" | "country"> & { query?: string; country?: string };

export function matchesSearch(job: CompanyJob, params: CompanyJobFilters): boolean {
  const remoteOnly = params.locationId === "remote" || params.workSetup === "remote";
  if (remoteOnly && job.workSetup !== "remote") return false;
  if (!remoteOnly && params.workSetup && job.workSetup && job.workSetup !== params.workSetup) return false;
  if (params.country && !inCountry(job, params.country)) return false;

  const area = params.country === "PH" && !remoteOnly ? findLocation(params.locationId) : undefined;
  const cities = area ? area.cities : params.city && !remoteOnly ? [params.city] : [];
  if (cities.length && job.workSetup !== "remote" && !cities.some((c) => mentions(`${job.location ?? ""} ${job.city ?? ""}`, c.toLowerCase()))) {
    return false;
  }

  if (params.postedWithinDays && job.postedAt) {
    if (Date.parse(job.postedAt) < Date.now() - params.postedWithinDays * 86_400_000) return false;
  }

  const wanted = words(params.query ?? "");
  if (wanted.length === 0) return true;
  const haystack = `${job.title} ${job.team ?? ""} ${toPlainText(job.description)}`.toLowerCase();
  return wanted.every((w) => haystack.includes(w));
}
