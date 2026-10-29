"use client";

import { Building2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { FollowedCompanyView } from "@/lib/companies/queries";
import { CompanyManager } from "./company-manager";

const SHOWN = 3;

/**
 * On Jobs, under the search form: invites the user to follow companies (or shows the ones they
 * follow), and opens the guided dialog to add or remove them.
 */
export function CompaniesBar({ companies }: { companies: FollowedCompanyView[] }) {
  const [open, setOpen] = useState(false);
  const names = companies.slice(0, SHOWN).map((c) => c.name);
  const more = companies.length - names.length;

  return (
    <>
      {companies.length === 0 ? (
        <div className="-mt-2 flex flex-col gap-2 rounded-lg border border-dashed border-border-strong px-3 py-2.5 sm:flex-row sm:items-center">
          <Building2 className="hidden size-4 shrink-0 text-brand-ink sm:block" />
          <p className="flex-1 text-[13px] text-muted">
            <strong className="font-medium text-fg">Have a company in mind?</strong> Follow it, and its openings show up in your searches,
            straight from its own careers page.
          </p>
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="self-start sm:self-auto">
            Follow a company
          </Button>
        </div>
      ) : (
        <div className="-mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-subtle">Following:</span>
          {names.map((n) => (
            <span key={n} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 font-medium text-muted">
              <Building2 className="size-3" /> {n}
            </span>
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
          <CompanyManager companies={companies} />
        </div>
      </Dialog>
    </>
  );
}
