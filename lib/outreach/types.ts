import { z } from "zod";

/*
 * Emails and follow-ups for one application: the people the user is in touch with, a draft
 * for each kind of message, what was sent and when, and whether the employer has replied.
 * Kept as one document per application (document.kind = "follow_up"). RolePort never sends
 * anything: the user copies a draft or opens it in their own mail app.
 */

export const EMAIL_KINDS = ["application", "referral", "cold", "linkedin", "nudge_1", "nudge_2", "thank_you", "check_in", "offer_reply"] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

/** The follow-ups RolePort reminds the user about (the rest are sent when the user chooses). */
export const FOLLOW_UP_KINDS = ["nudge_1", "nudge_2", "thank_you", "check_in", "offer_reply"] as const satisfies readonly EmailKind[];
export type FollowUpKind = (typeof FOLLOW_UP_KINDS)[number];

export const EMAIL_INFO: Record<EmailKind, { label: string; short: string; description: string; group: "apply" | "follow_up" }> = {
  application: {
    label: "Application email",
    short: "Application",
    description: "Sends your application by email, with your CV and cover letter attached.",
    group: "apply",
  },
  referral: {
    label: "Referral request",
    short: "Referral",
    description: "Asks someone you know at the company to refer you or pass your CV on.",
    group: "apply",
  },
  cold: {
    label: "Note to the hiring manager",
    short: "Hiring manager",
    description: "A short, direct note to the person you'd work for, alongside your application.",
    group: "apply",
  },
  linkedin: {
    label: "LinkedIn note",
    short: "LinkedIn",
    description: "The same note, short enough for a LinkedIn connection request (300 characters).",
    group: "apply",
  },
  nudge_1: { label: "First follow-up", short: "Follow-up 1", description: "A polite check-in when there's been no reply.", group: "follow_up" },
  nudge_2: { label: "Second follow-up", short: "Follow-up 2", description: "A last, brief check-in. After this, move on.", group: "follow_up" },
  thank_you: { label: "Thank-you after the interview", short: "Thank you", description: "Sent within a day of the interview.", group: "follow_up" },
  check_in: {
    label: "Check-in after the interview",
    short: "Check-in",
    description: "When the date they gave you has passed with no news.",
    group: "follow_up",
  },
  offer_reply: { label: "Reply to the offer", short: "Offer reply", description: "Accept, ask for time, or negotiate, before their deadline.", group: "follow_up" },
};

/** LinkedIn's limit for a note with a connection request. */
export const LINKEDIN_LIMIT = 300;
export const MAX_CONTACTS = 20;
export const MAX_EMAIL_BODY = 6000;
export const MAX_TALKING_POINTS = 3000;

const text = (max: number, what: string) => z.string().trim().max(max, `${what} can be at most ${max} characters.`);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.")
  .nullable();

export const contactSchema = z.object({
  id: z.string().trim().min(1).max(60),
  name: text(120, "A name"),
  role: text(120, "A role"),
  email: text(160, "An email").refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "That email address doesn't look right."),
  linkedin: text(300, "A LinkedIn link"),
  notes: text(1000, "Notes"),
});
export type Contact = z.infer<typeof contactSchema>;

/** What the last AI draft said and what the app's own checks found. Cleared when the user edits the draft. */
export const emailReviewSchema = z.object({
  model: z.string(),
  at: z.string(),
  customPrompt: z.boolean(),
  /** The one point from the profile or the history the message leans on. */
  keyPoint: z.string(),
  notes: z.string(),
  warnings: z.array(z.string()),
});
export type EmailReview = z.infer<typeof emailReviewSchema>;

export const emailDraftSchema = z.object({
  /** The recipient's address (empty: the user fills it in their mail app). */
  to: text(160, "The address"),
  /** Who it's for, for the greeting. */
  toName: text(120, "The recipient's name"),
  subject: text(300, "The subject"),
  body: text(MAX_EMAIL_BODY, "The message"),
  review: emailReviewSchema.nullable(),
});
export type EmailDraft = z.infer<typeof emailDraftSchema>;

export const sentEntrySchema = z.object({ id: z.string(), kind: z.enum(EMAIL_KINDS), at: z.string(), to: z.string() });
export type SentEntry = z.infer<typeof sentEntrySchema>;

/** The parts of the document the user edits directly. Sent log and pause change through their own actions. */
export const outreachEditSchema = z.object({
  contacts: z.array(contactSchema).max(MAX_CONTACTS, `Keep it to ${MAX_CONTACTS} contacts per application.`),
  drafts: z.partialRecord(z.enum(EMAIL_KINDS), emailDraftSchema),
  /** "They said they'd get back to you by", YYYY-MM-DD. */
  replyBy: day,
  /** The offer's deadline, YYYY-MM-DD. */
  offerDeadline: day,
  /** What came up in the interview, for the thank-you and check-in. */
  talkingPoints: text(MAX_TALKING_POINTS, "What came up"),
  /** The attachments checklist, ticked by the user. */
  checklist: z.record(z.string().max(60), z.boolean()),
});
export type OutreachEdit = z.infer<typeof outreachEditSchema>;

export const outreachDocSchema = outreachEditSchema.extend({
  sent: z.array(sentEntrySchema),
  /** "Got a reply": follow-ups pause until the application moves to another status. */
  pause: z.object({ status: z.string(), at: z.string() }).nullable(),
});
export type OutreachDoc = z.infer<typeof outreachDocSchema>;

export const EMPTY_OUTREACH: OutreachDoc = {
  contacts: [],
  drafts: {},
  replyBy: null,
  offerDeadline: null,
  talkingPoints: "",
  checklist: {},
  sent: [],
  pause: null,
};

/** A stored document, or the empty one when it's missing or from an older shape. */
export function outreachOf(data: unknown): OutreachDoc {
  const parsed = outreachDocSchema.safeParse({ ...EMPTY_OUTREACH, ...(data && typeof data === "object" ? data : {}) });
  return parsed.success ? parsed.data : EMPTY_OUTREACH;
}

/** The draft as it would be pasted or opened in a mail app. */
export function mailtoHref(draft: Pick<EmailDraft, "to" | "subject" | "body">): string {
  const params = [`subject=${encodeURIComponent(draft.subject)}`, `body=${encodeURIComponent(draft.body)}`].join("&");
  return `mailto:${encodeURIComponent(draft.to).replace(/%40/g, "@")}?${params}`;
}

/** Some mail apps cut a mailto: link around 2,000 characters. */
export const MAILTO_LIMIT = 1900;

/** The subject line each kind starts with. The user can change it. */
export function defaultSubject(kind: EmailKind, { role, company, name }: { role: string; company: string; name: string }): string {
  const who = name ? ` – ${name}` : "";
  switch (kind) {
    case "application":
      return `Application: ${role}${who}`;
    case "referral":
      return `Would you refer me for the ${role} role at ${company}?`;
    case "cold":
      return `${role} at ${company}${who}`;
    case "linkedin":
      return "";
    case "nudge_1":
    case "nudge_2":
    case "check_in":
      return `Re: Application: ${role}${who}`;
    case "thank_you":
      return `Thank you – ${role} interview`;
    case "offer_reply":
      return `Re: Offer – ${role}`;
  }
}
