import type { Metadata } from "next";
import { Suspense } from "react";
import { isAiConfigured } from "@/lib/ai/config";
import { getDb } from "@/lib/db";
import { isLite } from "@/lib/mode";
import { getMyProfile } from "@/lib/profile/data";
import { readOnboarding } from "@/lib/profile/queries";
import { getCurrentUser } from "@/lib/session";
import { LiteWelcome } from "./lite-welcome";
import { toOnboardingData } from "./onboarding-data";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata: Metadata = { title: "Welcome" };

const skeleton = <div className="h-[28rem] animate-pulse rounded-3xl bg-surface-3" />;

/** The welcome guide. New users land here when onboarding is on; anyone can come back from Home. */
export default function WelcomePage() {
  if (isLite) return <LiteWelcome />;
  return (
    <Suspense fallback={skeleton}>
      <Welcome />
    </Suspense>
  );
}

async function Welcome() {
  const user = await getCurrentUser();
  const [{ profile, cvFileName }, aiEnabled, onboarding] = await Promise.all([getMyProfile(), isAiConfigured(), readOnboarding(await getDb(), user.id)]);
  return <OnboardingFlow {...toOnboardingData(profile, cvFileName, aiEnabled, onboarding, false)} />;
}

