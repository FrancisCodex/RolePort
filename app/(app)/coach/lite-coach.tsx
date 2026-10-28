"use client";

import { LiteData } from "@/components/app/lite-data";
import { InterviewList } from "./interview-list";

/** Saved mock interviews in the lite edition: loaded from the browser database. */
export function LiteCoach() {
  return (
    <LiteData load={(q) => q.loadInterviews()} tables={["interview_session"]} fallback={<div className="h-64 animate-pulse rounded-xl bg-surface-3" />}>
      {(items) => <InterviewList items={items} />}
    </LiteData>
  );
}
