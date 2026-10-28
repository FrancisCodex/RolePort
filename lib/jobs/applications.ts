import { and, asc, desc, eq, sql } from "drizzle-orm";
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

export type ApplicationEvent = typeof schema.applicationEvent.$inferSelect;
export type ApplicationDetail = PipelineItem & { events: ApplicationEvent[] };

/** One application with its job and its status history (oldest first), or null if it isn't the user's. */
export async function readApplication(db: AnyDb, userId: string, applicationId: string): Promise<ApplicationDetail | null> {
  const [row] = await db
    .select()
    .from(schema.application)
    .leftJoin(schema.job, eq(schema.application.jobId, schema.job.id))
    .where(and(eq(schema.application.id, applicationId), eq(schema.application.userId, userId)));
  if (!row) return null;
  const events = await db
    .select()
    .from(schema.applicationEvent)
    .where(eq(schema.applicationEvent.applicationId, applicationId))
    .orderBy(asc(schema.applicationEvent.occurredAt));
  return { ...row.application, job: row.job, events };
}

/**
 * The "Apply" button: put the job on the user's list as applied (or move it on from "saved")
 * and return its application, where the user prepares and tracks it. An application that's
 * further along is left as it is. Null if the job isn't stored.
 */
export async function markApplied(db: AnyDb, userId: string, jobId: string): Promise<{ applicationId: string; changed: boolean } | null> {
  const [existing] = await db
    .select()
    .from(schema.application)
    .where(and(eq(schema.application.userId, userId), eq(schema.application.jobId, jobId)));
  if (existing) {
    if (existing.status !== "saved") return { applicationId: existing.id, changed: false };
    await setStatus(db, userId, existing.id, "applied");
    return { applicationId: existing.id, changed: true };
  }

  const [job] = await db.select().from(schema.job).where(eq(schema.job.id, jobId));
  if (!job) return null;

  const [app] = await db
    .insert(schema.application)
    .values({ userId, jobId, company: job.company, role: job.title, status: "applied", channel: job.source, appliedAt: new Date() })
    // A second click that raced the first: use the application it created.
    .onConflictDoNothing()
    .returning();
  if (!app) return markApplied(db, userId, jobId);
  await db.insert(schema.applicationEvent).values({ applicationId: app.id, status: "applied" });
  return { applicationId: app.id, changed: true };
}

/** Replace an application's notes (empty clears them). Returns whether anything changed. */
export async function writeNotes(db: AnyDb, userId: string, applicationId: string, notes: string): Promise<boolean> {
  const value = notes.trim() || null;
  const updated = await db
    .update(schema.application)
    .set({ notes: value })
    .where(and(eq(schema.application.id, applicationId), eq(schema.application.userId, userId)))
    .returning({ id: schema.application.id });
  return updated.length > 0;
}

/** Set or clear when the user's interview for an application is. Returns whether the application was theirs. */
export async function writeInterviewDate(db: AnyDb, userId: string, applicationId: string, at: Date | null): Promise<boolean> {
  const updated = await db
    .update(schema.application)
    .set({ interviewAt: at })
    .where(and(eq(schema.application.id, applicationId), eq(schema.application.userId, userId)))
    .returning({ id: schema.application.id });
  return updated.length > 0;
}

/** Stop tracking an application in any status, with its history and documents. Returns whether it existed. */
export async function removeApplication(db: AnyDb, userId: string, applicationId: string): Promise<boolean> {
  const removed = await db
    .delete(schema.application)
    .where(and(eq(schema.application.id, applicationId), eq(schema.application.userId, userId)))
    .returning({ id: schema.application.id });
  return removed.length > 0;
}
