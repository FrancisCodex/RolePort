"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

type Status = (typeof schema.applicationStatus.enumValues)[number];

/** Save a job to the pipeline, or remove it if it's still only "saved". Returns the new saved state. */
export async function toggleSavedJob(jobId: string): Promise<{ saved: boolean }> {
  const user = await getCurrentUser();
  const db = await getDb();

  const [existing] = await db
    .select()
    .from(schema.application)
    .where(and(eq(schema.application.userId, user.id), eq(schema.application.jobId, jobId)));

  if (existing) {
    // Never silently delete an application that has progressed past "saved".
    if (existing.status !== "saved") return { saved: true };
    await db.delete(schema.application).where(eq(schema.application.id, existing.id));
    refresh();
    return { saved: false };
  }

  const [job] = await db.select().from(schema.job).where(eq(schema.job.id, jobId));
  if (!job) return { saved: false };

  const [app] = await db
    .insert(schema.application)
    .values({ userId: user.id, jobId, company: job.company, role: job.title, status: "saved", channel: job.source })
    .returning();
  await db.insert(schema.applicationEvent).values({ applicationId: app.id, status: "saved" });
  refresh();
  return { saved: true };
}

export async function setApplicationStatus(applicationId: string, status: Status): Promise<void> {
  const user = await getCurrentUser();
  if (!schema.applicationStatus.enumValues.includes(status)) return;
  const db = await getDb();

  const [app] = await db
    .select()
    .from(schema.application)
    .where(and(eq(schema.application.id, applicationId), eq(schema.application.userId, user.id)));
  if (!app || app.status === status) return;

  await db
    .update(schema.application)
    .set({ status, appliedAt: status === "applied" && !app.appliedAt ? new Date() : app.appliedAt })
    .where(eq(schema.application.id, app.id));
  await db.insert(schema.applicationEvent).values({ applicationId: app.id, status });
  refresh();
}
