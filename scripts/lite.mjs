// Runs a Next.js command in lite mode (docs/LITE.md) on any OS: `node scripts/lite.mjs dev --port 3100`.
// `dev` and `build` first rebuild the starter database the browser loads on a first visit, and copy
// the ONNX Runtime files on-device Whisper loads (scripts/copy-ort.mjs).
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const args = process.argv.slice(2);
if (args[0] === "dev" || args[0] === "build") {
  const seed = spawnSync(process.execPath, ["scripts/build-seed-db.mjs"], { stdio: "inherit" });
  if (seed.status !== 0) process.exit(seed.status ?? 1);
  const ort = spawnSync(process.execPath, ["scripts/copy-ort.mjs"], { stdio: "inherit" });
  if (ort.status !== 0) process.exit(ort.status ?? 1);
}

const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
const child = spawn(process.execPath, [next, ...args], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_ROLEPORT_MODE: "lite" },
});
child.on("exit", (code, signal) => (signal ? process.kill(process.pid, signal) : process.exit(code ?? 0)));
