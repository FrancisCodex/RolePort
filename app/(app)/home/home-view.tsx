"use client";

import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  Check,
  Compass,
  MessageSquareReply,
  Search,
  Send,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MatchRing } from "@/components/ui/match-ring";
import type { DashboardStats, Stage } from "@/lib/jobs/dashboard";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type Status } from "../pipeline/status-select";

export type HomeData = {
  /** First name, or "" before one is set. */
  firstName: string;
  stats: DashboardStats;
  setup: { hasRoles: boolean; hasSkills: boolean; hasCv: boolean; aiEnabled: boolean; firstRole: string | null; country: string };
  /** The welcome guide hasn't been finished or skipped (Home sends these users there when it's on). */
  needsOnboarding: boolean;
};

const STAGE_LABEL: Record<Stage, string> = {
  saved: "Saved",
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
};

const STATUS_TONE: Record<Status, "neutral" | "brand" | "success" | "danger"> = {
  saved: "neutral",
  applied: "brand",
  screening: "brand",
  interview: "brand",
  offer: "success",
  hired: "success",
  rejected: "danger",
  withdrawn: "neutral",
  offer_declined: "neutral",
  ghosted: "neutral",
};

const pct = (n: number) => `${Math.round(n * 100)}%`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The Home dashboard: the user's job search at a glance. Shared by the server page and the lite edition. */
export function HomeView({ firstName, stats, setup }: HomeData) {
  const searchHref = setup.firstRole
    ? `/jobs?q=${encodeURIComponent(setup.firstRole)}&country=${setup.country}`
    : "/jobs";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-muted">Mabuhay{firstName ? `, ${firstName}` : ""}! 👋</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-balance">Your job search at a glance</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={searchHref} className={buttonVariants()}>
            <Search /> Find jobs
          </Link>
          <Link href="/welcome" className={buttonVariants({ variant: "secondary" })}>
            <Compass /> Setup guide
          </Link>
        </div>
      </header>

      <SetupChecklist setup={setup} />

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={Send}
          label="Applications sent"
          value={stats.reached.applied}
          note={stats.sentThisWeek ? `${stats.sentThisWeek} this week` : `${plural(stats.reached.saved, "job")} saved`}
        />
        <StatTile
          icon={MessageSquareReply}
          label="Response rate"
          value={stats.responseRate == null ? "–" : pct(stats.responseRate)}
          note={stats.reached.applied ? `${stats.reached.screening} of ${stats.reached.applied} replied` : "Appears once you apply"}
          meter={stats.responseRate}
        />
        <StatTile
          icon={CalendarCheck}
          label="Interviews"
          value={stats.reached.interview}
          note={stats.reached.applied ? `${pct(stats.reached.interview / stats.reached.applied)} of applications` : "Your next milestone"}
        />
        <StatTile
          icon={Trophy}
          label="Offers"
          value={stats.reached.offer}
          note={stats.reached.hired ? `${stats.reached.hired} accepted 🎉` : stats.active ? `${plural(stats.active, "application")} in play` : "Keep going"}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title="How far your applications get"
          description="Every job you saved, and how many reached each stage."
        >
          {stats.total ? <Funnel stats={stats} /> : <EmptyNote href={searchHref} action="Find jobs to save">No applications yet. Save a job and it starts here.</EmptyNote>}
        </Panel>
        <Panel className="lg:col-span-2" title="Applications sent per week" description="The last 8 weeks.">
          {stats.weekly.some((w) => w.count > 0) ? (
            <WeeklyChart weeks={stats.weekly} />
          ) : (
            <EmptyNote href="/pipeline" action="Open your pipeline">
              Move a job to Applied in your pipeline to see your pace here.
            </EmptyNote>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3" title="Recent activity">
          {stats.recent.length ? (
            <ul className="-my-1 divide-y divide-border">
              {stats.recent.map((item) => (
                <li key={item.id}>
                  <ActivityRow {...item} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote href={searchHref} action="Find jobs">
              Saving, applying and every status change show up here.
            </EmptyNote>
          )}
        </Panel>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <Panel title="Follow up" icon={BellRing}>
            {stats.followUps.length ? (
              <ul className="flex flex-col gap-2">
                {stats.followUps.map((f) => (
                  <li key={f.id}>
                    <Link
                      href={f.jobId ? `/jobs/${f.jobId}` : "/pipeline"}
                      className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-surface-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{f.role}</span>
                        <span className="block truncate text-xs text-muted">{f.company}</span>
                      </span>
                      <Badge tone="warning" className="shrink-0 whitespace-nowrap">
                        {f.days} days
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                Nothing waiting. Applications with no reply for a week show up here, so you know when to check in.
              </p>
            )}
          </Panel>

          <Panel title="Fit evaluations" icon={Sparkles}>
            {stats.evaluations.count ? (
              <div className="flex items-center gap-4">
                {stats.evaluations.average != null && <MatchRing score={stats.evaluations.average} size={64} />}
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">
                    {plural(stats.evaluations.count, "job")} evaluated
                    {stats.evaluations.average != null && <span className="font-normal text-muted"> · {stats.evaluations.average} on average</span>}
                  </p>
                  <p className="mt-0.5 text-muted">
                    {stats.evaluations.strong ? `${plural(stats.evaluations.strong, "strong fit")} worth applying to.` : "No strong fits yet."}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">
                {setup.aiEnabled ? "Evaluate a job to see how well it fits you, with strengths and gaps." : "Turn on AI in Settings to see how well each job fits you."}{" "}
                <Link href={setup.aiEnabled ? searchHref : "/settings"} className="font-semibold text-brand hover:underline">
                  {setup.aiEnabled ? "Find jobs" : "Set up AI"}
                </Link>
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* Pieces ------------------------------------------------------------------- */

function Panel({
  title,
  description,
  icon: Icon,
  className,
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("flex flex-col p-6", className)}>
      <div className="mb-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
          {Icon && <Icon className="size-4 text-brand" />}
          {title}
        </h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </Card>
  );
}

function EmptyNote({ children, href, action }: { children: ReactNode; href: string; action: string }) {
  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-3 rounded-2xl border-2 border-dashed border-border px-5 py-8">
      <p className="text-sm text-muted">{children}</p>
      <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
        {action} <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

/** One headline number. `meter` (0-1) adds a thin bar on the same hue. */
function StatTile({ icon: Icon, label, value, note, meter }: { icon: LucideIcon; label: string; value: number | string; note: string; meter?: number | null }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-muted">{label}</p>
        <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand-ink">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="font-display text-4xl font-bold tracking-tight tabular-nums">{value}</p>
      {meter != null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
          <div className="h-full rounded-full bg-brand" style={{ width: pct(meter) }} />
        </div>
      )}
      <p className="text-xs text-muted">{note}</p>
    </Card>
  );
}

function SetupChecklist({ setup }: { setup: HomeData["setup"] }) {
  const items = [
    { done: setup.hasRoles, label: "Roles you want", href: "/welcome" },
    { done: setup.hasSkills, label: "Your skills", href: "/profile" },
    { done: setup.hasCv, label: "Your CV", href: "/profile" },
    { done: setup.aiEnabled, label: "AI provider", href: "/settings" },
  ];
  const done = items.filter((i) => i.done).length;
  if (done === items.length) return null;

  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3 sm:w-56 sm:shrink-0">
        <span className="font-display text-2xl font-bold text-brand tabular-nums">
          {done}/{items.length}
        </span>
        <p className="text-sm font-semibold leading-tight">Finish setting up for better matches</p>
      </div>
      <ul className="flex flex-1 flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                item.done ? "border-transparent bg-success-soft text-success" : "border-border text-fg hover:border-border-strong",
              )}
            >
              {item.done ? <Check className="size-3.5" strokeWidth={3} /> : <span className="size-3.5 rounded-full border-2 border-border-strong" />}
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ActivityRow({ company, role, status, ago, jobId }: HomeData["stats"]["recent"][number]) {
  const body = (
    <>
      <Badge tone={STATUS_TONE[status]} className="w-24 shrink-0 justify-center">
        {STATUS_LABEL[status]}
      </Badge>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{role}</span>
        <span className="block truncate text-xs text-muted">{company}</span>
      </span>
      <span className="shrink-0 text-xs text-subtle">{ago}</span>
    </>
  );
  return jobId ? (
    <Link href={`/jobs/${jobId}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-surface-2">
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-3 py-3">{body}</div>
  );
}

/* Charts --------------------------------------------------------------------- */

/** Tooltip box shown above a hovered mark. */
function ChartTooltip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="tooltip"
      className={cn(
        "pointer-events-none absolute z-10 rounded-xl bg-fg px-3 py-1.5 text-xs font-medium whitespace-nowrap text-bg shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Horizontal bars, one hue: how many applications reached each stage, labelled directly. */
function Funnel({ stats }: { stats: DashboardStats }) {
  const [hover, setHover] = useState<Stage | null>(null);
  const stages = (Object.keys(STAGE_LABEL) as Stage[]).filter((s) => s !== "hired" || stats.reached.hired > 0);
  const base = stats.reached.saved || 1;

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-2.5">
        {stages.map((stage, i) => {
          const count = stats.reached[stage];
          const prev = i > 0 ? stats.reached[stages[i - 1]] : null;
          return (
            <li
              key={stage}
              tabIndex={0}
              onMouseEnter={() => setHover(stage)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(stage)}
              onBlur={() => setHover(null)}
              className="relative grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <span className="text-sm font-medium text-muted">{STAGE_LABEL[stage]}</span>
              <span className="relative h-5 rounded-r-[4px] bg-surface-2">
                <span
                  className={cn("absolute inset-y-0 left-0 rounded-r-[4px] transition-[width,opacity] duration-500", count ? "bg-brand" : "")}
                  style={{ width: count ? `max(4px, ${(count / base) * 100}%)` : 0, opacity: hover && hover !== stage ? 0.45 : 1 }}
                />
              </span>
              <span className="text-right text-sm font-semibold tabular-nums">{count}</span>
              {hover === stage && (
                <ChartTooltip className="bottom-full left-[5.5rem] mb-1.5 ml-3">
                  {STAGE_LABEL[stage]}: {plural(count, "application")} · {pct(count / base)} of saved
                  {prev ? ` · ${pct(count / prev)} of ${STAGE_LABEL[stages[i - 1]].toLowerCase()}` : ""}
                </ChartTooltip>
              )}
            </li>
          );
        })}
      </ol>
      <p className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-3 text-xs text-muted">
        <span>
          <span className="font-semibold text-fg tabular-nums">{stats.active}</span> in play
        </span>
        {stats.closed.map((c) => (
          <span key={c.status}>
            <span className="font-semibold text-fg tabular-nums">{c.count}</span> {STATUS_LABEL[c.status].toLowerCase()}
          </span>
        ))}
      </p>
    </div>
  );
}

/** Columns, one hue, from one baseline; only the latest and highest weeks are labelled. */
function WeeklyChart({ weeks }: { weeks: DashboardStats["weekly"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...weeks.map((w) => w.count));
  const peak = weeks.findLastIndex((w) => w.count === max);
  const last = weeks.length - 1;
  const total = weeks.reduce((n, w) => n + w.count, 0);

  return (
    <figure className="flex flex-1 flex-col justify-end">
      <div className="relative flex h-40 items-end gap-1 border-b border-border" role="img" aria-label={`${total} applications sent in the last 8 weeks, ${weeks[last].count} this week.`}>
        {weeks.map((w, i) => {
          const showValue = (i === last || i === peak) && w.count > 0;
          return (
            <div
              key={w.start}
              tabIndex={0}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="relative flex h-full flex-1 flex-col items-center justify-end outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              {showValue && <span className="mb-1 text-xs font-semibold tabular-nums">{w.count}</span>}
              <span
                className={cn(
                  "w-full max-w-6 rounded-t-[4px] transition-[height,opacity] duration-500",
                  w.count ? "bg-brand" : "h-px bg-transparent",
                )}
                style={{ height: w.count ? `${(w.count / max) * 80}%` : undefined, opacity: hover != null && hover !== i ? 0.45 : 1 }}
              />
              {hover === i && (
                <ChartTooltip className={cn("bottom-full mb-1", i > last - 2 ? "right-0" : i < 2 ? "left-0" : "left-1/2 -translate-x-1/2")}>
                  Week of {w.label}: {plural(w.count, "application")} sent
                </ChartTooltip>
              )}
            </div>
          );
        })}
      </div>
      <figcaption className="mt-2 flex justify-between text-xs text-subtle">
        <span>{weeks[0].label}</span>
        <span>This week</span>
      </figcaption>
      <table className="sr-only">
        <caption>Applications sent per week</caption>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.start}>
              <th scope="row">Week of {w.label}</th>
              <td>{w.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
