import { and, desc, eq } from "drizzle-orm";
import { jobBlock } from "@/lib/ai/evaluate-job";
import { emailSystemPrompt } from "@/lib/ai/email-prompt";
import { describeAiConfig, type AiConfig } from "@/lib/ai/settings";
import { candidateBlock, sourceOf } from "@/lib/ai/tailor-cv";
import { writeEmail } from "@/lib/ai/write-email";
import * as schema from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { readAppDocument, writeAppDocument } from "@/lib/documents/queries";
import { readApplication, setStatus, writeInterviewDate, type ApplicationDetail, type ApplicationStatus } from "@/lib/jobs/applications";
import { evaluationJobOf } from "@/lib/jobs/fit-evaluation";
import { readCvText, readProfile } from "@/lib/profile/queries";
import type { ProfileInput } from "@/lib/profile/schema";
import { followUpLabel, nextFollowUp, rulesOf, type FollowUpRules } from "./rules";
import { CLOSING_STATUS, EMAIL_INFO, outreachOf, type EmailDraft, type EmailKind, type OutreachDoc, type OutreachEdit, type SentEntry } from "./types";
import { applicationBlock, blankDraft, emailFacts, onDay, signature, type OutreachPageData } from "./view";

/*
 * The emails-and-follow-ups page's data and its writes, shared by the server (actions, page)
 * and the lite edition's browser database. One document per application (kind "follow_up").
 * No auth here: callers pass the user.
 */

type User = { id: string; name: string };

const KIND = "follow_up";

/** Things a posting often asks to be sent along, found by their wording. */
const ASKS: { label: string; pattern: RegExp }[] = [
  { label: "Portfolio", pattern: /\bportfolio\b/i },
  { label: "References", pattern: /\b(references|referees)\b/i },
  { label: "Transcript of records", pattern: /\btranscripts?\b/i },
  { label: "Writing or work samples", pattern: /\b(writing|work|code) samples?\b/i },
  { label: "Certificates", pattern: /\bcertificates?\b/i },
  { label: "Diploma", pattern: /\bdiploma\b/i },
  { label: "NBI clearance", pattern: /\bNBI\b/ },
];

const EMAIL_IN_TEXT = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export type { OutreachPageData };

async function readDoc(db: AnyDb, userId: string, applicationId: string): Promise<OutreachDoc> {
  const saved = await readAppDocument<unknown>(db, userId, applicationId, KIND);
  return outreachOf(saved?.data);
}

async function writeDoc(db: AnyDb, userId: string, application: Pick<ApplicationDetail, "id" | "role" | "company">, doc: OutreachDoc) {
  await writeAppDocument(db, userId, application.id, KIND, `Emails and follow-ups for ${application.role} at ${application.company}`, doc);
}

export async function readEmailPrompt(db: AnyDb, userId: string): Promise<{ prompt: string | null; rules: FollowUpRules }> {
  const [row] = await db
    .select({ prompt: schema.userSettings.emailPrompt, rules: schema.userSettings.followUpRules })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId));
  return { prompt: row?.prompt ?? null, rules: rulesOf(row?.rules) };
}

const offerAtOf = (app: ApplicationDetail) => app.events.findLast((e) => e.status === "offer")?.occurredAt ?? null;

const firstLink = (profile: ProfileInput) => profile.links.find((l) => /linkedin\.com/i.test(l)) ?? profile.links[0] ?? null;

async function inputs(db: AnyDb, user: User, applicationId: string) {
  const application = await readApplication(db, user.id, applicationId);
  if (!application) return null;
  const [{ profile }, cvText, doc, settings, cv, letter, [coach]] = await Promise.all([
    readProfile(db, user),
    readCvText(db, user.id),
    readDoc(db, user.id, applicationId),
    readEmailPrompt(db, user.id),
    readAppDocument<{ tailoring?: unknown }>(db, user.id, applicationId, "cv"),
    readAppDocument<{ content?: { body?: string } }>(db, user.id, applicationId, "cover_letter"),
    db
      .select({ briefing: schema.interviewSession.briefing, report: schema.interviewSession.report })
      .from(schema.interviewSession)
      .where(and(eq(schema.interviewSession.userId, user.id), eq(schema.interviewSession.applicationId, applicationId)))
      .orderBy(desc(schema.interviewSession.createdAt))
      .limit(1),
  ]);
  const job = application.job ? evaluationJobOf(application.job) : null;
  return { application, profile, cvText, doc, settings, cv, letter, coach, job };
}

export async function readOutreachPage(db: AnyDb, user: User, applicationId: string, aiEnabled: boolean): Promise<OutreachPageData | null> {
  const found = await inputs(db, user, applicationId);
  return found && pageOf(found, aiEnabled);
}

function pageOf(found: NonNullable<Awaited<ReturnType<typeof inputs>>>, aiEnabled: boolean): OutreachPageData {
  const { application, profile, cvText, doc, settings, cv, letter, coach, job } = found;
  const description = job?.description ?? "";
  const coachLines = [
    ...(coach?.briefing?.mustHaves.map((m) => `They're looking for: ${m}`) ?? []),
    ...(coach?.report?.summary?.strengths.map((s) => `You did well in practice: ${s}`) ?? []),
  ];
  return {
    applicationId: application.id,
    role: application.role,
    company: application.company,
    status: application.status,
    appliedAt: application.appliedAt?.toISOString() ?? null,
    interviewAt: application.interviewAt?.toISOString() ?? null,
    offerAt: offerAtOf(application)?.toISOString() ?? null,
    candidate: { name: profile.name, email: profile.email, phone: profile.phone, link: firstLink(profile) },
    notes: application.notes ?? "",
    doc,
    rules: settings.rules,
    postingEmails: [...new Set(description.match(EMAIL_IN_TEXT) ?? [])].slice(0, 5),
    attachments: {
      cv: cv?.data.tailoring ? "tailored" : cv ? "edited" : "none",
      letter: Boolean(letter?.data.content?.body?.trim()),
      asks: ASKS.filter((a) => a.pattern.test(description)).map((a) => a.label),
    },
    coachNotes: coachLines.length ? coachLines.slice(0, 8).join("\n") : null,
    hasPosting: Boolean(job),
    aiEnabled,
    profileEmpty: profile.experience.length === 0 && profile.skills.length === 0 && !cvText,
    prompt: {
      system: emailSystemPrompt(settings.prompt),
      candidate: [`Name: ${profile.name}`, candidateBlock(profile, cvText)].join("\n"),
      posting: job ? jobBlock(job) : null,
      custom: Boolean(settings.prompt),
    },
    factDates: {
      appliedOn: application.appliedAt ? onDay(application.appliedAt) : null,
      interviewOn: application.interviewAt ? onDay(application.interviewAt) : null,
    },
  };
}

/** Save what the user edited (contacts, drafts, dates, notes, checklist). False if the application isn't theirs. */
export async function saveOutreachEdit(db: AnyDb, user: User, applicationId: string, edit: OutreachEdit): Promise<boolean> {
  const application = await readApplication(db, user.id, applicationId);
  if (!application) return false;
  const doc = await readDoc(db, user.id, applicationId);
  await writeDoc(db, user.id, application, { ...doc, ...edit });
  return true;
}

/** Draft one message with AI, keep the user's recipient and subject, and save it. */
export async function draftOutreachEmail(db: AnyDb, user: User, applicationId: string, kind: EmailKind, config: AiConfig): Promise<EmailDraft> {
  const found = await inputs(db, user, applicationId);
  if (!found) throw new Error("Application not found.");
  const { application, profile, cvText, doc, settings, job } = found;
  const page = pageOf(found, true);

  const draft = doc.drafts[kind] ?? blankDraft(kind, page);
  const facts = emailFacts(page, draft, kind);
  const result = await writeEmail(
    {
      candidate: page.prompt.candidate,
      posting: job ? page.prompt.posting : null,
      facts,
      kind,
      customPrompt: settings.prompt,
      signOff: signature(page.candidate),
      source: [sourceOf(profile, cvText), applicationBlock(facts)].join("\n"),
    },
    config,
  );
  const next: EmailDraft = {
    ...draft,
    body: result.body,
    review: {
      model: describeAiConfig(config),
      at: new Date().toISOString(),
      customPrompt: Boolean(settings.prompt),
      keyPoint: result.keyPoint,
      notes: result.notes,
      warnings: result.warnings,
    },
  };
  // Re-read: the user may have edited other drafts while the model was writing.
  const latest = await readDoc(db, user.id, applicationId);
  await writeDoc(db, user.id, application, { ...latest, drafts: { ...latest.drafts, [kind]: next } });
  return next;
}

/**
 * "Mark as sent": log it, note it in the status history and count it as contact. Sending the
 * application email moves a saved job to applied. A closing message moves the application to
 * withdrawn or offer declined, which ends its follow-ups, and cancelling an interview clears
 * its date; the sent entry remembers both so "Not sent" can restore them.
 */
export async function markOutreachSent(db: AnyDb, user: User, applicationId: string, kind: EmailKind): Promise<boolean> {
  const application = await readApplication(db, user.id, applicationId);
  if (!application) return false;
  const doc = await readDoc(db, user.id, applicationId);
  const now = new Date();
  const draft = doc.drafts[kind];

  const moved = kind === "application" && application.status === "saved" ? "applied" : CLOSING_STATUS[kind];
  const status = moved ?? application.status;
  const interviewAt = application.interviewAt?.toISOString() ?? null;
  const clearsInterview = kind === "cancel_interview" && interviewAt !== null;
  const undo = CLOSING_STATUS[kind] && (status !== application.status || clearsInterview) ? { status: application.status, interviewAt } : undefined;

  if (moved) await setStatus(db, user.id, applicationId, moved);
  if (clearsInterview) await writeInterviewDate(db, user.id, applicationId, null);

  // The message moves from drafts to sent, so the same kind can be written again.
  const entry: SentEntry = {
    id: crypto.randomUUID(),
    kind,
    at: now.toISOString(),
    to: draft?.to ?? "",
    toName: draft?.toName ?? "",
    subject: draft?.subject ?? "",
    body: draft?.body ?? "",
    reason: draft?.reason ?? "",
    ...(undo && { undo }),
  };
  const drafts = Object.fromEntries(Object.entries(doc.drafts).filter(([k]) => k !== kind));
  await writeDoc(db, user.id, application, { ...doc, drafts, sent: [...doc.sent, entry] });
  await db.insert(schema.applicationEvent).values({ applicationId, status, note: `Sent: ${EMAIL_INFO[kind].label}`, occurredAt: now });
  await db
    .update(schema.application)
    .set({
      lastContactAt: now,
      followUpCount: application.followUpCount + (EMAIL_INFO[kind].group === "follow_up" ? 1 : 0),
    })
    .where(eq(schema.application.id, applicationId));
  await syncNextFollowUp(db, user.id, applicationId);
  return true;
}

/** Undo a "Mark as sent" (a misclick): the message goes back to drafts. Its history entry stays, marked as undone. */
export async function unmarkOutreachSent(db: AnyDb, user: User, applicationId: string, sentId: string): Promise<boolean> {
  const application = await readApplication(db, user.id, applicationId);
  if (!application) return false;
  const doc = await readDoc(db, user.id, applicationId);
  const entry = doc.sent.find((s) => s.id === sentId);
  if (!entry) return true;
  const { kind, to, toName, subject, body, reason, undo } = entry;
  // A newer draft of this kind is the user's work: keep it rather than overwrite it.
  const drafts = doc.drafts[kind]?.body.trim() ? doc.drafts : { ...doc.drafts, [kind]: { to, toName, subject, body, reason, reasonDetail: "", review: null } };
  await writeDoc(db, user.id, application, { ...doc, drafts, sent: doc.sent.filter((s) => s.id !== sentId) });
  if (undo) {
    await setStatus(db, user.id, applicationId, undo.status as ApplicationStatus);
    if (undo.interviewAt) await writeInterviewDate(db, user.id, applicationId, new Date(undo.interviewAt));
  }
  await db
    .insert(schema.applicationEvent)
    .values({ applicationId, status: (undo?.status as ApplicationStatus) ?? application.status, note: `Not sent after all: ${EMAIL_INFO[kind].label}` });
  await syncNextFollowUp(db, user.id, applicationId);
  return true;
}

/** "Got a reply" pauses every follow-up until the application moves on; `false` resumes them. */
export async function setOutreachPaused(db: AnyDb, user: User, applicationId: string, paused: boolean): Promise<boolean> {
  const application = await readApplication(db, user.id, applicationId);
  if (!application) return false;
  const doc = await readDoc(db, user.id, applicationId);
  const now = new Date();
  await writeDoc(db, user.id, application, { ...doc, pause: paused ? { status: application.status, at: now.toISOString() } : null });
  if (paused) {
    await db.insert(schema.applicationEvent).values({ applicationId, status: application.status, note: "Got a reply", occurredAt: now });
    await db.update(schema.application).set({ lastContactAt: now }).where(eq(schema.application.id, applicationId));
  }
  await syncNextFollowUp(db, user.id, applicationId);
  return true;
}

/** The application with its follow-up document and the next follow-up, or null if it isn't the user's. */
async function withNext(db: AnyDb, userId: string, applicationId: string) {
  const application = await readApplication(db, userId, applicationId);
  if (!application) return null;
  const [doc, { rules }] = await Promise.all([readDoc(db, userId, applicationId), readEmailPrompt(db, userId)]);
  const next = nextFollowUp(
    { status: application.status, appliedAt: application.appliedAt, interviewAt: application.interviewAt, offerAt: offerAtOf(application), doc },
    rules,
  );
  return { application, doc, next };
}

/** Keep application.next_follow_up_at in step, for anything that reads the table directly. */
async function syncNextFollowUp(db: AnyDb, userId: string, applicationId: string) {
  const found = await withNext(db, userId, applicationId);
  if (!found) return;
  const { next } = found;
  await db
    .update(schema.application)
    .set({ nextFollowUpAt: next?.dueAt ?? null })
    .where(eq(schema.application.id, applicationId));
}

export type OutreachSummary = {
  next: { kind: EmailKind; label: string; when: string; due: boolean } | null;
  paused: boolean;
  sent: number;
  lastSent: { label: string; on: string } | null;
};

/** The application page's row: what's been sent and the next follow-up. */
export async function readOutreachSummary(db: AnyDb, userId: string, applicationId: string): Promise<OutreachSummary | null> {
  const found = await withNext(db, userId, applicationId);
  if (!found) return null;
  const { application, doc, next } = found;
  const label = next && followUpLabel(next);
  const last = doc.sent.at(-1);
  return {
    next: next && label && { kind: next.kind, label: EMAIL_INFO[next.kind].label, when: label.text, due: label.due },
    paused: doc.pause !== null && doc.pause.status === application.status,
    sent: doc.sent.length,
    lastSent: last ? { label: EMAIL_INFO[last.kind].label, on: onDay(last.at) } : null,
  };
}

/** Every application's follow-up document, by application id, for the dashboard. */
export async function readOutreachDocs(db: AnyDb, userId: string): Promise<Map<string, OutreachDoc>> {
  const rows = await db
    .select({ applicationId: schema.document.applicationId, content: schema.document.content })
    .from(schema.document)
    .where(and(eq(schema.document.userId, userId), eq(schema.document.kind, KIND)));
  return new Map(rows.flatMap((r) => (r.applicationId ? [[r.applicationId, outreachOf(r.content)] as const] : [])));
}
