"use client";

import { whisperModel, type WhisperModelId } from "./whisper-models";

/*
 * The page's side of on-device Whisper: one worker (lib/speech/whisper.worker.ts), created on
 * first use. download() is the only call that may fetch model files, and only the UI's Download
 * button calls it; transcribe() works from the browser's cache alone.
 */

type Progress = { loaded: number; total: number };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (text: string) => void; reject: (error: Error) => void }>();
let loadWaiter: { resolve: () => void; reject: (error: Error) => void; files: Map<string, Progress>; onProgress?: (p: Progress) => void } | null = null;

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module", name: "roleport-whisper" });
  worker.onmessage = (e: MessageEvent) => {
    const m = e.data as
      | { type: "progress"; file: string; loaded: number; total: number }
      | { type: "ready" }
      | { type: "result"; id: number; text: string }
      | { type: "error"; id?: number; message: string };
    if (m.type === "progress" && loadWaiter) {
      loadWaiter.files.set(m.file, { loaded: m.loaded, total: m.total });
      const sum = [...loadWaiter.files.values()].reduce((a, f) => ({ loaded: a.loaded + f.loaded, total: a.total + f.total }), { loaded: 0, total: 0 });
      loadWaiter.onProgress?.(sum);
    } else if (m.type === "ready") {
      loadWaiter?.resolve();
      loadWaiter = null;
    } else if (m.type === "result") {
      pending.get(m.id)?.resolve(m.text);
      pending.delete(m.id);
    } else if (m.type === "error") {
      const error = new Error(friendly(m.message));
      if (m.id !== undefined) {
        pending.get(m.id)?.reject(error);
        pending.delete(m.id);
      } else {
        loadWaiter?.reject(error);
        loadWaiter = null;
      }
    }
  };
  return worker;
}

function friendly(message: string): string {
  if (/allowRemoteModels|not found locally|local_files_only|Unable to (get|find) model file|Invalid configuration/i.test(message)) {
    return "The Whisper model isn't downloaded in this browser. Download it in Voice settings, or switch to built-in speech.";
  }
  if (/fetch|network|Failed to load/i.test(message)) return "Couldn't download the model. Check your connection and try again.";
  if (/quota|storage/i.test(message)) return "There isn't enough storage space in this browser for the model.";
  return `On-device speech recognition failed: ${message}`;
}

/** Download a model into this browser (the user agreed to it). Reports bytes loaded across all files. */
export function downloadWhisper(id: WhisperModelId, onProgress?: (p: Progress) => void): Promise<void> {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    loadWaiter = { resolve, reject, files: new Map(), onProgress };
    w.postMessage({ type: "load", repo: whisperModel(id).repo, allowDownload: true });
  });
}

/** Transcribe 16 kHz mono audio with a model already in this browser. Never downloads anything. */
export function transcribeWithWhisper(id: WhisperModelId, audio: Float32Array): Promise<string> {
  const w = getWorker();
  const msgId = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(msgId, { resolve, reject });
    w.postMessage({ type: "transcribe", id: msgId, repo: whisperModel(id).repo, audio }, [audio.buffer]);
  });
}

/** Turn a recording (any format the browser recorded) into 16 kHz mono samples for Whisper. */
export async function toWhisperAudio(recording: Blob): Promise<Float32Array> {
  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const context = new AudioCtx({ sampleRate: 16000 });
  try {
    const decoded = await context.decodeAudioData(await recording.arrayBuffer());
    if (decoded.numberOfChannels === 1) return decoded.getChannelData(0).slice();
    // Mix down to mono.
    const left = decoded.getChannelData(0);
    const right = decoded.getChannelData(1);
    return left.map((v, i) => (v + right[i]) / 2);
  } finally {
    void context.close();
  }
}
