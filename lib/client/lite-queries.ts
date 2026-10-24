import { eq, min } from "drizzle-orm";
import { toAppliedItems, toApplicationData, type AppliedItem, type ApplicationData } from "@/app/(app)/applied/view-data";
import { toHomeData } from "@/app/(app)/home/home-data";
import type { HomeData } from "@/app/(app)/home/home-view";
import type { ResultsData } from "@/app/(app)/jobs/results-view";
import type { BoardCard } from "@/app/(app)/pipeline/board";
import { toBoardCards } from "@/app/(app)/pipeline/cards";
import type { AiSettingsView } from "@/app/(app)/settings/ai-settings-form";
import { aiSettingsView } from "@/app/(app)/settings/view";
import { toOnboardingData } from "@/app/(onboarding)/welcome/onboarding-data";
import type { OnboardingData } from "@/app/(onboarding)/welcome/onboarding-flow";
import { aiConfigFromRow } from "@/lib/ai/settings";
import { getBrowserDb, type BrowserDb } from "@/lib/db/browser";
import { LOCAL_USER } from "@/lib/db/local-user";
import * as schema from "@/lib/db/schema";
import { readApplication, readApplications } from "@/lib/jobs/applications";
import { readDashboard } from "@/lib/jobs/dashboard";
import { readFitMatches, readJob, readJobsByIds, readTrackedJobs, sortJobs, toListItem, type JobListItem } from "@/lib/jobs/queries";
import type { JobSort } from "@/lib/jobs/search-params";
import { sourceCredit } from "@/lib/jobs/sources/credits";
import { readOnboarding, readProfile, type ProfileView } from "@/lib/profile/queries";
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

export async function loadHome(): Promise<HomeData> {
  const db = await getBrowserDb();
  const [view, stats, ai, onboarding] = await Promise.all([
    readProfile(db, await me(db)),
    readDashboard(db, LOCAL_USER.id),
    aiEnabled(db),
    readOnboarding(db, LOCAL_USER.id),
  ]);
  return toHomeData(view, stats, ai, onboarding);
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
    readTrackedJobs(db, LOCAL_USER.id),
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

export async function loadSettings(): Promise<{ ai: AiSettingsView; rapidApiKeyHint: string | null; jobspyEnabled: boolean }> {
  const db = await getBrowserDb();
  const row = await readSettings(db, LOCAL_USER.id);
  return {
    ai: aiSettingsView(row, readKey, aiConfigFromRow(row, readKey)),
    rapidApiKeyHint: maskSecret(readKey(row?.rapidApiKeyEnc)),
    jobspyEnabled: Boolean(row?.jobspyEnabled),
  };
}

/** When this browser started holding something worth backing up (a saved profile or job), or null if nothing yet. */
export async function loadDataSince(): Promise<Date | null> {
  const db = await getBrowserDb();
  const [[profile], [apps]] = await Promise.all([
    db.select({ at: schema.profile.onboardedAt }).from(schema.profile).where(eq(schema.profile.userId, LOCAL_USER.id)),
    db.select({ at: min(schema.application.createdAt) }).from(schema.application).where(eq(schema.application.userId, LOCAL_USER.id)),
  ]);
  const dates = [profile?.at, apps?.at].filter((d): d is Date => d instanceof Date);
  return dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
}

export async function loadWelcome(): Promise<OnboardingData> {
  const db = await getBrowserDb();
  const [{ profile, cvFileName }, ai, onboarding] = await Promise.all([readProfile(db, await me(db)), aiEnabled(db), readOnboarding(db, LOCAL_USER.id)]);
  return toOnboardingData(profile, cvFileName, ai, onboarding, true);
}

export async function loadApplied(): Promise<AppliedItem[]> {
  const db = await getBrowserDb();
  return toAppliedItems(await readApplications(db, LOCAL_USER.id));
}

export async function loadApplication(id: string): Promise<ApplicationData | null> {
  const db = await getBrowserDb();
  const application = await readApplication(db, LOCAL_USER.id, id);
  if (!application) return null;
  const [{ profile }, ai] = await Promise.all([readProfile(db, await me(db)), aiEnabled(db)]);
  const job = application.jobId ? await readJob(db, LOCAL_USER.id, application.jobId, profile) : null;
  return toApplicationData(application, job, ai, job && sourceCredit(job.source));
}
