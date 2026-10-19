import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";

export const metadata: Metadata = { title: "Pipeline" };

const columns = [
  { title: "Saved", dot: "bg-subtle" },
  { title: "Applied", dot: "bg-brand" },
  { title: "Interview", dot: "bg-warning" },
  { title: "Offer", dot: "bg-success" },
];

export default function PipelinePage() {
  return (
    <>
      <PageHeader title="Pipeline" description="Every application, from saved to signed." />
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
        {columns.map((col) => (
          <section key={col.title} className="w-64 shrink-0 snap-start rounded-3xl bg-surface-2 p-3 sm:w-auto">
            <h2 className="flex items-center gap-2 px-2 py-1.5 text-sm font-semibold">
              <span className={`size-2 rounded-full ${col.dot}`} />
              {col.title}
              <span className="ml-auto text-xs text-subtle tabular-nums">0</span>
            </h2>
            <div className="mt-2 grid min-h-40 place-items-center rounded-2xl border-2 border-dashed border-border-strong p-4 text-center text-sm text-subtle">
              Nothing here yet
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
