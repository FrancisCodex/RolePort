"use client";

import { Check, ChevronRight, Clock, ListChecks, Loader2, Sparkles, Square, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, use, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { evaluateJob } from "@/lib/client/mutations";
import { AiScore } from "@/components/jobs/ai-score";
import { useJobBrowser } from "@/components/jobs/job-browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MatchRing } from "@/components/ui/match-ring";
import { FIT_BANDS, fitBand, MAX_PER_RUN } from "@/lib/jobs/fit";
import { cn } from "@/lib/utils";

/**
 * AI analysis on the jobs list (port of ai-job-search's /rank batch idea): analyze the
 * top results or jobs the user picks, one at a time so a local model isn't overwhelmed,
 * with scores filling in on the cards as each job finishes.
 */

type Live =
  | { status: "queued" }
  | { status: "running" }
  | { status: "done"; score: number | null; veto: string | null }
  | { status: "error"; error: string };

type Phase = "idle" | "selecting" | "running" | "finished";

type AnalyzeState = {
  phase: Phase;
  selected: string[];
  live: Record<string, Live>;
  toggle: (id: string) => void;
};

const AnalyzeContext = createContext<AnalyzeState>({ phase: "idle", selected: [], live: {}, toggle: () => {} });

type JobRef = { id: string; title: string };

type Controls = {
  start: (ids: string[]) => void;
  stop: () => void;
  setPhase: (phase: Phase) => void;
  clearSelection: () => void;
};

const ControlsContext = createContext<Controls | null>(null);

export function AnalyzeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [selected, setSelected] = useState<string[]>([]);
  const [live, setLive] = useState<Record<string, Live>>({});
  const stopRef = useRef(false);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_PER_RUN ? s : [...s, id]));
  }

  async function start(ids: string[]) {
    if (ids.length === 0) return;
    stopRef.current = false;
    setPhase("running");
    setLive(Object.fromEntries(ids.map((id) => [id, { status: "queued" } as Live])));
    let done = 0;
    let failedInARow = 0;
    for (const id of ids) {
      if (stopRef.current) break;
      setLive((l) => ({ ...l, [id]: { status: "running" } }));
      const result = await evaluateJob(id, false);
      if (result.ok) {
        done++;
        failedInARow = 0;
        setLive((l) => ({ ...l, [id]: { status: "done", score: result.score, veto: result.veto } }));
        continue;
      }
      setLive((l) => ({ ...l, [id]: { status: "error", error: result.error } }));
      failedInARow++;
      // AI not set up, or the provider looks down: stop instead of burning through the queue.
      if (result.needsSetup || failedInARow >= 2) break;
    }
    // Anything still queued was skipped (stopped or gave up).
    setLive((l) => Object.fromEntries(Object.entries(l).filter(([, v]) => v.status !== "queued")));
    setSelected([]);
    setPhase("finished");
    if (done > 0) router.refresh();
  }

  const controls: Controls = {
    start,
    stop: () => (stopRef.current = true),
    setPhase,
    clearSelection: () => setSelected([]),
  };

  return (
    <ControlsContext value={controls}>
      <AnalyzeContext value={{ phase, selected, live, toggle }}>{children}</AnalyzeContext>
    </ControlsContext>
  );
}

/* -------------------------------------------------------------------------- */
/* The panel above the results                                                */
/* -------------------------------------------------------------------------- */

export function AnalyzePanel({ jobs, topIds, aiEnabled }: { jobs: JobRef[]; topIds: string[]; aiEnabled: boolean }) {
  const { phase, selected, live } = use(AnalyzeContext);
  const controls = use(ControlsContext);
  if (!controls) return null;

  if (!aiEnabled) {
    return (
      <Link
        href="/settings"
        className="flex items-center gap-3 rounded-2xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand-ink hover:opacity-90"
      >
        <Sparkles className="size-4 shrink-0" />
        <span className="flex-1">Choose an AI provider to analyze how well each job fits you.</span>
        <ChevronRight className="size-4" />
      </Link>
    );
  }

  const title = (id: string) => jobs.find((j) => j.id === id)?.title ?? "Job";
  const entries = Object.entries(live);

  if (phase === "selecting") {
    return (
      <div className="sticky top-16 z-20 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-brand bg-surface px-4 py-3 shadow-[var(--shadow-lift)] lg:top-4">
        <ListChecks className="size-5 shrink-0 text-brand" />
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">
            {selected.length} of {MAX_PER_RUN} selected
          </span>
          <span className="text-muted"> · tap jobs to pick them</span>
        </p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              controls.clearSelection();
              controls.setPhase("idle");
            }}
          >
            Cancel
          </Button>
          <Button size="sm" disabled={selected.length === 0} onClick={() => controls.start(selected)}>
            <Sparkles /> Analyze {selected.length || ""}
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "running" || phase === "finished") {
    const finished = entries.filter(([, v]) => v.status === "done" || v.status === "error").length;
    const succeeded = entries.filter(([, v]) => v.status === "done").length;
    const running = entries.find(([, v]) => v.status === "running");
    const pct = entries.length ? Math.round((finished / entries.length) * 100) : 0;
    return (
      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)]" aria-live="polite">
        <div className="flex items-center gap-3">
          {phase === "running" ? (
            <Loader2 className="size-5 shrink-0 animate-spin text-brand" />
          ) : (
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-success-soft text-success">
              <Check className="size-3.5" strokeWidth={3} />
            </span>
          )}
          <p className="min-w-0 flex-1 truncate text-sm">
            <span className="font-semibold">
              {phase === "running" ? `Analyzing ${Math.min(finished + 1, entries.length)} of ${entries.length}` : `Analyzed ${succeeded} job${succeeded === 1 ? "" : "s"}${finished > succeeded ? `, ${finished - succeeded} failed` : ""}`}
            </span>
            {running && <span className="text-muted"> · {title(running[0])}</span>}
          </p>
          {phase === "running" ? (
            <Button variant="ghost" size="sm" onClick={controls.stop}>
              <Square className="fill-current" /> Stop
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => controls.setPhase("idle")}>
              Done
            </Button>
          )}
        </div>
        {phase === "running" && (
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
        )}
        <ul className="flex flex-col divide-y divide-border">
          {entries.map(([id, state]) => (
            <li key={id}>
              <ResultRow id={id} title={title(id)} state={state} />
            </li>
          ))}
        </ul>
        {phase === "finished" && (
          <p className="text-xs text-subtle">Triage from the posting text and your profile. Open a job to see the gates, scores and gaps.</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-brand-soft px-4 py-3 text-brand-ink sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Sparkles className="size-4 shrink-0" />
        <p className="text-sm font-medium">Analyze how well jobs fit you. They run one at a time, up to {MAX_PER_RUN} per run.</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="secondary" size="sm" onClick={() => controls.setPhase("selecting")}>
          <ListChecks /> Choose jobs
        </Button>
        {topIds.length > 0 && (
          <Button size="sm" onClick={() => controls.start(topIds)}>
            Top {topIds.length}
          </Button>
        )}
      </div>
    </div>
  );
}

function ResultRow({ id, title, state }: { id: string; title: string; state: Live }) {
  const right = (() => {
    switch (state.status) {
      case "queued":
        return (
          <span className="flex items-center gap-1 text-xs text-subtle">
            <Clock className="size-3.5" /> Queued
          </span>
        );
      case "running":
        return <Loader2 className="size-4 animate-spin text-brand" />;
      case "error":
        return (
          <Badge tone="danger" title={state.error}>
            <X /> Failed
          </Badge>
        );
      case "done": {
        const score = state.score ?? 0;
        return (
          <span className="flex items-center gap-2">
            {state.veto ? <Badge tone="danger">Excluded</Badge> : <Badge tone={FIT_BANDS[fitBand(score)].tone}>{FIT_BANDS[fitBand(score)].label}</Badge>}
            <MatchRing score={score} size={32} muted={Boolean(state.veto)} />
          </span>
        );
      }
    }
  })();

  const body = (
    <>
      <span className={cn("min-w-0 flex-1 truncate text-sm", state.status === "queued" ? "text-muted" : "font-medium")}>{title}</span>
      {right}
    </>
  );

  return state.status === "done" ? (
    <Link href={`/jobs/${id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2">
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-3 py-2">
      {body}
      {state.status === "error" && <span className="sr-only">{state.error}</span>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Per-card pieces                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Wraps a job card: a click shows the job in the details panel beside the list (Ctrl/Cmd or
 * middle click still opens the full page in a new tab), and in "choose jobs" mode a click
 * selects the job for analysis instead.
 */
export function SelectableJob({ id, children }: { id: string; children: ReactNode }) {
  const { phase, selected, toggle } = use(AnalyzeContext);
  const browser = useJobBrowser();
  const active = browser?.selectedId === id;
  const selecting = phase === "selecting";
  const isSelected = selected.includes(id);
  const full = !isSelected && selected.length >= MAX_PER_RUN;

  function onClickCapture(e: MouseEvent) {
    if (selecting) {
      e.preventDefault();
      e.stopPropagation();
      if (!full) toggle(id);
      return;
    }
    // Leave the card's own buttons (save) and new-tab clicks alone.
    const newTab = e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
    if (!browser || newTab || (e.target as Element).closest("button")) return;
    e.preventDefault();
    browser.select(id);
  }

  return (
    <div
      onClickCapture={onClickCapture}
      className={cn(
        "relative rounded-3xl transition-[box-shadow,opacity] duration-200",
        // The open job, on wide screens where the panel sits beside the list.
        active && "xl:[&>a]:border-brand xl:[&>a]:bg-brand-soft/40 xl:[&>a]:shadow-none",
        selecting && isSelected && "ring-2 ring-brand ring-offset-2 ring-offset-bg",
        selecting && full && "opacity-50",
      )}
    >
      {selecting && (
        <span
          role="checkbox"
          aria-checked={isSelected}
          aria-label="Select job"
          className={cn(
            "pointer-events-none absolute top-3 left-3 z-10 grid size-6 place-items-center rounded-full border-2 transition-colors",
            isSelected ? "border-brand bg-brand text-brand-fg" : "border-border-strong bg-surface",
          )}
        >
          {isSelected && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      )}
      {children}
    </div>
  );
}

/** The score ring on a card, swapped for live progress while that job is being analyzed. */
export function ScoreSlot({ id, children }: { id: string; children: ReactNode }) {
  const { live } = use(AnalyzeContext);
  const state = live[id];
  if (!state || state.status === "error") return <>{children}</>;
  if (state.status === "queued") {
    return (
      <span className="grid size-12 place-items-center rounded-full border-2 border-dashed border-border-strong text-subtle" title="Queued">
        <Clock className="size-4" />
      </span>
    );
  }
  if (state.status === "running") {
    return (
      <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand" title="Analyzing…">
        <Loader2 className="size-5 animate-spin" />
      </span>
    );
  }
  return <AiScore score={state.score ?? 0} veto={state.veto} className="animate-[pop_400ms_var(--ease-spring)]" />;
}
