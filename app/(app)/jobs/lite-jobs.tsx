"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LiteData } from "@/components/app/lite-data";
import type { LiteSearchResult } from "@/lib/client/lite-search";
import { companyJobFilters, isCompanyBrowse, parseCompanyBrowse, parseJobSearch, type JobSort } from "@/lib/jobs/search-params";
import type { CompanyJobFilters } from "@/lib/jobs/sources/companies/match";
import type { JobSearchParams } from "@/lib/jobs/types";
import { CompanyJobsView } from "./company-jobs-view";
import { ResultsSkeleton, ResultsView } from "./results-view";
import { JobSearchView } from "./search-view";

/** What LiteResults runs: a job search, or a look through the followed companies' jobs. */
type LiteRequest = { kind: "search"; params: JobSearchParams } | { kind: "companies"; company: string | undefined; filters: CompanyJobFilters };

/** Jobs in the lite edition: the same page, with the search run from the browser. */
export function LiteJobs() {
  const urlParams = Object.fromEntries(useSearchParams().entries());
  return (
    <LiteData load={(q) => q.loadJobSearch()} tables={["profile", "followed_company"]} fallback={<ResultsSkeleton withForm />}>
      {({ profile, companies }) => {
        // Following or unfollowing a company changes the results, so it's part of the keys.
        const companyIds = companies.map((c) => c.id);
        if (isCompanyBrowse(urlParams)) {
          const browse = parseCompanyBrowse(urlParams);
          const request: LiteRequest = { kind: "companies", company: browse.company, filters: companyJobFilters(browse) };
          return (
            <CompanyJobsView
              profile={profile}
              browse={browse}
              companies={companies}
              results={<LiteResults key={JSON.stringify({ request, sort: browse.sort, companyIds })} request={request} sort={browse.sort} />}
            />
          );
        }
        const search = parseJobSearch(urlParams, profile);
        const request: LiteRequest = { kind: "search", params: search.params };
        return (
          <JobSearchView
            profile={profile}
            search={search}
            companies={companies}
            results={<LiteResults key={JSON.stringify({ request, sort: search.sort, companyIds })} request={request} sort={search.sort} />}
          />
        );
      }}
    </LiteData>
  );
}

/** Runs one request through the lite routes, then shows the stored results (reloading when a job is saved or scored). */
function LiteResults({ request, sort }: { request: LiteRequest; sort: JobSort }) {
  const [found, setFound] = useState<LiteSearchResult | { error: string } | null>(null);

  // The component is keyed by the request, so this runs once per request.
  const requestKey = JSON.stringify(request);
  useEffect(() => {
    let live = true;
    const r = JSON.parse(requestKey) as LiteRequest;
    import("@/lib/client/lite-search")
      .then((m) => (r.kind === "search" ? m.liteSearch(r.params) : m.liteBrowseCompanies(r.company, r.filters)))
      .then(
        (result) => {
          if (live) setFound(result);
        },
        (e: unknown) => {
          if (live) setFound({ error: e instanceof Error ? e.message : "The search failed. Please try again." });
        },
      );
    return () => {
      live = false;
    };
  }, [requestKey]);

  if (!found) return <ResultsSkeleton />;
  if ("error" in found) {
    return <p className="rounded-lg bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{found.error}</p>;
  }
  return (
    <LiteData
      load={(q) => q.loadJobList(found.ids, sort)}
      tables={["application", "job_match", "profile", "user_settings"]}
      fallback={<ResultsSkeleton />}
    >
      {(data) => <ResultsView {...data} statuses={found.statuses} />}
    </LiteData>
  );
}
