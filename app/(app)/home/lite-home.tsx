"use client";

import { LiteData } from "@/components/app/lite-data";
import { HomeView } from "./home-view";

/** Home in the lite edition: loaded from the browser database. */
export function LiteHome() {
  return (
    <LiteData
      load={(q) => q.loadHome()}
      tables={["profile", "application", "user_settings"]}
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-surface-3" />}
    >
      {(data) => <HomeView {...data} />}
    </LiteData>
  );
}
