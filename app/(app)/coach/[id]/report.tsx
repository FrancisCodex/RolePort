"use client";

import { Check, ChevronDown, Loader2, RotateCcw, Target, Trash2, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteInterview } from "@/lib/client/mutations";
import { averageScore, RUBRIC, verdictOf, type InterviewView, type QuestionResult, type RubricKey } from "@/lib/interview/types";
import { cn } from "@/lib/utils";
import { Exchange } from "./interview-room";

const RUBRIC_KEYS = Object.keys(RUBRIC) as RubricKey[];

/** The post-round report: the verdict and summary, the rubric across answers, then each question in turn. */
export function InterviewReport({
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
  const { results, summary } = view.report;
  const done = results.filter(Boolean).length;
  const score = averageScore(results);
  const practiseAgain = view.applicationId ? `/coach/new?application=${view.applicationId}` : "/coach/new";

  return (
    <div className="flex flex-col gap-3">
      {view.status === "ended" && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-[13px] font-medium">
              {grading && <Loader2 className="size-4 animate-spin text-muted" />}
              {grading
                ? done < view.plan.length
                  ? `Grading question ${done + 1} of ${view.plan.length}…`
                  : "Writing your summary…"
                : "Your report isn't finished yet."}
            </p>
            <div className="flex gap-1" aria-hidden>
              {view.plan.map((_, i) => (
                <span key={i} className={cn("h-1 flex-1 rounded-full", results[i] ? "bg-brand" : "bg-surface-3")} />
              ))}
            </div>
            {grading && <p className="text-xs text-muted">Each answer is reviewed on its own. Local models can take a minute per question; you can leave and come back.</p>}
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
      )}

      {summary && (
        <Card>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-wrap items-start gap-4">
              {score != null && <ScoreDial score={score} />}
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-relaxed font-medium text-pretty">{summary.headline}</p>
                <p className="mt-1.5 text-xs text-subtle">
                  A practice verdict{view.report.model ? ` from ${view.report.model}` : ""}, not a prediction. Real interviewers weigh things a transcript can&apos;t show.
                </p>
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
        <QuestionCard key={i} index={i} view={view} result={results[i]} />
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

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <Link href={practiseAgain} className={buttonVariants({ variant: "secondary" })}>
          <RotateCcw /> Practise again
        </Link>
        <DeleteButton id={view.id} />
      </div>
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
  const graded = results.filter((r): r is Extract<QuestionResult, { status: "graded" }> => r?.status === "graded");
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

function QuestionCard({ index, view, result }: { index: number; view: InterviewView; result: QuestionResult | null }) {
  const question = view.plan[index];
  const turns = view.turns.filter((t) => t.q === index);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-subtle">Q{index + 1}</span>
          <Badge>{question.competency}</Badge>
          {result?.status === "graded" && result.followUps > 0 && <Badge tone="warning">{result.followUps} follow-up{result.followUps > 1 ? "s" : ""}</Badge>}
          {result?.status === "skipped" && <Badge>Skipped</Badge>}
          {result?.status === "not_reached" && <Badge>Not reached</Badge>}
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
          </>
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
      </CardContent>
    </Card>
  );
}

function Fold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group rounded-lg border border-border">
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
  const [working, setWorking] = useState(false);
  async function remove() {
    if (!window.confirm("Delete this interview and its report?")) return;
    setWorking(true);
    const result = await deleteInterview(id);
    if (!result.ok) {
      setWorking(false);
      window.alert(result.error);
      return;
    }
    router.push("/coach");
    router.refresh();
  }
  return (
    <Button variant="ghost" onClick={() => void remove()} disabled={working} className="hover:text-danger">
      <Trash2 /> Delete
    </Button>
  );
}
