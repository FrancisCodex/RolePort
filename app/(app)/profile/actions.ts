"use server";

import { refresh } from "next/cache";
import { getAiConfig } from "@/lib/ai/config";
import { MAX_PROFILE_PROMPT } from "@/lib/ai/profile-prompt";
import { getDb } from "@/lib/db";
import { readCvFile, type CvImport } from "@/lib/profile/cv-file";
import { draftFromCv } from "@/lib/profile/cv-import";
import { ONBOARDING_DONE, readProfilePrompt, readStoredCv, writeCv, writeOnboardingStep, writeProfile } from "@/lib/profile/queries";
import { profileError, profileSchema, type ProfileInput } from "@/lib/profile/schema";
import type { Result } from "@/lib/result";
import { getCurrentUser } from "@/lib/session";
import { writeSettings } from "@/lib/settings/queries";

export type { CvImport };

export async function saveProfile(input: ProfileInput): Promise<Result> {
  const user = await getCurrentUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: profileError(parsed.error) };
  }

  await writeProfile(await getDb(), user.id, parsed.data);
  refresh();
  return { ok: true, data: undefined };
}

export async function importCv(formData: FormData): Promise<Result<CvImport>> {
  const user = await getCurrentUser();
  const read = await readCvFile(formData.get("cv"));
  if (!read.ok) return read;
  const { fileName, text } = read.data;

  const db = await getDb();
  await writeCv(db, user.id, fileName, text);
  return { ok: true, data: await draftFromCv(fileName, text, await getAiConfig(), await readProfilePrompt(db, user.id)) };
}

/** Read the last imported CV again, with the current prompt. */
export async function rereadCv(): Promise<Result<CvImport>> {
  const user = await getCurrentUser();
  const db = await getDb();
  const stored = await readStoredCv(db, user.id);
  if (!stored) return { ok: false, error: "Import your CV first." };
  return { ok: true, data: await draftFromCv(stored.fileName, stored.text, await getAiConfig(), await readProfilePrompt(db, user.id)) };
}

export async function saveProfilePrompt(prompt: string | null): Promise<Result> {
  if (prompt != null && (typeof prompt !== "string" || prompt.length > MAX_PROFILE_PROMPT)) {
    return { ok: false, error: `Keep the prompt under ${MAX_PROFILE_PROMPT} characters.` };
  }
  const user = await getCurrentUser();
  await writeSettings(await getDb(), user.id, { profilePrompt: prompt?.trim() || null });
  refresh();
  return { ok: true, data: undefined };
}

/** Remember where the welcome guide is (1-5), or that it's finished or skipped (ONBOARDING_DONE). */
export async function setOnboardingStep(step: number): Promise<Result> {
  const user = await getCurrentUser();
  if (!Number.isInteger(step) || step < 0 || step > ONBOARDING_DONE) return { ok: false, error: "Invalid step." };
  await writeOnboardingStep(await getDb(), user.id, step);
  return { ok: true, data: undefined };
}
