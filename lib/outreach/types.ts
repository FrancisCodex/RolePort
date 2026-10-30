import { z } from "zod";

/*
 * Emails and follow-ups for one application: the people the user is in touch with, a draft
 * for each kind of message, what was sent and when, and whether the employer has replied.
 * Kept as one document per application (document.kind = "follow_up"). RolePort never sends
 * anything: the user copies a draft or opens it in their own mail app.
 */

export const EMAIL_KINDS = [
  "application",
  "referral",
  "cold",
  "linkedin",
  "nudge_1",
  "nudge_2",
  "thank_you",
  "check_in",
  "other_follow_up",
  "offer_reply",
  "withdraw",
  "cancel_interview",
  "decline_offer",
  "reply_rejection",
] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

/** The follow-ups RolePort reminds the user about (the rest are sent when the user chooses). */
export const FOLLOW_UP_KINDS = ["nudge_1", "nudge_2", "thank_you", "check_in", "offer_reply"] as const satisfies readonly EmailKind[];
export type FollowUpKind = (typeof FOLLOW_UP_KINDS)[number];

export const EMAIL_INFO: Record<EmailKind, { label: string; short: string; description: string; group: "apply" | "follow_up" | "close" }> = {
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
  other_follow_up: {
    label: "Follow-up for another reason",
    short: "Other reason",
    description: "Any time you need to reach them: confirm or move an interview, ask a question, share something new.",
    group: "follow_up",
  },
  offer_reply: { label: "Reply to the offer", short: "Offer reply", description: "Accept, ask for time, or negotiate, before their deadline.", group: "follow_up" },
  withdraw: { label: "Withdraw my application", short: "Withdraw", description: "Politely take yourself out of the running.", group: "close" },
  cancel_interview: { label: "Cancel the interview", short: "Cancel interview", description: "Tell them you won't be attending, as early as you can.", group: "close" },
  decline_offer: { label: "Decline the offer", short: "Decline offer", description: "Say no to an offer and leave on good terms.", group: "close" },
  reply_rejection: { label: "Reply to a rejection", short: "Rejection reply", description: "Thank them, ask for feedback, or ask them to keep you in mind.", group: "close" },
};

/** Why a message is being sent. `ask` is what the model is told to do. */
export const EMAIL_REASONS = {
  application_status: { label: "Where my application stands", ask: "Ask where the application stands." },
  timeline: { label: "When they expect to decide", ask: "Ask when they expect to make a decision or what the timeline is." },
  interview_confirm: { label: "Confirming an upcoming interview", ask: "Confirm the interview, using its date and time from the application if given, and say they look forward to it." },
  interview_details: { label: "Asking about the interview", ask: "Ask for the practical details of the interview: the format, who they'll meet, how to join or prepare." },
  interview_reschedule: { label: "Asking to move the interview", ask: "Ask to move the interview, apologise briefly and offer to work around their schedule. Only propose times the candidate gave." },
  after_interview: { label: "Next steps after the interview", ask: "Ask about the next steps after the interview." },
  new_info: { label: "Sharing something new", ask: "Share the news in the candidate's details and tie it to the role in one line." },
  other_offer: { label: "I accepted another offer", ask: "Say they've accepted another offer. Don't name the employer unless the details do." },
  not_fit: { label: "The role isn't the right fit", ask: "Say that after thinking it over the role isn't the right fit, without criticising the company or role." },
  pay: { label: "The pay or terms don't work", ask: "Say the pay or terms don't work for them, politely and without negotiating." },
  location: { label: "The location or work setup doesn't work", ask: "Say the location or work setup doesn't work for them." },
  personal: { label: "Personal reasons", ask: "Say it's for personal reasons and share nothing more." },
  timing: { label: "The timing doesn't work", ask: "Say the timing doesn't work for them right now." },
  private: { label: "I'd rather not say", ask: "Give no reason at all. Don't hint at one." },
  thanks: { label: "Just to say thank you", ask: "Thank them for their time and the chance to interview or apply. Ask for nothing." },
  feedback: { label: "Asking for feedback", ask: "Thank them and ask for brief feedback on what they could improve." },
  future: { label: "Asking them to keep me in mind", ask: "Thank them and ask to be kept in mind for future roles." },
  other: { label: "Something else", ask: "Write what the candidate's details say." },
} as const satisfies Record<string, { label: string; ask: string }>;
export type EmailReason = keyof typeof EMAIL_REASONS;

const LEAVING: EmailReason[] = ["other_offer", "not_fit", "pay", "location", "personal", "timing", "private", "other"];

/** The reasons each kind offers, the usual one first. Kinds with one purpose have none. */
export const KIND_REASONS: Partial<Record<EmailKind, EmailReason[]>> = {
  nudge_1: ["application_status", "timeline", "new_info", "other"],
  nudge_2: ["application_status", "timeline", "new_info", "other"],
  check_in: ["after_interview", "timeline", "new_info", "other"],
  other_follow_up: ["interview_confirm", "interview_details", "interview_reschedule", "application_status", "timeline", "after_interview", "new_info", "other"],
  withdraw: LEAVING,
  cancel_interview: LEAVING,
  decline_offer: LEAVING,
  reply_rejection: ["thanks", "feedback", "future", "other"],
};

/** Where a closing message leaves the application once it's marked as sent. */
export const CLOSING_STATUS: Partial<Record<EmailKind, "withdrawn" | "offer_declined">> = {
  withdraw: "withdrawn",
  cancel_interview: "withdrawn",
  decline_offer: "offer_declined",
};

/** LinkedIn's limit for a note with a connection request. */
export const LINKEDIN_LIMIT = 300;
export const MAX_CONTACTS = 20;
export const MAX_EMAIL_BODY = 6000;
export const MAX_TALKING_POINTS = 3000;
export const MAX_REASON_DETAIL = 1000;

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
  /** Why it's being sent (EMAIL_REASONS); empty for kinds with one purpose, or the kind's usual reason. */
  reason: z.string().max(40).default(""),
  /** The candidate's own words on the reason. Only this and the reason's label go to the model. */
  reasonDetail: text(MAX_REASON_DETAIL, "The details").default(""),
  review: emailReviewSchema.nullable(),
});
export type EmailDraft = z.infer<typeof emailDraftSchema>;

export const sentEntrySchema = z.object({
  id: z.string(),
  kind: z.enum(EMAIL_KINDS),
  at: z.string(),
  to: z.string(),
  /** A copy of the message as it was sent; empty on entries from before copies were kept. */
  toName: z.string().default(""),
  subject: z.string().default(""),
  body: z.string().default(""),
  reason: z.string().default(""),
  /** What a closing message changed, so "Not sent" can put it back. */
  undo: z.object({ status: z.string(), interviewAt: z.string().nullable() }).optional(),
});
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

const query = (params: Record<string, string>) => new URLSearchParams(params).toString().replace(/\+/g, "%20");

/** Gmail's compose screen in the browser, filled in. */
export function gmailHref(draft: Pick<EmailDraft, "to" | "subject" | "body">): string {
  return `https://mail.google.com/mail/?${query({ view: "cm", fs: "1", to: draft.to, su: draft.subject, body: draft.body })}`;
}

/** Outlook's compose screen in the browser, filled in. */
export function outlookHref(draft: Pick<EmailDraft, "to" | "subject" | "body">): string {
  return `https://outlook.live.com/mail/0/deeplink/compose?${query({ to: draft.to, subject: draft.subject, body: draft.body })}`;
}

/** Some mail apps cut a mailto: link around 2,000 characters. */
export const MAILTO_LIMIT = 1900;

/** The subject line each kind starts with, for its reason. The user can change it. */
export function defaultSubject(kind: EmailKind, { role, company, name }: { role: string; company: string; name: string }, reason?: string): string {
  const who = name ? ` – ${name}` : "";
  if (reason === "interview_confirm" || reason === "interview_details") return `Interview for ${role}${who}`;
  if (reason === "interview_reschedule") return `Rescheduling my interview: ${role}${who}`;
  switch (kind) {
    case "other_follow_up":
    case "reply_rejection":
      return `Re: Application: ${role}${who}`;
    case "withdraw":
      return `Withdrawing my application: ${role}${who}`;
    case "cancel_interview":
      return `Cancelling my interview: ${role}${who}`;
    case "decline_offer":
      return `Re: Offer – ${role}`;
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
