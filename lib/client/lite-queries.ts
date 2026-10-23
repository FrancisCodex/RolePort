import { eq } from "drizzle-orm";
import type { ResultsData } from "@/app/(app)/jobs/results-view";
import type { BoardCard } from "@/app/(app)/pipeline/board";
import { toBoardCards } from "@/app/(app)/pipeline/cards";
import type { AiSettingsView } from "@/app/(app)/settings/ai-settings-form";
import { aiSettingsView } from "@/app/(app)/settings/view";
import { aiConfigFromRow } from "@/lib/ai/settings";
import { getBrowserDb, type BrowserDb } from "@/lib/db/browser";
import { LOCAL_USER } from "@/lib/db/local-user";
import * as schema from "@/lib/db/schema";
import { countApplications, readApplications } from "@/lib/jobs/applications";
import { readFitMatches, readJob, readJobsByIds, readSavedJobIds, sortJobs, toListItem, type JobListItem } from "@/lib/jobs/queries";
import type { JobSort } from "@/lib/jobs/search-params";
import { sourceCredit } from "@/lib/jobs/sources/credits";
import { readProfile, type ProfileView } from "@/lib/profile/queries";
import { maskSecret } from "@/lib/secret-hint";
import { readSettings } from "@/lib/settings/queries";
import { readKey } from "./lite-keys";

/*
 * Reads for the lite edition's pages, against the browser database. Load with import()
 * so PGlite stays out of the first bundle. Each returns the props its page's view takes.
 */

/** AI runs from the browser in phase 4 (docs/LITE-IMPLEMENTATION.md); until then AI features stay off. */
const AI_IN_BROWSER = false;

async function me(db: BrowserDb) {
  const [user] = await db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(eq(schema.user.id, LOCAL_USER.id));
  return user ?? LOCAL_USER;
}

export async function loadProfile(): Promise<ProfileView> {
  const db = await getBrowserDb();
  return readProfile(db, await me(db));
}

export async function loadHome(): Promise<ProfileView & { saved: number; aiEnabled: boolean }> {
  const db = await getBrowserDb();
  const [view, saved] = await Promise.all([readProfile(db, await me(db)), countApplications(db, LOCAL_USER.id)]);
  return { ...view, saved, aiEnabled: AI_IN_BROWSER };
}

export async function loadPipeline(): Promise<BoardCard[]> {
  const db = await getBrowserDb();
  return toBoardCards(await readApplications(db, LOCAL_USER.id));
}

/** A search's stored results (from lite-search.ts), ranked for the list. */
export async function loadJobList(ids: string[], sort: JobSort): Promise<Omit<ResultsData, "statuses">> {
  const db = await getBrowserDb();
  const { profile } = await readProfile(db, await me(db));
  const [rows, saved, fits] = await Promise.all([
    readJobsByIds(db, ids),
    readSavedJobIds(db, LOCAL_USER.id),
    readFitMatches(db, LOCAL_USER.id, ids),
  ]);
  return {
    jobs: sortJobs(
      rows.map((row) => toListItem(row, profile, saved, fits)),
      sort,
    ),
    hasSkills: profile.skills.length > 0,
    aiEnabled: AI_IN_BROWSER,
  };
}

export async function loadJob(
  id: string,
): Promise<{ job: JobListItem; aiEnabled: boolean; source: { name: string; url: string } | null } | null> {
  const db = await getBrowserDb();
  const { profile } = await readProfile(db, await me(db));
  const job = await readJob(db, LOCAL_USER.id, id, profile);
  return job && { job, aiEnabled: AI_IN_BROWSER, source: sourceCredit(job.source) };
}

export async function loadSettings(): Promise<{ ai: AiSettingsView; rapidApiKeyHint: string | null }> {
  const db = await getBrowserDb();
  const row = await readSettings(db, LOCAL_USER.id);
  return {
    ai: aiSettingsView(row, readKey, aiConfigFromRow(row, readKey)),
    rapidApiKeyHint: maskSecret(readKey(row?.rapidApiKeyEnc)),
  };
}
