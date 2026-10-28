"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_WHISPER_MODEL, WHISPER_MODELS, type WhisperModelId } from "./whisper-models";

/*
 * Speech settings remembered in this browser (localStorage), shared by every component that
 * reads them, so a choice made in Settings or onboarding shows up in the interview at once.
 * They're per browser, like the voices and models they point to, so they aren't in backups.
 */

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function readSetting(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function writeSetting(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the choice just won't be remembered.
  }
  notify();
}

/** A string setting kept in localStorage ("" until set, and during server rendering). */
export function useStoredSetting(key: string): [string, (value: string) => void] {
  const value = useSyncExternalStore(subscribe, () => readSetting(key), () => "");
  const set = useCallback((next: string) => writeSetting(key, next), [key]);
  return [value, set];
}

export type SpeechEngine = "browser" | "whisper";

const ENGINE_KEY = "roleport:speech-engine";
const MODEL_KEY = "roleport:whisper-model";

/** Which speech-to-text answers out loud use. Built-in browser speech unless the user chose Whisper. */
export function useSpeechEngine(): [SpeechEngine, (engine: SpeechEngine) => void] {
  const [value, set] = useStoredSetting(ENGINE_KEY);
  return [value === "whisper" ? "whisper" : "browser", set];
}

/** The Whisper model to download and use. */
export function useWhisperModel(): [WhisperModelId, (id: WhisperModelId) => void] {
  const [value, set] = useStoredSetting(MODEL_KEY);
  const id = WHISPER_MODELS.some((m) => m.id === value) ? (value as WhisperModelId) : DEFAULT_WHISPER_MODEL;
  return [id, set];
}
