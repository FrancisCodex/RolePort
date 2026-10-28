import type { PGlite } from "@electric-sql/pglite";
import { PGliteWorker } from "@electric-sql/pglite/worker";
import type { MigrationConfig, MigrationMeta } from "drizzle-orm/migrator";
import type { PgSession } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";
import { LOCAL_USER } from "../local-user";
import { migrations } from "../migrations.generated";
import * as schema from "../schema";

/*
 * The lite edition's database: PGlite in a Web Worker, saved to IndexedDB.
 * Same schema and migrations as the server. Import this module with a dynamic
 * import() so PGlite only loads on pages that need data.
 */

function open() {
  const pg = new PGliteWorker(new Worker(new URL("./worker.ts", import.meta.url), { type: "module", name: "roleport-db" }));
  // PGliteWorker speaks the same query interface as PGlite.
  return { pg, db: drizzle(pg as unknown as PGlite, { schema }) };
}

export type BrowserDb = ReturnType<typeof open>["db"];

// Drizzle's own PGlite migrator reads drizzle/ from disk; this is the same step on bundled files.
type Migratable = { dialect: { migrate(m: MigrationMeta[], s: PgSession, c: MigrationConfig): Promise<void> }; session: PgSession };

async function start(): Promise<BrowserDb> {
  const { pg, db } = open();
  await pg.waitReady;
  const internals = db as unknown as Migratable;
  await internals.dialect.migrate(migrations, internals.session, { migrationsFolder: "" });
  await db.insert(schema.user).values(LOCAL_USER).onConflictDoNothing();
  // Keep browser storage small: drop old search results nothing refers to. Not awaited, so
  // pages don't wait for it; loaded on demand to keep the job queries out of this chunk.
  void import("@/lib/jobs/queries")
    .then((q) => q.pruneJobs(db, PRUNE_AFTER_DAYS))
    .catch((error) => console.warn("[lite] couldn't prune old jobs", error));
  return db;
}

const PRUNE_AFTER_DAYS = 60;

let ready: Promise<BrowserDb> | undefined;

/** Opens (and migrates) the browser database on first use; later calls share it. */
export function getBrowserDb(): Promise<BrowserDb> {
  ready ??= start().catch((error) => {
    ready = undefined; // let the next call retry
    throw error;
  });
  return ready;
}
