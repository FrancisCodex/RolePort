"use client";

import { Building2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { companyJobsHref } from "@/lib/companies/links";
import type { FollowedCompanyView } from "@/lib/companies/queries";
import { cn } from "@/lib/utils";
import { CompanyManager } from "./company-manager";

const SHOWN = 3;

const chip = (on: boolean) =>
  cn(
    "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium transition-colors",
    on ? "border-brand/40 bg-brand-soft text-brand-ink" : "border-border text-muted hover:border-border-strong hover:text-fg",
  );

/**
 * On Jobs: invites the user to follow companies, or lists the ones they follow as links to all
 * their jobs, and opens the guided dialog to add or remove them. `active` marks the company
 * (or "all") whose jobs are showing.
 */
export function CompaniesBar({
  companies,
  countries,
  active,
  className,
}: {
  companies: FollowedCompanyView[];
  countries: string[];
  active?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // The company being viewed stays visible even when it's past the first few.
  const current = companies.find((c) => c.id === active);
  const shown = [...(current ? [current] : []), ...companies.filter((c) => c !== current)].slice(0, SHOWN);
  const more = companies.length - shown.length;

  return (
    <>
      {companies.length === 0 ? (
        <div className={cn("flex flex-col gap-2 rounded-lg border border-dashed border-border-strong px-3 py-2.5 sm:flex-row sm:items-center", className)}>
          <Building2 className="hidden size-4 shrink-0 text-brand-ink sm:block" />
          <p className="flex-1 text-[13px] text-muted">
            <strong className="font-medium text-fg">Have a company in mind?</strong> Follow it, or pick popular employers in your country.
            Their openings show up in your searches.
          </p>
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="self-start sm:self-auto">
            Follow companies
          </Button>
        </div>
      ) : (
        <div className={cn("flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed border-border-strong px-3 py-2.5 text-xs", className)}>
          <span className="text-subtle">Following:</span>
          <Link href={companyJobsHref()} className={chip(active === "all")}>
            <Building2 className="size-3" /> All their jobs
          </Link>
          {shown.map((c) => (
            <Link key={c.id} href={companyJobsHref(c.id)} title={`See every job at ${c.name}`} className={chip(active === c.id)}>
              {c.name}
            </Link>
          ))}
          {more > 0 && <span className="text-subtle">+{more} more</span>}
          <button type="button" onClick={() => setOpen(true)} className="ml-1 font-medium text-brand-ink hover:underline">
            Manage or add companies
          </button>
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} labelledBy="follow-dialog-title" className="max-h-[88vh] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto">
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <h2 id="follow-dialog-title" className="text-[15px] font-semibold tracking-tight">
                Follow a company
              </h2>
              <p className="text-[13px] leading-relaxed text-muted">
                Know a company you&apos;d love to work for? Follow it, and every search also checks that company&apos;s own list of openings.
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
              <X />
            </Button>
          </div>
          <CompanyManager companies={companies} countries={countries} onNavigate={() => setOpen(false)} />
        </div>
      </Dialog>
    </>
  );
}
