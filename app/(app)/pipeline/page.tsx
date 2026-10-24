import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { getMyApplications } from "@/lib/jobs/data";
import { isLite } from "@/lib/mode";
import { PipelineBoard } from "./board";
import { toBoardCards } from "./cards";
import { LitePipeline } from "./lite-pipeline";

export const metadata: Metadata = { title: "Pipeline" };

export default function PipelinePage() {
  return (
    <>
      <PageHeader title="Pipeline" description="Every application, from saved to signed. Drag a card to move it." />
      {isLite ? (
        <LitePipeline />
      ) : (
        <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-surface-3" />}>
          <Board />
        </Suspense>
      )}
    </>
  );
}

async function Board() {
  return <PipelineBoard cards={toBoardCards(await getMyApplications())} />;
}
