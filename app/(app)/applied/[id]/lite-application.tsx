"use client";

import { SearchX } from "lucide-react";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { LiteData } from "@/components/app/lite-data";
import { ApplicationView } from "./application-view";

/** One application in the lite edition: loaded from the browser database. */
export function LiteApplication() {
  const { id } = useParams<{ id: string }>();
  return (
    <LiteData
      key={id} // a different application is a fresh load
      load={(q) => q.loadApplication(id)}
      tables={["application", "job", "job_match", "profile", "user_settings"]}
      fallback={<div className="h-96 animate-pulse rounded-xl bg-surface-3" />}
    >
      {(data) =>
        data ? (
          <ApplicationView data={data} />
        ) : (
          <EmptyState icon={SearchX} title="Application not found" body="It isn't saved in this browser, or it was removed." />
        )
      }
    </LiteData>
  );
}
