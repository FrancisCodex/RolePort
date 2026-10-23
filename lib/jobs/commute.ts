import { COUNTRIES, countryName } from "@/lib/geo/countries";
import { PH_LOCATIONS } from "@/lib/ph-locations";

/**
 * A rough commute check for the location gate, computed in code so small models
 * don't have to know Philippine geography: same area, a neighbouring area, or far.
 */

// Extra names postings use for places inside the PH_LOCATIONS areas.
const ALIASES: Record<string, string[]> = {
  "metro-manila": [
    "ncr", "national capital region", "bgc", "bonifacio global city", "fort bonifacio", "ortigas", "alabang", "eastwood",
    "paranaque", "las pinas", "marikina", "valenzuela", "malabon", "navotas", "pateros", "mandaluyong", "pasig", "makati",
    "taguig", "quezon city", "pasay", "muntinlupa", "caloocan", "san juan", "manila",
  ],
  "clark-pampanga": ["pampanga", "angeles"],
  "laguna": ["laguna", "santa rosa", "sta. rosa", "binan", "calamba", "san pedro"],
  "cavite": ["cavite", "imus", "bacoor", "dasmarinas", "general trias"],
  "cebu": ["cebu", "mandaue", "lapu-lapu"],
  "davao": ["davao"],
  "iloilo": ["iloilo"],
  "bacolod": ["bacolod", "negros"],
  "cagayan-de-oro": ["cagayan de oro", "cdo"],
  "baguio": ["baguio"],
  "batangas": ["batangas", "lipa"],
};

// Areas within a (long) daily commute of each other.
const NEIGHBOURS: Record<string, string[]> = {
  "metro-manila": ["cavite", "laguna"],
  "cavite": ["metro-manila", "laguna"],
  "laguna": ["metro-manila", "cavite", "batangas"],
  "batangas": ["laguna"],
};

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** The PH_LOCATIONS area a place string belongs to, or null. Longer names win ("Cavite City" over "Manila"). */
export function areaOf(place: string | null | undefined): string | null {
  if (!place) return null;
  const text = ` ${fold(place).replace(/[^a-z0-9.-]+/g, " ")} `;
  let best: { id: string; len: number } | null = null;
  for (const loc of PH_LOCATIONS) {
    const names = [loc.label, ...loc.cities, ...(ALIASES[loc.id] ?? [])].map(fold);
    for (const name of names) {
      if (text.includes(` ${name} `) && (!best || name.length > best.len)) best = { id: loc.id, len: name.length };
    }
  }
  return best?.id ?? null;
}

// Short names postings use for countries, besides the full name.
const COUNTRY_ALIASES: Record<string, string[]> = {
  AE: ["uae", "dubai", "abu dhabi"],
  GB: ["uk", "england", "london"],
  US: ["usa", "u.s."],
  SA: ["ksa", "riyadh", "jeddah"],
  QA: ["doha"],
};

/** The country a job's location names, as a code, or null. */
export function countryOf(place: string | null | undefined): string | null {
  if (!place) return null;
  const text = ` ${fold(place).replace(/[^a-z0-9.-]+/g, " ")} `;
  for (const c of COUNTRIES) {
    const names = [c.name, ...(COUNTRY_ALIASES[c.code] ?? [])].map((n) => fold(n).replace(/[^a-z0-9.-]+/g, " "));
    if (names.some((n) => text.includes(` ${n} `))) return c.code;
  }
  return null;
}

export type Commute = "remote" | "same_area" | "neighbouring" | "far" | "target_country" | "abroad" | "unknown";

export function commuteCheck(
  job: { location: string | null; workSetup: string | null },
  candidate: { city: string | null; region: string | null; country: string; targetCountries: string[] },
): { kind: Commute; text: string } {
  if (job.workSetup === "remote") return { kind: "remote", text: "Remote role: no commute needed." };
  const jobCountry = countryOf(job.location);
  if (jobCountry && jobCountry !== candidate.country) {
    return candidate.targetCountries.includes(jobCountry)
      ? {
          kind: "target_country",
          text: `The job is in ${countryName(jobCountry)}, one of the countries the candidate wants to move to: relocation is wanted, not a problem.`,
        }
      : { kind: "abroad", text: `The job is in ${countryName(jobCountry)}, which the candidate hasn't listed as a country they'd move to.` };
  }
  // The area map below only knows the Philippines.
  if (candidate.country !== "PH") {
    return { kind: "unknown", text: "The app can't judge commutes outside the Philippines; judge from the text." };
  }
  const jobArea = areaOf(job.location);
  const homeArea = areaOf(candidate.city) ?? (candidate.region === "NCR" ? "metro-manila" : areaOf(candidate.region));
  const label = (id: string) => PH_LOCATIONS.find((l) => l.id === id)?.label ?? id;
  if (!jobArea || !homeArea) {
    return { kind: "unknown", text: "The app couldn't place the job or the candidate on the map; judge from the text." };
  }
  if (jobArea === homeArea) {
    return { kind: "same_area", text: `Both are in ${label(jobArea)}: within commuting distance, no relocation needed.` };
  }
  if (NEIGHBOURS[homeArea]?.includes(jobArea)) {
    return { kind: "neighbouring", text: `The job is in ${label(jobArea)}, next to the candidate's ${label(homeArea)}: a long commute, no relocation.` };
  }
  return {
    kind: "far",
    text: `The job is in ${label(jobArea)}, far from the candidate's ${label(homeArea)}: onsite or hybrid work would mean relocating.`,
  };
}
