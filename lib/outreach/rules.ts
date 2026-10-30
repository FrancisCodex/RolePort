import { z } from "zod";
import type { FollowUpKind, OutreachDoc } from "./types";

/*
 * When follow-ups come due, from the application's dates, what was already sent and the
 * user's rules (Settings). Pure, so the dashboard, the application page and the email page
 * all agree, on the server and in the browser.
 */

export type FollowUpRules = {
  /** Days after applying with no reply. */
  nudge1Days: number | null;
  nudge2Days: number | null;
  /** Hours after the interview to send the thank-you by. */
  thankYouHours: number | null;
  /** Working days after the date they gave you (or the interview) before checking in. */
  checkInWorkingDays: number | null;
  /** Days before the offer's deadline to reply by. */
  offerReplyDaysBefore: number | null;
};

export const DEFAULT_RULES: FollowUpRules = { nudge1Days: 7, nudge2Days: 14, thankYouHours: 24, checkInWorkingDays: 5, offerReplyDaysBefore: 2 };

const limit = (max: number) => z.number().int().min(0).max(max).nullable();

export const followUpRulesSchema = z.object({
  nudge1Days: limit(90),
  nudge2Days: limit(120),
  thankYouHours: limit(168),
  checkInWorkingDays: limit(60),
  offerReplyDaysBefore: limit(30),
});

/** Stored rules over the defaults; a rule switched off is null. */
export function rulesOf(stored: unknown): FollowUpRules {
  if (!stored || typeof stored !== "object") return DEFAULT_RULES;
  const merged = { ...DEFAULT_RULES, ...stored };
  const parsed = followUpRulesSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_RULES;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** `days` working days (Monday to Friday) after `from`. */
export function addWorkingDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left--;
  }
  return d;
}

/** Noon on a YYYY-MM-DD day in local time, so a date-only value doesn't slip a day. */
const atNoon = (day: string) => new Date(`${day}T12:00:00`);

export type FollowUpInput = {
  status: string;
  appliedAt: Date | null;
  interviewAt: Date | null;
  /** When the application moved to "offer", from its history. */
  offerAt: Date | null;
  doc: Pick<OutreachDoc, "sent" | "pause" | "replyBy" | "offerDeadline">;
};

export type NextFollowUp = {
  kind: FollowUpKind;
  dueAt: Date;
  /** Send it by then (the thank-you, the offer reply). */
  by: Date | null;
  /** Why it's due, in a few words. */
  reason: string;
};

/**
 * The next follow-up for an application, due now or later, or null when nothing is planned:
 * closed or still only saved, paused after a reply, every rule already sent or switched off.
 */
export function nextFollowUp({ status, appliedAt, interviewAt, offerAt, doc }: FollowUpInput, rules: FollowUpRules, now = new Date()): NextFollowUp | null {
  if (doc.pause && doc.pause.status === status) return null;
  const sentSince = (kind: FollowUpKind, since: Date) => doc.sent.some((s) => s.kind === kind && new Date(s.at) >= since);
  const firstSent = (kind: string) => doc.sent.find((s) => s.kind === kind);

  if (status === "offer") {
    if (rules.offerReplyDaysBefore === null) return null;
    const since = offerAt ?? appliedAt ?? new Date(0);
    if (sentSince("offer_reply", since)) return null;
    if (doc.offerDeadline) {
      const by = atNoon(doc.offerDeadline);
      return { kind: "offer_reply", dueAt: new Date(by.getTime() - rules.offerReplyDaysBefore * DAY), by, reason: "Their deadline is coming up" };
    }
    return { kind: "offer_reply", dueAt: new Date(since.getTime() + rules.offerReplyDaysBefore * DAY), by: null, reason: "You have an offer to answer" };
  }

  // An interview that has happened, even if the status wasn't moved on.
  if ((status === "applied" || status === "screening" || status === "interview") && interviewAt && interviewAt <= now) {
    if (rules.thankYouHours !== null && !sentSince("thank_you", interviewAt)) {
      const by = new Date(interviewAt.getTime() + rules.thankYouHours * HOUR);
      // Days late, a thank-you would read oddly: go on to the check-in.
      if (now.getTime() <= by.getTime() + 2 * DAY) return { kind: "thank_you", dueAt: interviewAt, by, reason: "You had your interview" };
    }
    if (rules.checkInWorkingDays !== null && !sentSince("check_in", interviewAt)) {
      const from = doc.replyBy ? atNoon(doc.replyBy) : interviewAt;
      return {
        kind: "check_in",
        dueAt: addWorkingDays(from, rules.checkInWorkingDays),
        by: null,
        reason: doc.replyBy ? "The date they gave you has passed" : "No news since the interview",
      };
    }
    return null;
  }

  if (status === "applied") {
    const sentApplication = firstSent("application");
    const base = sentApplication ? new Date(sentApplication.at) : appliedAt;
    if (!base) return null;
    const nudge1 = firstSent("nudge_1");
    if (!nudge1) {
      if (rules.nudge1Days !== null) return { kind: "nudge_1", dueAt: new Date(base.getTime() + rules.nudge1Days * DAY), by: null, reason: "No reply since you applied" };
    }
    if (rules.nudge2Days !== null && !firstSent("nudge_2")) {
      // Never two nudges within three days of each other.
      const after = nudge1 ? new Date(nudge1.at).getTime() + 3 * DAY : 0;
      return { kind: "nudge_2", dueAt: new Date(Math.max(base.getTime() + rules.nudge2Days * DAY, after)), by: null, reason: "Still no reply" };
    }
  }
  return null;
}

/** The label for a follow-up. One with a send-by date counts from that: "Send by tomorrow", "Due today", then overdue. */
export function followUpLabel(next: Pick<NextFollowUp, "dueAt" | "by">, now = new Date()): { text: string; due: boolean } {
  const label = dueLabel(next.dueAt, now);
  if (!label.due || !next.by) return label;
  const byLabel = dueLabel(next.by, now);
  return byLabel.due ? byLabel : { text: `Send by ${byLabel.text.toLowerCase()}`, due: true };
}

/** "Due today", "3 days overdue", "in 5 days", "tomorrow", from whole calendar days. */
export function dueLabel(dueAt: Date, now = new Date()): { text: string; due: boolean } {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(dueAt) - start(now)) / DAY);
  if (dueAt <= now || days <= 0) {
    if (days >= 0) return { text: "Due today", due: true };
    return { text: days === -1 ? "1 day overdue" : `${-days} days overdue`, due: true };
  }
  return { text: days === 1 ? "Tomorrow" : `In ${days} days`, due: false };
}
