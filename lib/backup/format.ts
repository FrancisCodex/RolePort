import { getTableColumns, type InferSelectModel, type Table } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@/lib/db/schema";
import { migrations } from "@/lib/db/migrations.generated";
import packageJson from "@/package.json";

/*
 * A RolePort backup: one JSON file with a user's data, readable by either edition, so a lite
 * user can move to a self-hosted install and back. API keys are never included: the
 * server's are encrypted with its own secret and the browser's shouldn't sit in a file.
 */

export const BACKUP_FORMAT = "roleport-backup";
/** What backups were called before the app was renamed from HireMe; still accepted on import. */
const LEGACY_BACKUP_FORMAT = "hireme-backup";
export const BACKUP_VERSION = 1;
/** The newest migration, so an older install can refuse a backup with tables it doesn't know. */
export const SCHEMA_VERSION = migrations.at(-1)?.folderMillis ?? 0;
export const APP_VERSION = packageJson.version;

/** The tables a backup carries, in the order they're restored. */
export const BACKUP_TABLES = {
  profile: schema.profile,
  userSettings: schema.userSettings,
  job: schema.job,
  jobMatch: schema.jobMatch,
  application: schema.application,
  applicationEvent: schema.applicationEvent,
  document: schema.document,
} satisfies Record<string, Table>;

type BackupTables = typeof BACKUP_TABLES;
export type BackupRows = { [K in keyof BackupTables]: InferSelectModel<BackupTables[K]>[] };

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  appVersion: string;
  schemaVersion: number;
  exportedAt: string;
  user: { name: string };
  tables: BackupRows;
};

/** Settings columns that hold API keys: always left out of a backup. */
export const KEY_COLUMNS = ["aiApiKeyEnc", "rapidApiKeyEnc"] as const;

const rows = z.array(z.record(z.string(), z.unknown()));
const backupSchema = z.object({
  format: z.enum([BACKUP_FORMAT, LEGACY_BACKUP_FORMAT]),
  version: z.literal(BACKUP_VERSION),
  appVersion: z.string(),
  schemaVersion: z.number(),
  exportedAt: z.string(),
  user: z.object({ name: z.string() }),
  tables: z.object(Object.fromEntries(Object.keys(BACKUP_TABLES).map((k) => [k, rows])) as Record<keyof BackupTables, typeof rows>),
});

/** Check rows against a table: only known columns, timestamps back to Dates. */
function revive(name: string, table: Table, input: Record<string, unknown>[]): Record<string, unknown>[] {
  const columns = getTableColumns(table);
  return input.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const column = columns[key];
      if (!column) throw new Error(`The backup has an unknown field "${key}" in ${name}.`);
      if (column.dataType === "date" && typeof value === "string") {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) throw new Error(`The backup has an invalid date in ${name}.${key}.`);
        out[key] = date;
      } else {
        out[key] = value;
      }
    }
    return out;
  });
}

/** Parse and check a backup file's JSON. Throws an Error with a message for the user. */
export function parseBackup(json: unknown): Backup {
  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) throw new Error("That file isn't a RolePort backup.");
  const backup = parsed.data;
  if (backup.schemaVersion > SCHEMA_VERSION) {
    throw new Error("This backup was made by a newer version of RolePort. Update this install, then import it again.");
  }
  const tables = Object.fromEntries(
    (Object.keys(BACKUP_TABLES) as (keyof BackupTables)[]).map((k) => [k, revive(k, BACKUP_TABLES[k], backup.tables[k])]),
  ) as unknown as BackupRows;
  return { ...backup, format: BACKUP_FORMAT, version: BACKUP_VERSION, tables };
}

/** File name for a download, e.g. roleport-backup-2026-10-23.json. */
export function backupFileName(date = new Date()): string {
  return `roleport-backup-${date.toISOString().slice(0, 10)}.json`;
}
