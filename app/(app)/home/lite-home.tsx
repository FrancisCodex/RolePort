"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LiteData } from "@/components/app/lite-data";
import { onboardingEnabled } from "@/lib/mode";
import { HomeView } from "./home-view";

const skeleton = <div className="h-96 animate-pulse rounded-xl bg-surface-3" />;

/** Home in the lite edition: loaded from the browser database. New users go to the welcome guide first. */
export function LiteHome() {
  return (
    <LiteData load={(q) => q.loadHome()} tables={["profile", "application", "job_match", "user_settings"]} fallback={skeleton}>
      {(data) => (onboardingEnabled && data.needsOnboarding ? <ToWelcome /> : <HomeView {...data} />)}
    </LiteData>
  );
}

function ToWelcome() {
  const router = useRouter();
  useEffect(() => router.replace("/welcome"), [router]);
  return skeleton;
}
