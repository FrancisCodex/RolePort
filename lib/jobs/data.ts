import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getRapidApiKey } from "@/lib/ai/config";
import { getDb, schema } from "@/lib/db";
import { getMyProfile } from "@/lib/profile/data";
import { getCurrentUser } from "@/lib/session";
import { toPlainText } from "./html";
import { quickMatch, type QuickMatch } from "./quick-match";
import { searchAllSources, type KeyedJob } from "./search";
import type { JobSearchParams, SourceStatus } from "./types";

export type JobExtras = {
  summary: string | null;
  requirements: { text: string; priority: "required" | "preferred" }[];
  possiblyStale: boolean;
};

export type JobRow = typeof schema.job.$inferSelect;
export type JobListItem = JobRow & { extras: JobExtras; match: QuickMatch | null; saved: boolean };

const toInsert = (j: KeyedJob) => ({
  jobKey: j.jobKey,
  source: j.source,
  sourceId: j.sourceId,
  url: j.url,
  title: j.title,
  company: j.company,
  companyLogo: j.companyLogo,
  location: j.location,
  city: j.city,
  workSetup: j.workSetup,
  employmentType: j.employmentType,
  salaryMin: j.salaryMin,
  salaryMax: j.salaryMax,
  salaryCurrency: j.salaryCurrency,
  salaryPeriod: j.salaryPeriod,
  description: j.description,
  skills: j.skills,
  postedAt: j.postedAt ? new Date(j.postedAt) : null,
  raw: { summary: j.summary, requirements: j.requirements, possiblyStale: j.possiblyStale } satisfies JobExtras,
  fetchedAt: new Date(),
});

/** Keep a local copy of every result so job pages, saves and the pipeline have a stable id. */
async function storeJobs(jobs: KeyedJob[]): Promise<JobRow[]> {
  if (jobs.length === 0) return [];
  const db = await getDb();
  const excluded = (col: string) => sql.raw(`excluded.${col}`);
  // Refresh the mutable fields of a posting we've stored before.
  const updateSet = {
    url: excluded("url"),
    title: excluded("title"),
    location: excluded("location"),
    workSetup: excluded("work_setup"),
    salaryMin: excluded("salary_min"),
    salaryMax: excluded("salary_max"),
    description: excluded("description"),
    skills: excluded("skills"),
    postedAt: excluded("posted_at"),
    raw: excluded("raw"),
    fetchedAt: excluded("fetched_at"),
  };

  for (const job of jobs) {
    try {
      await db.insert(schema.job).values(toInsert(job)).onConflictDoUpdate({ target: schema.job.jobKey, set: updateSet });
    } catch (error) {
      // Same source id under a different key (e.g. the title was edited): keep the existing row.
      console.warn(`[jobs] skipped storing ${job.source}:${job.sourceId}`, error);
    }
  }

  const rows = await db.select().from(schema.job).where(inArray(schema.job.jobKey, jobs.map((j) => j.jobKey)));
  const order = new Map(jobs.map((j, i) => [j.jobKey, i]));
  return rows.sort((a, b) => (order.get(a.jobKey) ?? 0) - (order.get(b.jobKey) ?? 0));
}

async function savedJobIds(userId: string): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db
    .select({ jobId: schema.application.jobId })
    .from(schema.application)
    .where(eq(schema.application.userId, userId));
  return new Set(rows.map((r) => r.jobId).filter((id): id is string => Boolean(id)));
}

function extrasOf(row: JobRow): JobExtras {
  const raw = (row.raw ?? {}) as Partial<JobExtras>;
  return { summary: raw.summary ?? null, requirements: raw.requirements ?? [], possiblyStale: Boolean(raw.possiblyStale) };
}

export async function searchJobs(
  params: JobSearchParams,
  sort: "match" | "date",
): Promise<{ jobs: JobListItem[]; statuses: SourceStatus[]; hasSkills: boolean }> {
  const user = await getCurrentUser();
  const rapidApiKey = await getRapidApiKey();
  const [{ jobs, statuses }, { profile }, saved] = await Promise.all([
    searchAllSources(params, { rapidApiKey }),
    getMyProfile(),
    savedJobIds(user.id),
  ]);
  const rows = await storeJobs(jobs);

  const items: JobListItem[] = rows.map((row) => {
    const extras = extrasOf(row);
    const text = [toPlainText(row.description), extras.requirements.map((r) => r.text).join(" ")].join(" ");
    return { ...row, extras, saved: saved.has(row.id), match: quickMatch({ title: row.title, skills: row.skills, text }, profile) };
  });

  if (sort === "match") {
    items.sort((a, b) => (b.match?.score ?? -1) - (a.match?.score ?? -1));
  } else {
    items.sort((a, b) => (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0));
  }
  return { jobs: items, statuses, hasSkills: profile.skills.length > 0 };
}

export async function getJob(id: string): Promise<JobListItem | null> {
  const user = await getCurrentUser();
  const db = await getDb();
  const [row] = await db.select().from(schema.job).where(eq(schema.job.id, id));
  if (!row) return null;
  const [{ profile }, saved] = await Promise.all([getMyProfile(), savedJobIds(user.id)]);
  const extras = extrasOf(row);
  const text = [toPlainText(row.description), extras.requirements.map((r) => r.text).join(" ")].join(" ");
  return { ...row, extras, saved: saved.has(row.id), match: quickMatch({ title: row.title, skills: row.skills, text }, profile) };
}

export type PipelineItem = typeof schema.application.$inferSelect & { job: JobRow | null };

export async function getMyApplications(): Promise<PipelineItem[]> {
  const user = await getCurrentUser();
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.application)
    .leftJoin(schema.job, eq(schema.application.jobId, schema.job.id))
    .where(eq(schema.application.userId, user.id))
    .orderBy(desc(schema.application.updatedAt));
  return rows.map((r) => ({ ...r.application, job: r.job }));
}

export async function countMyApplications(): Promise<number> {
  const user = await getCurrentUser();
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.application)
    .where(and(eq(schema.application.userId, user.id)));
  return row?.n ?? 0;
}
