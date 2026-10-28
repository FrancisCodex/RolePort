import "server-only";
import { mkdirSync } from "node:fs";
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
  const db = drizzlePglite(new PGlite(dir), { schema });
  const ready = migrate(db, { migrationsFolder: "drizzle" });
  // Same query builder surface; only the driver type differs.
  return { db: db as unknown as Db, ready };
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
