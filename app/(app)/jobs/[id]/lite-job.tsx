"use client";

import { SearchX } from "lucide-react";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { LiteData } from "@/components/app/lite-data";
import { JobDetailView } from "@/components/jobs/job-detail";

/** One job in the lite edition: loaded from the browser database. */
export function LiteJob() {
  const { id } = useParams<{ id: string }>();
  return (
    <LiteData
      key={id} // a different job is a fresh load
      load={(q) => q.loadJob(id)}
      tables={["job", "application", "job_match", "profile", "user_settings"]}
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-surface-3" />}
    >
      {(data) =>
        data ? (
          <JobDetailView job={data.job} aiEnabled={data.aiEnabled} source={data.source} />
        ) : (
          <EmptyState icon={SearchX} title="Job not found" body="It isn't saved in this browser. Search again to find it." />
        )
      }
    </LiteData>
  );
}
