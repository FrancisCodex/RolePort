import { and, eq, isNull, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { KEY_COLUMNS, type Backup } from "./format";

/**
 * "merge" keeps what's here and adds the backup, a row from the backup winning only when it's
 * newer (so importing the same file twice changes nothing). "replace" first deletes this
 * user's profile, pipeline, evaluations and documents.
 */
export type ImportMode = "merge" | "replace";

export type ImportSummary = {
  profile: boolean;
  settings: boolean;
  jobs: number;
  evaluations: number;
  applications: number;
  events: number;
  documents: number;
  interviews: number;
};

function omit<T extends object, K extends keyof T>(row: T, keys: readonly K[]): Omit<T, K> {
  const copy = { ...row };
  for (const key of keys) delete copy[key];
  return copy;
}

/**
 * Restore a backup (from parseBackup) into `userId`'s data, in one transaction. Rows move to
 * this install's user and job ids; jobs already here (same dedupe key) are reused. API keys
 * here are never touched.
 */
export async function importBackup(db: AnyDb, userId: string, backup: Backup, mode: ImportMode): Promise<ImportSummary> {
  const t = backup.tables;
  const merge = mode === "merge";
  // In merge mode an existing row is only overwritten by a newer one from the backup.
  const newer = (column: AnyColumn, excluded: string): SQL | undefined =>
    merge ? sql`excluded.${sql.raw(excluded)} > ${column}` : undefined;

  return db.transaction(async (tx) => {
    const summary: ImportSummary = { profile: false, settings: false, jobs: 0, evaluations: 0, applications: 0, events: 0, documents: 0, interviews: 0 };

    if (!merge) {
      await tx.delete(schema.interviewSession).where(eq(schema.interviewSession.userId, userId));
      // Events and application documents go with their applications (cascade).
      await tx.delete(schema.application).where(eq(schema.application.userId, userId));
      await tx.delete(schema.document).where(eq(schema.document.userId, userId));
      await tx.delete(schema.jobMatch).where(eq(schema.jobMatch.userId, userId));
      await tx.delete(schema.profile).where(eq(schema.profile.userId, userId));
    }

    // The name lives on the user row. Merging never overwrites a name that's already set.
    if (backup.user.name) {
      const [me] = await tx.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, userId));
      if (!merge || !me?.name) await tx.update(schema.user).set({ name: backup.user.name }).where(eq(schema.user.id, userId));
    }

    for (const row of t.profile) {
      const values = { ...omit(row, ["userId"]), userId };
      const written = await tx
        .insert(schema.profile)
        .values(values)
        .onConflictDoUpdate({ target: schema.profile.userId, set: omit(values, ["userId", "createdAt"]), setWhere: newer(schema.profile.updatedAt, "updated_at") })
        .returning({ userId: schema.profile.userId });
      summary.profile ||= written.length > 0;
    }

    for (const row of t.userSettings) {
      const values = { ...omit(row, ["userId", ...KEY_COLUMNS]), userId };
      const written = await tx
        .insert(schema.userSettings)
        .values(values)
        .onConflictDoUpdate({
          target: schema.userSettings.userId,
          set: omit(values, ["userId", "createdAt"]),
          setWhere: newer(schema.userSettings.updatedAt, "updated_at"),
        })
        .returning({ userId: schema.userSettings.userId });
      summary.settings ||= written.length > 0;
    }

    // Jobs: reuse the one already stored for the same posting, else insert it.
    const jobIds = new Map<string, string>();
    for (const row of t.job) {
      const [existing] = await tx
        .select({ id: schema.job.id })
        .from(schema.job)
        .where(
          or(
            eq(schema.job.jobKey, row.jobKey),
            row.sourceId ? and(eq(schema.job.source, row.source), eq(schema.job.sourceId, row.sourceId)) : undefined,
          ),
        );
      if (existing) {
        jobIds.set(row.id, existing.id);
        continue;
      }
      const [inserted] = await tx.insert(schema.job).values(omit(row, ["id"])).returning({ id: schema.job.id });
      jobIds.set(row.id, inserted.id);
      summary.jobs++;
    }

    for (const row of t.jobMatch) {
      const jobId = jobIds.get(row.jobId);
      if (!jobId) continue;
      const values = { ...omit(row, ["id", "userId", "jobId"]), userId, jobId };
      const written = await tx
        .insert(schema.jobMatch)
        .values(values)
        .onConflictDoUpdate({
          target: [schema.jobMatch.userId, schema.jobMatch.jobId],
          set: omit(values, ["userId", "jobId"]),
          setWhere: newer(schema.jobMatch.scoredAt, "scored_at"),
        })
        .returning({ id: schema.jobMatch.id });
      summary.evaluations += written.length;
    }

    // Applications: one per user and job; ones whose job is gone are matched by company and role.
    const appIds = new Map<string, string>();
    for (const row of t.application) {
      const jobId = row.jobId ? (jobIds.get(row.jobId) ?? null) : null;
      const values = { ...omit(row, ["id", "userId", "jobId"]), userId, jobId };
      if (jobId) {
        const written = await tx
          .insert(schema.application)
          .values(values)
          .onConflictDoUpdate({
            target: [schema.application.userId, schema.application.jobId],
            set: omit(values, ["userId", "jobId", "createdAt"]),
            setWhere: newer(schema.application.updatedAt, "updated_at"),
          })
          .returning({ id: schema.application.id });
        summary.applications += written.length;
        const [app] = await tx
          .select({ id: schema.application.id })
          .from(schema.application)
          .where(and(eq(schema.application.userId, userId), eq(schema.application.jobId, jobId)));
        appIds.set(row.id, app.id);
        continue;
      }
      const [existing] = await tx
        .select({ id: schema.application.id })
        .from(schema.application)
        .where(
          and(
            eq(schema.application.userId, userId),
            isNull(schema.application.jobId),
            eq(schema.application.company, row.company),
            eq(schema.application.role, row.role),
          ),
        );
      if (existing) {
        appIds.set(row.id, existing.id);
        continue;
      }
      const [inserted] = await tx.insert(schema.application).values(values).returning({ id: schema.application.id });
      appIds.set(row.id, inserted.id);
      summary.applications++;
    }

    for (const row of t.applicationEvent) {
      const applicationId = appIds.get(row.applicationId);
      if (!applicationId) continue;
      const [existing] = await tx
        .select({ id: schema.applicationEvent.id })
        .from(schema.applicationEvent)
        .where(
          and(
            eq(schema.applicationEvent.applicationId, applicationId),
            eq(schema.applicationEvent.status, row.status),
            eq(schema.applicationEvent.occurredAt, row.occurredAt),
          ),
        );
      if (existing) continue;
      await tx.insert(schema.applicationEvent).values({ ...omit(row, ["id"]), applicationId });
      summary.events++;
    }

    for (const row of t.document) {
      const applicationId = row.applicationId ? (appIds.get(row.applicationId) ?? null) : null;
      const [existing] = await tx
        .select({ id: schema.document.id })
        .from(schema.document)
        .where(
          and(
            eq(schema.document.userId, userId),
            eq(schema.document.kind, row.kind),
            eq(schema.document.title, row.title),
            eq(schema.document.version, row.version),
          ),
        );
      if (existing) continue;
      await tx.insert(schema.document).values({ ...omit(row, ["id", "userId", "applicationId"]), userId, applicationId });
      summary.documents++;
    }

    for (const row of t.interviewSession) {
      const applicationId = row.applicationId ? (appIds.get(row.applicationId) ?? null) : null;
      // Same title started at the same moment: the same interview, already here.
      const [existing] = await tx
        .select({ id: schema.interviewSession.id })
        .from(schema.interviewSession)
        .where(
          and(
            eq(schema.interviewSession.userId, userId),
            eq(schema.interviewSession.title, row.title),
            eq(schema.interviewSession.createdAt, row.createdAt),
          ),
        );
      if (existing) continue;
      await tx.insert(schema.interviewSession).values({ ...omit(row, ["id", "userId", "applicationId"]), userId, applicationId });
      summary.interviews++;
    }

    return summary;
  });
}
