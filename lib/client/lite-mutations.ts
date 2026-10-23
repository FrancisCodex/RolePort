import { z } from "zod";
import type { EvaluateResult } from "@/app/(app)/jobs/actions";
import { aiInput, aiSettingsValues, resolveAiInput, type AiSettingsInput } from "@/lib/ai/settings";
import { getBrowserDb } from "@/lib/db/browser";
import { LOCAL_USER } from "@/lib/db/local-user";
import { setStatus, toggleSaved, type ApplicationStatus } from "@/lib/jobs/applications";
import { readCvFile, type CvImport } from "@/lib/profile/cv-file";
import { detectSkills } from "@/lib/profile/detect-skills";
import { writeCv, writeProfile } from "@/lib/profile/queries";
import { profileSchema, type ProfileInput } from "@/lib/profile/schema";
import type { Result } from "@/lib/result";
import { readSettings, writeSettings } from "@/lib/settings/queries";
import { invalidate } from "./bus";
import { readKey, storeKey } from "./lite-keys";

/*
 * The lite edition's versions of the server actions, run against the browser database.
 * Same signatures and results; invalidate() stands in for the server's refresh().
 */

// AI from the browser arrives with phase 4 (docs/LITE-IMPLEMENTATION.md).
const NO_AI_YET = "AI from the browser isn't available in HireMe Lite yet. Your settings are saved.";

/* Profile ------------------------------------------------------------------- */

export async function saveProfile(input: ProfileInput): Promise<Result> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Some fields are invalid." };
  }
  await writeProfile(await getBrowserDb(), LOCAL_USER.id, parsed.data);
  await invalidate("profile");
  return { ok: true, data: undefined };
}

export async function importCv(formData: FormData): Promise<Result<CvImport>> {
  const read = await readCvFile(formData.get("cv"));
  if (!read.ok) return read;
  const { fileName, text } = read.data;

  await writeCv(await getBrowserDb(), LOCAL_USER.id, fileName, text);
  await invalidate("profile");

  // Until AI runs in the browser (phase 4), detected skills only.
  const skills = detectSkills(text).map((name) => ({ name, level: "secondary" as const }));
  return { ok: true, data: { fileName, draft: { skills }, usedAi: false } };
}

/* Jobs and pipeline --------------------------------------------------------- */

export async function toggleSavedJob(jobId: string): Promise<{ saved: boolean }> {
  const { saved, changed } = await toggleSaved(await getBrowserDb(), LOCAL_USER.id, jobId);
  if (changed) await invalidate("application");
  return { saved };
}

export async function setApplicationStatus(applicationId: string, status: ApplicationStatus): Promise<void> {
  if (await setStatus(await getBrowserDb(), LOCAL_USER.id, applicationId, status)) await invalidate("application");
}

export async function evaluateJob(): Promise<EvaluateResult> {
  return { ok: false, error: NO_AI_YET };
}

/* Settings ------------------------------------------------------------------ */

export async function saveAiSettings(raw: AiSettingsInput): Promise<Result> {
  const parsed = aiInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Some settings are invalid." };
  try {
    const db = await getBrowserDb();
    const saved = await readSettings(db, LOCAL_USER.id);
    // Local addresses are fine: they're the user's own machine, called from their own browser.
    const { config, apiKey } = resolveAiInput(parsed.data, readKey(saved?.aiApiKeyEnc), true);
    if (!config.model) return { ok: false, error: "Choose a model." };
    await writeSettings(db, LOCAL_USER.id, aiSettingsValues(parsed.data.preset, config, apiKey ? storeKey(apiKey) : null));
    await invalidate("user_settings");
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function turnOffAi(): Promise<Result> {
  await writeSettings(await getBrowserDb(), LOCAL_USER.id, { aiProvider: null, aiApiKeyEnc: null });
  await invalidate("user_settings");
  return { ok: true, data: undefined };
}

export async function testAiConnection(): Promise<Result<{ ms: number; reply: string }>> {
  return { ok: false, error: NO_AI_YET };
}

export async function fetchModels(): Promise<Result<string[]>> {
  return { ok: false, error: NO_AI_YET };
}

export async function saveRapidApiKey(raw: { apiKey: string | null; clear: boolean }): Promise<Result> {
  const input = z.object({ apiKey: z.string().trim().max(200).nullable(), clear: z.boolean() }).safeParse(raw);
  if (!input.success) return { ok: false, error: "Invalid key." };
  if (!input.data.clear && !input.data.apiKey) return { ok: false, error: "Paste your RapidAPI key." };
  const value = input.data.clear ? null : storeKey(input.data.apiKey!);
  await writeSettings(await getBrowserDb(), LOCAL_USER.id, { rapidApiKeyEnc: value });
  await invalidate("user_settings");
  return { ok: true, data: undefined };
}

export async function saveJobSpyEnabled(): Promise<Result> {
  // Connecting JobSpy on the user's own computer arrives with phase 6.
  return { ok: false, error: "JobSpy isn't available in HireMe Lite yet." };
}
