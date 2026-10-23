import { z } from "zod";
import { findCountry } from "@/lib/geo/countries";
import { PH_LOCATIONS } from "@/lib/ph-locations";
import type { JobSearchParams, WorkSetup } from "./types";

/*
 * The Jobs page's search, from URL parameters to JobSearchParams. Shared by the server
 * page, the lite edition's page and the lite search route, so all apply the same rules.
 */

export const WORK_SETUPS: WorkSetup[] = ["onsite", "hybrid", "remote"];
export const POSTED_WITHIN_DAYS = [1, 3, 7, 14, 30];

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
  const days = Number(one(sp.days)) || undefined;
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
      postedWithinDays: days && POSTED_WITHIN_DAYS.includes(days) ? days : undefined,
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
