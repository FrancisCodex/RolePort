import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { isAiConfigured } from "@/lib/ai/config";
import { getDb } from "@/lib/db";
import { readDashboard } from "@/lib/jobs/dashboard";
import { isLite, onboardingEnabled } from "@/lib/mode";
import { getMyProfile } from "@/lib/profile/data";
import { readOnboarding } from "@/lib/profile/queries";
import { getCurrentUser } from "@/lib/session";
import { toHomeData } from "./home-data";
import { HomeView } from "./home-view";
import { LiteHome } from "./lite-home";

export const metadata: Metadata = { title: "Home" };

const skeleton = <div className="h-96 animate-pulse rounded-3xl bg-surface-3" />;

export default function HomePage() {
  if (isLite) return <LiteHome />;
  return (
    <Suspense fallback={skeleton}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const user = await getCurrentUser();
  const db = await getDb();
  const [view, stats, aiEnabled, onboarding] = await Promise.all([
    getMyProfile(),
    readDashboard(db, user.id),
    isAiConfigured(),
    readOnboarding(db, user.id),
  ]);
  // New users start on the welcome guide when it's turned on (NEXT_PUBLIC_HIREME_ONBOARDING).
  if (onboardingEnabled && !onboarding.done) redirect("/welcome");
  return <HomeView {...toHomeData(view, stats, aiEnabled, onboarding)} />;
}
