import { z } from "zod";
import { findCountry } from "@/lib/geo/countries";
import { PH_LOCATIONS } from "@/lib/ph-locations";
import type { CompanyJobFilters } from "./sources/companies/match";
import { ATS_IDS, MAX_FOLLOWED, SLUG_PATTERN } from "./sources/companies/types";
import type { JobSearchParams, WorkSetup } from "./types";

/*
 * The Jobs page's search, from URL parameters to JobSearchParams. Shared by the server
 * page, the lite edition's page and the lite search route, so all apply the same rules.
 */

export const WORK_SETUPS: WorkSetup[] = ["onsite", "hybrid", "remote"];
/** How recent a posting must be, in days. Older postings are never shown: they are rarely still open. */
export const POSTED_WITHIN_DAYS = [1, 3, 7, 30, 90];
/** A month unless the user picks otherwise. */
export const DEFAULT_POSTED_DAYS = 30;

export const POSTED_OPTIONS = [
  { value: "1", label: "Past 24 hours" },
  { value: "3", label: "Past 3 days" },
  { value: "7", label: "Past week" },
  { value: "30", label: "Past month" },
  { value: "90", label: "Past 3 months" },
];

function postedDays(value: string | undefined): number {
  const days = Number(value);
  return POSTED_WITHIN_DAYS.includes(days) ? days : DEFAULT_POSTED_DAYS;
}

export type JobSort = "match" | "date";

export type ParsedJobSearch = {
  params: JobSearchParams;
  sort: JobSort;
  /** The query and city as typed (or defaulted), for the form. */
  query: string;
  city: string | undefined;
};

type UrlParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

/** Read the search from URL parameters, defaulting to the profile's first role and country. */
export function parseJobSearch(sp: UrlParams, profile: { desiredRoles: string[]; country: string }): ParsedJobSearch {
  const query = one(sp.q) ?? profile.desiredRoles[0] ?? "";
  const country = (findCountry(one(sp.country)) ?? findCountry(profile.country))?.code ?? "PH";
  const locationId = one(sp.loc);
  const city = locationId === "remote" || country === "PH" ? undefined : one(sp.city)?.slice(0, 80);
  const setup = one(sp.setup) as WorkSetup | undefined;
  const days = postedDays(one(sp.days));
  const sort = one(sp.sort) === "date" ? "date" : "match";

  return {
    query,
    city,
    sort,
    params: {
      query,
      country,
      locationId:
        locationId === "remote" || (country === "PH" && PH_LOCATIONS.some((l) => l.id === locationId)) ? locationId : undefined,
      city,
      workSetup: setup && WORK_SETUPS.includes(setup) ? setup : undefined,
      postedWithinDays: days,
    },
  };
}

/** JobSearchParams arriving from a browser (the lite search route): the same limits as parseJobSearch. */
export const jobSearchParamsSchema = z
  .object({
    query: z.string().trim().min(1).max(120),
    country: z.string().refine((code) => findCountry(code)?.code === code, "Unknown country"),
    locationId: z.string().max(40).optional(),
    city: z.string().trim().max(80).optional(),
    workSetup: z.enum(["onsite", "hybrid", "remote"]).optional(),
    postedWithinDays: z.number().int().refine((d) => POSTED_WITHIN_DAYS.includes(d)).optional(),
  })
  .strict()
  .refine(
    (p) => p.locationId === undefined || p.locationId === "remote" || (p.country === "PH" && PH_LOCATIONS.some((l) => l.id === p.locationId)),
    { message: "Unknown location", path: ["locationId"] },
  );

/** The "Jobs at companies you follow" view: /jobs?view=companies, optionally narrowed to one company. */
export type ParsedCompanyBrowse = {
  /** A followed company's id, or undefined for all of them. */
  company: string | undefined;
  /** Words to look for; optional here, unlike a search. */
  query: string;
  /** Undefined for any country. */
  country: string | undefined;
  workSetup: WorkSetup | undefined;
  postedWithinDays: number;
  sort: JobSort;
};

export function isCompanyBrowse(sp: UrlParams): boolean {
  return one(sp.view) === "companies";
}

export function parseCompanyBrowse(sp: UrlParams): ParsedCompanyBrowse {
  const setup = one(sp.setup) as WorkSetup | undefined;
  const days = postedDays(one(sp.days));
  return {
    company: one(sp.company)?.slice(0, 100),
    query: one(sp.q)?.slice(0, 120) ?? "",
    country: findCountry(one(sp.country))?.code,
    workSetup: setup && WORK_SETUPS.includes(setup) ? setup : undefined,
    postedWithinDays: days,
    // Newest first by default: this view is for seeing what a company has open.
    sort: one(sp.sort) === "match" ? "match" : "date",
  };
}

/** What the company feeds are filtered by. */
export function companyJobFilters({ query, country, workSetup, postedWithinDays }: ParsedCompanyBrowse): CompanyJobFilters {
  return { query: query || undefined, country, workSetup, postedWithinDays };
}

/** The browse filters arriving from a browser (the lite company-jobs route). */
export const companyJobFiltersSchema = z
  .object({
    query: z.string().trim().max(120).optional(),
    country: z
      .string()
      .refine((code) => findCountry(code)?.code === code, "Unknown country")
      .optional(),
    workSetup: z.enum(["onsite", "hybrid", "remote"]).optional(),
    postedWithinDays: z.number().int().refine((d) => POSTED_WITHIN_DAYS.includes(d)).optional(),
  })
  .strict();

/** The companies a lite user follows, sent along with each request (they're kept in the browser). */
export const companyRefsSchema = z
  .array(z.object({ ats: z.enum(ATS_IDS), slug: z.string().regex(SLUG_PATTERN), name: z.string().trim().min(1).max(120) }))
  .max(MAX_FOLLOWED)
  .catch([]);
