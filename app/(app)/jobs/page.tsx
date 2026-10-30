import type { Metadata } from "next";
import { Suspense } from "react";
import { LearnMore } from "@/components/app/learn-more";
import { PageHeader } from "@/components/app/page-header";
import { isAiConfigured } from "@/lib/ai/config";
import { getMyFollowedCompanies } from "@/lib/companies/data";
import { browseMyCompanyJobs, searchJobs } from "@/lib/jobs/data";
import { isCompanyBrowse, parseCompanyBrowse, parseJobSearch, type JobSort, type ParsedCompanyBrowse } from "@/lib/jobs/search-params";
import type { JobSearchParams } from "@/lib/jobs/types";
import { isLite } from "@/lib/mode";
import { getMyProfile } from "@/lib/profile/data";
import { CompanyJobsView } from "./company-jobs-view";
import { LiteJobs } from "./lite-jobs";
import { ResultsSkeleton, ResultsView } from "./results-view";
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
      results={
        <Suspense key={JSON.stringify({ params: search.params, sort: search.sort, companies: companyIds })} fallback={<ResultsSkeleton />}>
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

async function CompanyResults({ browse }: { browse: ParsedCompanyBrowse }) {
  const [results, aiEnabled] = await Promise.all([browseMyCompanyJobs(browse), isAiConfigured()]);
  return <ResultsView {...results} aiEnabled={aiEnabled} />;
}
