/*
 * On-device speech-to-text (Whisper), optional: nothing is downloaded until the user picks a
 * model and agrees. Every file, its size and where it comes from are listed here so the UI can
 * show exactly what a download means. Sizes were read from Hugging Face on 2026-10-28.
 *
 * Models run on the CPU (WebAssembly) with 8-bit weights, so the same files work in every
 * browser and in desktop builds (Electron, Tauri), whatever the GPU.
 */

export type WhisperModelId = "tiny" | "base" | "small";

export type WhisperModel = {
  id: WhisperModelId;
  label: string;
  /** The Hugging Face repository the files come from. */
  repo: string;
  description: string;
  /** The model files, as they appear in the download. */
  files: { name: string; mb: number }[];
};

/** Tokenizer and settings files every model also downloads (config, tokenizer, preprocessor). */
const SHARED_FILES = { name: "Tokenizer and settings files", mb: 3 };

export const WHISPER_MODELS: WhisperModel[] = [
  {
    id: "tiny",
    label: "Tiny",
    repo: "onnx-community/whisper-tiny",
    description: "Smallest and fastest. Good for clear speech in a quiet room; makes more mistakes with accents and noise.",
    files: [
      { name: "encoder_model_quantized.onnx", mb: 10.1 },
      { name: "decoder_model_merged_quantized.onnx", mb: 30.7 },
      SHARED_FILES,
    ],
  },
  {
    id: "base",
    label: "Base",
    repo: "onnx-community/whisper-base",
    description: "Recommended. Noticeably more accurate than Tiny and still quick on most laptops.",
    files: [
      { name: "encoder_model_quantized.onnx", mb: 23.2 },
      { name: "decoder_model_merged_quantized.onnx", mb: 53.7 },
      SHARED_FILES,
    ],
  },
  {
    id: "small",
    label: "Small",
    repo: "onnx-community/whisper-small",
    description: "Most accurate, including accented English and Filipino. Slower: a minute-long answer can take a while on older computers.",
    files: [
      { name: "encoder_model_quantized.onnx", mb: 92.3 },
      { name: "decoder_model_merged_quantized.onnx", mb: 156.8 },
      SHARED_FILES,
    ],
  },
];

export const DEFAULT_WHISPER_MODEL: WhisperModelId = "base";

export const whisperModel = (id: string) => WHISPER_MODELS.find((m) => m.id === id) ?? WHISPER_MODELS.find((m) => m.id === DEFAULT_WHISPER_MODEL)!;

export const modelMb = (m: WhisperModel) => Math.round(m.files.reduce((n, f) => n + f.mb, 0));

/** The speech engine runtime (ONNX Runtime for WebAssembly), served by RolePort itself, not a CDN. */
export const WHISPER_RUNTIME = { name: "ONNX Runtime for WebAssembly", mb: 27, from: "RolePort (this site)" };

/** Where model files come from, for the "what gets downloaded" list. */
export const MODEL_HOST = "huggingface.co";

/** The Cache Storage bucket Transformers.js keeps downloaded files in. */
const CACHE_NAME = "transformers-cache";

const cacheAvailable = () => typeof caches !== "undefined";

/** Which models are fully downloaded in this browser. */
export async function downloadedModels(): Promise<WhisperModelId[]> {
  if (!cacheAvailable()) return [];
  try {
    if (!(await caches.has(CACHE_NAME))) return [];
    const urls = (await (await caches.open(CACHE_NAME)).keys()).map((r) => r.url);
    return WHISPER_MODELS.filter((m) =>
      m.files.filter((f) => f.name.endsWith(".onnx")).every((f) => urls.some((u) => u.includes(m.repo) && u.endsWith(f.name))),
    ).map((m) => m.id);
  } catch {
    return [];
  }
}

/** Remove a model's files from this browser (and the runtime with the last one). */
export async function deleteModel(id: WhisperModelId): Promise<void> {
  if (!cacheAvailable() || !(await caches.has(CACHE_NAME))) return;
  const cache = await caches.open(CACHE_NAME);
  const repo = whisperModel(id).repo;
  const keys = await cache.keys();
  await Promise.all(keys.filter((r) => r.url.includes(repo)).map((r) => cache.delete(r)));
  const left = await downloadedModels();
  if (left.length === 0) await caches.delete(CACHE_NAME);
}

/** Free space the browser allows this site, in MB, or null if it won't say. */
export async function storageLeftMb(): Promise<number | null> {
  try {
    const { quota, usage } = await navigator.storage.estimate();
    return quota != null && usage != null ? Math.round((quota - usage) / 1e6) : null;
  } catch {
    return null;
  }
}
