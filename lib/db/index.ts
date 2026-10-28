import "server-only";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { isLite } from "@/lib/mode";
import * as schema from "./schema";

/**
 * Two backends behind one Drizzle API:
 * - DATABASE_URL set → a real Postgres server (local, Supabase, Neon…). Run `npm run db:migrate`.
 * - DATABASE_URL unset → embedded PGlite stored in .data/pglite, migrated automatically.
 *   Zero setup, single process — ideal for trying RolePort on your own machine.
 *
 * Created lazily on first use so build workers never open the database.
 */
export type Db = PostgresJsDatabase<typeof schema>;

type DbState = { db: Db; ready: Promise<unknown> };

function createDb(): DbState {
  // The hosted lite edition keeps no user data on the server (docs/LITE.md); its data lives in the browser.
  if (isLite) throw new Error("The lite build has no server database. Read data through lib/db/browser instead.");

  const url = process.env.DATABASE_URL;
  if (url) {
    return { db: drizzlePostgres(postgres(url, { prepare: false }), { schema }), ready: Promise.resolve() };
  }

  const dir = process.env.PGLITE_DIR ?? ".data/pglite";
  mkdirSync(dir, { recursive: true });
  warnIfSynced(dir);
  const client = new PGlite(dir);
  closeOnShutdown(client);
  const db = drizzlePglite(client, { schema });
  const ready = migrate(db, { migrationsFolder: "drizzle" });
  // Same query builder surface; only the driver type differs.
  return { db: db as unknown as Db, ready };
}

/**
 * Close PGlite before the process exits, so its last checkpoint is written. An embedded
 * database killed mid-write can't recover on its next start ("could not locate a valid
 * checkpoint record"). Covers `docker stop` and Ctrl+C on `next start`; `next dev` on
 * Windows force-kills its server process, so there it can only help, not guarantee.
 */
function closeOnShutdown(client: PGlite) {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    // Prepended so the close starts before Next's own shutdown, which ends in process.exit.
    process.prependOnceListener(signal, () => {
      void client
        .close()
        .catch(() => {})
        .finally(() => {
          // With nobody else handling the signal, exiting is ours to do.
          if (process.listenerCount(signal) === 0) process.exit(signal === "SIGINT" ? 130 : 143);
        });
    });
  }
}

/** Sync clients (OneDrive, Dropbox…) rewrite files while PGlite has them open, which can corrupt the database. */
function warnIfSynced(dir: string) {
  const path = resolve(dir);
  if (/[\\/](OneDrive[^\\/]*|Dropbox|Google Drive|iCloud ?Drive|Mobile Documents)[\\/]/i.test(path)) {
    console.warn(
      `[db] The database folder ${path} is inside a cloud-synced folder. Syncing can corrupt it while RolePort is running. ` +
        `Set PGLITE_DIR in .env.local to a folder outside it, e.g. PGLITE_DIR=${join(homedir(), ".roleport", "pglite").replace(/\\/g, "/")}`,
    );
  }
}

// One instance per process, surviving dev hot reloads (PGlite holds a lock on its folder).
const globalForDb = globalThis as unknown as { roleportDb?: DbState };

function state(): DbState {
  return (globalForDb.roleportDb ??= createDb());
}

/** Resolves once the schema is migrated. */
export async function getDb(): Promise<Db> {
  const s = state();
  await s.ready;
  return s.db;
}

export { schema };
