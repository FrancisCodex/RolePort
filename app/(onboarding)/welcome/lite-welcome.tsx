"use client";

import { LiteData } from "@/components/app/lite-data";
import { OnboardingFlow } from "./onboarding-flow";

/** The welcome guide in the lite edition: loaded from the browser database. */
export function LiteWelcome() {
  return (
    // No reload tables: the guide keeps its own form state while the user fills it in.
    <LiteData load={(q) => q.loadWelcome()} tables={[]} fallback={<div className="h-[28rem] animate-pulse rounded-3xl bg-surface-3" />}>
      {(data) => <OnboardingFlow {...data} />}
    </LiteData>
  );
}
