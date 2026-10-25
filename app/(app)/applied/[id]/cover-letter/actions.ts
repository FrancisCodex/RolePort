"use server";

import { refresh } from "next/cache";
import { AiUnavailableError } from "@/lib/ai/client";
import { getAiConfig } from "@/lib/ai/config";
import { aiErrorMessage } from "@/lib/ai/errors";
import { MAX_LETTER_PROMPT } from "@/lib/ai/letter-prompt";
import { getDb } from "@/lib/db";
import { discardApplicationLetter, draftApplicationLetter, saveEditedLetter } from "@/lib/letter/letter";
import { letterContentSchema, type LetterContent, type LetterReview } from "@/lib/letter/types";
import type { Result } from "@/lib/result";
import { getCurrentUser } from "@/lib/session";
import { writeSettings } from "@/lib/settings/queries";

export type DraftLetterResult = Result<{ content: LetterContent; review: LetterReview }> & { needsSetup?: boolean };

/** Draft the application's cover letter with the user's AI provider. Local models can take a few minutes. */
export async function draftLetter(applicationId: string): Promise<DraftLetterResult> {
  const user = await getCurrentUser();
  const config = await getAiConfig();
  if (!config) return { ok: false, error: new AiUnavailableError().message, needsSetup: true };
  try {
    const data = await draftApplicationLetter(await getDb(), user, applicationId, config);
    return { ok: true, data };
  } catch (error) {
    console.error("[letter] drafting failed", error);
    return { ok: false, error: aiErrorMessage(error, "Writing the letter failed. Please try again.") };
  }
}

export async function saveLetter(applicationId: string, content: LetterContent): Promise<Result> {
  const parsed = letterContentSchema.safeParse(content);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Some fields are too long." };
  const user = await getCurrentUser();
  if (!(await saveEditedLetter(await getDb(), user, applicationId, parsed.data))) return { ok: false, error: "Application not found." };
  return { ok: true, data: undefined };
}

/** Start the letter over; returns the blank one with the sender and recipient filled in. */
export async function discardLetter(applicationId: string): Promise<Result<LetterContent>> {
  const user = await getCurrentUser();
  const content = await discardApplicationLetter(await getDb(), user, applicationId);
  if (!content) return { ok: false, error: "Application not found." };
  return { ok: true, data: content };
}

/** Save the user's own cover letter instructions; null or blank goes back to the default. */
export async function saveLetterPrompt(prompt: string | null): Promise<Result> {
  if (prompt != null && (typeof prompt !== "string" || prompt.length > MAX_LETTER_PROMPT)) {
    return { ok: false, error: `Keep the prompt under ${MAX_LETTER_PROMPT} characters.` };
  }
  const user = await getCurrentUser();
  await writeSettings(await getDb(), user.id, { coverLetterPrompt: prompt?.trim() || null });
  refresh();
  return { ok: true, data: undefined };
}
