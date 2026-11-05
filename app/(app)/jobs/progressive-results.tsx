"use client";

import { useEffect, useState } from "react";
import type { JobResults } from "@/lib/jobs/data";
import { ResultsView } from "./results-view";

/**
 * Search results that arrive in two steps (lib/jobs/data.ts, startJobSearch): the quick job boards'
 * results show at once and work like any results (open, save, analyze), with a note while slower
 * boards are still searching, then update in place with the full list. Updating rather than
 * swapping keeps the open job and page.
 */
export function ProgressiveResults({
  quick,
  full,
  aiEnabled,
}: {
  quick: JobResults & { pending: string[] };
  full: Promise<JobResults>;
  aiEnabled: boolean;
}) {
  const [results, setResults] = useState<JobResults & { pending: string[] }>(quick);

  useEffect(() => {
    let live = true;
    full.then(
      (all) => {
        if (live) setResults({ ...all, pending: [] });
      },
      () => {
        // The slow boards failed: keep what's shown, without the "still searching" note.
        if (live) setResults((shown) => ({ ...shown, pending: [] }));
      },
    );
    return () => {
      live = false;
    };
  }, [full]);

  return <ResultsView {...results} aiEnabled={aiEnabled} />;
}
