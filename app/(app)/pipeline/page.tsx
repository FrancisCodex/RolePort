import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { getMyApplications } from "@/lib/jobs/data";
import { timeAgo } from "@/lib/jobs/format";
import { PipelineBoard } from "./board";

export const metadata: Metadata = { title: "Pipeline" };

export default function PipelinePage() {
  return (
    <>
      <PageHeader title="Pipeline" description="Every application, from saved to signed. Drag a card to move it." />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-surface-3" />}>
        <Board />
      </Suspense>
    </>
  );
}

async function Board() {
  const items = await getMyApplications();
  // Only what the cards show: the full job rows (descriptions included) stay on the server.
  const cards = items.map((i) => ({
    id: i.id,
    jobId: i.jobId,
    role: i.role,
    company: i.company,
    status: i.status,
    updated: timeAgo(i.updatedAt),
  }));
  return <PipelineBoard cards={cards} />;
}
