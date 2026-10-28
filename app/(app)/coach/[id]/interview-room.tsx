"use client";

import { ArrowLeft, ChevronDown, CornerDownLeft, Loader2, SkipForward, Square } from "lucide-react";
import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";
import type { InterviewResult } from "@/app/(app)/coach/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/fields";
import { answerInterviewQuestion, endInterview, gradeInterview, skipInterviewTurn } from "@/lib/client/mutations";
import { FOCUS_INFO, INTERVIEW_LENGTHS, interviewState, MAX_INTERVIEW_ANSWER, type InterviewPageData, type InterviewTurn, type InterviewView } from "@/lib/interview/types";
import { wordCount } from "@/lib/letter/types";
import { cn } from "@/lib/utils";
import { InterviewReport } from "./report";

type Busy = "answer" | "skip" | "end" | "grade" | null;

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

  const state = interviewState(view);
  const total = view.plan.length;

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
    const text = draft.trim();
    if (!text || busy) return;
    if (await act("answer", () => answerInterviewQuestion(view.id, text))) setDraft("");
  }

  async function skip() {
    if (busy) return;
    if (draft.trim() && !window.confirm("Skip this question? What you wrote isn't sent.")) return;
    if (await act("skip", () => skipInterviewTurn(view.id))) setDraft("");
  }

  async function end() {
    if (!window.confirm("End the interview now? The questions you answered still get graded.")) return;
    await act("end", () => endInterview(view.id));
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
      <Link href="/coach" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Back to Coach
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-balance">{view.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge>{FOCUS_INFO[view.focus].label}</Badge>
            <Badge>{INTERVIEW_LENGTHS[view.length].label}</Badge>
            {view.applicationId && (
              <Link href={`/applied/${view.applicationId}`} className="text-xs font-medium text-muted hover:text-fg">
                Open the application
              </Link>
            )}
          </div>
        </div>
        {view.status === "active" && (
          <Button variant="ghost" onClick={() => void end()} disabled={busy !== null}>
            <Square /> End interview
          </Button>
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
          aiEnabled={data.aiEnabled}
          error={error}
          needsSetup={needsSetup}
          onRetry={() => void grade()}
        />
      </div>
    );
  }

  const current = view.turns.filter((t) => t.q === state.q);
  const earlier = view.plan.map((_, q) => view.turns.filter((t) => t.q === q)).slice(0, Math.min(state.q, total));
  const last = view.turns.at(-1);

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
              <Exchange key={q} turns={turns} compact />
            ))}
          </div>
        </details>
      )}

      <section aria-live="polite" className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <p className="text-xs font-medium tracking-wide text-subtle uppercase">
          {state.inClosing ? "Your questions" : `Question ${state.q + 1} of ${total}`}
          {state.followUps > 0 && ` · follow-up ${state.followUps}`}
        </p>
        <Exchange turns={current} />
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
          <AnswerTimer key={last?.id} />
          <span className="text-xs text-subtle tabular-nums">{wordCount(draft)} words</span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" onClick={() => void skip()} disabled={busy !== null}>
              {busy === "skip" ? <Loader2 className="animate-spin" /> : <SkipForward />}
              {state.inClosing ? "No questions" : "Skip"}
            </Button>
            <Button onClick={() => void send()} disabled={busy !== null || !draft.trim()}>
              {busy === "answer" ? <Loader2 className="animate-spin" /> : <CornerDownLeft />}
              {state.inClosing ? "Ask" : "Send answer"}
            </Button>
          </div>
        </div>
      </div>
      <p className="mt-2 px-1 text-xs text-subtle">Ctrl+Enter sends. No scores until the end, as in a real interview.</p>

      {error && (
        <p className="mt-3 rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-xs text-danger">
          {error}{" "}
          {needsSetup && (
            <Link href="/settings" className="font-medium underline">
              Open Settings
            </Link>
          )}
        </p>
      )}
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
export function Exchange({ turns, compact }: { turns: InterviewTurn[]; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-4")}>
      {turns.map((t) =>
        t.from === "interviewer" ? (
          <div key={t.id} className="flex flex-col gap-1">
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
