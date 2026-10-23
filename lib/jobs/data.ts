import "server-only";
import { getJobSpyEnabled, getRapidApiKey } from "@/lib/ai/config";
import { getDb } from "@/lib/db";
import { getMyProfile } from "@/lib/profile/data";
import { getCurrentUser } from "@/lib/session";
import { countApplications, readApplications, type PipelineItem } from "./applications";
import { readFitMatches, readJob, readSavedJobIds, sortJobs, storeJobs, toListItem, type JobListItem } from "./queries";
import { searchAllSources } from "./search";
import type { JobSearchParams, SourceStatus } from "./types";

export { matchSortScore, type JobExtras, type JobListItem, type JobRow } from "./queries";
export type { PipelineItem } from "./applications";

export async function searchJobs(
  params: JobSearchParams,
  sort: "match" | "date",
): Promise<{ jobs: JobListItem[]; statuses: SourceStatus[]; hasSkills: boolean }> {
  const user = await getCurrentUser();
  const db = await getDb();
  const [rapidApiKey, jobspyEnabled] = await Promise.all([getRapidApiKey(), getJobSpyEnabled()]);
  const [{ jobs, statuses }, { profile }, saved] = await Promise.all([
    searchAllSources(params, { rapidApiKey, jobspyEnabled }),
    getMyProfile(),
    readSavedJobIds(db, user.id),
  ]);
  const rows = await storeJobs(db, jobs);
  const fits = await readFitMatches(db, user.id, rows.map((r) => r.id));
  const items = sortJobs(
    rows.map((row) => toListItem(row, profile, saved, fits)),
    sort,
  );
  return { jobs: items, statuses, hasSkills: profile.skills.length > 0 };
}

export async function getJob(id: string): Promise<JobListItem | null> {
  const user = await getCurrentUser();
  const { profile } = await getMyProfile();
  return readJob(await getDb(), user.id, id, profile);
}

export async function getMyApplications(): Promise<PipelineItem[]> {
  const user = await getCurrentUser();
  return readApplications(await getDb(), user.id);
}

export async function countMyApplications(): Promise<number> {
  const user = await getCurrentUser();
  return countApplications(await getDb(), user.id);
}
