export type WorkSetup = "onsite" | "hybrid" | "remote";
export type EmploymentType = "full_time" | "part_time" | "contract" | "freelance" | "internship";
export type SalaryPeriod = "hour" | "day" | "month" | "year";

export type JobSearchParams = {
  query: string;
  /** ISO 3166-1 alpha-2 code of the country to search, from lib/geo/countries.ts. */
  country: string;
  /**
   * "remote" for remote roles open to people living in `country`. In the Philippines, an id from
   * PH_LOCATIONS narrows the search to that area. Undefined means anywhere in the country.
   */
  locationId?: string;
  /** Free-text city for countries without a curated location list. */
  city?: string;
  workSetup?: WorkSetup;
  postedWithinDays?: number;
};

/** One posting in a shape every source maps into. */
export type NormalizedJob = {
  source: string;
  sourceId: string;
  url: string;
  title: string;
  company: string;
  companyLogo: string | null;
  location: string | null;
  city: string | null;
  workSetup: WorkSetup | null;
  employmentType: EmploymentType | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: SalaryPeriod | null;
  /** Sanitized HTML. */
  description: string | null;
  summary: string | null;
  skills: string[];
  requirements: { text: string; priority: "required" | "preferred" }[];
  postedAt: string | null;
  /** The source suspects the posting is old or reposted. */
  possiblyStale: boolean;
};

export type SourceStatus = {
  id: string;
  label: string;
  count: number;
  /** Set when the source is switched off (missing key) or failed. */
  note?: string;
  failed?: boolean;
};

/** Per-request keys for sources that need one. */
export type SourceContext = { rapidApiKey: string | null };

export interface JobSource {
  id: string;
  label: string;
  /** Credit line and link required by the source's terms. */
  attribution: { name: string; url: string };
  enabled(ctx: SourceContext): boolean;
  disabledNote?: string;
  /** Whether this source has anything for the given search (e.g. remote-only feeds). */
  covers(params: JobSearchParams): boolean;
  search(params: JobSearchParams, ctx: SourceContext): Promise<NormalizedJob[]>;
}
