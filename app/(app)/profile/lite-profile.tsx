"use client";

import { LiteData } from "@/components/app/lite-data";
import { ProfileEditor } from "./profile-editor";

/** Profile in the lite edition: loaded from the browser database instead of the server. */
export function LiteProfile() {
  return (
    <LiteData load={(q) => q.loadProfile()} tables={[]} fallback={<div className="h-96 animate-pulse rounded-3xl bg-surface-3" />}>
      {/* AI in the browser arrives with phase 4 (docs/LITE-IMPLEMENTATION.md). */}
      {(view) => <ProfileEditor initial={view.profile} initialCvFileName={view.cvFileName} aiEnabled={false} />}
    </LiteData>
  );
}
