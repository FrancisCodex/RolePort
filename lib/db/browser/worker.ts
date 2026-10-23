import { PGlite } from "@electric-sql/pglite";
import { OpfsAhpFS } from "@electric-sql/pglite/opfs-ahp";
import { worker } from "@electric-sql/pglite/worker";
import { DB_NAME as NAME, IDB_NAME, NO_SEED_MARKER as NO_SEED, READY_MARKER as READY } from "./storage";

/*
 * One database per origin, shared by every open tab: PGlite elects one tab's worker to own it.
 *
 * Storage: OPFS (sync access handles, worker-only) where the browser has it, else IndexedDB.
 * Measured in Chromium (docs/LITE-IMPLEMENTATION.md §1.5), OPFS is about 2x faster to open
 * and about 15x faster per query: IndexedDB writes the whole data folder after every query.
 * Writes are durable (no relaxedDurability): the browser holds the only copy of the data.
 *
 * First visit: instead of creating and migrating a database, load the migrated starter
 * database built by scripts/build-seed-db.mjs. If the seed is missing or fails to load,
 * the database is created the usual way.
 */
const hasOpfs = "FileSystemSyncAccessHandle" in globalThis && typeof navigator.storage?.getDirectory === "function";
const SEED_URL = "/pglite/seed.tar.gz";

// The OPFS backend opens one handle per file from a pool that starts at 1,000; the seed
// unpacks about 1,040 files in one go, so it needs a bigger starting pool. Each pooled
// handle costs time on a first visit, so keep it just above the seed: the seed build
// (scripts/build-seed-db.mjs) fails when it gets too close.
const SEED_POOL_SIZE = 1100;

async function fetchSeed(): Promise<Blob | undefined> {
  try {
    const res = await fetch(SEED_URL);
    if (!res.ok) return undefined;
    const bytes = new Uint8Array(await res.arrayBuffer());
    // PGlite unpacks gzip only when the Blob says so; a server may already have decoded it.
    const gzipped = bytes[0] === 0x1f && bytes[1] === 0x8b;
    return new Blob([bytes], { type: gzipped ? "application/x-gzip" : "application/x-tar" });
  } catch {
    return undefined;
  }
}

async function openOpfs(): Promise<PGlite> {
  const root = await navigator.storage.getDirectory();
  const has = (name: string) => root.getFileHandle(name).then(
    () => true,
    () => false,
  );
  if (await has(READY)) return new PGlite(`opfs-ahp://${NAME}`);

  // No READY marker: no finished database yet. Clear what an interrupted first visit left
  // (no handles are open yet).
  await root.removeEntry(NAME, { recursive: true }).catch(() => {});
  const seed = (await has(NO_SEED)) ? undefined : await fetchSeed();
  try {
    const pg = seed
      ? new PGlite({ fs: new OpfsAhpFS(NAME, { initialPoolSize: SEED_POOL_SIZE }), loadDataDir: seed })
      : new PGlite(`opfs-ahp://${NAME}`);
    await pg.waitReady;
    await root.getFileHandle(READY, { create: true });
    return pg;
  } catch (error) {
    // This worker may still hold file handles, so cleanup waits for the next start (see above).
    if (seed) await root.getFileHandle(NO_SEED, { create: true }).catch(() => {});
    throw error;
  }
}

async function openIndexedDb(): Promise<PGlite> {
  const exists = await indexedDB.databases().then(
    (dbs) => dbs.some((d) => d.name === IDB_NAME),
    () => true, // unsure: never load a seed over a database
  );
  const seed = exists ? undefined : await fetchSeed();
  if (seed) {
    let pg: PGlite | undefined;
    try {
      pg = new PGlite(`idb://${NAME}`, { loadDataDir: seed });
      await pg.waitReady;
      return pg;
    } catch (error) {
      console.warn("[hireme] couldn't load the starter database; creating one instead", error);
      await pg?.close().catch(() => {});
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(IDB_NAME);
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      });
    }
  }
  return new PGlite(`idb://${NAME}`);
}

worker({
  async init() {
    return hasOpfs ? openOpfs() : openIndexedDb();
  },
});
