"use client";

import { useEffect, useState } from "react";
import { BrowserDbSetup } from "@/components/app/browser-db-setup";
import { hasBrowserDb } from "@/lib/db/browser/storage";
import type { ProfileView } from "@/lib/profile/queries";
import { ProfileEditor } from "./profile-editor";

/** Profile in the lite edition: loaded from the browser database instead of the server. */
export function LiteProfile() {
  const [view, setView] = useState<ProfileView | null>(null);
  const [error, setError] = useState<string | null>(null);
  // First visit: setting up the database takes seconds, so say so instead of a bare skeleton.
  const [firstVisit, setFirstVisit] = useState(false);

  useEffect(() => {
    let live = true;
    hasBrowserDb().then((exists) => live && setFirstVisit(!exists));
    import("@/lib/client/lite-queries")
      .then((q) => q.loadProfile())
      .then(
        (v) => live && setView(v),
        (e: unknown) => {
          console.error("[lite] couldn't open the browser database", e);
          if (live) setError(e instanceof Error ? e.message : "Couldn't open the database in this browser.");
        },
      );
    return () => {
      live = false;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-3xl border border-danger/30 bg-danger-soft p-5 text-sm">
        <p className="font-semibold">Couldn&apos;t open your data in this browser.</p>
        <p className="mt-1 text-muted">{error}</p>
      </div>
    );
  }
  if (!view) return firstVisit ? <BrowserDbSetup /> : <div className="h-96 animate-pulse rounded-3xl bg-surface-3" />;
  // AI in the browser arrives with phase 4 (docs/LITE-IMPLEMENTATION.md).
  return <ProfileEditor initial={view.profile} initialCvFileName={view.cvFileName} aiEnabled={false} />;
}
