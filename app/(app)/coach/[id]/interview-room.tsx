"use client";

import { ArrowLeft, BookOpen, ChevronDown, CornerDownLeft, Loader2, Mic, MicOff, Play, RotateCcw, Settings2, SkipForward, Square, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, type MouseEvent } from "react";
import type { InterviewResult } from "@/app/(app)/coach/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/fields";
import { answerInterviewQuestion, endInterview, gradeInterview, prepareBriefing, skipInterviewTurn } from "@/lib/client/mutations";
import { FOCUS_INFO, INTERVIEW_LENGTHS, interviewState, MAX_INTERVIEW_ANSWER, STYLE_INFO, type InterviewPageData, type InterviewTurn, type InterviewView, type Panelist } from "@/lib/interview/types";
import { wordCount } from "@/lib/letter/types";
import { cn } from "@/lib/utils";
import { Briefing } from "./briefing";
import { InterviewReport } from "./report";
import { useSpeechEngine, useWhisperModel } from "@/lib/speech/settings";
import { agreeToVoice, canSpeak, speak, useDictation, useDictationSupported, useMicLevel, useMicSetting, useReadAloudSetting, voiceAgreed } from "./voice";
import { VoiceSettings } from "./voice-settings";

type Busy = "answer" | "skip" | "end" | "grade" | "brief" | null;

/**
 * A mock interview: one question at a time, the current question's follow-ups in view and the
 * earlier ones folded away. Once it ends, the report is graded question by question and shown.
 */
export function InterviewRoom({ data }: { data: InterviewPageData }) {
  const [view, setView] = useState<InterviewView>(data.interview);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const router = useRouter();
  // Before the first answer the page offers a briefing; once anything is answered it goes straight to the interview.
  const [started, setStarted] = useState(() => data.interview.turns.some((t) => t.from === "candidate"));

  const state = interviewState(view);
  const total = view.plan.length;

  // Voice: dictated phrases are added to the answer; seconds spoken go with it for pace feedback.
  const [mic] = useMicSetting();
  const [engine] = useSpeechEngine();
  const [model] = useWhisperModel();
  const addText = (text: string) => text && setDraft((d) => (d.trim() ? `${d.trimEnd()} ${text}` : text));
  const dictation = useDictation(addText, { deviceId: mic, engine, model });
  // Whisper only needs a way to record; built-in recognition needs the browser to have it.
  const canDictate = useDictationSupported() || engine === "whisper";
  const [voiceSettings, setVoiceSettings] = useState(false);
  const [readAloud, setReadAloud] = useReadAloudSetting();
  const spokenSeconds = useRef(0);
  const last = view.turns.at(-1);

  // A new interviewer turn is read out when that's switched on.
  const sayLatest = useEffectEvent(() => {
    if (!last || last.from !== "interviewer") return;
    speak([last.lead, last.text].filter(Boolean).join(" "), last.speaker ?? 0);
  });
  useEffect(() => {
    if (readAloud && started && view.status === "active") sayLatest();
  }, [last?.id, readAloud, started, view.status]);

  async function toggleMic() {
    if (dictation.listening) return addText(await dictation.stop());
    if (
      !voiceAgreed() &&
      !(await confirm({
        title: "Answer out loud?",
        body:
          engine === "whisper"
            ? "Your answer is recorded and turned into text on this device with Whisper, in the answer box where you can fix it before sending. The audio never leaves this computer."
            : "Your browser turns your speech into text in the answer box, where you can fix it before sending. RolePort never receives the audio, but Chrome and Edge send it to Google or Microsoft to transcribe unless your browser can do it on this device. You can switch to on-device Whisper in Voice settings.",
        confirmLabel: "Use the microphone",
      }))
    ) {
      return;
    }
    agreeToVoice();
    void dictation.start();
  }

  async function act(kind: Exclude<Busy, null>, run: () => Promise<InterviewResult>): Promise<boolean> {
    setBusy(kind);
    setError(null);
    setNeedsSetup(false);
    const result = await run();
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      setNeedsSetup(Boolean(result.needsSetup));
      return false;
    }
    setView(result.data);
    return true;
  }

  async function send() {
    if (busy || dictation.transcribing) return;
    // With Whisper, stopping transcribes what was just said, and that goes with the answer.
    const heard = dictation.listening ? await dictation.stop() : "";
    const text = [draft.trim(), heard].filter(Boolean).join(" ");
    if (heard) setDraft(text);
    if (!text) return;
    const seconds = spokenSeconds.current + dictation.takeSeconds();
    // Count it as spoken only if the microphone was on for a real part of it.
    const spoken = seconds >= 3 ? { seconds } : null;
    if (await act("answer", () => answerInterviewQuestion(view.id, text, spoken))) {
      setDraft("");
      spokenSeconds.current = 0;
    } else {
      spokenSeconds.current = seconds;
    }
  }

  async function skip() {
    if (busy) return;
    if (
      draft.trim() &&
      !(await confirm({
        title: state.inClosing ? "Finish without asking?" : "Skip this question?",
        body: "What you've written isn't sent, and the interviewer moves on.",
        confirmLabel: state.inClosing ? "Finish" : "Skip question",
      }))
    ) {
      return;
    }
    dictation.cancel();
    dictation.takeSeconds();
    spokenSeconds.current = 0;
    if (await act("skip", () => skipInterviewTurn(view.id))) setDraft("");
  }

  async function end() {
    const ok = await confirm({
      title: "End the interview now?",
      body: "The questions you've answered still get graded. The rest are marked as not reached, and you can't continue this interview afterwards.",
      confirmLabel: "End interview",
      cancelLabel: "Keep going",
      tone: "danger",
    });
    if (ok) await act("end", () => endInterview(view.id));
  }

  /** Leaving mid-interview is safe (every turn is saved), but say so, and warn about an unsent answer. */
  async function leave(e: MouseEvent<HTMLAnchorElement>) {
    if (view.status !== "active") return;
    e.preventDefault();
    const ok = await confirm({
      title: "Leave the interview?",
      body: draft.trim()
        ? "Your progress is saved and you can pick up where you left off, but the answer you're writing now isn't sent."
        : "Your progress is saved. Open it from Coach to pick up where you left off.",
      confirmLabel: "Leave",
      cancelLabel: "Keep going",
    });
    if (ok) router.push("/coach");
  }

  async function brief() {
    if (view.briefing && !(await confirm({ title: "Write the briefing again?", body: "The new one replaces this briefing.", confirmLabel: "Write again" }))) return;
    await act("brief", () => prepareBriefing(view.id));
  }

  /** Grade question by question until the report is done; each step is one model call. */
  async function grade() {
    setBusy("grade");
    setError(null);
    setNeedsSetup(false);
    let current = view;
    while (current.status === "ended") {
      const result = await gradeInterview(current.id);
      if (!result.ok) {
        setError(result.error);
        setNeedsSetup(Boolean(result.needsSetup));
        break;
      }
      current = result.data;
      setView(current);
    }
    setBusy(null);
  }

  // The report starts on its own once the interview is over (and resumes after a reload).
  const startGrading = useEffectEvent(() => void grade());
  useEffect(() => {
    if (view.status !== "ended" || !data.aiEnabled) return;
    const timer = setTimeout(startGrading, 0);
    return () => clearTimeout(timer);
  }, [view.status, data.aiEnabled]);

  const header = (
    <div className="mb-6 flex flex-col gap-4">
      {confirmDialog}
      <Link href="/coach" onClick={(e) => void leave(e)} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Back to Coach
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-balance">{view.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge>{FOCUS_INFO[view.focus].label}</Badge>
            <Badge>{INTERVIEW_LENGTHS[view.length].label}</Badge>
            {view.style !== "standard" && <Badge tone={view.style === "hell" ? "danger" : "neutral"}>{STYLE_INFO[view.style].label}</Badge>}
            {view.drill && <Badge tone="brand">Weak-spot drill</Badge>}
            {view.panel && <Badge>Panel: {view.panel.map((p) => p.role).join(" & ")}</Badge>}
            {view.applicationId && (
              <Link href={`/applied/${view.applicationId}`} className="text-xs font-medium text-muted hover:text-fg">
                Open the application
              </Link>
            )}
          </div>
        </div>
        {view.status === "active" && (
          <div className="flex items-center gap-1">
            {canSpeak() && (
              <Button
                variant="ghost"
                onClick={() => setReadAloud(!readAloud)}
                aria-pressed={readAloud}
                title={readAloud ? "Stop reading questions aloud" : "Read questions aloud"}
                suppressHydrationWarning
              >
                {readAloud ? <Volume2 /> : <VolumeX />} <span className="max-sm:hidden">{readAloud ? "Reading aloud" : "Read aloud"}</span>
              </Button>
            )}
            <Button variant="ghost" onClick={() => void end()} disabled={busy !== null}>
              <Square /> End interview
            </Button>
          </div>
        )}
      </div>
      <Progress view={view} />
    </div>
  );

  if (view.status !== "active") {
    return (
      <div className="mx-auto max-w-4xl">
        {header}
        <InterviewReport
          view={view}
          grading={busy === "grade"}
          briefing={busy === "brief"}
          aiEnabled={data.aiEnabled}
          error={error}
          needsSetup={needsSetup}
          onRetry={() => void grade()}
          onBrief={() => void brief()}
          onUpdate={setView}
        />
      </div>
    );
  }

  const errorNote = error && (
    <p className="mt-3 rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-xs text-danger">
      {error}{" "}
      {needsSetup && (
        <Link href="/settings" className="font-medium underline">
          Open Settings
        </Link>
      )}
    </p>
  );

  if (!started) {
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        <section className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">{view.briefing ? "Your briefing" : "Before you start"}</h2>
              <p className="mt-1 text-[13px] text-muted">
                {view.briefing
                  ? "Read it through, then start when you're ready. It stays in your report's cheat sheet."
                  : `A short briefing on what this ${view.hasJob ? "posting" : "role"} needs, which of your stories proves what, where you might be pressed and what to ask them. It doesn't give away the questions.`}
              </p>
            </div>
            {view.briefing && (
              <Button variant="ghost" size="sm" onClick={() => void brief()} disabled={busy !== null}>
                {busy === "brief" ? <Loader2 className="animate-spin" /> : <RotateCcw />} Write again
              </Button>
            )}
          </div>
          {view.briefing && <Briefing briefing={view.briefing} />}
          {busy === "brief" && <p className="text-xs text-muted">Local models can take a minute or two. Keep this page open.</p>}
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {!view.briefing && data.aiEnabled && (
              <Button onClick={() => void brief()} disabled={busy !== null}>
                {busy === "brief" ? <Loader2 className="animate-spin" /> : <BookOpen />}
                {busy === "brief" ? "Writing your briefing…" : "Brief me first"}
              </Button>
            )}
            <Button variant={view.briefing ? "primary" : "secondary"} onClick={() => setStarted(true)} disabled={busy !== null}>
              <Play /> {view.briefing ? "Start the interview" : "Skip, start the interview"}
            </Button>
          </div>
        </section>
        {errorNote}
      </div>
    );
  }

  const current = view.turns.filter((t) => t.q === state.q);
  const earlier = view.plan.map((_, q) => view.turns.filter((t) => t.q === q)).slice(0, Math.min(state.q, total));
  return (
    <div className="mx-auto max-w-3xl">
      {header}

      {earlier.length > 0 && (
        <details className="group mb-4 rounded-lg border border-border bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-[13px] font-medium text-muted hover:text-fg">
            Earlier in this interview ({earlier.length} {earlier.length === 1 ? "question" : "questions"})
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-col gap-5 border-t border-border px-4 py-4">
            {earlier.map((turns, q) => (
              <Exchange key={q} turns={turns} panel={view.panel} compact />
            ))}
          </div>
        </details>
      )}

      <section aria-live="polite" className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <p className="text-xs font-medium tracking-wide text-subtle uppercase">
          {state.inClosing ? "Your questions" : `Question ${state.q + 1} of ${total}`}
          {state.followUps > 0 && ` · follow-up ${state.followUps}`}
        </p>
        <Exchange turns={current} panel={view.panel} />
        {busy === "answer" && (
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <Loader2 className="size-3.5 animate-spin" /> The interviewer is thinking…
          </p>
        )}
      </section>

      <div className="mt-3 flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-soft)]">
        <Textarea
          key={last?.id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
          }}
          maxLength={MAX_INTERVIEW_ANSWER}
          placeholder={state.inClosing ? "Ask the interviewer something, or skip if you have no questions." : "Answer as you would out loud: what happened, what you did, how it turned out."}
          className="min-h-36 border-0 text-[14px] leading-relaxed shadow-none focus-visible:ring-0"
          disabled={busy !== null}
          autoFocus
          aria-label="Your answer"
        />
        <div className="flex flex-wrap items-center gap-2 px-1">
          {canDictate && (
            <Button
              variant={dictation.listening ? "danger" : "secondary"}
              size="sm"
              onClick={() => void toggleMic()}
              disabled={busy !== null || dictation.starting || dictation.transcribing}
              aria-pressed={dictation.listening}
              title={dictation.listening ? "Stop the microphone" : "Answer out loud"}
            >
              {dictation.starting ? <Loader2 className="animate-spin" /> : dictation.listening ? <MicOff /> : <Mic />}{" "}
              {dictation.listening ? "Stop" : "Speak"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              dictation.cancel();
              setVoiceSettings(true);
            }}
            disabled={busy !== null}
            aria-label="Voice settings"
            title="Voice settings: microphone, speech-to-text test, interviewer voice"
          >
            <Settings2 />
          </Button>
          <AnswerTimer key={last?.id} />
          <span className="text-xs text-subtle tabular-nums">{wordCount(draft)} words</span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" onClick={() => void skip()} disabled={busy !== null}>
              {busy === "skip" ? <Loader2 className="animate-spin" /> : <SkipForward />}
              {state.inClosing ? "No questions" : "Skip"}
            </Button>
            <Button
              onClick={() => void send()}
              disabled={busy !== null || dictation.transcribing || (!draft.trim() && !(dictation.listening && dictation.engine === "whisper"))}
            >
              {busy === "answer" || dictation.transcribing ? <Loader2 className="animate-spin" /> : <CornerDownLeft />}
              {state.inClosing ? "Ask" : "Send answer"}
            </Button>
          </div>
        </div>
      </div>
      {dictation.transcribing && (
        <p className="mt-2 flex items-center gap-1.5 px-1 text-xs text-muted" aria-live="polite">
          <Loader2 className="size-3.5 animate-spin" /> Turning your answer into text on this device…
        </p>
      )}
      {dictation.listening && <ListeningStatus dictation={dictation} onSettings={() => (dictation.cancel(), setVoiceSettings(true))} />}
      {dictation.error && (
        <p className="mt-2 px-1 text-xs text-danger">
          {dictation.error}{" "}
          <button type="button" className="font-medium underline" onClick={() => setVoiceSettings(true)}>
            Open voice settings
          </button>
        </p>
      )}
      <VoiceSettings open={voiceSettings} onClose={() => setVoiceSettings(false)} />
      <p className="mt-2 px-1 text-xs text-subtle">Ctrl+Enter sends. No scores until the end, as in a real interview.</p>

      {errorNote}
    </div>
  );
}

/** One segment per main question: done, in progress, or still to come. */
function Progress({ view }: { view: InterviewView }) {
  const { q } = interviewState(view);
  const over = view.status !== "active";
  return (
    <div className="flex gap-1" aria-hidden>
      {view.plan.map((_, i) => (
        <span
          key={i}
          className={cn("h-1 flex-1 rounded-full", over || i < q ? "bg-brand" : i === q ? "bg-brand/40" : "bg-surface-3")}
        />
      ))}
    </div>
  );
}

/** A question's turns: the interviewer's question and follow-ups, the candidate's answers. */
export function Exchange({ turns, compact, panel = null }: { turns: InterviewTurn[]; compact?: boolean; panel?: Panelist[] | null }) {
  return (
    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-4")}>
      {turns.map((t) =>
        t.from === "interviewer" ? (
          <div key={t.id} className="flex flex-col gap-1">
            {panel && t.speaker !== undefined && panel[t.speaker] && (
              <p className="text-[11px] font-medium tracking-wide text-subtle uppercase">{panel[t.speaker].role}</p>
            )}
            {t.lead && !compact && <p className="text-[13px] text-muted">{t.lead}</p>}
            <p className={cn("text-pretty", compact ? "text-[13px] font-medium" : "text-[17px] leading-relaxed font-medium tracking-tight")}>
              {t.kind === "follow_up" && <span className="mr-1.5 text-xs font-medium text-brand-ink">Follow-up</span>}
              {t.text}
            </p>
          </div>
        ) : (
          <div
            key={t.id}
            className={cn(
              "rounded-lg bg-surface-2 whitespace-pre-line text-muted",
              compact ? "px-3 py-2 text-xs" : "ml-auto max-w-[90%] px-3.5 py-2.5 text-[13px] leading-relaxed",
            )}
          >
            {t.kind === "skip" ? <span className="italic">Skipped</span> : t.text}
          </div>
        ),
      )}
    </div>
  );
}

/**
 * While dictating: a live microphone level, what's being heard, and a nudge to voice settings
 * when sound comes in but no words do, so a silent failure can't pass for "listening".
 */
function ListeningStatus({ dictation, onSettings }: { dictation: ReturnType<typeof useDictation>; onSettings: () => void }) {
  const { level, peak } = useMicLevel(dictation.stream);
  return (
    <div className="mt-2 flex flex-col gap-1.5 px-1" aria-live="polite">
      <p className="flex items-center gap-2 text-xs text-muted">
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-danger" />
        <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-surface-3" aria-hidden>
          <span className={cn("block h-full rounded-full", level > 0.08 ? "bg-success" : "bg-brand/50")} style={{ width: `${level * 100}%` }} />
        </span>
        {dictation.interim ? (
          <span className="truncate italic">{dictation.interim}</span>
        ) : (
          <span>
            {dictation.engine === "whisper"
              ? peak > 0.08
                ? "Recording… press Stop to turn it into text, or Send to send it as it is."
                : "Recording… start talking."
              : peak > 0.08
                ? "Listening… keep talking, then press Stop or Send."
                : "Listening… start talking."}
          </span>
        )}
      </p>
      {dictation.stalled && (
        <p className="text-xs text-warning">
          {peak > 0.08
            ? "Your microphone hears you, but no words are coming through: this browser's speech-to-text may not work."
            : "No sound is reaching the microphone."}{" "}
          <button type="button" className="font-medium underline" onClick={onSettings}>
            Check voice settings
          </button>
        </p>
      )}
    </div>
  );
}

/** Time on the current answer. Real answers usually land in one to two minutes. */
function AnswerTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const long = seconds >= 180;
  return (
    <span className={cn("text-xs tabular-nums", long ? "text-warning" : "text-subtle")} title="Most spoken answers take one to two minutes.">
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
      {long && " · keep it moving"}
    </span>
  );
}
