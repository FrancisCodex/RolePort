"use client";

import { LiteData } from "@/components/app/lite-data";
import { PipelineBoard } from "./board";

/** Pipeline in the lite edition: loaded from the browser database. */
export function LitePipeline() {
  return (
    <LiteData
      load={(q) => q.loadPipeline()}
      tables={["application", "job"]}
      fallback={<div className="h-64 animate-pulse rounded-xl bg-surface-3" />}
    >
      {(cards) => <PipelineBoard cards={cards} />}
    </LiteData>
  );
}
