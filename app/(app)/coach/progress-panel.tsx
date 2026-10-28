"use client";

import { CalendarClock, Crosshair, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { startInterview } from "@/lib/client/mutations";
import { daysUntil, RUBRIC, verdictOf, type InterviewProgress } from "@/lib/interview/types";
import { cn } from "@/lib/utils";

const formatDate = (d: Date) => new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" });
const formatWhen = (d: Date) => new Date(d).toLocaleString("en", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Above the interview list: upcoming interviews, scores over time, rubric trends and a weak-spot drill. */
export function ProgressPanel({ progress }: { progress: InterviewProgress }) {
  const { sessions, upcoming } = progress;
  if (sessions.length === 0 && upcoming.length === 0) return null;
  return (
    <div className="mb-4 flex flex-col gap-3">
      {upcoming.length > 0 && <Upcoming items={upcoming} />}
      {sessions.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card>
            <CardHeader>
              <CardTitle>Your progress</CardTitle>
              <CardDescription>Average rubric score per interview, out of 4.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <ScoreHistory sessions={sessions} />
              <Dimensions dimensions={progress.dimensions} />
            </CardContent>
          </Card>
          <WeakSpots progress={progress} />
        </div>
      )}
    </div>
  );
}

function Upcoming({ items }: { items: InterviewProgress["upcoming"] }) {
  return (
    <Card>
      <CardContent className="flex flex-col divide-y divide-border">
        {items.map((u) => (
          <div key={u.applicationId} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <CalendarClock className="size-4 shrink-0 text-brand-ink" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">
                {u.role} · {u.company}
              </p>
              <p className="text-xs text-muted">
                Interview {daysUntil(u.interviewAt)} · {formatWhen(u.interviewAt)}
              </p>
            </div>
            <Link href={`/coach/new?application=${u.applicationId}`} className={buttonVariants({ size: "sm" })}>
              Prepare
            </Link>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * One bar per finished interview, oldest on the left. Hovering (or focusing) a bar shows that
 * interview in the readout above; otherwise it shows the latest. The latest bar is labelled.
 */
function ScoreHistory({ sessions }: { sessions: InterviewProgress["sessions"] }) {
  const [active, setActive] = useState<number | null>(null);
  const shown = sessions[active ?? sessions.length - 1];
  const first = sessions[0].score;
  const latest = sessions.at(-1)!.score;
  const change = latest - first;
  const verdict = verdictOf(shown.score);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1" aria-live="polite">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">
          {shown.score.toFixed(1)}
          <span className="text-sm font-normal text-subtle">/4</span>
        </span>
        <Badge tone={verdict.tone}>{verdict.label}</Badge>
        <span className="min-w-0 truncate text-xs text-muted">
          {active === null ? "Latest" : formatDate(shown.date)} · {shown.title}
        </span>
        {active === null && sessions.length > 1 && Math.abs(change) >= 0.05 && (
          <span className={cn("flex items-center gap-1 text-xs tabular-nums", change > 0 ? "text-success" : "text-danger")}>
            {change > 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {change > 0 ? "+" : ""}
            {change.toFixed(1)} since your first
          </span>
        )}
      </div>

      <div className="relative h-28" onMouseLeave={() => setActive(null)}>
        {/* Recessive guides at 2 and 3: the verdict bands. */}
        {[2, 3].map((v) => (
          <div key={v} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border" style={{ bottom: `${(v / 4) * 100}%` }}>
            <span className="absolute -top-2 right-0 bg-surface pl-1 text-[10px] text-subtle tabular-nums">{v}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-0.5 pr-5">
          {sessions.map((s, i) => {
            const isLatest = i === sessions.length - 1;
            return (
              <button
                key={s.id}
                type="button"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(i)}
                aria-label={`${s.title}, ${formatDate(s.date)}: ${s.score.toFixed(1)} out of 4`}
                // The hit target is the full column, wider and taller than the bar.
                className="group relative flex h-full max-w-10 flex-1 items-end justify-center outline-none"
              >
                <span
                  className={cn(
                    "w-full max-w-6 rounded-t-[4px] transition-colors",
                    active === i || (active === null && isLatest) ? "bg-brand" : "bg-brand/45 group-hover:bg-brand/70",
                    "group-focus-visible:ring-2 group-focus-visible:ring-brand/40",
                  )}
                  style={{ height: `${Math.max(4, (s.score / 4) * 100)}%` }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex justify-between pr-5 text-[11px] text-subtle tabular-nums">
        <span>{formatDate(sessions[0].date)}</span>
        {sessions.length > 1 && <span>{formatDate(sessions.at(-1)!.date)}</span>}
      </div>
    </div>
  );
}

/** Each rubric dimension over the last three interviews, with the change from the ones before. */
function Dimensions({ dimensions }: { dimensions: InterviewProgress["dimensions"] }) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs font-medium text-muted">Last 3 interviews</p>
      {dimensions.map((d) => {
        const change = d.earlier === null ? null : d.recent - d.earlier;
        return (
          <div key={d.key} className="grid grid-cols-[10rem_1fr_2rem_2.5rem] items-center gap-3 text-[13px]" title={RUBRIC[d.key].hint}>
            <span className="truncate text-muted">{RUBRIC[d.key].label}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-surface-3">
              <span
                className={cn("block h-full rounded-full", d.recent < 2 ? "bg-danger" : d.recent < 2.75 ? "bg-warning" : "bg-brand")}
                style={{ width: `${(d.recent / 4) * 100}%` }}
              />
            </span>
            <span className="text-right text-xs text-muted tabular-nums">{d.recent.toFixed(1)}</span>
            <span
              className={cn(
                "text-right text-xs tabular-nums",
                change === null || Math.abs(change) < 0.05 ? "text-subtle" : change > 0 ? "text-success" : "text-danger",
              )}
            >
              {change === null ? "" : Math.abs(change) < 0.05 ? "±0" : `${change > 0 ? "+" : ""}${change.toFixed(1)}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** The lowest-scoring competencies lately, and a quick drill built around them. */
function WeakSpots({ progress }: { progress: InterviewProgress }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { drill, weakest } = progress;

  async function startDrill() {
    if (!drill) return;
    setWorking(true);
    setError(null);
    const result = await startInterview({
      applicationId: drill.applicationId,
      targetRole: drill.role,
      company: drill.company ?? "",
      jobDescription: "",
      focus: drill.focus,
      length: "quick",
      style: "standard",
      panel: false,
      drill: { competencies: drill.competencies, dimensions: drill.dimensions },
    });
    if (!result.ok) {
      setWorking(false);
      setError(result.error);
      return;
    }
    router.push(`/coach/${result.data}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Crosshair className="size-4 text-muted" /> Weak spots
        </CardTitle>
        <CardDescription>Your lowest-scoring topics in recent interviews.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {weakest.length === 0 ? (
          <p className="text-[13px] text-muted">Nothing below 3 out of 4 lately. Try a tougher interviewer to find the next thing to work on.</p>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {weakest.map((w) => (
                <li key={w.competency} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate">{w.competency}</span>
                  <span className={cn("shrink-0 text-xs tabular-nums", w.score < 2 ? "text-danger" : "text-warning")}>{w.score.toFixed(1)}/4</span>
                </li>
              ))}
            </ul>
            {drill && (
              <>
                <Button onClick={() => void startDrill()} disabled={working}>
                  {working ? <Loader2 className="animate-spin" /> : <Crosshair />}
                  {working ? "Preparing your drill…" : "Drill these"}
                </Button>
                <p className="text-xs text-muted">
                  3 questions on these topics for {drill.role}
                  {drill.company ? ` at ${drill.company}` : ""}, with the same interviewer and rubric.
                </p>
              </>
            )}
          </>
        )}
        {working && <p className="text-xs text-muted">Local models can take a minute or two. Keep this page open.</p>}
        {error && <p className="text-xs text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}
