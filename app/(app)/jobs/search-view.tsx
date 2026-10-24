import { Search } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { LocationFields } from "@/components/jobs/location-fields";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { findCountry, orderedCountries } from "@/lib/geo/countries";
import type { ParsedJobSearch } from "@/lib/jobs/search-params";
import { PH_LOCATIONS } from "@/lib/ph-locations";
import type { ProfileInput } from "@/lib/profile/schema";
import { cn } from "@/lib/utils";

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

/**
 * The search form, the country and role shortcuts, and `results` below them (or a prompt
 * when there's nothing to search for). Shared by the server page and the lite edition.
 */
export function JobSearchView({
  profile,
  search: { params, sort, query, city },
  results,
}: {
  profile: Pick<ProfileInput, "country" | "targetCountries" | "desiredRoles">;
  search: ParsedJobSearch;
  results: ReactNode;
}) {
  const country = params.country;

  return (
    <div className="flex flex-col gap-5">
      <Form action="/jobs" className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-2 shadow-[var(--shadow-soft)]">
        <div className="flex gap-1.5">
          <label className="relative flex-1">
            <span className="sr-only">Job title, skill or company</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
            <input
              name="q"
              defaultValue={query}
              placeholder="Job title, skill or company"
              className="h-10 w-full rounded-lg border border-transparent bg-surface-2 pr-3 pl-9 text-sm outline-none transition-[border-color,background-color,box-shadow] placeholder:text-subtle focus:border-brand focus:bg-surface focus:ring-3 focus:ring-brand/15"
            />
          </label>
          <Button type="submit" className="h-10 px-4">
            Search
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-[1fr_1.6fr_1fr_1fr_1fr]">
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
        <div className="-mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-subtle">Your countries:</span>
          {[profile.country, ...profile.targetCountries.filter((c) => c !== profile.country)].map((code) => (
            <Link
              key={code}
              href={`/jobs?q=${encodeURIComponent(query)}&country=${code}`}
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
                code === country && params.locationId !== "remote"
                  ? "border-brand/40 bg-brand-soft text-brand-ink"
                  : "border-border text-muted hover:border-border-strong hover:text-fg",
              )}
            >
              {findCountry(code)?.name ?? code}
            </Link>
          ))}
          <Link
            href={`/jobs?q=${encodeURIComponent(query)}&country=${profile.country}&loc=remote`}
            className={cn(
              "rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
              params.locationId === "remote" ? "border-brand/40 bg-brand-soft text-brand-ink" : "border-border text-muted hover:border-border-strong hover:text-fg",
            )}
          >
            Remote
          </Link>
        </div>
      )}

      {profile.desiredRoles.length > 1 && (
        <div className="-mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-subtle">Your roles:</span>
          {profile.desiredRoles.map((role) => (
            <Link
              key={role}
              href={`/jobs?q=${encodeURIComponent(role)}&country=${country}`}
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
                role === query ? "border-brand/40 bg-brand-soft text-brand-ink" : "border-border text-muted hover:border-border-strong hover:text-fg",
              )}
            >
              {role}
            </Link>
          ))}
        </div>
      )}

      {query ? (
        results
      ) : (
        <EmptyState
          icon={Search}
          title="What kind of job are you looking for?"
          body="Search by job title, skill or company. Add your target roles to your profile and we'll search for them automatically."
          action={
            <Link href="/profile" className="font-medium text-brand-ink hover:underline">
              Set up your profile
            </Link>
          }
        />
      )}
    </div>
  );
}
