import { AlertCircle, Search, SearchX, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { AnalyzePanel, AnalyzeProvider } from "@/components/jobs/analyze-jobs";
import { JobCard } from "@/components/jobs/job-card";
import { JobBrowser } from "@/components/jobs/job-browser";
import { LocationFields } from "@/components/jobs/location-fields";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { isAiConfigured } from "@/lib/ai/config";
import { findCountry, orderedCountries } from "@/lib/geo/countries";
import { searchJobs } from "@/lib/jobs/data";
import { MAX_PER_RUN } from "@/lib/jobs/fit";
import { sourceCredit } from "@/lib/jobs/search";
import type { JobSearchParams, WorkSetup } from "@/lib/jobs/types";
import { PH_LOCATIONS } from "@/lib/ph-locations";
import { getMyProfile } from "@/lib/profile/data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Jobs" };

const SETUPS: WorkSetup[] = ["onsite", "hybrid", "remote"];

const SETUP_OPTIONS = [
  { value: "", label: "Any setup" },
  { value: "onsite", label: "Onsite" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
];
const POSTED_OPTIONS = [
  { value: "", label: "Any time" },
  { value: "1", label: "Past 24 hours" },
  { value: "3", label: "Past 3 days" },
  { value: "7", label: "Past week" },
  { value: "30", label: "Past month" },
];
const SORT_OPTIONS = [
  { value: "match", label: "Best match" },
  { value: "date", label: "Newest" },
];

function one(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

export default function JobsPage(props: PageProps<"/jobs">) {
  return (
    <>
      <PageHeader title="Jobs" description="Roles at home or abroad, ranked by how well they fit you." />
      <Suspense fallback={<ResultsSkeleton withForm />}>
        <JobSearch searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function JobSearch({ searchParams }: { searchParams: PageProps<"/jobs">["searchParams"] }) {
  const sp = await searchParams;
  const { profile } = await getMyProfile();

  const query = one(sp.q) ?? profile.desiredRoles[0] ?? "";
  const country = (findCountry(one(sp.country)) ?? findCountry(profile.country))?.code ?? "PH";
  const locationId = one(sp.loc);
  const city = locationId === "remote" || country === "PH" ? undefined : one(sp.city)?.slice(0, 80);
  const setup = one(sp.setup) as WorkSetup | undefined;
  const days = Number(one(sp.days)) || undefined;
  const sort = one(sp.sort) === "date" ? "date" : "match";

  const params: JobSearchParams = {
    query,
    country,
    locationId:
      locationId === "remote" || (country === "PH" && PH_LOCATIONS.some((l) => l.id === locationId)) ? locationId : undefined,
    city,
    workSetup: setup && SETUPS.includes(setup) ? setup : undefined,
    postedWithinDays: days && [1, 3, 7, 14, 30].includes(days) ? days : undefined,
  };

  return (
    <div className="flex flex-col gap-6">
      <Form action="/jobs" className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-3 shadow-[var(--shadow-soft)] sm:p-4">
        <div className="flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Job title, skill or company</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-subtle" />
            <input
              name="q"
              defaultValue={query}
              placeholder="Job title, skill or company"
              className="h-12 w-full rounded-2xl border-2 border-border bg-surface-2 pr-4 pl-12 text-[15px] outline-none transition-colors placeholder:text-subtle focus:border-brand focus:bg-surface"
            />
          </label>
          <Button type="submit" className="h-12">
            Search
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-[1fr_1.6fr_1fr_1fr_1fr]">
          <LocationFields
            key={country}
            countries={orderedCountries(profile.country, profile.targetCountries).map(({ code, name }) => ({ code, name }))}
            phLocations={PH_LOCATIONS.map(({ id, label }) => ({ id, label }))}
            country={country}
            locationId={params.locationId}
            city={city}
          />
          <Select name="setup" defaultValue={params.workSetup ?? ""} aria-label="Work setup" options={SETUP_OPTIONS} />
          <Select
            name="days"
            defaultValue={params.postedWithinDays ? String(params.postedWithinDays) : ""}
            aria-label="Date posted"
            options={POSTED_OPTIONS}
          />
          <Select name="sort" defaultValue={sort} aria-label="Sort by" options={SORT_OPTIONS} />
        </div>
      </Form>

      {profile.targetCountries.length > 0 && (
        <div className="-mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-subtle">Your countries:</span>
          {[profile.country, ...profile.targetCountries.filter((c) => c !== profile.country)].map((code) => (
            <Link
              key={code}
              href={`/jobs?q=${encodeURIComponent(query)}&country=${code}`}
              className={cn(
                "rounded-full border px-3 py-1 font-medium transition-colors",
                code === country && params.locationId !== "remote"
                  ? "border-brand bg-brand-soft text-brand-ink"
                  : "border-border text-muted hover:border-border-strong",
              )}
            >
              {findCountry(code)?.name ?? code}
            </Link>
          ))}
          <Link
            href={`/jobs?q=${encodeURIComponent(query)}&country=${profile.country}&loc=remote`}
            className={cn(
              "rounded-full border px-3 py-1 font-medium transition-colors",
              params.locationId === "remote" ? "border-brand bg-brand-soft text-brand-ink" : "border-border text-muted hover:border-border-strong",
            )}
          >
            Remote
          </Link>
        </div>
      )}

      {profile.desiredRoles.length > 1 && (
        <div className="-mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-subtle">Your roles:</span>
          {profile.desiredRoles.map((role) => (
            <Link
              key={role}
              href={`/jobs?q=${encodeURIComponent(role)}&country=${country}`}
              className={cn(
                "rounded-full border px-3 py-1 font-medium transition-colors",
                role === query ? "border-brand bg-brand-soft text-brand-ink" : "border-border text-muted hover:border-border-strong",
              )}
            >
              {role}
            </Link>
          ))}
        </div>
      )}

      {query ? (
        <Suspense key={JSON.stringify({ params, sort })} fallback={<ResultsSkeleton />}>
          <Results params={params} sort={sort} />
        </Suspense>
      ) : (
        <EmptyState
          icon={Search}
          title="What kind of job are you looking for?"
          body="Search by job title, skill or company. Add your target roles to your profile and we'll search for them automatically."
          action={
            <Link href="/profile" className="font-semibold text-brand hover:underline">
              Set up your profile
            </Link>
          }
        />
      )}
    </div>
  );
}

async function Results({ params, sort }: { params: JobSearchParams; sort: "match" | "date" }) {
  const [{ jobs, statuses, hasSkills }, aiEnabled] = await Promise.all([searchJobs(params, sort), isAiConfigured()]);
  const sources = Object.fromEntries(
    [...new Set(jobs.map((j) => j.source))].flatMap((id) => {
      const credit = sourceCredit(id);
      return credit ? [[id, credit] as const] : [];
    }),
  );
  // "Top N" analyzes the best-ranked results that don't have an AI score yet.
  const topIds = jobs
    .filter((j) => !j.fit)
    .slice(0, MAX_PER_RUN)
    .map((j) => j.id);

  return (
    <AnalyzeProvider>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-fg">
            {jobs.length} job{jobs.length === 1 ? "" : "s"}
          </span>
          <span className="text-subtle">from</span>
          {statuses.map((s) => (
            <span
              key={s.id}
              title={s.note}
              className={cn(
                "rounded-full px-2.5 py-1 font-medium",
                s.failed ? "bg-danger-soft text-danger" : s.note ? "bg-surface-2 text-subtle" : "bg-surface-2 text-muted",
              )}
            >
              {s.label} {s.note ? (s.failed ? "· unavailable" : "· off") : `· ${s.count}`}
            </span>
          ))}
        </div>

        {!hasSkills && (
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-2xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand-ink hover:opacity-90"
          >
            <Sparkles className="size-4 shrink-0" />
            Add your skills to your profile to see a match score on every job.
          </Link>
        )}

        {jobs.length > 0 && (
          <AnalyzePanel jobs={jobs.map((j) => ({ id: j.id, title: j.title }))} topIds={topIds} aiEnabled={aiEnabled} />
        )}

        {statuses.length > 0 && statuses.every((s) => s.failed || s.note) && (
          <p className="flex items-center gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
            <AlertCircle className="size-4" /> No job source could be reached. Check your connection and try again.
          </p>
        )}

        {jobs.length === 0 ? (
          <EmptyState icon={SearchX} title="No jobs found" body="Try a broader title, another location, or a longer date range." />
        ) : (
          // Split view: the results, and the selected job beside them (a drawer on small screens).
          <JobBrowser jobs={jobs} aiEnabled={aiEnabled} sources={sources}>
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </JobBrowser>
        )}
      </div>
    </AnalyzeProvider>
  );
}

function ResultsSkeleton({ withForm = false }: { withForm?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {withForm && <div className="mb-3 h-36 animate-pulse rounded-3xl bg-surface-3" />}
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex gap-4 rounded-3xl border border-border bg-surface p-5">
          <span className="size-12 animate-pulse rounded-2xl bg-surface-3" />
          <div className="flex flex-1 flex-col gap-2">
            <span className="h-4 w-2/3 animate-pulse rounded-full bg-surface-3" />
            <span className="h-3 w-1/3 animate-pulse rounded-full bg-surface-3" />
            <span className="h-3 w-1/2 animate-pulse rounded-full bg-surface-3" />
          </div>
        </div>
      ))}
    </div>
  );
}
