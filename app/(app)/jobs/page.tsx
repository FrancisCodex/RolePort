import type { Metadata } from "next";
import { Suspense } from "react";
import { LearnMore } from "@/components/app/learn-more";
import { PageHeader } from "@/components/app/page-header";
import { isAiConfigured } from "@/lib/ai/config";
import { getMyFollowedCompanies } from "@/lib/companies/data";
import { SearchingJobs } from "@/components/jobs/searching";
import {
  browseMyCompanyJobs,
  countMyEvaluatedJobs,
  countMySavedJobs,
  getMyEvaluatedJobs,
  getMySavedJobs,
  startJobSearch,
} from "@/lib/jobs/data";
import {
  isCompanyBrowse,
  isEvaluatedView,
  isSavedView,
  parseCompanyBrowse,
  parseEvaluated,
  parseJobSearch,
  searchPlace,
  type JobSort,
  type ParsedCompanyBrowse,
  type ParsedEvaluated,
} from "@/lib/jobs/search-params";
import type { JobSearchParams } from "@/lib/jobs/types";
import { isLite } from "@/lib/mode";
import { getMyProfile } from "@/lib/profile/data";
import { CompanyJobsView } from "./company-jobs-view";
import { EvaluatedJobsView, EvaluatedResults } from "./evaluated-view";
import { LiteJobs } from "./lite-jobs";
import { ProgressiveResults } from "./progressive-results";
import { ResultsSkeleton, ResultsView } from "./results-view";
import { SavedJobsView, SavedResults } from "./saved-view";
import { JobSearchView } from "./search-view";

export const metadata: Metadata = { title: "Jobs" };

export default function JobsPage(props: PageProps<"/jobs">) {
  return (
    <>
      <PageHeader
        title="Jobs"
        description={
          <>
            Roles at home or abroad, ranked by how well they fit you. <LearnMore doc="guides/jobs" />
          </>
        }
      />
      <Suspense fallback={<ResultsSkeleton withForm />}>
        {/* Lite reads the URL in the browser (useSearchParams), so the page shell still prerenders. */}
        {isLite ? <LiteJobs /> : <JobSearch searchParams={props.searchParams} />}
      </Suspense>
    </>
  );
}

async function JobSearch({ searchParams }: { searchParams: PageProps<"/jobs">["searchParams"] }) {
  const [{ profile }, companies, sp] = await Promise.all([getMyProfile(), getMyFollowedCompanies(), searchParams]);
  // Following or unfollowing a company changes the results, so it's part of the keys below.
  const companyIds = companies.map((c) => c.id);

  if (isSavedView(sp)) {
    return (
      <SavedJobsView
        results={
          <Suspense fallback={<ResultsSkeleton />}>
            <SavedJobs />
          </Suspense>
        }
      />
    );
  }

  if (isEvaluatedView(sp)) {
    const filter = parseEvaluated(sp);
    return (
      <EvaluatedJobsView
        filter={filter}
        results={
          <Suspense key={JSON.stringify(filter)} fallback={<ResultsSkeleton />}>
            <EvaluatedJobs filter={filter} />
          </Suspense>
        }
      />
    );
  }

  if (isCompanyBrowse(sp)) {
    const browse = parseCompanyBrowse(sp);
    return (
      <CompanyJobsView
        profile={profile}
        browse={browse}
        companies={companies}
        results={
          <Suspense key={JSON.stringify({ browse, companies: companyIds })} fallback={<ResultsSkeleton />}>
            <CompanyResults browse={browse} />
          </Suspense>
        }
      />
    );
  }

  const search = parseJobSearch(sp, profile);
  return (
    <JobSearchView
      profile={profile}
      search={search}
      companies={companies}
      evaluatedCount={await countMyEvaluatedJobs()}
      savedCount={await countMySavedJobs()}
      results={
        <Suspense
          key={JSON.stringify({ params: search.params, sort: search.sort, companies: companyIds })}
          fallback={<SearchingJobs query={search.query} place={searchPlace(search.params)} />}
        >
          <Results params={search.params} sort={search.sort} />
        </Suspense>
      }
    />
  );
}

/**
 * The results as they come in: what the quick job boards found, with a note while slower ones
 * (LinkedIn through JobSpy can take half a minute) are still searching, then the full list in
 * their place. The full list streams to the browser as a promise, so the quick results are
 * interactive from the start.
 */
async function Results({ params, sort }: { params: JobSearchParams; sort: JobSort }) {
  const [search, aiEnabled] = await Promise.all([startJobSearch(params, sort), isAiConfigured()]);
  const quick = await search.quick;
  if (quick.pending.length === 0) return <ResultsView {...quick} aiEnabled={aiEnabled} />;
  return <ProgressiveResults quick={quick} full={search.full()} aiEnabled={aiEnabled} />;
}

async function SavedJobs() {
  const [jobs, aiEnabled] = await Promise.all([getMySavedJobs(), isAiConfigured()]);
  return <SavedResults jobs={jobs} aiEnabled={aiEnabled} />;
}

async function EvaluatedJobs({ filter }: { filter: ParsedEvaluated }) {
  const [{ jobs, total }, aiEnabled] = await Promise.all([getMyEvaluatedJobs(filter), isAiConfigured()]);
  return <EvaluatedResults jobs={jobs} total={total} aiEnabled={aiEnabled} filtered={Boolean(filter.query) || filter.fit !== "all"} />;
}

async function CompanyResults({ browse }: { browse: ParsedCompanyBrowse }) {
  const [results, aiEnabled] = await Promise.all([browseMyCompanyJobs(browse), isAiConfigured()]);
  return <ResultsView {...results} aiEnabled={aiEnabled} />;
}
