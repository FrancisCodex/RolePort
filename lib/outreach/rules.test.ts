import { describe, expect, it } from "vitest";
import { addWorkingDays, DEFAULT_RULES, dueLabel, followUpLabel, nextFollowUp, rulesOf, type FollowUpInput } from "./rules";
import { gmailHref, mailtoHref, outlookHref, outreachOf } from "./types";

const day = (s: string) => new Date(`${s}T09:00:00`);
const doc = (over: Partial<FollowUpInput["doc"]> = {}): FollowUpInput["doc"] => ({ sent: [], pause: null, replyBy: null, offerDeadline: null, ...over });
const input = (over: Partial<FollowUpInput>): FollowUpInput => ({ status: "applied", appliedAt: day("2026-10-01"), interviewAt: null, offerAt: null, doc: doc(), ...over });
const sent = (kind: string, at: string) => ({ id: `${kind}-${at}`, kind: kind as "nudge_1", at: day(at).toISOString(), to: "", toName: "", subject: "", body: "", reason: "" });

describe("nextFollowUp", () => {
  it("nudges 7 days after applying, then 14", () => {
    const first = nextFollowUp(input({}), DEFAULT_RULES, day("2026-10-02"));
    expect(first?.kind).toBe("nudge_1");
    expect(first?.dueAt).toEqual(day("2026-10-08"));

    const second = nextFollowUp(input({ doc: doc({ sent: [sent("nudge_1", "2026-10-08")] }) }), DEFAULT_RULES, day("2026-10-09"));
    expect(second?.kind).toBe("nudge_2");
    expect(second?.dueAt).toEqual(day("2026-10-15"));

    const done = nextFollowUp(input({ doc: doc({ sent: [sent("nudge_1", "2026-10-08"), sent("nudge_2", "2026-10-15")] }) }), DEFAULT_RULES);
    expect(done).toBeNull();
  });

  it("counts from when the application email was sent", () => {
    const next = nextFollowUp(input({ doc: doc({ sent: [sent("application", "2026-10-05")] }) }), DEFAULT_RULES, day("2026-10-06"));
    expect(next?.dueAt).toEqual(day("2026-10-12"));
  });

  it("keeps a late first nudge and the second at least three days apart", () => {
    const next = nextFollowUp(input({ doc: doc({ sent: [sent("nudge_1", "2026-10-14")] }) }), DEFAULT_RULES, day("2026-10-14"));
    expect(next?.dueAt).toEqual(day("2026-10-17"));
  });

  it("pauses after a reply until the status moves on", () => {
    const paused = doc({ pause: { status: "applied", at: day("2026-10-03").toISOString() } });
    expect(nextFollowUp(input({ doc: paused }), DEFAULT_RULES)).toBeNull();
    const moved = nextFollowUp(input({ status: "offer", offerAt: day("2026-10-20"), doc: paused }), DEFAULT_RULES, day("2026-10-20"));
    expect(moved?.kind).toBe("offer_reply");
  });

  it("asks for a thank-you after the interview, then a check-in 5 working days after the date they gave", () => {
    const interviewAt = day("2026-10-15"); // a Thursday
    const thanks = nextFollowUp(input({ status: "interview", interviewAt }), DEFAULT_RULES, day("2026-10-15"));
    expect(thanks?.kind).toBe("thank_you");
    expect(thanks?.by).toEqual(day("2026-10-16"));

    const withThanks = doc({ sent: [sent("thank_you", "2026-10-15")], replyBy: "2026-10-20" });
    const checkIn = nextFollowUp(input({ status: "interview", interviewAt, doc: withThanks }), DEFAULT_RULES, day("2026-10-16"));
    expect(checkIn?.kind).toBe("check_in");
    expect(checkIn?.dueAt.toDateString()).toBe(new Date("2026-10-27T12:00:00").toDateString());
  });

  it("skips a thank-you that would be days late", () => {
    const next = nextFollowUp(input({ status: "interview", interviewAt: day("2026-10-01") }), DEFAULT_RULES, day("2026-10-10"));
    expect(next?.kind).toBe("check_in");
  });

  it("waits for an interview that hasn't happened", () => {
    expect(nextFollowUp(input({ status: "interview", interviewAt: day("2026-11-01") }), DEFAULT_RULES, day("2026-10-20"))).toBeNull();
  });

  it("replies to an offer before its deadline", () => {
    const next = nextFollowUp(input({ status: "offer", offerAt: day("2026-10-20"), doc: doc({ offerDeadline: "2026-10-30" }) }), DEFAULT_RULES);
    expect(next?.dueAt.toDateString()).toBe(new Date("2026-10-28T12:00:00").toDateString());
  });

  it("follows rules switched off and leaves closed applications alone", () => {
    expect(nextFollowUp(input({}), { ...DEFAULT_RULES, nudge1Days: null, nudge2Days: null })).toBeNull();
    expect(nextFollowUp(input({ status: "rejected" }), DEFAULT_RULES)).toBeNull();
    expect(nextFollowUp(input({ status: "saved" }), DEFAULT_RULES)).toBeNull();
  });
});

describe("helpers", () => {
  it("skips weekends", () => {
    expect(addWorkingDays(day("2026-10-16"), 1).getDay()).toBe(1); // Friday → Monday
    expect(addWorkingDays(day("2026-10-15"), 5).getDate()).toBe(22);
  });

  it("labels due dates", () => {
    const now = day("2026-10-10");
    expect(dueLabel(day("2026-10-10"), new Date(now.getTime() + 1))).toEqual({ text: "Due today", due: true });
    expect(dueLabel(day("2026-10-07"), now)).toEqual({ text: "3 days overdue", due: true });
    expect(dueLabel(day("2026-10-11"), now)).toEqual({ text: "Tomorrow", due: false });
  });

  it("doesn't call a thank-you overdue while its send-by date is ahead", () => {
    const now = day("2026-10-10");
    expect(followUpLabel({ dueAt: day("2026-10-09"), by: new Date(now.getTime() + 3600_000) }, now)).toEqual({ text: "Due today", due: true });
    expect(followUpLabel({ dueAt: day("2026-10-09"), by: day("2026-10-11") }, now)).toEqual({ text: "Send by tomorrow", due: true });
    expect(followUpLabel({ dueAt: day("2026-10-09"), by: new Date(now.getTime() - 3600_000) }, now)).toEqual({ text: "Due today", due: true });
    expect(followUpLabel({ dueAt: day("2026-10-07"), by: day("2026-10-08") }, now)).toEqual({ text: "2 days overdue", due: true });
  });

  it("reads stored rules over the defaults and ignores bad ones", () => {
    expect(rulesOf({ nudge1Days: 5, thankYouHours: null })).toEqual({ ...DEFAULT_RULES, nudge1Days: 5, thankYouHours: null });
    expect(rulesOf({ nudge1Days: -3 })).toEqual(DEFAULT_RULES);
    expect(rulesOf(null)).toEqual(DEFAULT_RULES);
  });

  it("builds a mailto link", () => {
    expect(mailtoHref({ to: "ana@acme.com", subject: "Application: Dev – Juan", body: "Hi Ana,\n\nThanks" })).toBe(
      "mailto:ana@acme.com?subject=Application%3A%20Dev%20%E2%80%93%20Juan&body=Hi%20Ana%2C%0A%0AThanks",
    );
  });

  it("builds Gmail and Outlook compose links", () => {
    const draft = { to: "ana@acme.com", subject: "Hi & hello", body: "Line one\n\nA+B" };
    expect(gmailHref(draft)).toBe("https://mail.google.com/mail/?view=cm&fs=1&to=ana%40acme.com&su=Hi%20%26%20hello&body=Line%20one%0A%0AA%2BB");
    expect(outlookHref(draft)).toBe("https://outlook.live.com/mail/0/deeplink/compose?to=ana%40acme.com&subject=Hi%20%26%20hello&body=Line%20one%0A%0AA%2BB");
  });

  it("reads sent entries from before copies were kept", () => {
    const old = { id: "1", kind: "nudge_1", at: "2026-10-08T01:00:00.000Z", to: "ana@acme.com" };
    expect(outreachOf({ sent: [old] }).sent[0]).toMatchObject({ to: "ana@acme.com", body: "", subject: "" });
  });

  it("reads an old or broken document as empty", () => {
    expect(outreachOf(null).sent).toEqual([]);
    expect(outreachOf({ contacts: "nope" }).contacts).toEqual([]);
    expect(outreachOf({ talkingPoints: "We discussed APIs" }).talkingPoints).toBe("We discussed APIs");
  });
});
