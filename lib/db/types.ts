import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/**
 * Any Drizzle database with HireMe's schema: the server's (Postgres or PGlite) or the
 * browser's (PGlite in IndexedDB, lite mode). Query code shared by both takes this.
 */
export type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;
