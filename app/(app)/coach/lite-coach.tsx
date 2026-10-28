"use client";

import { LiteData } from "@/components/app/lite-data";
import { InterviewList } from "./interview-list";
import { ProgressPanel } from "./progress-panel";

/** Saved mock interviews and progress in the lite edition: loaded from the browser database. */
export function LiteCoach() {
  return (
    <LiteData load={(q) => q.loadCoach()} tables={["interview_session", "application"]} fallback={<div className="h-64 animate-pulse rounded-xl bg-surface-3" />}>
      {({ items, progress }) => (
        <>
          <ProgressPanel progress={progress} />
          <InterviewList items={items} />
        </>
      )}
    </LiteData>
  );
}
