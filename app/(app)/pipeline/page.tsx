import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { getMyApplications, type PipelineItem } from "@/lib/jobs/data";
import { timeAgo } from "@/lib/jobs/format";
import { cn } from "@/lib/utils";
import { StatusSelect, type Status } from "./status-select";

export const metadata: Metadata = { title: "Pipeline" };

const COLUMNS: { title: string; dot: string; statuses: Status[] }[] = [
  { title: "Saved", dot: "bg-subtle", statuses: ["saved"] },
  { title: "Applied", dot: "bg-brand", statuses: ["applied", "screening"] },
  { title: "Interview", dot: "bg-warning", statuses: ["interview"] },
  { title: "Offer", dot: "bg-success", statuses: ["offer", "hired"] },
];
const CLOSED: Status[] = ["rejected", "withdrawn", "offer_declined", "ghosted"];

export default function PipelinePage() {
  return (
    <>
      <PageHeader title="Pipeline" description="Every application, from saved to signed." />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-surface-3" />}>
        <Board />
      </Suspense>
    </>
  );
}

async function Board() {
  const items = await getMyApplications();
  const closed = items.filter((i) => CLOSED.includes(i.status));

  return (
    <div className="flex flex-col gap-8">
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const cards = items.filter((i) => col.statuses.includes(i.status));
          return (
            <section key={col.title} className="flex w-72 shrink-0 snap-start flex-col rounded-3xl bg-surface-2 p-3 sm:w-auto">
              <h2 className="flex items-center gap-2 px-2 py-1.5 text-sm font-semibold">
                <span className={cn("size-2 rounded-full", col.dot)} />
                {col.title}
                <span className="ml-auto text-xs text-subtle tabular-nums">{cards.length}</span>
              </h2>
              <div className="mt-2 flex flex-col gap-2">
                {cards.length === 0 ? (
                  <div className="grid min-h-32 place-items-center rounded-2xl border-2 border-dashed border-border-strong p-4 text-center text-sm text-subtle">
                    {col.title === "Saved" ? (
                      <span>
                        Save jobs from{" "}
                        <Link href="/jobs" className="font-semibold text-brand">
                          Jobs
                        </Link>
                      </span>
                    ) : (
                      "Nothing here yet"
                    )}
                  </div>
                ) : (
                  cards.map((item) => <PipelineCard key={item.id} item={item} />)
                )}
              </div>
            </section>
          );
        })}
      </div>

      {closed.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted">Closed ({closed.length})</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {closed.map((item) => (
              <PipelineCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PipelineCard({ item }: { item: PipelineItem }) {
  const updated = timeAgo(item.updatedAt);
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3.5 shadow-[var(--shadow-soft)]">
      <div className="min-w-0">
        {item.jobId ? (
          <Link href={`/jobs/${item.jobId}`} className="font-semibold leading-snug hover:text-brand">
            {item.role}
          </Link>
        ) : (
          <p className="font-semibold leading-snug">{item.role}</p>
        )}
        <p className="truncate text-sm text-muted">{item.company}</p>
        {updated && <p className="mt-1 text-xs text-subtle">Updated {updated.toLowerCase()}</p>}
      </div>
      <StatusSelect applicationId={item.id} status={item.status} />
    </article>
  );
}
