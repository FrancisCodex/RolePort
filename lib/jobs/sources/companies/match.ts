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

/** The posting's location names this country, or (for remote jobs) names no other country. */
function inCountry(job: CompanyJob, code: string): boolean {
  if (job.countries.includes(code)) return true;
  const text = job.location ?? "";
  if (countryTerms(code).some((t) => mentions(text, t))) return true;
  if (job.countries.length > 0) return false;
  if (job.workSetup !== "remote") return false;
  // "Remote" with no country, or a region like "APAC" / "Worldwide": open to applicants here.
  return !COUNTRIES.some((c) => c.code !== code && countryTerms(c.code).some((t) => mentions(text, t)));
}

function words(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}+#.]+/u)
    .map((w) => w.replace(/^\.+|\.+$/g, ""))
    .filter((w) => w.length > 1);
}

export function matchesSearch(job: CompanyJob, params: JobSearchParams): boolean {
  const remoteOnly = params.locationId === "remote" || params.workSetup === "remote";
  if (remoteOnly && job.workSetup !== "remote") return false;
  if (!remoteOnly && params.workSetup && job.workSetup && job.workSetup !== params.workSetup) return false;
  if (!inCountry(job, params.country)) return false;

  const area = params.country === "PH" && !remoteOnly ? findLocation(params.locationId) : undefined;
  const cities = area ? area.cities : params.city && !remoteOnly ? [params.city] : [];
  if (cities.length && job.workSetup !== "remote" && !cities.some((c) => mentions(`${job.location ?? ""} ${job.city ?? ""}`, c.toLowerCase()))) {
    return false;
  }

  if (params.postedWithinDays && job.postedAt) {
    if (Date.parse(job.postedAt) < Date.now() - params.postedWithinDays * 86_400_000) return false;
  }

  const wanted = words(params.query);
  if (wanted.length === 0) return true;
  const haystack = `${job.title} ${job.team ?? ""} ${toPlainText(job.description)}`.toLowerCase();
  return wanted.every((w) => haystack.includes(w));
}
