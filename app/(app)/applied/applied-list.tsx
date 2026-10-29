"use client";

import { ArrowUpRight, Briefcase, ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { CompanyLogo } from "@/components/jobs/job-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { ApplicationStatus } from "@/lib/jobs/applications";
import { cn } from "@/lib/utils";
import { StatusBadge } from "../pipeline/status-select";
import type { AppliedItem } from "./view-data";

const VIEWS = [
  { id: "applied", label: "Applied", statuses: ["applied", "screening", "interview", "offer", "hired"] },
  { id: "saved", label: "Saved", statuses: ["saved"] },
  { id: "closed", label: "Closed", statuses: ["rejected", "withdrawn", "offer_declined", "ghosted"] },
] as const satisfies { id: string; label: string; statuses: ApplicationStatus[] }[];

type View = (typeof VIEWS)[number]["id"];

const EMPTY: Record<View, { title: string; body: string }> = {
  applied: {
    title: "No applications yet",
    body: "Press Apply on a job and it lands here, ready for a tailored CV and answers before you finish on the company site.",
  },
  saved: { title: "Nothing saved", body: "Bookmark jobs from your search to come back to them here." },
  closed: { title: "Nothing closed", body: "Applications you mark rejected, withdrawn or without a response move here." },
};

const inView = (view: View, status: ApplicationStatus) =>
  (VIEWS.find((v) => v.id === view)!.statuses as readonly ApplicationStatus[]).includes(status);

/** Every job the user applied to or saved, split by where it stands. */
export function AppliedList({ items }: { items: AppliedItem[] }) {
  const counts = Object.fromEntries(VIEWS.map((v) => [v.id, items.filter((i) => inView(v.id, i.status)).length])) as Record<View, number>;
  // Open on the first view with something in it, so a user with only saved jobs isn't greeted by an empty list.
  const [view, setView] = useState<View>(() => VIEWS.find((v) => counts[v.id] > 0)?.id ?? "applied");
  const shown = items.filter((i) => inView(view, i.status));

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Filter applications" className="flex gap-1 border-b border-border">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            onClick={() => setView(v.id)}
            className={cn(
              "-mb-px flex h-9 items-center gap-1.5 border-b-2 px-2.5 text-[13px] font-medium transition-colors",
              view === v.id ? "border-brand text-fg" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {v.label}
            <span className="text-xs text-subtle tabular-nums">{counts[v.id]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          {...EMPTY[view]}
          action={
            view !== "closed" && (
              <Link href="/jobs" className={buttonVariants({ variant: "secondary" })}>
                Find jobs
              </Link>
            )
          }
        />
      ) : (
        <ul role="tabpanel" className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {shown.map((item) => (
            <AppliedRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AppliedRow({ item }: { item: AppliedItem }) {
  return (
    <li className="group relative flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-surface-2/60">
      <CompanyLogo src={item.companyLogo} company={item.company} />
      <div className="min-w-0 flex-1">
        {/* The whole row opens the application; the posting link sits above this overlay. */}
        <Link href={`/applied/${item.id}`} className="text-sm leading-snug font-medium after:absolute after:inset-0">
          {item.role}
        </Link>
        <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted">
          <span className="truncate">{item.company}</span>
          {item.location && (
            <span className="hidden min-w-0 items-center gap-1 text-subtle sm:flex">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{item.location}</span>
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
        {item.closed && (
          <Badge tone="danger" title="The employer's job posting is closed">
            Posting closed
          </Badge>
        )}
        <StatusBadge status={item.status} />
        <span className="text-[11px] text-subtle tabular-nums sm:w-24 sm:text-right sm:text-xs">
          {item.appliedOn ? item.appliedOn : item.updated && `Saved ${item.updated.toLowerCase()}`}
        </span>
      </div>
      {item.url ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener"
          aria-label={`Open the ${item.role} posting`}
          title="Open the job posting"
          className="relative z-10 hidden size-8 shrink-0 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-3 hover:text-fg sm:grid"
        >
          <ArrowUpRight className="size-4" />
        </a>
      ) : (
        <ChevronRight aria-hidden className="hidden size-4 shrink-0 text-subtle sm:block" />
      )}
    </li>
  );
}
