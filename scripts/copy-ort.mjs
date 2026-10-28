// Copies the ONNX Runtime WebAssembly files that on-device Whisper needs into public/ort/, so the
// browser loads them from RolePort itself instead of a CDN (and desktop builds work offline).
// Run before `dev` and `build`; it skips files that are already up to date.
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

const from = join("node_modules", "onnxruntime-web", "dist");
const to = join("public", "ort");

// The builds Transformers.js picks: "asyncify" normally, the plain one on Safari before 26 without WebGPU.
const FILES = [
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
];

if (!existsSync(from)) {
  console.warn("[copy-ort] onnxruntime-web isn't installed; on-device Whisper won't be available.");
  process.exit(0);
}
mkdirSync(to, { recursive: true });
let copied = 0;
for (const file of FILES) {
  const src = join(from, file);
  const dest = join(to, file);
  if (existsSync(dest) && statSync(dest).size === statSync(src).size) continue;
  copyFileSync(src, dest);
  copied++;
}
if (copied) console.log(`[copy-ort] copied ${copied} ONNX Runtime file(s) to public/ort`);
