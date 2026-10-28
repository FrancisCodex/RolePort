"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { readSetting as read, useStoredSetting as useStored, writeSetting as write, type SpeechEngine } from "@/lib/speech/settings";
import { transcribeWithWhisper, toWhisperAudio } from "@/lib/speech/whisper";
import { downloadedModels, type WhisperModelId } from "@/lib/speech/whisper-models";

/*
 * Voice for mock interviews, with nothing but the browser: the microphone (getUserMedia),
 * speech-to-text for answering out loud, and text-to-speech for hearing the questions. Speech-to-
 * text is the browser's built-in recognition by default (Web Speech API: Chrome and Edge send the
 * audio to their makers), or on-device Whisper if the user chose to download it (nothing leaves
 * the device). Nothing ever goes to RolePort.
 *
 * The microphone is always opened with getUserMedia first: it makes the browser ask for
 * permission even where speech recognition alone wouldn't, it lets the user pick a device, and
 * it drives the level meter, so "the mic hears nothing" and "the browser can't transcribe" can be
 * told apart.
 */

const READ_ALOUD_KEY = "roleport:interview-read-aloud";
const MIC_KEY = "roleport:interview-mic";
const VOICE_KEY = "roleport:interview-voice";
const VOICE_OK_KEY = "roleport:interview-voice-ok";

/** The "read questions aloud" switch. */
export function useReadAloudSetting(): [boolean, (on: boolean) => void] {
  const [value, set] = useStored(READ_ALOUD_KEY);
  const setOn = useCallback(
    (on: boolean) => {
      if (!on && canSpeak()) speechSynthesis.cancel();
      set(on ? "1" : "0");
    },
    [set],
  );
  return [value === "1", setOn];
}

/** The chosen microphone's deviceId, or "" for the system default. */
export const useMicSetting = () => useStored(MIC_KEY);

/** The chosen interviewer voice's name, or "" for automatic. */
export const useVoiceSetting = () => useStored(VOICE_KEY);

/** Whether the user already agreed to the speech recognition note in this browser. */
export const voiceAgreed = () => read(VOICE_OK_KEY) === "1";
export const agreeToVoice = () => write(VOICE_OK_KEY, "1");

/* The microphone ------------------------------------------------------------- */

/** Open the microphone (asking for permission if needed). Throws an Error with a message for the user. */
export async function openMic(deviceId: string): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser can't use a microphone here. Open RolePort on http://localhost or https in Chrome or Edge.");
  }
  const constraints = (id: string): MediaStreamConstraints => ({
    audio: { ...(id ? { deviceId: { exact: id } } : {}), echoCancellation: true, noiseSuppression: true },
  });
  try {
    return await navigator.mediaDevices.getUserMedia(constraints(deviceId));
  } catch (error) {
    const name = (error as { name?: string }).name;
    // The chosen microphone was unplugged: fall back to the default one.
    if (deviceId && (name === "OverconstrainedError" || name === "NotFoundError")) return openMic("");
    if (name === "NotAllowedError" || name === "SecurityError") {
      throw new Error("Microphone access is blocked. Click the icon at the left of the address bar, allow the microphone for this site, then try again.");
    }
    if (name === "NotFoundError") throw new Error("No microphone was found. Plug one in or check your system sound settings.");
    if (name === "NotReadableError") throw new Error("The microphone is in use by another app or couldn't be started. Close other apps using it and try again.");
    throw new Error("Couldn't open the microphone. Try again, or pick another one in Voice settings.");
  }
}

export const stopStream = (stream: MediaStream | null) => stream?.getTracks().forEach((t) => t.stop());

/** The audio inputs, labelled. Labels are only available once microphone permission is granted. */
export async function listMics(): Promise<{ id: string; label: string }[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === "audioinput" && d.deviceId !== "default" && d.deviceId !== "communications")
    .map((d, i) => ({ id: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
}

/** How loud the microphone is right now and at its loudest so far, 0 to 1, while `stream` is open. */
export function useMicLevel(stream: MediaStream | null): { level: number; peak: number } {
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  useEffect(() => {
    if (!stream) return;
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const context = new AudioCtx();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    let frame = 0;
    const tick = () => {
      analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((n, s) => n + s * s, 0) / samples.length);
      // Speech sits around 0.02-0.2 RMS; stretch it so talking fills most of the bar.
      const now = Math.min(1, rms * 6);
      setLevel(now);
      setPeak((p) => Math.max(p, now));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      void context.close();
      setLevel(0);
      setPeak(0);
    };
  }, [stream]);
  return { level, peak };
}

/* Speech-to-text ------------------------------------------------------------- */

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  /** Chrome's on-device recognition, where the browser supports it. */
  processLocally?: boolean;
  start(track?: MediaStreamTrack): void;
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

/** Whether this browser has speech-to-text at all (false during server rendering). */
export function useDictationSupported(): boolean {
  return useSyncExternalStore(noSubscribe, () => recognitionCtor() !== null, () => false);
}

const NO_SERVICE =
  "This browser has no working speech-to-text (Brave, Firefox and in-app browsers often don't). Use Chrome or Edge, or type your answer.";

const ERRORS: Record<string, string> = {
  "not-allowed": "Speech recognition was blocked. Allow the microphone for this site in the address bar, then try again.",
  "service-not-allowed": NO_SERVICE,
  "audio-capture": "The browser couldn't capture audio from the microphone. Check it in Voice settings.",
  network: NO_SERVICE,
  "language-not-supported": "Speech recognition doesn't support your browser's language. Try setting the browser language to English.",
};

/** Seconds of listening with sound but no words before the page says transcription seems stuck. */
const STALL_SECONDS = 8;

/** Options for dictation: which microphone, and which speech-to-text engine. */
export type DictationOptions = { deviceId: string; engine: SpeechEngine; model: WhisperModelId };

/**
 * Dictation into an answer box, with either engine:
 * - browser: the built-in recognition. Final phrases go to `onText` as they're recognised and
 *   `interim` is what's being heard. Chrome ends recognition after a pause, so it restarts until
 *   stopped, unless it keeps ending at once, which means the browser's service isn't working.
 * - whisper: records, then transcribes on this device when `stop()` is called; `stop()`
 *   resolves with the text (and `transcribing` is true meanwhile).
 * `stream` is the open microphone, for a level meter; `takeSeconds()` returns how long it was on.
 */
export function useDictation(onText: (text: string) => void, { deviceId, engine, model }: DictationOptions) {
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stalled, setStalled] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const recorder = useRef<{ media: MediaRecorder; chunks: Blob[]; model: WhisperModelId } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wanted = useRef(false);
  const heard = useRef(false);
  const quickEnds = useRef(0);
  const runStartedAt = useRef(0);
  const startedAt = useRef<number | null>(null);
  const seconds = useRef(0);
  const stallTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  const clock = () => {
    if (startedAt.current !== null) seconds.current += (Date.now() - startedAt.current) / 1000;
    startedAt.current = null;
  };

  const release = useCallback(() => {
    if (stallTimer.current) clearTimeout(stallTimer.current);
    stopStream(streamRef.current);
    streamRef.current = null;
    setStream(null);
  }, []);

  /** Stop listening and close the microphone. A pending recording is thrown away. */
  const finish = useCallback(
    (message: string | null) => {
      wanted.current = false;
      clock();
      recognition.current?.abort();
      recognition.current = null;
      if (recorder.current?.media.state === "recording") recorder.current.media.stop();
      recorder.current = null;
      release();
      setListening(false);
      setStarting(false);
      setInterim("");
      setStalled(false);
      if (message) setError(message);
    },
    [release],
  );

  /** Stop without transcribing what was recorded (skipping a question, opening settings). */
  const cancel = useCallback(() => finish(null), [finish]);

  /**
   * Stop listening. With Whisper, transcribes the recording on this device and resolves with the
   * text; with built-in recognition the words have already gone to `onText`, so it resolves "".
   */
  const stop = useCallback(async (): Promise<string> => {
    const rec = recorder.current;
    if (!rec || rec.media.state !== "recording") {
      finish(null);
      return "";
    }
    const done = new Promise<void>((resolve) => rec.media.addEventListener("stop", () => resolve(), { once: true }));
    rec.media.stop();
    await done;
    recorder.current = null;
    finish(null);
    const recording = new Blob(rec.chunks, { type: rec.media.mimeType });
    if (recording.size === 0) return "";
    setTranscribing(true);
    try {
      return await transcribeWithWhisper(rec.model, await toWhisperAudio(recording));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcribing failed. Try again, or type your answer.");
      return "";
    } finally {
      setTranscribing(false);
    }
  }, [finish]);

  const start = useCallback(async () => {
    const Ctor = recognitionCtor();
    if (engine === "browser" && !Ctor) return setError(NO_SERVICE);
    setError(null);
    setStalled(false);
    setStarting(true);

    if (engine === "whisper" && !(await downloadedModels()).includes(model)) {
      setStarting(false);
      return setError("The Whisper model isn't downloaded in this browser yet. Download it in Voice settings, or switch to built-in speech there.");
    }

    // Open the microphone first: this is what makes the browser ask for permission.
    let mic: MediaStream;
    try {
      mic = await openMic(deviceId);
    } catch (e) {
      setStarting(false);
      return setError(e instanceof Error ? e.message : "Couldn't open the microphone.");
    }
    streamRef.current = mic;
    setStream(mic);

    if (engine === "whisper") {
      if (typeof MediaRecorder === "undefined") return finish("This browser can't record audio. Switch to built-in speech, or type your answer.");
      const media = new MediaRecorder(mic);
      const chunks: Blob[] = [];
      media.addEventListener("dataavailable", (e) => {
        if (e.data.size) chunks.push(e.data);
      });
      recorder.current = { media, chunks, model };
      media.start(1000);
      wanted.current = true;
      startedAt.current = Date.now();
      setListening(true);
      setStarting(false);
      return;
    }

    const r = new Ctor!();
    r.lang = navigator.language || "en-US";
    r.continuous = true;
    r.interimResults = true;
    if ("processLocally" in r) r.processLocally = true;
    heard.current = false;
    quickEnds.current = 0;

    r.onresult = (e) => {
      heard.current = true;
      setStalled(false);
      if (stallTimer.current) clearTimeout(stallTimer.current);
      let now = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) onTextRef.current(text.trim());
        else now += text;
      }
      setInterim(now.trim());
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      finish(ERRORS[e.error] ?? "Speech recognition stopped. Try again, or type your answer.");
    };
    const run = () => {
      runStartedAt.current = Date.now();
      // Newer Chrome can listen to the chosen microphone; older browsers ignore the track and use the default.
      r.start(mic.getAudioTracks()[0]);
    };
    r.onend = () => {
      if (!wanted.current) return;
      // Ending again and again within a second, having heard nothing, means there's no working service.
      quickEnds.current = !heard.current && Date.now() - runStartedAt.current < 1000 ? quickEnds.current + 1 : 0;
      if (quickEnds.current >= 3) return finish(NO_SERVICE);
      try {
        run();
      } catch {
        finish("Speech recognition stopped. Try again, or type your answer.");
      }
    };

    recognition.current = r;
    wanted.current = true;
    try {
      run();
    } catch {
      return finish("Couldn't start speech recognition. Try again, or type your answer.");
    }
    startedAt.current = Date.now();
    setListening(true);
    setStarting(false);
    stallTimer.current = setTimeout(() => {
      if (wanted.current && !heard.current) setStalled(true);
    }, STALL_SECONDS * 1000);
  }, [deviceId, engine, model, finish]);

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
      if (recorder.current?.media.state === "recording") recorder.current.media.stop();
      stopStream(streamRef.current);
      if (stallTimer.current) clearTimeout(stallTimer.current);
    },
    [],
  );

  return { engine, listening, starting, transcribing, interim, error, stalled, stream, start, stop, cancel, takeSeconds };
}

/* Text-to-speech ------------------------------------------------------------- */

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** The browser's voices for the page's language (all of them if none match). */
export function availableVoices(): SpeechSynthesisVoice[] {
  if (!canSpeak()) return [];
  const all = speechSynthesis.getVoices();
  const lang = (navigator.language || "en").slice(0, 2).toLowerCase();
  const matching = all.filter((v) => v.lang.toLowerCase().startsWith(lang));
  return matching.length ? matching : all;
}

/** Say `text`: in the chosen voice for the first speaker, and a different one for a second panelist. */
export function speak(text: string, speaker = 0) {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  const voices = availableVoices();
  const chosen = read(VOICE_KEY);
  const first = Math.max(0, voices.findIndex((v) => v.name === chosen));
  const utterance = new SpeechSynthesisUtterance(text);
  if (voices.length) utterance.voice = voices[(first + speaker) % voices.length];
  else utterance.pitch = speaker ? 0.85 : 1;
  speechSynthesis.speak(utterance);
}
