"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LiteData } from "@/components/app/lite-data";
import type { LiteSearchResult } from "@/lib/client/lite-search";
import { parseJobSearch, type JobSort } from "@/lib/jobs/search-params";
import type { JobSearchParams } from "@/lib/jobs/types";
import { ResultsSkeleton, ResultsView } from "./results-view";
import { JobSearchView } from "./search-view";

/** Jobs in the lite edition: the same page, with the search run from the browser. */
export function LiteJobs() {
  const urlParams = Object.fromEntries(useSearchParams().entries());
  return (
    <LiteData load={(q) => q.loadProfile()} tables={["profile"]} fallback={<ResultsSkeleton withForm />}>
      {({ profile }) => {
        const search = parseJobSearch(urlParams, profile);
        const key = JSON.stringify({ params: search.params, sort: search.sort });
        return <JobSearchView profile={profile} search={search} results={<LiteResults key={key} params={search.params} sort={search.sort} />} />;
      }}
    </LiteData>
  );
}

/** Runs one search through /api/lite/search, then shows the stored results (reloading when a job is saved or scored). */
function LiteResults({ params, sort }: { params: JobSearchParams; sort: JobSort }) {
  const [found, setFound] = useState<LiteSearchResult | { error: string } | null>(null);

  // The component is keyed by the search, so this runs once per search.
  const paramsKey = JSON.stringify(params);
  useEffect(() => {
    let live = true;
    import("@/lib/client/lite-search")
      .then((m) => m.liteSearch(JSON.parse(paramsKey) as JobSearchParams))
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
  }, [paramsKey]);

  if (!found) return <ResultsSkeleton />;
  if ("error" in found) {
    return <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{found.error}</p>;
  }
  return (
    <LiteData
      load={(q) => q.loadJobList(found.ids, sort)}
      tables={["application", "job_match", "profile"]}
      fallback={<ResultsSkeleton />}
    >
      {(data) => <ResultsView {...data} statuses={found.statuses} />}
    </LiteData>
  );
}
