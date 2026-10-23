import { desc, eq, inArray } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import type { ApplicationStatus } from "./applications";
import { timeAgo } from "./format";

/*
 * The Home dashboard's numbers, from the pipeline, its event history and the fit evaluations.
 * Shared by the server page and the lite edition. Everything returned is plain data.
 */

/** The forward stages, in order. A closed application keeps the furthest stage it reached. */
export const STAGES = ["saved", "applied", "screening", "interview", "offer", "hired"] as const;
export type Stage = (typeof STAGES)[number];
const CLOSED: ApplicationStatus[] = ["rejected", "withdrawn", "offer_declined", "ghosted"];

const WEEKS = 8;
const FOLLOW_UP_AFTER_DAYS = 7;
const DAY = 86_400_000;

export type DashboardStats = {
  total: number;
  /** Applications that reached each stage (or further). */
  reached: Record<Stage, number>;
  /** Where applications are now. */
  active: number;
  closed: { status: ApplicationStatus; count: number }[];
  /** Share of sent applications that got any reply (screening or further), 0-1, or null before any are sent. */
  responseRate: number | null;
  /** Applications marked applied per week, oldest first; `start` is the week's Monday (YYYY-MM-DD), `label` e.g. "Oct 13". */
  weekly: { start: string; label: string; count: number }[];
  sentThisWeek: number;
  evaluations: { count: number; average: number | null; strong: number };
  /** Latest pipeline changes; `ago` is formatted where the data is loaded so server and browser agree. */
  recent: { id: string; company: string; role: string; status: ApplicationStatus; at: string; ago: string; jobId: string | null }[];
  /** Applied or screening with no change for a while: worth a follow-up. */
  followUps: { id: string; company: string; role: string; days: number; jobId: string | null }[];
};

/** Monday 00:00 (local time) of the week containing `date`. */
function weekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export async function readDashboard(db: AnyDb, userId: string, now = new Date()): Promise<DashboardStats> {
  const [apps, matches] = await Promise.all([
    db.select().from(schema.application).where(eq(schema.application.userId, userId)),
    db.select({ score: schema.jobMatch.overallScore }).from(schema.jobMatch).where(eq(schema.jobMatch.userId, userId)),
  ]);
  const events = apps.length
    ? await db
        .select()
        .from(schema.applicationEvent)
        .where(
          inArray(
            schema.applicationEvent.applicationId,
            apps.map((a) => a.id),
          ),
        )
        .orderBy(desc(schema.applicationEvent.occurredAt))
    : [];
  const appById = new Map(apps.map((a) => [a.id, a]));

  // Furthest forward stage each application reached, from its history and its current status.
  const rank = (s: ApplicationStatus) => STAGES.indexOf(s as Stage);
  const furthest = new Map(apps.map((a) => [a.id, rank(a.status)]));
  for (const e of events) furthest.set(e.applicationId, Math.max(furthest.get(e.applicationId) ?? -1, rank(e.status)));

  const reached = Object.fromEntries(STAGES.map((s, i) => [s, [...furthest.values()].filter((r) => r >= i).length])) as Record<Stage, number>;
  // An application closed straight from "saved" (e.g. withdrawn) still counts as saved.
  reached.saved = apps.length;

  const closedCounts = new Map<ApplicationStatus, number>();
  for (const a of apps) if (CLOSED.includes(a.status)) closedCounts.set(a.status, (closedCounts.get(a.status) ?? 0) + 1);

  // When each application was sent: its first "applied" event, else appliedAt.
  const sentAt = new Map<string, Date>();
  for (const e of events) if (e.status === "applied") sentAt.set(e.applicationId, e.occurredAt);
  for (const a of apps) if (a.appliedAt && !sentAt.has(a.id)) sentAt.set(a.id, a.appliedAt);

  const thisWeek = weekStart(now);
  const weekly = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - (WEEKS - 1 - i) * 7);
    return { start, count: 0 };
  });
  for (const at of sentAt.values()) {
    const bucket = weekly.findLast((w) => at >= w.start);
    if (bucket && at.getTime() < thisWeek.getTime() + 7 * DAY) bucket.count++;
  }

  const scores = matches.map((m) => m.score).filter((s): s is number => s != null);

  return {
    total: apps.length,
    reached,
    active: apps.filter((a) => !CLOSED.includes(a.status) && a.status !== "hired").length,
    closed: [...closedCounts].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
    responseRate: reached.applied ? reached.screening / reached.applied : null,
    weekly: weekly.map((w) => ({
      start: isoDay(w.start),
      label: w.start.toLocaleDateString("en", { month: "short", day: "numeric" }),
      count: w.count,
    })),
    sentThisWeek: weekly.at(-1)?.count ?? 0,
    evaluations: {
      count: matches.length,
      average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      strong: scores.filter((s) => s >= 75).length,
    },
    recent: events.slice(0, 6).flatMap((e) => {
      const app = appById.get(e.applicationId);
      return app
        ? [{ id: e.id, company: app.company, role: app.role, status: e.status, at: e.occurredAt.toISOString(), ago: timeAgo(e.occurredAt, now.getTime()) ?? "", jobId: app.jobId }]
        : [];
    }),
    followUps: apps
      .filter((a) => (a.status === "applied" || a.status === "screening") && now.getTime() - a.updatedAt.getTime() > FOLLOW_UP_AFTER_DAYS * DAY)
      .map((a) => ({ id: a.id, company: a.company, role: a.role, days: Math.floor((now.getTime() - a.updatedAt.getTime()) / DAY), jobId: a.jobId }))
      .sort((a, b) => b.days - a.days)
      .slice(0, 4),
  };
}
