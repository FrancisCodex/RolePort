"use client";

import { CircleCheck, CircleX, Loader2, Mic, MicOff, Play, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SpeechSettings } from "@/components/speech/speech-settings";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { useSpeechEngine, useWhisperModel } from "@/lib/speech/settings";
import { cn } from "@/lib/utils";
import {
  agreeToVoice,
  availableVoices,
  canSpeak,
  listMics,
  openMic,
  speak,
  stopStream,
  useDictation,
  useDictationSupported,
  useMicLevel,
  useMicSetting,
  useVoiceSetting,
} from "./voice";

/**
 * Voice settings for mock interviews: pick the microphone and watch it pick up sound, check that
 * this browser can turn speech into text, and choose the interviewer's voice. Opening it asks
 * for microphone permission, so it doubles as the fix when no prompt ever appeared.
 */
export function VoiceSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="voice-settings-title" className="w-[min(34rem,calc(100vw-2rem))]">
      {/* Mounted only while open, so the microphone is released the moment it closes. */}
      {open && <VoiceSettingsBody onClose={onClose} />}
    </Dialog>
  );
}

function VoiceSettingsBody({ onClose }: { onClose: () => void }) {
  const [mic, setMic] = useMicSetting();
  const [mics, setMics] = useState<{ id: string; label: string }[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const { level, peak } = useMicLevel(stream);

  // Open the chosen microphone for the meter (this is where the browser asks for permission).
  useEffect(() => {
    let live = true;
    let opened: MediaStream | null = null;
    openMic(mic)
      .then(async (s) => {
        opened = s;
        if (!live) return stopStream(s);
        setStream(s);
        setMicError(null);
        setMics(await listMics());
      })
      .catch((e: unknown) => live && setMicError(e instanceof Error ? e.message : "Couldn't open the microphone."));
    return () => {
      live = false;
      stopStream(opened);
      setStream(null);
    };
  }, [mic]);

  return (
    <div className="flex flex-col gap-5 p-5">
      <div>
        <h2 id="voice-settings-title" className="text-[15px] font-semibold tracking-tight">
          Voice settings
        </h2>
        <p className="mt-1 text-[13px] text-muted">Check your microphone and speech-to-text before you answer out loud.</p>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium tracking-wide text-subtle uppercase">1 · Microphone</h3>
        {mics.length > 0 && (
          <Select
            aria-label="Microphone"
            value={mic || ""}
            onValueChange={setMic}
            options={[{ value: "", label: "System default" }, ...mics.map((m) => ({ value: m.id, label: m.label }))]}
          />
        )}
        {micError ? (
          <p className="flex gap-1.5 rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-xs text-danger">
            <CircleX className="mt-0.5 size-3.5 shrink-0" /> {micError}
          </p>
        ) : (
          <>
            <div className="h-2 overflow-hidden rounded-full bg-surface-3" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
              <div className={cn("h-full rounded-full transition-[width] duration-75", level > 0.08 ? "bg-success" : "bg-brand/50")} style={{ width: `${level * 100}%` }} />
            </div>
            <p className={cn("flex items-center gap-1.5 text-xs", peak > 0.08 ? "text-success" : "text-muted")}>
              {peak > 0.08 ? <CircleCheck className="size-3.5" /> : <Mic className="size-3.5" />}
              {!stream ? "Opening the microphone…" : peak > 0.08 ? "Your microphone is picking up sound." : "Say something: the bar should move. If it doesn't, pick another microphone."}
            </p>
          </>
        )}
      </section>

      <SpeechTest mic={mic} disabled={Boolean(micError)} />

      <VoicePicker />

      <SwitchBrowserNote />

      <div className="flex justify-end border-t border-border pt-4">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

/**
 * Pick how speech becomes text, then speak a sentence and see it written out: proves the chosen
 * engine works in this browser before an interview depends on it.
 */
function SpeechTest({ mic, disabled }: { mic: string; disabled: boolean }) {
  const [engine] = useSpeechEngine();
  const [model] = useWhisperModel();
  const builtInSupported = useDictationSupported();
  const [text, setText] = useState("");
  const add = (t: string) => t && setText((s) => (s ? `${s} ${t}` : t));
  const dictation = useDictation(add, { deviceId: mic, engine, model });
  const words = `${text} ${dictation.interim}`.trim();
  const canTest = engine === "whisper" || builtInSupported;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-wide text-subtle uppercase">2 · Speech to text</h3>
      <SpeechSettings intro={false} />
      {!canTest ? (
        <p className="flex gap-1.5 text-xs text-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> This browser has no built-in speech-to-text. Download Whisper above, use Chrome or Edge,
          or type your answers.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted">
            {engine === "whisper"
              ? "Press Test, say a sentence, then press Stop: it's turned into text on this device."
              : "Press Test and say a sentence. Chrome and Edge may send the audio to Google or Microsoft to transcribe."}
          </p>
          <div className="min-h-16 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px]" aria-live="polite">
            {words ? (
              <>
                {text} <span className="text-muted italic">{dictation.interim}</span>
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-subtle">
                {dictation.transcribing && <Loader2 className="size-3.5 animate-spin" />}
                {dictation.transcribing
                  ? "Turning it into text on this device…"
                  : dictation.listening
                    ? engine === "whisper"
                      ? "Recording… press Stop when you're done."
                      : "Listening…"
                    : "Your words appear here."}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={dictation.listening ? "danger" : "secondary"}
              size="sm"
              disabled={disabled || dictation.starting || dictation.transcribing}
              onClick={async () => {
                if (dictation.listening) return add(await dictation.stop());
                agreeToVoice();
                setText("");
                void dictation.start();
              }}
            >
              {dictation.starting || dictation.transcribing ? <Loader2 className="animate-spin" /> : dictation.listening ? <MicOff /> : <Mic />}
              {dictation.listening ? "Stop" : "Test"}
            </Button>
            {text && !dictation.listening && !dictation.transcribing && (
              <span className="flex items-center gap-1.5 text-xs text-success">
                <CircleCheck className="size-3.5" /> {engine === "whisper" ? "Whisper works on this device." : "Speech-to-text works in this browser."}
              </span>
            )}
          </div>
          {dictation.stalled && (
            <p className="flex gap-1.5 text-xs text-warning">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> Nothing has been transcribed yet. If the microphone bar moves but no words appear, this
              browser&apos;s speech service isn&apos;t working: switch to Whisper above, try Chrome or Edge, or set this microphone as your system default.
            </p>
          )}
          {dictation.error && (
            <p className="flex gap-1.5 text-xs text-danger">
              <CircleX className="mt-0.5 size-3.5 shrink-0" /> {dictation.error}
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** Moving to a browser where speech works: the data goes along in a backup file. */
function SwitchBrowserNote() {
  return (
    <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
      Prefer another browser? In{" "}
      <Link href="/settings#data" className="font-medium text-brand-ink hover:underline">
        Settings → Your data
      </Link>
      , download a backup, then import it in the other browser. Everything comes along except API keys, which you enter again, and Whisper, which you
      download again there if you want it.
    </p>
  );
}

/** The interviewer's voice for reading questions aloud, with a sample. */
function VoicePicker() {
  const [voice, setVoice] = useVoiceSetting();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Chrome loads its voices after the page, and says so with voiceschanged.
  useEffect(() => {
    if (!canSpeak()) return;
    const load = () => setVoices(availableVoices());
    load();
    speechSynthesis.addEventListener("voiceschanged", load);
    return () => speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  if (!canSpeak()) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-wide text-subtle uppercase">3 · Interviewer voice</h3>
      <p className="text-xs text-muted">Used when &ldquo;Read aloud&rdquo; is on. Voices come from your device, so nothing is sent anywhere.</p>
      <div className="flex gap-2">
        <Select
          aria-label="Interviewer voice"
          className="min-w-0 flex-1"
          value={voice}
          onValueChange={setVoice}
          searchable
          options={[{ value: "", label: "Automatic" }, ...voices.map((v) => ({ value: v.name, label: `${v.name} (${v.lang})` }))]}
        />
        <Button variant="secondary" onClick={() => speak("Thanks for joining. Tell me about a project you're proud of.")}>
          <Play /> Play sample
        </Button>
      </div>
    </section>
  );
}
