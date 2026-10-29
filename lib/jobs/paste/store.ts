import { and, eq } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { cleanDescription } from "@/lib/jobs/html";
import { jobKey } from "@/lib/jobs/job-key";
import { extrasOf, type JobExtras } from "@/lib/jobs/queries";
import type { JobCheck, PastedJob } from "./types";

/*
 * Storing pasted jobs and "still open" checks, shared by the server actions and the lite
 * edition's browser database. No auth here: callers pass the user.
 */

export const jobCheckSchema = z.object({
  status: z.enum(["open", "closed", "unknown"]),
  reason: z.string().max(500).nullable(),
  at: z.string().max(40),
});

const toDate = (iso: string | null) => {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? new Date(ms) : null;
};

/**
 * Stores a reviewed job and puts it on the user's list as saved (unless it's there already),
 * so it can't get lost. Pasting the same link or text again updates the job it made before.
 * Returns the job's id.
 */
export async function storePastedJob(db: AnyDb, userId: string, job: PastedJob, check: JobCheck | null): Promise<string> {
  const key = jobKey(job.company, job.title, `${job.source}-${job.sourceId ?? job.url}`);
  const fields = {
    url: job.url,
    title: job.title,
    company: job.company,
    companyLogo: job.companyLogo,
    location: job.location,
    workSetup: job.workSetup,
    employmentType: job.employmentType,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryCurrency: job.salaryCurrency || "PHP",
    salaryPeriod: job.salaryPeriod,
    description: cleanDescription(job.description),
    skills: job.skills,
    postedAt: toDate(job.postedAt),
    expiresAt: toDate(job.expiresAt),
    fetchedAt: new Date(),
  };
  const extras = (previous: JobExtras | null): JobExtras => ({
    summary: previous?.summary ?? null,
    requirements: job.requirements,
    possiblyStale: false,
    alsoOn: previous?.alsoOn ?? [],
    check: check ?? previous?.check ?? null,
  });

  // The same posting pasted before (same link or text), else the same company and title from a search.
  const [same] = job.sourceId
    ? await db.select().from(schema.job).where(and(eq(schema.job.source, job.source), eq(schema.job.sourceId, job.sourceId)))
    : [];
  const [existing] = same ? [same] : await db.select().from(schema.job).where(eq(schema.job.jobKey, key));

  let jobId: string;
  if (existing) {
    await db
      .update(schema.job)
      .set({ ...fields, raw: extras(extrasOf(existing)) })
      .where(eq(schema.job.id, existing.id));
    jobId = existing.id;
  } else {
    const [row] = await db
      .insert(schema.job)
      .values({ jobKey: key, source: job.source, sourceId: job.sourceId, ...fields, raw: extras(null) })
      .returning({ id: schema.job.id });
    jobId = row.id;
  }

  const [tracked] = await db
    .select({ id: schema.application.id })
    .from(schema.application)
    .where(and(eq(schema.application.userId, userId), eq(schema.application.jobId, jobId)));
  if (!tracked) {
    const [app] = await db
      .insert(schema.application)
      .values({ userId, jobId, company: job.company, role: job.title, status: "saved", channel: job.source })
      .onConflictDoNothing()
      .returning();
    if (app) await db.insert(schema.applicationEvent).values({ applicationId: app.id, status: "saved" });
  }
  return jobId;
}

/** Records a "still open" check on a stored job. Returns false when the job no longer exists. */
export async function writeJobCheck(db: AnyDb, jobId: string, check: JobCheck): Promise<boolean> {
  const [row] = await db.select().from(schema.job).where(eq(schema.job.id, jobId));
  if (!row) return false;
  await db
    .update(schema.job)
    .set({ raw: { ...extrasOf(row), check } satisfies JobExtras })
    .where(eq(schema.job.id, jobId));
  return true;
}
