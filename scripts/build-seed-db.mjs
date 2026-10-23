// Builds the lite edition's starter database (docs/LITE-IMPLEMENTATION.md §1.5): an empty,
// fully migrated PGlite data folder, dumped as a gzipped tar the browser loads on a first
// visit instead of creating and migrating a database itself.
//   node scripts/build-seed-db.mjs   → public/pglite/seed.tar.gz
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

const OUT_DIR = "public/pglite";
const OUT = `${OUT_DIR}/seed.tar.gz`;
const WORKER = "lib/db/browser/worker.ts";
// Files the database may gain after loading (new tables) before the OPFS pool refills.
const POOL_HEADROOM = 30;

const pg = new PGlite(); // in memory
await migrate(drizzle(pg), { migrationsFolder: "drizzle" });
const dump = await pg.dumpDataDir("gzip");

await pg.close();
const gz = Buffer.from(await dump.arrayBuffer());

// The browser's OPFS backend needs one pooled file handle per file it unpacks (see the worker).
// Count regular files in the tar: 512-byte headers, type flag "0" (or NUL), size in octal.
const tar = gunzipSync(gz);
let files = 0;
for (let at = 0; at + 512 <= tar.length && tar[at] !== 0; ) {
  const type = tar[at + 156];
  const size = parseInt(tar.subarray(at + 124, at + 136).toString().replace(/\0.*$/, "").trim() || "0", 8);
  if (type === 0x30 || type === 0) files++;
  at += 512 + Math.ceil(size / 512) * 512;
}

const poolSize = Number(readFileSync(WORKER, "utf8").match(/const SEED_POOL_SIZE = (\d+);/)?.[1]);
if (!poolSize) throw new Error(`Couldn't find SEED_POOL_SIZE in ${WORKER}.`);
if (files + POOL_HEADROOM > poolSize) {
  console.error(`The starter database has ${files} files; raise SEED_POOL_SIZE in ${WORKER} to at least ${files + POOL_HEADROOM}.`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, gz);
console.log(`Wrote ${OUT} (${Math.round(gz.length / 1024)} KB, ${files} files, pool ${poolSize})`);
