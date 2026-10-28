"use client";

import { CircleCheck, CircleX, Loader2, Mic, MicOff, Play, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
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

      <div className="flex justify-end border-t border-border pt-4">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

/** Speak a sentence and see it written out: proves the browser's speech-to-text works here. */
function SpeechTest({ mic, disabled }: { mic: string; disabled: boolean }) {
  const supported = useDictationSupported();
  const [text, setText] = useState("");
  const dictation = useDictation((t) => t && setText((s) => (s ? `${s} ${t}` : t)), mic);
  const words = `${text} ${dictation.interim}`.trim();

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-wide text-subtle uppercase">2 · Speech to text</h3>
      {!supported ? (
        <p className="flex gap-1.5 text-xs text-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> This browser can&apos;t turn speech into text. Use Chrome or Edge to answer out loud, or type your answers.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted">
            Press Test and say a sentence. RolePort never receives the audio, but Chrome and Edge may send it to Google or Microsoft to transcribe. Some newer
            browsers can transcribe on this device.
          </p>
          <div className="min-h-16 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px]" aria-live="polite">
            {words ? (
              <>
                {text} <span className="text-muted italic">{dictation.interim}</span>
              </>
            ) : (
              <span className="text-subtle">{dictation.listening ? "Listening…" : "Your words appear here."}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={dictation.listening ? "danger" : "secondary"}
              size="sm"
              disabled={disabled || dictation.starting}
              onClick={() => {
                if (dictation.listening) return dictation.stop();
                agreeToVoice();
                setText("");
                void dictation.start();
              }}
            >
              {dictation.starting ? <Loader2 className="animate-spin" /> : dictation.listening ? <MicOff /> : <Mic />}
              {dictation.listening ? "Stop" : "Test"}
            </Button>
            {text && !dictation.listening && (
              <span className="flex items-center gap-1.5 text-xs text-success">
                <CircleCheck className="size-3.5" /> Speech-to-text works in this browser.
              </span>
            )}
          </div>
          {dictation.stalled && (
            <p className="flex gap-1.5 text-xs text-warning">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> Nothing has been transcribed yet. If the microphone bar moves but no words appear, this
              browser&apos;s speech service isn&apos;t working: try Chrome or Edge, or set this microphone as your system default.
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
