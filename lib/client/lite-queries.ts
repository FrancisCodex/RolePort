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

/** Whether an AI provider is set up in this browser (AI calls run from the browser in lite). */
async function aiEnabled(db: BrowserDb): Promise<boolean> {
  return aiConfigFromRow(await readSettings(db, LOCAL_USER.id), readKey) !== null;
}

export async function me(db: BrowserDb) {
  const [user] = await db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(eq(schema.user.id, LOCAL_USER.id));
  return user ?? LOCAL_USER;
}

export async function loadProfile(): Promise<ProfileView & { aiEnabled: boolean }> {
  const db = await getBrowserDb();
  const [view, ai] = await Promise.all([readProfile(db, await me(db)), aiEnabled(db)]);
  return { ...view, aiEnabled: ai };
}

export async function loadHome(): Promise<ProfileView & { saved: number; aiEnabled: boolean }> {
  const db = await getBrowserDb();
  const [view, saved, ai] = await Promise.all([readProfile(db, await me(db)), countApplications(db, LOCAL_USER.id), aiEnabled(db)]);
  return { ...view, saved, aiEnabled: ai };
}

export async function loadPipeline(): Promise<BoardCard[]> {
  const db = await getBrowserDb();
  return toBoardCards(await readApplications(db, LOCAL_USER.id));
}

/** A search's stored results (from lite-search.ts), ranked for the list. */
export async function loadJobList(ids: string[], sort: JobSort): Promise<Omit<ResultsData, "statuses">> {
  const db = await getBrowserDb();
  const { profile } = await readProfile(db, await me(db));
  const [rows, saved, fits, ai] = await Promise.all([
    readJobsByIds(db, ids),
    readSavedJobIds(db, LOCAL_USER.id),
    readFitMatches(db, LOCAL_USER.id, ids),
    aiEnabled(db),
  ]);
  return {
    jobs: sortJobs(
      rows.map((row) => toListItem(row, profile, saved, fits)),
      sort,
    ),
    hasSkills: profile.skills.length > 0,
    aiEnabled: ai,
  };
}

export async function loadJob(
  id: string,
): Promise<{ job: JobListItem; aiEnabled: boolean; source: { name: string; url: string } | null } | null> {
  const db = await getBrowserDb();
  const { profile } = await readProfile(db, await me(db));
  const [job, ai] = await Promise.all([readJob(db, LOCAL_USER.id, id, profile), aiEnabled(db)]);
  return job && { job, aiEnabled: ai, source: sourceCredit(job.source) };
}

export async function loadSettings(): Promise<{ ai: AiSettingsView; rapidApiKeyHint: string | null }> {
  const db = await getBrowserDb();
  const row = await readSettings(db, LOCAL_USER.id);
  return {
    ai: aiSettingsView(row, readKey, aiConfigFromRow(row, readKey)),
    rapidApiKeyHint: maskSecret(readKey(row?.rapidApiKeyEnc)),
  };
}
