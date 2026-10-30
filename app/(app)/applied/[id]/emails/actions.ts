"use server";

import { refresh } from "next/cache";
import { AiUnavailableError } from "@/lib/ai/client";
import { getAiConfig, isAiConfigured } from "@/lib/ai/config";
import { MAX_EMAIL_PROMPT } from "@/lib/ai/email-prompt";
import { aiErrorMessage } from "@/lib/ai/errors";
import { getDb } from "@/lib/db";
import { draftOutreachEmail, markOutreachSent, readOutreachPage, saveOutreachEdit, setOutreachPaused, unmarkOutreachSent } from "@/lib/outreach/outreach";
import { followUpRulesSchema, type FollowUpRules } from "@/lib/outreach/rules";
import { EMAIL_KINDS, outreachEditSchema, type EmailDraft, type EmailKind, type OutreachEdit } from "@/lib/outreach/types";
import type { OutreachPageData } from "@/lib/outreach/view";
import type { Result } from "@/lib/result";
import { getCurrentUser } from "@/lib/session";
import { writeSettings } from "@/lib/settings/queries";

export type DraftEmailResult = Result<EmailDraft> & { needsSetup?: boolean };

const isKind = (kind: unknown): kind is EmailKind => EMAIL_KINDS.includes(kind as EmailKind);

/** Save the contacts, drafts, dates and checklist as the user left them. */
export async function saveOutreach(applicationId: string, edit: OutreachEdit): Promise<Result> {
  const parsed = outreachEditSchema.safeParse(edit);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Some fields are too long." };
  const user = await getCurrentUser();
  if (!(await saveOutreachEdit(await getDb(), user, applicationId, parsed.data))) return { ok: false, error: "Application not found." };
  return { ok: true, data: undefined };
}

/** Draft one message with the user's AI provider. Local models can take a minute or two. */
export async function draftEmail(applicationId: string, kind: EmailKind): Promise<DraftEmailResult> {
  if (!isKind(kind)) return { ok: false, error: "Unknown kind of email." };
  const user = await getCurrentUser();
  const config = await getAiConfig();
  if (!config) return { ok: false, error: new AiUnavailableError().message, needsSetup: true };
  try {
    return { ok: true, data: await draftOutreachEmail(await getDb(), user, applicationId, kind, config) };
  } catch (error) {
    console.error("[email] drafting failed", error);
    return { ok: false, error: aiErrorMessage(error, "Writing the email failed. Please try again.") };
  }
}

/** "Mark as sent"; returns the page as it is now, with the message in Sent and the next follow-up. */
export async function markEmailSent(applicationId: string, kind: EmailKind): Promise<Result<OutreachPageData>> {
  if (!isKind(kind)) return { ok: false, error: "Unknown kind of email." };
  const user = await getCurrentUser();
  const db = await getDb();
  const done = await markOutreachSent(db, user, applicationId, kind);
  const page = done && (await readOutreachPage(db, user, applicationId, await isAiConfigured()));
  if (!page) return { ok: false, error: "Application not found." };
  refresh();
  return { ok: true, data: page };
}

/** Undo "Mark as sent" for one message; it goes back to drafts. */
export async function unmarkEmailSent(applicationId: string, sentId: string): Promise<Result<OutreachPageData>> {
  const user = await getCurrentUser();
  const db = await getDb();
  const done = await unmarkOutreachSent(db, user, applicationId, sentId);
  const page = done && (await readOutreachPage(db, user, applicationId, await isAiConfigured()));
  if (!page) return { ok: false, error: "Application not found." };
  refresh();
  return { ok: true, data: page };
}

/** "Got a reply" pauses the follow-ups; `false` resumes them. */
export async function setFollowUpsPaused(applicationId: string, paused: boolean): Promise<Result<OutreachPageData>> {
  const user = await getCurrentUser();
  const db = await getDb();
  const done = await setOutreachPaused(db, user, applicationId, paused === true);
  const page = done && (await readOutreachPage(db, user, applicationId, await isAiConfigured()));
  if (!page) return { ok: false, error: "Application not found." };
  refresh();
  return { ok: true, data: page };
}

/** Save the user's own email instructions; null or blank goes back to the default. */
export async function saveEmailPrompt(prompt: string | null): Promise<Result> {
  if (prompt != null && (typeof prompt !== "string" || prompt.length > MAX_EMAIL_PROMPT)) {
    return { ok: false, error: `Keep the prompt under ${MAX_EMAIL_PROMPT} characters.` };
  }
  const user = await getCurrentUser();
  await writeSettings(await getDb(), user.id, { emailPrompt: prompt?.trim() || null });
  refresh();
  return { ok: true, data: undefined };
}

/** Save when follow-ups come due; null goes back to the defaults. */
export async function saveFollowUpRules(rules: FollowUpRules | null): Promise<Result> {
  const parsed = rules === null ? null : followUpRulesSchema.safeParse(rules);
  if (parsed && !parsed.success) return { ok: false, error: "Use whole numbers in the ranges shown." };
  const user = await getCurrentUser();
  await writeSettings(await getDb(), user.id, { followUpRules: parsed ? parsed.data : null });
  refresh();
  return { ok: true, data: undefined };
}
