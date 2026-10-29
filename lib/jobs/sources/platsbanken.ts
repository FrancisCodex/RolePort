import { cacheLife } from "next/cache";
import { cleanDescription } from "../html";
import type { EmploymentType, JobSearchParams, JobSource, NormalizedJob } from "../types";
import { isoDate, setupFromText } from "./companies/types";
import { SOURCE_CREDITS } from "./credits";
import { emptyJob, textToHtml, toNormalized } from "./feed";
import { fetchJson } from "./http";

// Platsbanken is the job board of Arbetsförmedlingen, the Swedish Public Employment Service. JobTech's
// JobSearch API publishes its ads as open data, with no key. Credit Platsbanken and link to the ad there.
export type PlatsbankenAd = {
  id: string;
  headline: string;
  webpage_url: string;
  logo_url?: string | null;
  employer?: { name?: string | null } | null;
  workplace_address?: { municipality?: string | null; region?: string | null; city?: string | null } | null;
  working_hours_type?: { label?: string | null } | null;
  employment_type?: { label?: string | null } | null;
  description?: { text?: string | null; text_formatted?: string | null } | null;
  publication_date?: string | null;
  last_publication_date?: string | null;
  removed?: boolean;
};

const LIMIT = 100;

function employment(ad: PlatsbankenAd): EmploymentType | null {
  const hours = ad.working_hours_type?.label?.toLowerCase() ?? "";
  if (hours.startsWith("deltid")) return "part_time";
  if (/tidsbegränsad|vikariat|projekt/i.test(ad.employment_type?.label ?? "")) return "contract";
  if (hours.startsWith("heltid")) return "full_time";
  return null;
}

/** Times in the feed have no zone; they're Swedish local time, close enough to UTC for "how recent". */
function date(value: string | null | undefined): string | null {
  return value ? isoDate(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`) : null;
}

/** The request for a search: JobTech matches the words (Swedish or English) and filters by date itself. */
export function platsbankenQuery(params: JobSearchParams, now = Date.now()): URLSearchParams {
  const q = new URLSearchParams({ q: [params.query.trim(), params.city?.trim()].filter(Boolean).join(" "), limit: String(LIMIT) });
  if (params.postedWithinDays) q.set("published-after", new Date(now - params.postedWithinDays * 86_400_000).toISOString().slice(0, 19));
  if (params.locationId === "remote" || params.workSetup === "remote") q.set("remote", "true");
  return q;
}

async function searchPlatsbanken(query: string): Promise<PlatsbankenAd[]> {
  "use cache";
  cacheLife("hours");
  const body = await fetchJson<{ hits?: PlatsbankenAd[] }>(`https://jobsearch.api.jobtechdev.se/search?${query}`, {
    allowedHosts: ["jobsearch.api.jobtechdev.se"],
  });
  return body.hits ?? [];
}

export function normalizePlatsbanken(ad: PlatsbankenAd, remote: boolean, now = Date.now()): NormalizedJob {
  const place = ad.workplace_address;
  const city = place?.city || place?.municipality || null;
  const closes = date(ad.last_publication_date);
  return toNormalized({
    ...emptyJob("platsbanken"),
    sourceId: ad.id,
    url: ad.webpage_url,
    title: ad.headline,
    company: ad.employer?.name?.trim() || "Unknown employer",
    companyLogo: ad.logo_url || null,
    location: [city, place?.region, "Sweden"].filter(Boolean).join(", "),
    city,
    workSetup: remote ? "remote" : setupFromText(ad.headline),
    employmentType: employment(ad),
    salaryCurrency: "SEK",
    description: cleanDescription(ad.description?.text_formatted || textToHtml(ad.description?.text)),
    postedAt: date(ad.publication_date),
    // Taken down, or past its last day for applications.
    possiblyStale: Boolean(ad.removed) || Boolean(closes && Date.parse(closes) < now),
    countries: ["SE"],
  });
}

export const platsbankenSource: JobSource = {
  id: "platsbanken",
  label: "Platsbanken",
  kind: "official",
  coverage: "Sweden (Arbetsförmedlingen, the public employment service)",
  attribution: SOURCE_CREDITS.platsbanken,
  enabled: () => true,
  covers: (params) => params.country === "SE" && Boolean(params.query.trim()),
  async search(params) {
    const remote = params.locationId === "remote" || params.workSetup === "remote";
    const ads = await searchPlatsbanken(platsbankenQuery(params).toString());
    // JobTech matches the words itself (it understands Swedish job titles), so only the setup is checked here.
    return ads
      .map((ad) => normalizePlatsbanken(ad, remote))
      .filter((j) => !params.workSetup || remote || !j.workSetup || j.workSetup === params.workSetup);
  },
};
