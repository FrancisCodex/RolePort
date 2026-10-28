/*
 * Where the lite edition's browser database lives, shared by the worker that opens it
 * and by pages that want to know whether it exists yet. No PGlite here: cheap to import.
 */

export const DB_NAME = "roleport";
/** OPFS marker the worker writes once a database is fully set up. */
export const READY_MARKER = "roleport.ready";
/** OPFS marker that makes the next first visit skip the starter database. */
export const NO_SEED_MARKER = "roleport.noseed";
/** How IndexedDB names PGlite's `idb://roleport` database. */
export const IDB_NAME = `/pglite/${DB_NAME}`;

/**
 * Whether this browser already has a finished database, i.e. this isn't a first visit.
 * Works on the main thread; when unsure, says yes so pages show their usual loading state.
 */
export async function hasBrowserDb(): Promise<boolean> {
  try {
    const root = await navigator.storage.getDirectory();
    const ready = await root.getFileHandle(READY_MARKER).then(
      () => true,
      () => false,
    );
    if (ready) return true;
  } catch {
    // No OPFS here: the worker uses IndexedDB.
  }
  try {
    const dbs = await indexedDB.databases();
    return dbs.some((d) => d.name === IDB_NAME);
  } catch {
    return true;
  }
}
