"use client";

import { useSearchParams } from "next/navigation";
import { LiteData } from "@/components/app/lite-data";
import { SetupForm } from "./setup-form";

/** The new-interview form in the lite edition: applications and profile from the browser database. */
export function LiteSetup() {
  const application = useSearchParams().get("application");
  return (
    <LiteData
      key={application}
      load={(q) => q.loadInterviewSetup(application)}
      tables={["application", "profile", "user_settings"]}
      fallback={<div className="h-96 animate-pulse rounded-xl bg-surface-3" />}
    >
      {(data) => <SetupForm data={data} />}
    </LiteData>
  );
}
