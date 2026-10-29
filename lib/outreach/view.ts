import type { FollowUpRules } from "./rules";
import { defaultSubject, EMAIL_INFO, type EmailDraft, type EmailKind, type OutreachDoc } from "./types";

/*
 * The emails page's data and the prompt it shows, with no database or AI imports, so the
 * browser builds the exact text a run would send (lib/ai/write-email.ts sends the same).
 */

export type OutreachPageData = {
  applicationId: string;
  role: string;
  company: string;
  status: string;
  appliedAt: string | null;
  interviewAt: string | null;
  offerAt: string | null;
  candidate: { name: string; email: string; phone: string; link: string | null };
  /** The application's own notes, which follow-ups may draw on. */
  notes: string;
  doc: OutreachDoc;
  rules: FollowUpRules;
  /** Email addresses written in the posting, to copy into a contact. */
  postingEmails: string[];
  attachments: { cv: "tailored" | "edited" | "none"; letter: boolean; asks: string[] };
  /** From the Interview Coach for this application, offered to the user for "what came up". */
  coachNotes: string | null;
  hasPosting: boolean;
  aiEnabled: boolean;
  profileEmpty: boolean;
  /** What the browser needs to show the exact prompt for any kind. */
  prompt: { system: string; candidate: string; posting: string | null; custom: boolean };
  /** Applied and interview dates as the prompt words them, so the browser builds the same text. */
  factDates: { appliedOn: string | null; interviewOn: string | null };
};

/** What the model is told about the application, as plain strings. */
export type EmailFacts = {
  role: string;
  company: string;
  status: string;
  appliedOn: string | null;
  interviewOn: string | null;
  replyBy: string | null;
  offerDeadline: string | null;
  sent: { label: string; on: string }[];
  /** The user's own notes on the application. */
  notes: string;
  /** What came up in the interview, as the user wrote it. */
  talkingPoints: string;
  recipient: { name: string; role: string } | null;
};

const STATUS_WORDS: Record<string, string> = {
  saved: "Saved, not applied yet",
  applied: "Applied, no reply yet",
  screening: "Screening",
  interview: "Interviewing",
  offer: "Offer received",
  hired: "Hired",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  offer_declined: "Offer declined",
  ghosted: "No response",
};

/** "Tue, October 21, 2026": dates as the prompt and the page word them. */
export const onDay = (d: Date | string) => new Date(d).toLocaleDateString("en", { weekday: "short", month: "long", day: "numeric", year: "numeric" });
const dayOf = (iso: string) => onDay(`${iso}T12:00:00`);

/** The facts block for one message, from the page data and the draft's recipient. */
export function emailFacts(data: Pick<OutreachPageData, "role" | "company" | "status" | "factDates" | "doc" | "notes">, draft: Pick<EmailDraft, "to" | "toName"> | undefined): EmailFacts {
  const contact = draft && data.doc.contacts.find((c) => (draft.to && c.email === draft.to) || (draft.toName && c.name === draft.toName));
  const name = draft?.toName || contact?.name || "";
  return {
    role: data.role,
    company: data.company,
    status: STATUS_WORDS[data.status] ?? data.status,
    appliedOn: data.factDates.appliedOn,
    interviewOn: data.factDates.interviewOn,
    replyBy: data.doc.replyBy && dayOf(data.doc.replyBy),
    offerDeadline: data.doc.offerDeadline && dayOf(data.doc.offerDeadline),
    sent: data.doc.sent.map((s) => ({ label: EMAIL_INFO[s.kind].label, on: onDay(s.at) })),
    notes: data.notes,
    talkingPoints: data.doc.talkingPoints,
    recipient: name || contact ? { name, role: contact?.role ?? "" } : null,
  };
}

const scrub = (s: string) => s.replace(/<\/?\s*(application|job_posting|candidate_profile)\s*>/gi, " ");

/** The application block, inside <application> tags. Its numbers count as backed in the checks. */
export function applicationBlock(f: EmailFacts): string {
  const lines = [
    `Role: ${f.role}`,
    `Company: ${f.company}`,
    `Status: ${f.status}`,
    f.appliedOn && `Applied on: ${f.appliedOn}`,
    f.interviewOn && `Interview: ${f.interviewOn}`,
    f.replyBy && `They said they'd reply by: ${f.replyBy}`,
    f.offerDeadline && `Offer deadline: ${f.offerDeadline}`,
    f.sent.length ? `Already sent:\n${f.sent.map((s) => `- ${s.label}, ${s.on}`).join("\n")}` : "Already sent: nothing yet",
    f.recipient && `Writing to: ${f.recipient.name || "(name unknown)"}${f.recipient.role ? `, ${f.recipient.role}` : ""}`,
    f.talkingPoints.trim() && `What came up (from the candidate):\n${scrub(f.talkingPoints.trim())}`,
    f.notes.trim() && `Candidate's notes on this application:\n${scrub(f.notes.trim()).slice(0, 2000)}`,
  ];
  return lines.filter(Boolean).join("\n");
}

export type EmailPromptInput = {
  /** The candidate block (name, profile and CV), as the other prompts send it. */
  candidate: string;
  /** The posting block, or null when it isn't stored anymore. */
  posting: string | null;
  facts: EmailFacts;
  kind: EmailKind;
};

/** The user message of an email run, shown to the user as-is on the email page. */
export function buildEmailPrompt({ candidate, posting, facts, kind }: EmailPromptInput): string {
  return [
    "<candidate_profile>",
    candidate,
    "</candidate_profile>",
    "",
    ...(posting ? ["<job_posting>", posting, "</job_posting>", ""] : []),
    "<application>",
    applicationBlock(facts),
    "</application>",
    "",
    `Write the "${kind}" message (${EMAIL_INFO[kind].label}: ${EMAIL_INFO[kind].description}) for this candidate. Reply with the JSON object only.`,
  ].join("\n");
}

/** The user message a run of this kind would send now. */
export function emailPromptFor(data: OutreachPageData, kind: EmailKind, draft: EmailDraft | undefined): string {
  return buildEmailPrompt({ candidate: data.prompt.candidate, posting: data.prompt.posting, facts: emailFacts(data, draft), kind });
}

/** The candidate's sign-off: name, then phone and one link if they have them. Never on a LinkedIn note. */
export function signature({ name, phone, link }: { name: string; phone: string; link: string | null }): string {
  return ["Kind regards,", name, phone, link].filter(Boolean).join("\n");
}

/** A draft to start from: the subject for its kind and the recipient the user picked last. */
export function blankDraft(kind: EmailKind, data: Pick<OutreachPageData, "role" | "company" | "candidate" | "doc">): EmailDraft {
  const recent = Object.values(data.doc.drafts).find((d) => d?.to || d?.toName);
  const first = data.doc.contacts[0];
  return {
    to: recent?.to ?? first?.email ?? "",
    toName: recent?.toName ?? first?.name ?? "",
    subject: defaultSubject(kind, { role: data.role, company: data.company, name: data.candidate.name }),
    body: "",
    review: null,
  };
}
