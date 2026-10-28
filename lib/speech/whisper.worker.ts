/// <reference lib="webworker" />
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

/*
 * Whisper in a Web Worker, so transcribing never freezes the page. The main thread talks to it
 * through lib/speech/whisper.ts. Files are fetched only on a "load" with allowDownload set (the
 * user pressed Download); every other load reads from this browser's cache and fails if a file
 * is missing, so nothing is ever downloaded behind the user's back.
 */

type In =
  | { type: "load"; repo: string; allowDownload: boolean }
  | { type: "transcribe"; id: number; repo: string; audio: Float32Array };

type Out =
  | { type: "progress"; file: string; loaded: number; total: number }
  | { type: "ready"; repo: string }
  | { type: "result"; id: number; text: string }
  | { type: "error"; id?: number; message: string };

const post = (m: Out) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

env.useBrowserCache = true;
// The runtime comes from RolePort itself (scripts/copy-ort.mjs), not a CDN. Safari before 26
// without WebGPU needs the plain build; everything else uses "asyncify", as Transformers.js would.
const ua = self.navigator.userAgent;
const oldSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua) && !("gpu" in self.navigator);
const suffix = oldSafari ? "" : ".asyncify";
const wasm = env.backends.onnx.wasm as { wasmPaths?: unknown } | undefined;
if (wasm) {
  wasm.wasmPaths = {
    mjs: new URL(`/ort/ort-wasm-simd-threaded${suffix}.mjs`, self.location.origin).href,
    wasm: new URL(`/ort/ort-wasm-simd-threaded${suffix}.wasm`, self.location.origin).href,
  };
}

let asr: AutomaticSpeechRecognitionPipeline | null = null;
let loadedRepo: string | null = null;

async function load(repo: string, allowDownload: boolean): Promise<AutomaticSpeechRecognitionPipeline> {
  if (asr && loadedRepo === repo) return asr;
  // The browser cache is checked first either way (keyed by the Hugging Face URL). Cache-only
  // mode needs "local" models on, or Transformers.js refuses to run with both sources off; a
  // missing file then fails with "not found locally" instead of being downloaded.
  env.allowRemoteModels = allowDownload;
  env.allowLocalModels = !allowDownload;
  const loaded = await pipeline("automatic-speech-recognition", repo, {
    device: "wasm",
    dtype: "q8",
    progress_callback: (p: { status?: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status === "progress" && p.file) post({ type: "progress", file: p.file, loaded: p.loaded ?? 0, total: p.total ?? 0 });
    },
  });
  asr = loaded as AutomaticSpeechRecognitionPipeline;
  loadedRepo = repo;
  return asr;
}

self.onmessage = async (e: MessageEvent<In>) => {
  const msg = e.data;
  try {
    if (msg.type === "load") {
      await load(msg.repo, msg.allowDownload);
      post({ type: "ready", repo: msg.repo });
      return;
    }
    const run = await load(msg.repo, false);
    // Language is detected per answer, so English, Filipino and a mix of both all work.
    const output = await run(msg.audio, { chunk_length_s: 30, stride_length_s: 5, task: "transcribe" });
    const text = (Array.isArray(output) ? output.map((o) => o.text).join(" ") : output.text).trim();
    post({ type: "result", id: msg.id, text });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    post({ type: "error", id: msg.type === "transcribe" ? msg.id : undefined, message });
  }
};
