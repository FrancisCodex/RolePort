import { eq, inArray } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { APP_VERSION, BACKUP_FORMAT, BACKUP_VERSION, SCHEMA_VERSION, type Backup } from "./format";

/**
 * Everything of one user's, as a backup. Jobs are a shared cache, so only the ones the user
 * saved or evaluated go in. API keys are left out.
 */
export async function exportBackup(db: AnyDb, user: { id: string; name: string }): Promise<Backup> {
  const [profile, settings, jobMatch, application, document, interviewSession] = await Promise.all([
    db.select().from(schema.profile).where(eq(schema.profile.userId, user.id)),
    db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, user.id)),
    db.select().from(schema.jobMatch).where(eq(schema.jobMatch.userId, user.id)),
    db.select().from(schema.application).where(eq(schema.application.userId, user.id)),
    db.select().from(schema.document).where(eq(schema.document.userId, user.id)),
    db.select().from(schema.interviewSession).where(eq(schema.interviewSession.userId, user.id)),
  ]);

  const appIds = application.map((a) => a.id);
  const jobIds = [...new Set([...jobMatch.map((m) => m.jobId), ...application.flatMap((a) => (a.jobId ? [a.jobId] : []))])];
  const [applicationEvent, job] = await Promise.all([
    appIds.length ? db.select().from(schema.applicationEvent).where(inArray(schema.applicationEvent.applicationId, appIds)) : [],
    jobIds.length ? db.select().from(schema.job).where(inArray(schema.job.id, jobIds)) : [],
  ]);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    user: { name: user.name },
    tables: {
      profile,
      userSettings: settings.map((s) => ({ ...s, aiApiKeyEnc: null, rapidApiKeyEnc: null })),
      job,
      jobMatch,
      application,
      applicationEvent,
      document,
      interviewSession,
    },
  };
}
