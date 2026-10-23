"use client";

import { LiteData } from "@/components/app/lite-data";
import { ProfileEditor } from "./profile-editor";

/** Profile in the lite edition: loaded from the browser database instead of the server. */
export function LiteProfile() {
  return (
    // Only settings reload the editor: it keeps its own form state after a save.
    <LiteData load={(q) => q.loadProfile()} tables={["user_settings"]} fallback={<div className="h-96 animate-pulse rounded-3xl bg-surface-3" />}>
      {(view) => <ProfileEditor initial={view.profile} initialCvFileName={view.cvFileName} aiEnabled={view.aiEnabled} />}
    </LiteData>
  );
}
