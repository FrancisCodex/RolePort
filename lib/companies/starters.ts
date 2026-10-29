import { z } from "zod";
import { findCountry } from "@/lib/geo/countries";
import { ATS_IDS, SLUG_PATTERN, type AtsId } from "@/lib/jobs/sources/companies/types";
import au from "./starters/au.json";
import de from "./starters/de.json";
import gb from "./starters/gb.json";
import ph from "./starters/ph.json";
import remote from "./starters/remote.json";
import se from "./starters/se.json";
import sg from "./starters/sg.json";
import us from "./starters/us.json";

/*
 * Starter lists: well-known employers with open jobs in each country, on hiring software RolePort
 * reads, so a new user can follow a few in one click. One JSON file per country in ./starters
 * (ISO code, lower case), plus "remote" for companies that hire remotely across countries.
 * Contributed per country: docs/ADDING_A_JOB_SOURCE.md says how to check an entry.
 */

export type StarterCompany = { name: string; ats: AtsId; slug: string };

/** "remote", or a country code. */
export const STARTER_LISTS: Record<string, StarterCompany[]> = {
  PH: ph as StarterCompany[],
  SG: sg as StarterCompany[],
  AU: au as StarterCompany[],
  US: us as StarterCompany[],
  GB: gb as StarterCompany[],
  DE: de as StarterCompany[],
  SE: se as StarterCompany[],
  remote: remote as StarterCompany[],
};

export const REMOTE_LIST = "remote";

/** How a starter company is told apart: its hiring software and its slug there. */
export function companyKey(c: { ats: string; slug: string }): string {
  return `${c.ats}:${c.slug.toLowerCase()}`;
}

/** The starter company with this key, from any list, or null (so only listed companies can be followed this way). */
export function findStarter(key: string): StarterCompany | null {
  for (const list of Object.values(STARTER_LISTS)) {
    const found = list.find((c) => companyKey(c) === key);
    if (found) return found;
  }
  return null;
}

/** The lists to offer, the user's own countries first, then remote, then the rest. */
export function starterListOrder(countries: string[]): { id: string; label: string }[] {
  const ids = Object.keys(STARTER_LISTS);
  const mine = countries.filter((c) => ids.includes(c));
  const ordered = [...new Set([...mine, REMOTE_LIST, ...ids])];
  return ordered.map((id) => ({ id, label: id === REMOTE_LIST ? "Hiring remotely" : (findCountry(id)?.name ?? id) }));
}

/** The company's careers page on its hiring software, for the link in the list. */
export function boardCareersUrl(ats: AtsId, slug: string): string {
  switch (ats) {
    case "greenhouse":
      return `https://job-boards.greenhouse.io/${slug}`;
    case "lever":
      return `https://jobs.lever.co/${slug}`;
    case "ashby":
      return `https://jobs.ashbyhq.com/${slug}`;
    case "smartrecruiters":
      return `https://careers.smartrecruiters.com/${slug}`;
    case "workable":
      return `https://apply.workable.com/${slug}`;
    case "recruitee":
      return `https://${slug}.recruitee.com`;
  }
}

/** Every entry is well formed (checked by a test, so a contributed list can't break following). */
export function invalidStarters(): string[] {
  return Object.entries(STARTER_LISTS).flatMap(([id, list]) =>
    list.flatMap((c) =>
      !c.name?.trim() || !(ATS_IDS as readonly string[]).includes(c.ats) || !SLUG_PATTERN.test(c.slug) ? [`${id}: ${JSON.stringify(c)}`] : [],
    ),
  );
}

/** Keys sent to the follow action (they're checked against the lists there too). */
export const starterKeysSchema = z.object({ keys: z.array(z.string().max(140)).min(1).max(50) });
