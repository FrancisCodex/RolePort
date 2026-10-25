"use server";

import { refresh } from "next/cache";
import { AiUnavailableError } from "@/lib/ai/client";
import { getAiConfig } from "@/lib/ai/config";
import { MAX_CV_PROMPT } from "@/lib/ai/cv-prompt";
import { aiErrorMessage } from "@/lib/ai/errors";
import { discardApplicationCv, saveEditedCv, tailorApplicationCv } from "@/lib/cv/tailor";
import { cvContentSchema, type CvContent, type CvTailoring } from "@/lib/cv/types";
import { getDb } from "@/lib/db";
import type { Result } from "@/lib/result";
import { getCurrentUser } from "@/lib/session";
import { writeSettings } from "@/lib/settings/queries";

export type TailorResult = Result<{ content: CvContent; tailoring: CvTailoring }> & { needsSetup?: boolean };

/** Tailor an application's CV to its posting with the user's AI provider. Local models can take a few minutes. */
export async function tailorCv(applicationId: string): Promise<TailorResult> {
  const user = await getCurrentUser();
  const config = await getAiConfig();
  if (!config) return { ok: false, error: new AiUnavailableError().message, needsSetup: true };
  try {
    const data = await tailorApplicationCv(await getDb(), user, applicationId, config);
    refresh();
    return { ok: true, data };
  } catch (error) {
    console.error("[cv] tailoring failed", error);
    return { ok: false, error: aiErrorMessage(error, "Tailoring failed. Please try again.") };
  }
}

export async function saveCv(applicationId: string, content: CvContent): Promise<Result> {
  const parsed = cvContentSchema.safeParse(content);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Some fields are too long." };
  const user = await getCurrentUser();
  if (!(await saveEditedCv(await getDb(), user.id, applicationId, parsed.data))) return { ok: false, error: "Application not found." };
  return { ok: true, data: undefined };
}

/** Start the CV over from the profile; returns the profile-based CV. */
export async function discardCv(applicationId: string): Promise<Result<CvContent>> {
  const user = await getCurrentUser();
  const content = await discardApplicationCv(await getDb(), user, applicationId);
  if (!content) return { ok: false, error: "Application not found." };
  return { ok: true, data: content };
}

/** Save the user's own tailoring instructions; null or blank goes back to the default. */
export async function saveCvPrompt(prompt: string | null): Promise<Result> {
  if (prompt != null && (typeof prompt !== "string" || prompt.length > MAX_CV_PROMPT)) return { ok: false, error: `Keep the prompt under ${MAX_CV_PROMPT} characters.` };
  const user = await getCurrentUser();
  await writeSettings(await getDb(), user.id, { cvPrompt: prompt?.trim() || null });
  refresh();
  return { ok: true, data: undefined };
}
