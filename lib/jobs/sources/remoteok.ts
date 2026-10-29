import { cacheLife } from "next/cache";
import { cleanDescription } from "../html";
import type { JobSource } from "../types";
import { isoDate } from "./companies/types";
import { SOURCE_CREDITS } from "./credits";
import { countryCodes, coversRemote, emptyJob, keepMatching, type FeedJob } from "./feed";
import { fetchJson } from "./http";

// Remote OK's terms: link back to the posting on Remote OK (a followed link, no nofollow) and name
// Remote OK as the source. Don't use its logo. The API returns the whole feed; RolePort searches it.
type RemoteOkItem = {
  id?: string | number;
  legal?: string;
  url?: string;
  date?: string;
  company?: string;
  company_logo?: string;
  position?: string;
  tags?: string[];
  description?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
};
export type RemoteOkJob = RemoteOkItem & { id: string | number; url: string; position: string };

async function fetchRemoteOk(): Promise<RemoteOkItem[]> {
  "use cache";
  cacheLife("hours");
  return fetchJson<RemoteOkItem[]>("https://remoteok.com/api", { allowedHosts: ["remoteok.com"] });
}

export function normalizeRemoteOk(item: RemoteOkJob): FeedJob {
  const where = item.location?.trim() || "Worldwide";
  return {
    ...emptyJob("remoteok"),
    sourceId: String(item.id),
    url: item.url,
    title: item.position,
    company: item.company?.trim() || "Unknown company",
    companyLogo: item.company_logo || null,
    location: `Remote · ${where}`,
    workSetup: "remote",
    // Remote OK salaries are yearly, in US dollars; 0 means none given.
    salaryMin: item.salary_min || null,
    salaryMax: item.salary_max || null,
    salaryPeriod: item.salary_min || item.salary_max ? "year" : null,
    description: cleanDescription(item.description),
    skills: item.tags ?? [],
    postedAt: isoDate(item.date),
    countries: countryCodes(where.split(/\s*[,;/|]\s*/)),
  };
}

export const remoteOkSource: JobSource = {
  id: "remoteok",
  label: "Remote OK",
  kind: "remote",
  coverage: "Remote jobs, worldwide or for the countries each one lists",
  attribution: SOURCE_CREDITS.remoteok,
  enabled: () => true,
  covers: coversRemote,
  async search(params) {
    // The first item is the terms notice, not a job.
    const items = (await fetchRemoteOk()).filter((i): i is RemoteOkJob => Boolean(i.id && i.url && i.position));
    return keepMatching(items.map(normalizeRemoteOk), params);
  },
};
