import "server-only";
import { RELEASES_URL } from "@/lib/repo";
import { cleanDescription } from "@/lib/jobs/html";
import { askDesktop, isDesktop } from "./bridge";

/*
 * The desktop app's updates (desktop/updates.mjs), for Settings → About & updates and the in-app
 * notice. The app checks, downloads and installs; the server only passes requests along and makes
 * the release notes safe to show.
 */

export type UpdateStatus = "idle" | "checking" | "up-to-date" | "available" | "downloading" | "ready" | "error";

/** What the pages show. Mirrors UpdateState in desktop/updates.mjs, with the notes cleaned. */
export type AppUpdate = {
  /** False when running from the repo (no installer to update). */
  supported: boolean;
  current: string;
  status: UpdateStatus;
  latest: { version: string; date: string | null; notes: { version: string; html: string }[] } | null;
  progress: { percent: number; transferred: number; total: number } | null;
  error: string | null;
  lastChecked: string | null;
  autoCheck: boolean;
  skipped: string | null;
  remindAfter: string | null;
  /** Show the in-app notice. */
  notify: boolean;
  /** Every release's notes on GitHub. */
  releasesUrl: string;
};

export type UpdateRequest = "state" | "check" | "download" | "later" | "skip" | "auto-check" | "install";

/** Release notes come from GitHub as HTML: keep the formatting, drop anything active. */
function clean(update: AppUpdate): AppUpdate {
  const notes = (update.latest?.notes ?? []).map((n) => ({ version: n.version, html: cleanDescription(n.html) ?? "" }));
  return { ...update, latest: update.latest && { ...update.latest, notes }, releasesUrl: RELEASES_URL };
}

/** Sends one update request to the desktop app. Null outside the desktop app. */
export async function askForUpdate(request: UpdateRequest, payload: Record<string, unknown> = {}): Promise<AppUpdate | null> {
  if (!isDesktop) return null;
  // A check waits for GitHub; everything else answers at once.
  const answer = await askDesktop<AppUpdate | null>(`update:${request}`, payload, request === "check" ? 60_000 : 15_000);
  return answer && clean(answer);
}
