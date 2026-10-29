// Rewrites the "Job sources" table in README.md from each source's metadata
// (lib/jobs/sources/readme-table.test.ts holds the generator, so it runs the TypeScript as is).
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["vitest", "run", "lib/jobs/sources/readme-table.test.ts"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, UPDATE_SOURCES_TABLE: "1" },
});
process.exit(result.status ?? 1);
