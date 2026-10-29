import { ArrowLeft, Building2, Search } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { CompaniesBar } from "@/components/companies/companies-bar";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { FollowedCompanyView } from "@/lib/companies/queries";
import { orderedCountries } from "@/lib/geo/countries";
import { POSTED_OPTIONS, type ParsedCompanyBrowse } from "@/lib/jobs/search-params";
import type { ProfileInput } from "@/lib/profile/schema";

const SETUP_OPTIONS = [
  { value: "", label: "Any setup" },
  { value: "onsite", label: "Onsite" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
];
const SORT_OPTIONS = [
  { value: "date", label: "Newest" },
  { value: "match", label: "Best match" },
];

/**
 * Jobs at the companies the user follows: every opening they have, narrowed by company, words,
 * country, setup and date if the user wants. Shared by the server page and the lite edition.
 */
export function CompanyJobsView({
  profile,
  browse,
  companies,
  results,
}: {
  profile: Pick<ProfileInput, "country" | "targetCountries">;
  browse: ParsedCompanyBrowse;
  companies: FollowedCompanyView[];
  results: ReactNode;
}) {
  // An id that isn't followed any more (removed in another tab) falls back to all companies.
  const company = companies.find((c) => c.id === browse.company);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link href="/jobs" className="inline-flex w-fit items-center gap-1 text-xs font-medium text-muted hover:text-fg">
          <ArrowLeft className="size-3.5" /> Back to job search
        </Link>
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <Building2 className="size-4 text-brand-ink" />
          {company ? `Jobs at ${company.name}` : "Jobs at companies you follow"}
        </h2>
        <p className="text-[13px] text-muted">
          Every opening {company ? "this company has" : "these companies have"} right now, read from {company ? "its" : "their"} own careers
          pages. Narrow it down below, or leave the filters empty to see everything.
        </p>
      </div>

      {companies.length > 0 && (
        // Keyed by the filters, so the fields show the new ones after clicking a company's name.
        <Form key={JSON.stringify(browse)} action="/jobs" className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-2 shadow-[var(--shadow-soft)]">
          <input type="hidden" name="view" value="companies" />
          <div className="flex gap-1.5">
            <label className="relative flex-1">
              <span className="sr-only">Filter by job title or skill</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
              <input
                name="q"
                defaultValue={browse.query}
                placeholder="Filter by job title or skill (optional)"
                className="h-10 w-full rounded-lg border border-transparent bg-surface-2 pr-3 pl-9 text-sm outline-none transition-[border-color,background-color,box-shadow] placeholder:text-subtle focus:border-brand focus:bg-surface focus:ring-3 focus:ring-brand/15"
              />
            </label>
            <Button type="submit" className="h-10 px-4">
              Show jobs
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-5">
            <Select
              name="company"
              defaultValue={company?.id ?? ""}
              aria-label="Company"
              options={[{ value: "", label: "All companies you follow" }, ...companies.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <Select
              name="country"
              defaultValue={browse.country ?? ""}
              aria-label="Country"
              options={[
                { value: "", label: "Any country" },
                ...orderedCountries(profile.country, profile.targetCountries).map(({ code, name }) => ({ value: code, label: name })),
              ]}
            />
            <Select name="setup" defaultValue={browse.workSetup ?? ""} aria-label="Work setup" options={SETUP_OPTIONS} />
            <Select
              name="days"
              defaultValue={String(browse.postedWithinDays)}
              aria-label="Date posted"
              options={POSTED_OPTIONS}
            />
            <Select name="sort" defaultValue={browse.sort} aria-label="Sort by" options={SORT_OPTIONS} />
          </div>
        </Form>
      )}

      <CompaniesBar companies={companies} active={company?.id ?? "all"} />

      {companies.length > 0 ? (
        results
      ) : (
        <EmptyState
          icon={Building2}
          title="You don't follow any companies yet"
          body="Follow a company you'd like to work for, and all of its openings show up here, straight from its own careers page."
        />
      )}
    </div>
  );
}
