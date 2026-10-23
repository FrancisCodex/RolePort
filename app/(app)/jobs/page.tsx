import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { isAiConfigured } from "@/lib/ai/config";
import { searchJobs } from "@/lib/jobs/data";
import { parseJobSearch, type JobSort } from "@/lib/jobs/search-params";
import type { JobSearchParams } from "@/lib/jobs/types";
import { isLite } from "@/lib/mode";
import { getMyProfile } from "@/lib/profile/data";
import { LiteJobs } from "./lite-jobs";
import { ResultsSkeleton, ResultsView } from "./results-view";
import { JobSearchView } from "./search-view";

export const metadata: Metadata = { title: "Jobs" };

export default function JobsPage(props: PageProps<"/jobs">) {
  return (
    <>
      <PageHeader title="Jobs" description="Roles at home or abroad, ranked by how well they fit you." />
      <Suspense fallback={<ResultsSkeleton withForm />}>
        {/* Lite reads the URL in the browser (useSearchParams), so the page shell still prerenders. */}
        {isLite ? <LiteJobs /> : <JobSearch searchParams={props.searchParams} />}
      </Suspense>
    </>
  );
}

async function JobSearch({ searchParams }: { searchParams: PageProps<"/jobs">["searchParams"] }) {
  const { profile } = await getMyProfile();
  const search = parseJobSearch(await searchParams, profile);

  return (
    <JobSearchView
      profile={profile}
      search={search}
      results={
        <Suspense key={JSON.stringify({ params: search.params, sort: search.sort })} fallback={<ResultsSkeleton />}>
          <Results params={search.params} sort={search.sort} />
        </Suspense>
      }
    />
  );
}

async function Results({ params, sort }: { params: JobSearchParams; sort: JobSort }) {
  const [results, aiEnabled] = await Promise.all([searchJobs(params, sort), isAiConfigured()]);
  return <ResultsView {...results} aiEnabled={aiEnabled} />;
}
