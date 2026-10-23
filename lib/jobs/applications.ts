import { and, desc, eq, sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import type { JobRow } from "./queries";

/*
 * The pipeline (saved jobs and applications), shared by the server actions and the
 * lite edition's browser database. No auth here: callers pass the user.
 */

export type ApplicationStatus = (typeof schema.applicationStatus.enumValues)[number];
export type PipelineItem = typeof schema.application.$inferSelect & { job: JobRow | null };

export async function readApplications(db: AnyDb, userId: string): Promise<PipelineItem[]> {
  const rows = await db
    .select()
    .from(schema.application)
    .leftJoin(schema.job, eq(schema.application.jobId, schema.job.id))
    .where(eq(schema.application.userId, userId))
    .orderBy(desc(schema.application.updatedAt));
  return rows.map((r) => ({ ...r.application, job: r.job }));
}

export async function countApplications(db: AnyDb, userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.application)
    .where(eq(schema.application.userId, userId));
  return row?.n ?? 0;
}

/** Save a job to the pipeline, or remove it if it's still only "saved". Returns the new saved state. */
export async function toggleSaved(db: AnyDb, userId: string, jobId: string): Promise<{ saved: boolean; changed: boolean }> {
  const [existing] = await db
    .select()
    .from(schema.application)
    .where(and(eq(schema.application.userId, userId), eq(schema.application.jobId, jobId)));

  if (existing) {
    // Never silently delete an application that has progressed past "saved".
    if (existing.status !== "saved") return { saved: true, changed: false };
    await db.delete(schema.application).where(eq(schema.application.id, existing.id));
    return { saved: false, changed: true };
  }

  const [job] = await db.select().from(schema.job).where(eq(schema.job.id, jobId));
  if (!job) return { saved: false, changed: false };

  const [app] = await db
    .insert(schema.application)
    .values({ userId, jobId, company: job.company, role: job.title, status: "saved", channel: job.source })
    .returning();
  await db.insert(schema.applicationEvent).values({ applicationId: app.id, status: "saved" });
  return { saved: true, changed: true };
}

/** Move an application to another status. Returns whether anything changed. */
export async function setStatus(db: AnyDb, userId: string, applicationId: string, status: ApplicationStatus): Promise<boolean> {
  if (!schema.applicationStatus.enumValues.includes(status)) return false;

  const [app] = await db
    .select()
    .from(schema.application)
    .where(and(eq(schema.application.id, applicationId), eq(schema.application.userId, userId)));
  if (!app || app.status === status) return false;

  await db
    .update(schema.application)
    .set({ status, appliedAt: status === "applied" && !app.appliedAt ? new Date() : app.appliedAt })
    .where(eq(schema.application.id, app.id));
  await db.insert(schema.applicationEvent).values({ applicationId: app.id, status });
  return true;
}
