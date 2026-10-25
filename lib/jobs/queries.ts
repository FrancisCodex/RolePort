import { and, eq, inArray, lt, notExists, sql } from "drizzle-orm";
import type { FitEvaluation } from "@/lib/ai/evaluate-job";
import * as schema from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import type { ProfileInput } from "@/lib/profile/schema";
import { overallFitScore, vetoReason } from "./fit";
import { toPlainText } from "./html";
import { quickMatch, type QuickMatch } from "./quick-match";
import type { JobLink, NormalizedJob } from "./types";

/*
 * Job and fit-evaluation storage, shared by the server (lib/jobs/data.ts, evaluation.ts)
 * and the lite edition's browser database. No auth here: callers pass the user.
 */

export type JobExtras = {
  summary: string | null;
  requirements: { text: string; priority: "required" | "preferred" }[];
  possiblyStale: boolean;
  /** The same opening on other boards. */
  alsoOn: JobLink[];
};

export type JobRow = typeof schema.job.$inferSelect;
export type FitMatch = typeof schema.jobMatch.$inferSelect;
/** The user's application for a job: saved, applied or further along. */
export type TrackedJob = { id: string; status: (typeof schema.applicationStatus.enumValues)[number] };
/**
 * `fit` is the saved AI evaluation, when the user has run one; `match` is the free skill-overlap estimate.
 * `saved` means the job is on the user's list in any status; `application` says which one.
 */
export type JobListItem = JobRow & {
  extras: JobExtras;
  match: QuickMatch | null;
  fit: FitMatch | null;
  saved: boolean;
  application: TrackedJob | null;
};
/** A search result with its dedupe key (lib/jobs/job-key.ts). */
export type KeyedJob = NormalizedJob & { jobKey: string };

/** Sort key for "Best match": the AI score when there is one (vetoed jobs sink), else the quick match. */
export function matchSortScore(job: JobListItem): number {
  if (job.fit) return vetoReason(job.fit) ? -0.5 : (job.fit.overallScore ?? 0);
  return job.match?.score ?? -1;
}

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
  raw: { summary: j.summary, requirements: j.requirements, possiblyStale: j.possiblyStale, alsoOn: j.alsoOn ?? [] } satisfies JobExtras,
  fetchedAt: new Date(),
});

/** Keep a local copy of every result so job pages, saves and the pipeline have a stable id. */
export async function storeJobs(db: AnyDb, jobs: KeyedJob[]): Promise<JobRow[]> {
  if (jobs.length === 0) return [];
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

/**
 * Delete stored search results not fetched in `days` that nothing refers to: not saved to
 * the pipeline and never evaluated. Keeps the lite edition's browser storage small.
 * Returns how many were removed.
 */
export async function pruneJobs(db: AnyDb, days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const removed = await db
    .delete(schema.job)
    .where(
      and(
        lt(schema.job.fetchedAt, cutoff),
        notExists(db.select({ one: sql`1` }).from(schema.application).where(eq(schema.application.jobId, schema.job.id))),
        notExists(db.select({ one: sql`1` }).from(schema.jobMatch).where(eq(schema.jobMatch.jobId, schema.job.id))),
      ),
    )
    .returning({ id: schema.job.id });
  return removed.length;
}

/** Stored jobs by id, in the order given (ids that no longer exist are skipped). */
export async function readJobsByIds(db: AnyDb, ids: string[]): Promise<JobRow[]> {
  if (ids.length === 0) return [];
  const rows = await db.select().from(schema.job).where(inArray(schema.job.id, ids));
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** "Best match" (AI score, else quick match) or "Newest", in place. */
export function sortJobs(items: JobListItem[], sort: "match" | "date"): JobListItem[] {
  if (sort === "match") return items.sort((a, b) => matchSortScore(b) - matchSortScore(a));
  return items.sort((a, b) => (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0));
}

/** The user's applications (saved jobs included), keyed by job id. */
export async function readTrackedJobs(db: AnyDb, userId: string): Promise<Map<string, TrackedJob>> {
  const rows = await db
    .select({ id: schema.application.id, jobId: schema.application.jobId, status: schema.application.status })
    .from(schema.application)
    .where(eq(schema.application.userId, userId));
  return new Map(rows.flatMap((r) => (r.jobId ? [[r.jobId, { id: r.id, status: r.status }] as const] : [])));
}

/** The user's saved evaluations for these jobs, keyed by job id. */
export async function readFitMatches(db: AnyDb, userId: string, jobIds: string[]): Promise<Map<string, FitMatch>> {
  if (jobIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(schema.jobMatch)
    .where(and(eq(schema.jobMatch.userId, userId), inArray(schema.jobMatch.jobId, jobIds)));
  return new Map(rows.map((r) => [r.jobId, r]));
}

export function extrasOf(row: JobRow): JobExtras {
  const raw = (row.raw ?? {}) as Partial<JobExtras>;
  return {
    summary: raw.summary ?? null,
    requirements: raw.requirements ?? [],
    possiblyStale: Boolean(raw.possiblyStale),
    alsoOn: raw.alsoOn ?? [],
  };
}

/** A stored job with what the list and detail views show next to it. */
export function toListItem(row: JobRow, profile: ProfileInput, tracked: Map<string, TrackedJob>, fits: Map<string, FitMatch>): JobListItem {
  const extras = extrasOf(row);
  const text = [toPlainText(row.description), extras.requirements.map((r) => r.text).join(" ")].join(" ");
  return {
    ...row,
    extras,
    saved: tracked.has(row.id),
    application: tracked.get(row.id) ?? null,
    match: quickMatch({ title: row.title, skills: row.skills, text }, profile),
    fit: fits.get(row.id) ?? null,
  };
}

export async function readJob(db: AnyDb, userId: string, id: string, profile: ProfileInput): Promise<JobListItem | null> {
  const [row] = await db.select().from(schema.job).where(eq(schema.job.id, id));
  if (!row) return null;
  const [tracked, fits] = await Promise.all([readTrackedJobs(db, userId), readFitMatches(db, userId, [row.id])]);
  return toListItem(row, profile, tracked, fits);
}

export async function readJobRow(db: AnyDb, id: string): Promise<JobRow | null> {
  const [row] = await db.select().from(schema.job).where(eq(schema.job.id, id));
  return row ?? null;
}

/** Save an AI evaluation (one row per user + job). `model` is a label such as "Ollama · gemma4:12b". */
export async function writeFitMatch(db: AnyDb, userId: string, jobId: string, result: FitEvaluation, model: string): Promise<FitMatch> {
  const values = {
    eligibilityGate: result.eligibility,
    eligibilityNote: result.eligibilityNote || null,
    languageGate: result.language,
    languageNote: result.languageNote || null,
    locationGate: result.location,
    locationNote: result.locationNote || null,
    gateNote: result.dealBreaker || null,
    skillsScore: result.skillsScore,
    experienceScore: result.experienceScore,
    cultureScore: result.cultureScore,
    careerScore: result.careerScore,
    overallScore: overallFitScore({
      skills: result.skillsScore,
      experience: result.experienceScore,
      culture: result.cultureScore,
      career: result.careerScore,
    }),
    strengths: result.strengths,
    gaps: result.gaps,
    summary: result.summary || null,
    recommendation: result.recommendation || null,
    deadline: result.deadline || null,
    postingClosed: result.postingClosed,
    model,
    scoredAt: new Date(),
  };

  const [row] = await db
    .insert(schema.jobMatch)
    .values({ userId, jobId, ...values })
    .onConflictDoUpdate({ target: [schema.jobMatch.userId, schema.jobMatch.jobId], set: values })
    .returning();
  return row;
}
