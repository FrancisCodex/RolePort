import type { Metadata } from "next";
import { Suspense } from "react";
import { isAiConfigured } from "@/lib/ai/config";
import { countMyApplications } from "@/lib/jobs/data";
import { isLite } from "@/lib/mode";
import { getMyProfile } from "@/lib/profile/data";
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
  const [view, saved, aiEnabled] = await Promise.all([getMyProfile(), countMyApplications(), isAiConfigured()]);
  return <HomeView {...view} saved={saved} aiEnabled={aiEnabled} />;
}
