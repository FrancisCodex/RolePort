"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Bookmark,
  Check,
  CornerDownLeft,
  Home,
  KanbanSquare,
  MapPin,
  Search,
  Settings,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { MatchRing } from "@/components/ui/match-ring";
import { cn } from "@/lib/utils";
import { DEMO_JOBS, fitLabel, type DemoJob, type DemoSetup } from "./demo-data";

const SETUPS: DemoSetup[] = ["Remote", "Hybrid", "Onsite"];
/** What the demo types into the search box on its own, until the visitor takes over. */
const INTRO_QUERY = "developer";
const ease = [0.2, 0, 0, 1] as const;

/**
 * The hero's live product demo: a miniature HireMe with made-up jobs. Visitors can search,
 * filter by setup, open a job's fit breakdown and save it to the pipeline.
 */
export function ProductDemo() {
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [setups, setSetups] = useState<DemoSetup[]>([]);
  const [selectedId, setSelectedId] = useState<string>(DEMO_JOBS[0].id);
  const [saved, setSaved] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const touched = useRef(false);

  // Type the intro query a letter at a time, unless the visitor gets there first.
  useEffect(() => {
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    if (reduce) {
      timer = setTimeout(() => !touched.current && setQuery(INTRO_QUERY), 0);
      return () => clearTimeout(timer);
    }
    const tick = () => {
      if (touched.current) return;
      i += 1;
      setQuery(INTRO_QUERY.slice(0, i));
      if (i < INTRO_QUERY.length) timer = setTimeout(tick, 75 + Math.random() * 60);
    };
    timer = setTimeout(tick, 900);
    return () => clearTimeout(timer);
  }, [reduce]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DEMO_JOBS.filter(
      (j) =>
        (!q || [j.title, j.company, j.place, ...j.skills].some((s) => s.toLowerCase().includes(q))) &&
        (setups.length === 0 || setups.includes(j.setup)),
    ).sort((a, b) => b.score - a.score);
  }, [query, setups]);

  // Keep a visible job selected as the list changes.
  const selected = results.find((j) => j.id === selectedId) ?? results[0] ?? null;

  function takeOver() {
    touched.current = true;
  }

  function toggleSave(job: DemoJob) {
    takeOver();
    const on = saved.includes(job.id);
    setToast(on ? `Removed ${job.title}` : `Saved ${job.title} to Pipeline`);
    setSaved((s) => (on ? s.filter((id) => id !== job.id) : [...s, job.id]));
  }

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (!selected || !["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) return;
    e.preventDefault();
    if (e.key === "Enter") return toggleSave(selected);
    const at = results.indexOf(selected);
    const next = results[at + (e.key === "ArrowDown" ? 1 : -1)];
    if (next) setSelectedId(next.id);
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-surface text-left shadow-[0_0_0_1px_hsl(var(--shadow-color)/0.02),0_24px_80px_-24px_hsl(var(--shadow-color)/0.35)]">
      {/* Window chrome */}
      <div className="flex h-9 items-center gap-1.5 border-b border-border bg-sidebar px-3">
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="mx-auto rounded-md border border-border bg-surface px-2.5 py-0.5 font-mono text-[11px] text-subtle">
          localhost:3000/jobs
        </span>
        <span className="hidden items-center gap-1 rounded-md bg-brand-soft px-1.5 py-0.5 text-[10px] font-medium text-brand-ink sm:flex">
          <span className="size-1.5 animate-pulse rounded-full bg-brand" /> Live demo
        </span>
      </div>

      <div className="grid h-[440px] md:grid-cols-[150px_minmax(0,1fr)] lg:grid-cols-[150px_minmax(0,1fr)_300px]">
        {/* Sidebar */}
        <aside className="hidden flex-col gap-px border-r border-border bg-sidebar p-2 md:flex">
          <p className="px-2 pt-1 pb-1.5 text-[10px] font-medium text-subtle">Workspace</p>
          <SideItem icon={Home} label="Home" />
          <SideItem icon={Search} label="Jobs" active />
          <SideItem icon={KanbanSquare} label="Pipeline" count={saved.length} />
          <SideItem icon={UserRound} label="Profile" />
          <div className="mt-auto">
            <SideItem icon={Settings} label="Settings" />
          </div>
        </aside>

        {/* Results */}
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="flex flex-col gap-2 border-b border-border p-2.5">
            <label className="relative">
              <span className="sr-only">Search the demo jobs</span>
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle" />
              <input
                value={query}
                onChange={(e) => {
                  takeOver();
                  setQuery(e.target.value);
                }}
                onFocus={takeOver}
                onKeyDown={onSearchKey}
                placeholder="Search a role, skill or company"
                className="h-8 w-full rounded-md border border-transparent bg-surface-2 pr-16 pl-8 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-subtle focus:border-brand focus:bg-surface focus:ring-3 focus:ring-brand/15"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    takeOver();
                    setQuery("");
                  }}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-1.5 grid size-5 -translate-y-1/2 place-items-center rounded text-subtle hover:bg-surface-3 hover:text-fg"
                >
                  <X className="size-3" />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 font-mono text-[10px] text-subtle">↑↓ ↵</kbd>
              )}
            </label>
            <div className="flex items-center gap-1">
              {SETUPS.map((s) => {
                const on = setups.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      takeOver();
                      setSetups((cur) => (on ? cur.filter((x) => x !== s) : [...cur, s]));
                    }}
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
                      on ? "border-brand/40 bg-brand-soft text-brand-ink" : "border-border text-muted hover:border-border-strong hover:text-fg",
                    )}
                  >
                    {s}
                  </button>
                );
              })}
              <span className="ml-auto text-[11px] text-subtle tabular-nums">
                {results.length} {results.length === 1 ? "job" : "jobs"} · best match
              </span>
            </div>
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
            <AnimatePresence initial={false} mode="popLayout">
              {results.map((job) => {
                const active = selected?.id === job.id;
                return (
                  <motion.li
                    key={job.id}
                    layout={!reduce}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2, ease }}
                  >
                    <div
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2 py-2 transition-colors",
                        active ? "bg-brand-soft/60 shadow-[inset_2px_0_0_var(--brand)]" : "hover:bg-surface-2",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          takeOver();
                          setSelectedId(job.id);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-surface-2 text-[11px] font-semibold text-muted">
                          {job.company[0]}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">{job.title}</span>
                          <span className="flex items-center gap-1 truncate text-[11px] text-subtle">
                            {job.company} · <MapPin className="size-2.5 shrink-0" /> {job.place} · {job.setup}
                          </span>
                        </span>
                        <MatchRing score={job.score} size={30} />
                      </button>
                      <SaveToggle saved={saved.includes(job.id)} onClick={() => toggleSave(job)} />
                    </div>
                    {/* Narrow screens: details open under the row instead of in a side pane. */}
                    {active && (
                      <div className="px-2 pt-1 pb-3 lg:hidden">
                        <JobDetail job={job} saved={saved.includes(job.id)} onSave={() => toggleSave(job)} compact />
                      </div>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
            {results.length === 0 && (
              <li className="flex flex-col items-center gap-2 px-4 py-14 text-center text-[13px] text-muted">
                No demo jobs match “{query}”.
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setSetups([]);
                  }}
                  className="text-[13px] font-medium text-brand-ink hover:underline"
                >
                  Clear filters
                </button>
              </li>
            )}
          </ul>
        </div>

        {/* Details */}
        <section className="hidden min-h-0 overflow-y-auto border-l border-border bg-bg p-3.5 lg:block" aria-label="Job details">
          <AnimatePresence mode="wait" initial={false}>
            {selected ? (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease }}
              >
                <JobDetail job={selected} saved={saved.includes(selected.id)} onSave={() => toggleSave(selected)} />
              </motion.div>
            ) : (
              <p className="pt-10 text-center text-[13px] text-subtle">Pick a job to see how it fits.</p>
            )}
          </AnimatePresence>
        </section>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast}
            role="status"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease }}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium whitespace-nowrap shadow-[var(--shadow-lift)]"
          >
            <Check className="size-3.5 text-brand" strokeWidth={2.5} />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SideItem({ icon: Icon, label, active, count }: { icon: typeof Home; label: string; active?: boolean; count?: number }) {
  return (
    <span
      className={cn(
        "flex h-7 items-center gap-2 rounded-md px-2 text-xs font-medium",
        active ? "bg-surface-3 text-fg" : "text-muted",
      )}
    >
      <Icon className={cn("size-3.5", active ? "text-fg" : "text-subtle")} strokeWidth={1.75} />
      {label}
      {!!count && (
        <motion.span
          key={count}
          initial={{ scale: 0.6 }}
          animate={{ scale: 1 }}
          className="ml-auto rounded bg-brand px-1 text-[10px] leading-4 font-semibold text-brand-fg tabular-nums"
        >
          {count}
        </motion.span>
      )}
    </span>
  );
}

function SaveToggle({ saved, onClick }: { saved: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save job"}
      className={cn("grid size-7 shrink-0 place-items-center rounded-md transition-colors", saved ? "text-brand" : "text-subtle hover:bg-surface-3 hover:text-fg")}
    >
      <Bookmark className="size-3.5" fill={saved ? "currentColor" : "none"} />
    </button>
  );
}

function JobDetail({ job, saved, onSave, compact }: { job: DemoJob; saved: boolean; onSave: () => void; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-3.5">
      {!compact && (
        <div>
          <p className="text-[15px] leading-snug font-semibold tracking-tight">{job.title}</p>
          <p className="text-xs text-muted">
            {job.company} · {job.place}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge>{job.setup}</Badge>
            <Badge tone="success">{job.pay}</Badge>
            <Badge>{job.posted}</Badge>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
        <MatchRing score={job.score} size={44} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold">
            {fitLabel(job.score)}
            <span className="inline-flex items-center gap-0.5 rounded-sm bg-brand px-1 text-[9px] leading-[14px] font-semibold text-brand-fg">
              <Sparkles className="size-2" /> AI
            </span>
          </p>
          <p className="text-[11px] text-subtle">Scored against your profile</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {job.breakdown.map((b, i) => (
          <div key={b.label}>
            <div className="mb-1 flex justify-between text-[11px]">
              <span className="text-muted">{b.label}</span>
              <span className="font-medium tabular-nums">{b.score}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-surface-3">
              <motion.div
                className={cn("h-full rounded-full", b.score >= 75 ? "bg-brand" : b.score >= 60 ? "bg-warning" : "bg-danger")}
                initial={{ width: 0 }}
                animate={{ width: `${b.score}%` }}
                transition={{ duration: 0.6, ease, delay: 0.05 * i }}
              />
            </div>
          </div>
        ))}
      </div>

      <ul className="flex flex-col gap-1.5 text-xs">
        {job.strengths.map((s) => (
          <li key={s} className="flex gap-1.5">
            <Check className="mt-px size-3 shrink-0 text-brand" strokeWidth={3} />
            {s}
          </li>
        ))}
        {job.gaps.map((g) => (
          <li key={g} className="flex gap-1.5 text-muted">
            <X className="mt-px size-3 shrink-0 text-danger" strokeWidth={3} />
            {g}
          </li>
        ))}
      </ul>

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onSave}
          className={cn(
            "inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors",
            saved ? "border-brand/40 bg-brand-soft text-brand-ink" : "border-border bg-surface hover:bg-surface-2",
          )}
        >
          <Bookmark className="size-3" fill={saved ? "currentColor" : "none"} />
          {saved ? "Saved" : "Save"}
          <CornerDownLeft className="size-3 text-subtle" />
        </button>
        <Link
          href="/home"
          className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md bg-brand text-xs font-medium text-brand-fg hover:bg-brand-hover"
        >
          Try with your CV <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}
