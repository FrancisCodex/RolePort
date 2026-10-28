"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/*
 * Voice for mock interviews, with nothing but the browser: speech-to-text for answering out
 * loud (Web Speech API) and text-to-speech for hearing the questions. Neither sends anything to
 * RolePort; Chrome and Edge do send the audio to their makers to transcribe it, which the page
 * says before the microphone is first used.
 */

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  /** Chrome's on-device recognition, where the browser supports it. */
  processLocally?: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noSubscribe = () => () => {};

/** Whether this browser can turn speech into text (false during server rendering). */
export function useDictationSupported(): boolean {
  return useSyncExternalStore(noSubscribe, () => recognitionCtor() !== null, () => false);
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it for this site in your browser, then try again.",
  "service-not-allowed": "This browser won't run speech recognition here. Try Chrome or Edge.",
  "audio-capture": "No microphone was found.",
  network: "Speech recognition needs an internet connection in this browser.",
};

/**
 * Dictation into the answer box. Final phrases go to `onText`; `interim` is what's being heard
 * right now. Chrome ends recognition after a pause, so it restarts until `stop()`.
 * `takeSeconds()` returns how long the microphone was on since it was last taken, for pace.
 */
export function useDictation(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const wanted = useRef(false);
  const startedAt = useRef<number | null>(null);
  const seconds = useRef(0);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  const clock = () => {
    if (startedAt.current !== null) seconds.current += (Date.now() - startedAt.current) / 1000;
    startedAt.current = null;
  };

  const stop = useCallback(() => {
    wanted.current = false;
    clock();
    recognition.current?.stop();
    setListening(false);
    setInterim("");
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    setError(null);
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.continuous = true;
    r.interimResults = true;
    if ("processLocally" in r) r.processLocally = true;
    r.onresult = (e) => {
      let heard = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) onTextRef.current(text.trim());
        else heard += text;
      }
      setInterim(heard.trim());
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(ERRORS[e.error] ?? "Speech recognition stopped. Try again, or type your answer.");
      wanted.current = false;
    };
    r.onend = () => {
      if (wanted.current) {
        try {
          r.start();
          return;
        } catch {
          // Fall through: treat it as stopped.
        }
      }
      clock();
      setListening(false);
      setInterim("");
    };
    recognition.current = r;
    wanted.current = true;
    startedAt.current = Date.now();
    try {
      r.start();
      setListening(true);
    } catch {
      setError("Couldn't start the microphone. Try again.");
      wanted.current = false;
      startedAt.current = null;
    }
  }, []);

  const takeSeconds = useCallback(() => {
    clock();
    if (wanted.current) startedAt.current = Date.now();
    const s = seconds.current;
    seconds.current = 0;
    return s;
  }, []);

  // Never leave the microphone on after leaving the page.
  useEffect(
    () => () => {
      wanted.current = false;
      recognition.current?.abort();
    },
    [],
  );

  return { listening, interim, error, start, stop, takeSeconds };
}

/* Read-aloud ----------------------------------------------------------------- */

const READ_ALOUD_KEY = "roleport:interview-read-aloud";
const listeners = new Set<() => void>();

function readSetting(): boolean {
  try {
    return localStorage.getItem(READ_ALOUD_KEY) === "1";
  } catch {
    return false;
  }
}

/** The "read questions aloud" switch, remembered in this browser. */
export function useReadAloudSetting(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readSetting,
    () => false,
  );
  const set = useCallback((next: boolean) => {
    try {
      localStorage.setItem(READ_ALOUD_KEY, next ? "1" : "0");
    } catch {
      // Storage blocked: the switch just won't be remembered.
    }
    if (!next && typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    listeners.forEach((l) => l());
  }, []);
  return [on, set];
}

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Say `text` with the browser's own voices; each panelist gets a different voice when there's a choice. */
export function speak(text: string, speaker = 0) {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  const lang = (navigator.language || "en").slice(0, 2);
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
  const utterance = new SpeechSynthesisUtterance(text);
  if (voices.length) utterance.voice = voices[speaker % voices.length];
  else utterance.pitch = speaker ? 0.85 : 1;
  utterance.rate = 1;
  speechSynthesis.speak(utterance);
}

const VOICE_OK_KEY = "roleport:interview-voice-ok";

/** Whether the user already agreed to the speech recognition note in this browser. */
export function voiceAgreed(): boolean {
  try {
    return localStorage.getItem(VOICE_OK_KEY) === "1";
  } catch {
    return false;
  }
}

export function agreeToVoice() {
  try {
    localStorage.setItem(VOICE_OK_KEY, "1");
  } catch {
    // Not remembered; the note shows again next time.
  }
}
