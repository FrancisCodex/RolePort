// Builds RolePort's server for the desktop app into desktop/server:
//   node desktop/scripts/prepare-server.mjs   (npm run desktop does this first)
// A Next.js standalone build (next.config.ts, ROLEPORT_DESKTOP_BUILD=1) holds the server and the
// node_modules it needs; the static files, public folder and database migrations are copied in.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.join(root, "desktop", "server");
const standalone = path.join(root, ".next", "standalone");

function run(args, env = {}) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// On-device Whisper's runtime files, served from public/ort (works offline).
run(["scripts/copy-ort.mjs"]);
const next = createRequire(path.join(root, "package.json")).resolve("next/dist/bin/next");
// New desktop users start on the welcome guide, as in Lite (self-hosted installs leave it off).
run([next, "build"], { ROLEPORT_DESKTOP_BUILD: "1", NEXT_PUBLIC_ROLEPORT_ONBOARDING: "on", NEXT_TELEMETRY_DISABLED: "1" });

if (!existsSync(path.join(standalone, "server.js"))) {
  console.error("The build made no .next/standalone/server.js. Is output: \"standalone\" still set for ROLEPORT_DESKTOP_BUILD in next.config.ts?");
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
// dereference: the standalone node_modules may hold links that wouldn't survive packaging.
cpSync(standalone, out, { recursive: true, dereference: true });
cpSync(path.join(root, ".next", "static"), path.join(out, ".next", "static"), { recursive: true });
cpSync(path.join(root, "drizzle"), path.join(out, "drizzle"), { recursive: true });
// public/pglite is the lite edition's starter database; the desktop app has its own.
cpSync(path.join(root, "public"), path.join(out, "public"), {
  recursive: true,
  filter: (src) => !src.startsWith(path.join(root, "public", "pglite")),
});
console.log(`RolePort's server is ready in ${path.relative(root, out)}.`);
