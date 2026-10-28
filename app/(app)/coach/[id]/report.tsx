"use client";

import { BookOpen, Check, ChevronDown, Copy, Eye, Loader2, Quote, RotateCcw, Target, Trash2, TrendingUp, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/fields";
import { deleteInterview, redoQuestion } from "@/lib/client/mutations";
import { wordCount } from "@/lib/letter/types";
import {
  averageScore,
  FLAG_INFO,
  gradeScore,
  MAX_INTERVIEW_ANSWER,
  reportProgress,
  RUBRIC,
  verdictOf,
  type ConsistencyFlag,
  type InterviewView,
  type QuestionResult,
  type RefinedAnswer,
  type RubricKey,
} from "@/lib/interview/types";
import { cn } from "@/lib/utils";
import { Briefing } from "./briefing";
import { Exchange } from "./interview-room";

const RUBRIC_KEYS = Object.keys(RUBRIC) as RubricKey[];

type Graded = Extract<QuestionResult, { status: "graded" }>;

/**
 * After the interview: the report (verdict, summary, rubric, each question with its flags and a
 * stronger answer) and a cheat sheet to read before the real interview.
 */
export function InterviewReport({
  view,
  grading,
  briefing,
  aiEnabled,
  error,
  needsSetup,
  onRetry,
  onBrief,
  onUpdate,
}: {
  view: InterviewView;
  grading: boolean;
  briefing: boolean;
  aiEnabled: boolean;
  error: string | null;
  needsSetup: boolean;
  onRetry: () => void;
  onBrief: () => void;
  /** A redo saved: show the session as it now is. */
  onUpdate: (view: InterviewView) => void;
}) {
  const [tab, setTab] = useState<"report" | "cheat">("report");
  const { results, summary } = view.report;
  const score = averageScore(results);
  const practiseAgain = view.applicationId ? `/coach/new?application=${view.applicationId}` : "/coach/new";

  return (
    <div className="flex flex-col gap-3">
      {view.status === "ended" && (
        <Progress view={view} grading={grading} aiEnabled={aiEnabled} error={error} needsSetup={needsSetup} onRetry={onRetry} />
      )}

      {view.status === "done" && (
        <div role="tablist" className="flex gap-1 rounded-lg border border-border bg-surface p-1 shadow-[var(--shadow-soft)] sm:w-fit">
          {(
            [
              ["report", "Report"],
              ["cheat", "Cheat sheet"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors sm:flex-none",
                tab === key ? "bg-surface-2 text-fg shadow-[inset_0_0_0_1px_var(--border)]" : "text-muted hover:text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "cheat" && view.status === "done" ? (
        <CheatSheet view={view} briefing={briefing} aiEnabled={aiEnabled} onBrief={onBrief} error={error} />
      ) : (
        <>
          {summary && (
            <Card>
              <CardContent className="flex flex-col gap-5">
                <div className="flex flex-wrap items-start gap-4">
                  {score != null && <ScoreDial score={score} />}
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] leading-relaxed font-medium text-pretty">{summary.headline}</p>
                    {score != null && (
                      <p className="mt-1.5 text-xs text-subtle">
                        A practice verdict{view.report.model ? ` from ${view.report.model}` : ""}, not a prediction. Real interviewers weigh things a transcript
                        can&apos;t show.
                      </p>
                    )}
                  </div>
                </div>
                {(summary.strengths.length > 0 || summary.focusAreas.length > 0) && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Points icon={TrendingUp} title="What worked" items={summary.strengths} tone="text-success" />
                    <Points icon={Target} title="Practise next" items={summary.focusAreas} tone="text-brand-ink" />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {score != null && <RubricOverview results={results} />}

          {view.plan.map((_, i) => (
            <QuestionCard key={i} index={i} view={view} result={results[i]} onUpdate={onUpdate} />
          ))}

          {summary?.questionsFeedback && (
            <Card>
              <CardHeader>
                <CardTitle>Your questions for them</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Exchange turns={view.turns.filter((t) => t.q === view.plan.length && t.kind !== "wrap")} compact />
                <p className="text-[13px] text-muted">{summary.questionsFeedback}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <Link href={practiseAgain} className={buttonVariants({ variant: "secondary" })}>
          <RotateCcw /> Practise again
        </Link>
        <DeleteButton id={view.id} />
      </div>
    </div>
  );
}

/** While the report is being written: which step it's on, and a way to retry if a step failed. */
function Progress({
  view,
  grading,
  aiEnabled,
  error,
  needsSetup,
  onRetry,
}: {
  view: InterviewView;
  grading: boolean;
  aiEnabled: boolean;
  error: string | null;
  needsSetup: boolean;
  onRetry: () => void;
}) {
  const { done, total } = reportProgress(view);
  const results = view.report.results;
  const step = view.plan.some((_, i) => !results[i] && view.turns.some((t) => t.q === i && t.kind === "answer"))
    ? "Grading your answers…"
    : results.some((r) => r?.status === "graded" && !r.coached)
      ? "Checking your answers against what you sent, and writing stronger versions…"
      : "Writing your summary…";
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <p className="flex items-center gap-2 text-[13px] font-medium">
          {grading && <Loader2 className="size-4 animate-spin text-muted" />}
          {grading ? step : "Your report isn't finished yet."}
          <span className="ml-auto text-xs font-normal text-subtle tabular-nums">
            {done} of {total}
          </span>
        </p>
        <div className="h-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
          <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        {grading && <p className="text-xs text-muted">Each answer is reviewed on its own. Local models can take a minute per step; you can leave and come back.</p>}
        {!aiEnabled && (
          <p className="text-xs text-muted">
            <Link href="/settings" className="font-medium text-brand-ink hover:underline">
              Choose an AI provider
            </Link>{" "}
            to grade this interview.
          </p>
        )}
        {error && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-xs text-danger">
            <span>{error}</span>
            {needsSetup ? (
              <Link href="/settings" className="font-medium underline">
                Open Settings
              </Link>
            ) : (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                <RotateCcw /> Try again
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** What to read before the real interview: flags to resolve, the briefing, and stronger answers to rehearse. */
function CheatSheet({
  view,
  briefing,
  aiEnabled,
  onBrief,
  error,
}: {
  view: InterviewView;
  briefing: boolean;
  aiEnabled: boolean;
  onBrief: () => void;
  error: string | null;
}) {
  const graded = view.plan.flatMap((q, i) => {
    const r = view.report.results[i];
    return r?.status === "graded" ? [{ question: q, index: i, result: r }] : [];
  });
  const flags = graded.flatMap((g) => (g.result.flags ?? []).map((flag) => ({ flag, index: g.index })));
  const refined = graded.filter((g) => g.result.refined);

  return (
    <>
      {flags.length > 0 && (
        <Card className="border-warning/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <TriangleAlert className="size-4 text-warning" /> Sort these out before the real interview
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {flags.map(({ flag, index }, n) => (
              <FlagItem key={n} flag={flag} label={`Q${index + 1}`} />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <BookOpen className="size-4 text-muted" /> Briefing
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {view.briefing ? (
            <Briefing briefing={view.briefing} />
          ) : (
            <>
              <p className="text-[13px] text-muted">What the role needs, which of your stories proves what, where you might be pressed and what to ask them.</p>
              {aiEnabled && (
                <Button className="w-fit" onClick={onBrief} disabled={briefing}>
                  {briefing ? <Loader2 className="animate-spin" /> : <BookOpen />} {briefing ? "Writing your briefing…" : "Write my briefing"}
                </Button>
              )}
              {error && <p className="text-xs text-danger">{error}</p>}
            </>
          )}
        </CardContent>
      </Card>

      {refined.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Answers to rehearse</CardTitle>
            <p className="text-[13px] text-muted">Try each one out loud first, then reveal the stronger version and compare.</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {refined.map(({ question, index, result }) => (
              <RehearseCard key={index} label={`Q${index + 1}`} question={question.question} refined={result.refined!} />
            ))}
          </CardContent>
        </Card>
      )}

      {graded.length === 0 && <p className="px-1 text-[13px] text-muted">Answer some questions in an interview to get stronger answers to rehearse here.</p>}
    </>
  );
}

/** A question with its stronger answer hidden until asked for, so the user practises before reading. */
function RehearseCard({ label, question, refined }: { label: string; question: string; refined: RefinedAnswer }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border p-3">
      <p className="text-[13px] font-medium text-pretty">
        <span className="mr-1.5 text-xs text-subtle">{label}</span>
        {question}
      </p>
      {shown ? (
        <RefinedBlock refined={refined} />
      ) : (
        <Button variant="secondary" size="sm" className="w-fit" onClick={() => setShown(true)}>
          <Eye /> Show the stronger answer
        </Button>
      )}
    </div>
  );
}

function RefinedBlock({ refined }: { refined: RefinedAnswer }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] leading-relaxed whitespace-pre-line">{highlightPlaceholders(refined.answer)}</p>
      {refined.notes && <p className="text-xs text-muted">{refined.notes}</p>}
      {refined.warnings.map((w) => (
        <p key={w} className="flex gap-1.5 text-xs text-warning">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" /> {w}
        </p>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => {
          void navigator.clipboard.writeText(refined.answer).then(() => setCopied(true), () => {});
        }}
      >
        {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

/** [placeholders] stand out so they're filled in before the answer is used. */
function highlightPlaceholders(text: string): ReactNode[] {
  return text.split(/(\[[^\]]{1,60}\])/g).map((part, i) =>
    /^\[.*\]$/.test(part) ? (
      <mark key={i} className="rounded bg-warning-soft px-0.5 text-warning">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function FlagItem({ flag, label }: { flag: ConsistencyFlag; label?: string }) {
  const info = FLAG_INFO[flag.kind];
  return (
    <div className="flex flex-col gap-1.5 text-[13px]">
      <div className="flex flex-wrap items-center gap-1.5">
        {label && <span className="text-xs text-subtle">{label}</span>}
        <Badge tone={info.tone}>{info.label}</Badge>
      </div>
      <p>
        You said: <span className="italic">“{flag.said}”</span>
      </p>
      {flag.source && flag.sourceQuote && (
        <p className="flex gap-1.5 text-muted">
          <Quote className="mt-1 size-3 shrink-0" />
          <span>
            Your {flag.source.toLowerCase()} says: <span className="italic">“{flag.sourceQuote}”</span>
          </span>
        </p>
      )}
      <p className="text-xs text-muted">{flag.note}</p>
    </div>
  );
}

function ScoreDial({ score }: { score: number }) {
  const verdict = verdictOf(score);
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-4 py-3">
      <span className="text-2xl font-semibold tracking-tight tabular-nums">
        {score.toFixed(1)}
        <span className="text-sm font-normal text-subtle">/4</span>
      </span>
      <Badge tone={verdict.tone}>{verdict.label}</Badge>
    </div>
  );
}

function Points({ icon: Icon, title, items, tone }: { icon: typeof Check; title: string; items: string[]; tone: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={cn("mb-2 flex items-center gap-1.5 text-xs font-medium", tone)}>
        <Icon className="size-3.5" /> {title}
      </p>
      <ul className="flex flex-col gap-1.5 text-[13px]">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-border-strong" /> {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Each rubric dimension averaged over the graded answers, weakest easy to spot. */
function RubricOverview({ results }: { results: (QuestionResult | null)[] }) {
  const graded = results.filter((r): r is Graded => r?.status === "graded");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Across your answers</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {RUBRIC_KEYS.map((key) => {
          const avg = graded.reduce((n, r) => n + r.scores[key], 0) / graded.length;
          return (
            <div key={key} className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-3 text-[13px]" title={RUBRIC[key].hint}>
              <span className="text-muted">{RUBRIC[key].label}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                <span className={cn("block h-full rounded-full", avg < 2 ? "bg-danger" : avg < 2.75 ? "bg-warning" : "bg-brand")} style={{ width: `${(avg / 4) * 100}%` }} />
              </span>
              <span className="text-right text-xs text-muted tabular-nums">{avg.toFixed(1)}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function QuestionCard({
  index,
  view,
  result,
  onUpdate,
}: {
  index: number;
  view: InterviewView;
  result: QuestionResult | null;
  onUpdate: (view: InterviewView) => void;
}) {
  const question = view.plan[index];
  const turns = view.turns.filter((t) => t.q === index);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-subtle">Q{index + 1}</span>
          <Badge>{question.competency}</Badge>
          {result?.status === "graded" && result.followUps > 0 && <Badge tone="warning">{result.followUps} follow-up{result.followUps > 1 ? "s" : ""}</Badge>}
          {result?.status === "graded" && (result.flags?.length ?? 0) > 0 && (
            <Badge tone="danger">
              {result.flags!.length} flag{result.flags!.length > 1 ? "s" : ""}
            </Badge>
          )}
          {result?.status === "skipped" && <Badge>Skipped</Badge>}
          {result?.status === "not_reached" && <Badge>Not answered</Badge>}
        </div>
        <CardTitle className="mt-1 text-pretty">{question.question}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {result?.status === "graded" && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {RUBRIC_KEYS.map((key) => (
                <span
                  key={key}
                  title={RUBRIC[key].hint}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-xs tabular-nums",
                    result.scores[key] <= 1 ? "border-danger/25 text-danger" : result.scores[key] === 2 ? "border-warning/25 text-warning" : "border-border text-muted",
                  )}
                >
                  {RUBRIC[key].label} {result.scores[key]}/4
                </span>
              ))}
              <span className="px-1 py-0.5 text-xs text-subtle tabular-nums">{result.words} words</span>
            </div>
            <p className="text-[13px]">{result.summary}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Points icon={Check} title="Good" items={result.strengths} tone="text-success" />
              <Points icon={Target} title="Next time" items={result.improvements} tone="text-brand-ink" />
            </div>
            {(result.flags?.length ?? 0) > 0 && (
              <div className="flex flex-col gap-3 rounded-lg border border-danger/20 bg-danger-soft/40 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-danger">
                  <TriangleAlert className="size-3.5" /> Doesn&apos;t match what you sent
                </p>
                {result.flags!.map((flag, n) => (
                  <FlagItem key={n} flag={flag} />
                ))}
              </div>
            )}
          </>
        )}
        {result?.status === "graded" && result.refined && (
          <Fold title="A stronger answer" open>
            <RefinedBlock refined={result.refined} />
          </Fold>
        )}
        {turns.length > 0 && (
          <Fold title="Your answers">
            <Exchange turns={turns.filter((t) => t.kind !== "question")} compact />
          </Fold>
        )}
        <Fold title="What the interviewer listened for">
          <div className="flex flex-col gap-2 text-xs text-muted">
            <p>{question.intent}</p>
            {question.strongSignals.length > 0 && <p>Strong answers: {question.strongSignals.join(" · ")}</p>}
            {question.redFlags.length > 0 && <p>Red flags: {question.redFlags.join(" · ")}</p>}
          </div>
        </Fold>
        <RedoQuestion view={view} index={index} onUpdate={onUpdate} />
      </CardContent>
    </Card>
  );
}

/** Another go at a question after the interview, graded on the same rubric and compared with the first answer. */
function RedoQuestion({ view, index, onUpdate }: { view: InterviewView; index: number; onUpdate: (view: InterviewView) => void }) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempts = view.report.redos?.[index] ?? [];
  const first = view.report.results[index];
  const firstScore = first?.status === "graded" ? gradeScore(first) : null;

  async function submit() {
    if (!answer.trim()) return;
    setWorking(true);
    setError(null);
    const result = await redoQuestion(view.id, index, answer);
    setWorking(false);
    if (!result.ok) return setError(result.error);
    onUpdate(result.data);
    setAnswer("");
    setOpen(false);
  }

  return (
    <>
      {attempts.length > 0 && (
        <div className="flex flex-col gap-2">
          {attempts.map((a, n) => {
            const score = gradeScore(a);
            const delta = firstScore === null ? null : score - firstScore;
            return (
              <Fold
                key={a.at}
                title={
                  <span className="flex flex-wrap items-center gap-1.5">
                    Redo {n + 1} · {score.toFixed(1)}/4
                    {delta !== null && Math.abs(delta) >= 0.05 && (
                      <Badge tone={delta > 0 ? "success" : "danger"}>
                        {delta > 0 ? "+" : ""}
                        {delta.toFixed(1)} vs first answer
                      </Badge>
                    )}
                  </span>
                }
              >
                <div className="flex flex-col gap-3">
                  <p className="text-[13px]">{a.summary}</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Points icon={Check} title="Good" items={a.strengths} tone="text-success" />
                    <Points icon={Target} title="Next time" items={a.improvements} tone="text-brand-ink" />
                  </div>
                  <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs whitespace-pre-line text-muted">{a.answer}</p>
                </div>
              </Fold>
            );
          })}
        </div>
      )}
      {view.status === "done" && (
        <Button variant="secondary" size="sm" className="w-fit" onClick={() => setOpen(true)}>
          <RotateCcw /> {attempts.length ? "Try it again" : "Redo this question"}
        </Button>
      )}
      <Dialog open={open} onClose={() => !working && setOpen(false)} labelledBy={`redo-${index}`} className="w-[min(36rem,calc(100vw-2rem))]">
        <div className="flex flex-col gap-3 p-5">
          <p className="text-xs font-medium tracking-wide text-subtle uppercase">Redo Q{index + 1}</p>
          <h2 id={`redo-${index}`} className="text-[15px] leading-relaxed font-semibold tracking-tight text-pretty">
            {view.plan[index].question}
          </h2>
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
            }}
            maxLength={MAX_INTERVIEW_ANSWER}
            placeholder="Answer it again as you would out loud. No follow-ups this time; it's graded on its own."
            className="min-h-40 text-[13px] leading-relaxed"
            disabled={working}
            autoFocus
            aria-label="Your new answer"
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <span className="text-xs text-subtle tabular-nums sm:mr-auto">{wordCount(answer)} words</span>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={working}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={working || !answer.trim()}>
              {working && <Loader2 className="animate-spin" />}
              {working ? "Grading…" : "Grade my answer"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

function Fold({ title, open, children }: { title: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details className="group rounded-lg border border-border" open={open}>
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-medium text-muted hover:text-fg">
        {title}
        <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border p-3">{children}</div>
    </details>
  );
}

function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setWorking(true);
    setError(null);
    const result = await deleteInterview(id);
    if (!result.ok) {
      setWorking(false);
      setError(result.error);
      return;
    }
    router.push("/coach");
    router.refresh();
  }

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)} className="hover:text-danger">
        <Trash2 /> Delete
      </Button>
      <ConfirmDialog
        open={open}
        title="Delete this interview?"
        body={
          <>
            The transcript, report and briefing are deleted for good.
            {error && <span className="mt-2 block text-danger">{error}</span>}
          </>
        }
        confirmLabel={working ? "Deleting…" : "Delete interview"}
        tone="danger"
        busy={working}
        onConfirm={() => void remove()}
        onCancel={() => {
          setOpen(false);
          setError(null);
        }}
      />
    </>
  );
}
