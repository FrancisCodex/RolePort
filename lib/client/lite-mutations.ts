import { z } from "zod";
import { MAX_NOTES } from "@/app/(app)/applied/view-data";
import type { DraftLetterResult } from "@/app/(app)/applied/[id]/cover-letter/actions";
import type { AnswerResult } from "@/app/(app)/applied/[id]/questions/actions";
import type { TailorResult } from "@/app/(app)/applied/[id]/cv/actions";
import type { EvaluateResult } from "@/app/(app)/jobs/actions";
import { aiErrorMessage, isUnreachable } from "@/lib/ai/errors";
import { explainLocalFailure, isLocalUrl, isOllamaUrl } from "@/lib/ai/local-server";
import { AI_PRESETS } from "@/lib/ai/presets";
import {
  aiConfigFromRow,
  aiInput,
  aiSettingsValues,
  checkBaseUrl,
  CONNECTION_TEST,
  resolveAiInput,
  type AiConfig,
  type AiSettingsInput,
} from "@/lib/ai/settings";
import { AiUnavailableError, generateStructured, listModels } from "@/lib/ai/structured";
import { MAX_CV_PROMPT } from "@/lib/ai/cv-prompt";
import { MAX_LETTER_PROMPT } from "@/lib/ai/letter-prompt";
import { exportBackup } from "@/lib/backup/export";
import { importErrorMessage, readBackupForm } from "@/lib/backup/form";
import { importBackup, type ImportSummary } from "@/lib/backup/import";
import { discardApplicationCv, saveEditedCv, tailorApplicationCv } from "@/lib/cv/tailor";
import { cvContentSchema, type CvContent } from "@/lib/cv/types";
import { discardApplicationLetter, draftApplicationLetter, saveEditedLetter } from "@/lib/letter/letter";
import { draftQuestionAnswer, saveQuestionList } from "@/lib/questions/questions";
import { questionsSchema, type QuestionItem } from "@/lib/questions/types";
import { letterContentSchema, type LetterContent } from "@/lib/letter/types";
import { getBrowserDb, type BrowserDb } from "@/lib/db/browser";
import { LOCAL_USER } from "@/lib/db/local-user";
import {
  markApplied,
  removeApplication,
  setStatus,
  toggleSaved,
  writeNotes,
  type ApplicationStatus,
} from "@/lib/jobs/applications";
import { vetoReason } from "@/lib/jobs/fit";
import { evaluateStoredJob } from "@/lib/jobs/fit-evaluation";
import { readCvFile, type CvImport } from "@/lib/profile/cv-file";
import { draftFromCv } from "@/lib/profile/cv-import";
import { ONBOARDING_DONE, writeCv, writeOnboardingStep, writeProfile } from "@/lib/profile/queries";
import { profileSchema, type ProfileInput } from "@/lib/profile/schema";
import type { Result } from "@/lib/result";
import { readSettings, writeSettings } from "@/lib/settings/queries";
import { invalidate } from "./bus";
import { readKey, storeKey } from "./lite-keys";
import { me } from "./lite-queries";
import { requestPersistence } from "./storage";

/*
 * The lite edition's versions of the server actions, run against the browser database.
 * Same signatures and results; invalidate() stands in for the server's refresh().
 * AI calls go straight from the browser to the user's provider with the user's own key.
 */

async function savedAiConfig(db: BrowserDb): Promise<AiConfig | null> {
  return aiConfigFromRow(await readSettings(db, LOCAL_USER.id), readKey);
}

/** Like the server's messages, plus why a model server on this computer couldn't be reached. */
async function providerError(error: unknown, baseUrl: string | null, model: string | null): Promise<string> {
  if (isUnreachable(error) && baseUrl && isLocalUrl(baseUrl)) return explainLocalFailure(baseUrl);
  if (isUnreachable(error)) return "Couldn't reach the provider. Check your connection and the base URL.";
  const message = aiErrorMessage(error, "Something went wrong.");
  if (baseUrl && model && isOllamaUrl(baseUrl) && /wasn't found/.test(message)) return `${message} Run \`ollama pull ${model}\` first.`;
  return message;
}

/* Profile ------------------------------------------------------------------- */

export async function saveProfile(input: ProfileInput): Promise<Result> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Some fields are invalid." };
  }
  await writeProfile(await getBrowserDb(), LOCAL_USER.id, parsed.data);
  await invalidate("profile");
  // There's something worth keeping now: ask the browser not to evict this site's storage.
  void requestPersistence();
  return { ok: true, data: undefined };
}

export async function importCv(formData: FormData): Promise<Result<CvImport>> {
  const read = await readCvFile(formData.get("cv"));
  if (!read.ok) return read;
  const { fileName, text } = read.data;

  const db = await getBrowserDb();
  await writeCv(db, LOCAL_USER.id, fileName, text);
  await invalidate("profile");
  return { ok: true, data: await draftFromCv(fileName, text, await savedAiConfig(db)) };
}

export async function setOnboardingStep(step: number): Promise<Result> {
  if (!Number.isInteger(step) || step < 0 || step > ONBOARDING_DONE) return { ok: false, error: "Invalid step." };
  await writeOnboardingStep(await getBrowserDb(), LOCAL_USER.id, step);
  await invalidate("profile");
  return { ok: true, data: undefined };
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

export async function applyToJob(jobId: string): Promise<Result<{ applicationId: string }>> {
  const applied = await markApplied(await getBrowserDb(), LOCAL_USER.id, jobId);
  if (!applied) return { ok: false, error: "This job is no longer stored. Search for it again." };
  if (applied.changed) {
    await invalidate("application");
    void requestPersistence();
  }
  return { ok: true, data: { applicationId: applied.applicationId } };
}

export async function saveApplicationNotes(applicationId: string, notes: string): Promise<Result> {
  if (typeof notes !== "string" || notes.length > MAX_NOTES) return { ok: false, error: "Notes are too long." };
  if (!(await writeNotes(await getBrowserDb(), LOCAL_USER.id, applicationId, notes))) return { ok: false, error: "Application not found." };
  // Other tabs pick the notes up; this one already shows them.
  void invalidate("application");
  return { ok: true, data: undefined };
}

export async function deleteApplication(applicationId: string): Promise<Result> {
  if (!(await removeApplication(await getBrowserDb(), LOCAL_USER.id, applicationId))) return { ok: false, error: "Application not found." };
  await invalidate("application");
  return { ok: true, data: undefined };
}

/** Reloading here is a quick local query, so every evaluation refreshes the list (unlike the server's refreshPage). */
export async function evaluateJob(jobId: string): Promise<EvaluateResult> {
  const db = await getBrowserDb();
  const config = await savedAiConfig(db);
  if (!config) return { ok: false, error: new AiUnavailableError().message, needsSetup: true };
  try {
    const match = await evaluateStoredJob(db, await me(db), jobId, config);
    await invalidate("job_match");
    return { ok: true, score: match.overallScore, veto: vetoReason(match) };
  } catch (error) {
    console.error("[evaluate] failed", error);
    const baseUrl = config.provider === "openai_compatible" ? config.baseUrl : null;
    if (isUnreachable(error) && baseUrl && isLocalUrl(baseUrl)) return { ok: false, error: await explainLocalFailure(baseUrl) };
    return { ok: false, error: aiErrorMessage(error, "The evaluation failed. Please try again.") };
  }
}

/* CV tailoring -------------------------------------------------------------- */

export async function tailorCv(applicationId: string): Promise<TailorResult> {
  const db = await getBrowserDb();
  const config = await savedAiConfig(db);
  if (!config) return { ok: false, error: new AiUnavailableError().message, needsSetup: true };
  try {
    const data = await tailorApplicationCv(db, await me(db), applicationId, config);
    void invalidate("document");
    return { ok: true, data };
  } catch (error) {
    console.error("[cv] tailoring failed", error);
    const baseUrl = config.provider === "openai_compatible" ? config.baseUrl : null;
    if (isUnreachable(error) && baseUrl && isLocalUrl(baseUrl)) return { ok: false, error: await explainLocalFailure(baseUrl) };
    return { ok: false, error: aiErrorMessage(error, "Tailoring failed. Please try again.") };
  }
}

export async function saveCv(applicationId: string, content: CvContent): Promise<Result> {
  const parsed = cvContentSchema.safeParse(content);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Some fields are too long." };
  if (!(await saveEditedCv(await getBrowserDb(), LOCAL_USER.id, applicationId, parsed.data))) return { ok: false, error: "Application not found." };
  // Other tabs pick the edit up; this one already shows it.
  void invalidate("document", "profile");
  return { ok: true, data: undefined };
}

export async function discardCv(applicationId: string): Promise<Result<CvContent>> {
  const db = await getBrowserDb();
  const content = await discardApplicationCv(db, await me(db), applicationId);
  if (!content) return { ok: false, error: "Application not found." };
  void invalidate("document");
  return { ok: true, data: content };
}

export async function saveCvPrompt(prompt: string | null): Promise<Result> {
  if (prompt != null && (typeof prompt !== "string" || prompt.length > MAX_CV_PROMPT)) return { ok: false, error: `Keep the prompt under ${MAX_CV_PROMPT} characters.` };
  await writeSettings(await getBrowserDb(), LOCAL_USER.id, { cvPrompt: prompt?.trim() || null });
  await invalidate("user_settings");
  return { ok: true, data: undefined };
}

/* Cover letters ------------------------------------------------------------- */

export async function draftLetter(applicationId: string): Promise<DraftLetterResult> {
  const db = await getBrowserDb();
  const config = await savedAiConfig(db);
  if (!config) return { ok: false, error: new AiUnavailableError().message, needsSetup: true };
  try {
    const data = await draftApplicationLetter(db, await me(db), applicationId, config);
    void invalidate("document");
    return { ok: true, data };
  } catch (error) {
    console.error("[letter] drafting failed", error);
    const baseUrl = config.provider === "openai_compatible" ? config.baseUrl : null;
    if (isUnreachable(error) && baseUrl && isLocalUrl(baseUrl)) return { ok: false, error: await explainLocalFailure(baseUrl) };
    return { ok: false, error: aiErrorMessage(error, "Writing the letter failed. Please try again.") };
  }
}

export async function saveLetter(applicationId: string, content: LetterContent): Promise<Result> {
  const parsed = letterContentSchema.safeParse(content);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Some fields are too long." };
  const db = await getBrowserDb();
  if (!(await saveEditedLetter(db, await me(db), applicationId, parsed.data))) return { ok: false, error: "Application not found." };
  void invalidate("document", "profile");
  return { ok: true, data: undefined };
}

export async function discardLetter(applicationId: string): Promise<Result<LetterContent>> {
  const db = await getBrowserDb();
  const content = await discardApplicationLetter(db, await me(db), applicationId);
  if (!content) return { ok: false, error: "Application not found." };
  void invalidate("document");
  return { ok: true, data: content };
}

export async function saveLetterPrompt(prompt: string | null): Promise<Result> {
  if (prompt != null && (typeof prompt !== "string" || prompt.length > MAX_LETTER_PROMPT)) {
    return { ok: false, error: `Keep the prompt under ${MAX_LETTER_PROMPT} characters.` };
  }
  await writeSettings(await getBrowserDb(), LOCAL_USER.id, { coverLetterPrompt: prompt?.trim() || null });
  await invalidate("user_settings");
  return { ok: true, data: undefined };
}

/* Application questions ----------------------------------------------------- */

export async function saveQuestions(applicationId: string, items: QuestionItem[]): Promise<Result> {
  const parsed = questionsSchema.safeParse(items);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Some fields are too long." };
  const db = await getBrowserDb();
  if (!(await saveQuestionList(db, await me(db), applicationId, parsed.data))) return { ok: false, error: "Application not found." };
  void invalidate("document");
  return { ok: true, data: undefined };
}

export async function answerApplicationQuestion(applicationId: string, questionId: string): Promise<AnswerResult> {
  const db = await getBrowserDb();
  const config = await savedAiConfig(db);
  if (!config) return { ok: false, error: new AiUnavailableError().message, needsSetup: true };
  try {
    const data = await draftQuestionAnswer(db, await me(db), applicationId, questionId, config);
    void invalidate("document");
    return { ok: true, data };
  } catch (error) {
    console.error("[questions] answering failed", error);
    const baseUrl = config.provider === "openai_compatible" ? config.baseUrl : null;
    if (isUnreachable(error) && baseUrl && isLocalUrl(baseUrl)) return { ok: false, error: await explainLocalFailure(baseUrl) };
    return { ok: false, error: aiErrorMessage(error, "Writing the answer failed. Please try again.") };
  }
}

/* Settings ------------------------------------------------------------------ */

/** Form input → provider config, reusing the saved key. Local addresses are fine: it's the user's own machine. */
async function resolve(input: AiSettingsInput) {
  const saved = await readSettings(await getBrowserDb(), LOCAL_USER.id);
  return resolveAiInput(input, readKey(saved?.aiApiKeyEnc), true);
}

export async function saveAiSettings(raw: AiSettingsInput): Promise<Result> {
  const parsed = aiInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Some settings are invalid." };
  try {
    const { config, apiKey } = await resolve(parsed.data);
    if (!config.model) return { ok: false, error: "Choose a model." };
    await writeSettings(await getBrowserDb(), LOCAL_USER.id, aiSettingsValues(parsed.data.preset, config, apiKey ? storeKey(apiKey) : null));
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

export async function testAiConnection(raw: AiSettingsInput): Promise<Result<{ ms: number; reply: string }>> {
  const parsed = aiInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Some settings are invalid." };
  let config: AiConfig;
  try {
    config = (await resolve(parsed.data)).config;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Some settings are invalid." };
  }
  if (!config.model) return { ok: false, error: "Choose a model first." };
  try {
    const started = Date.now();
    const result = await generateStructured({ ...CONNECTION_TEST, config });
    return { ok: true, data: { ms: Date.now() - started, reply: result.reply } };
  } catch (error) {
    return { ok: false, error: await providerError(error, config.provider === "openai_compatible" ? config.baseUrl : null, config.model) };
  }
}

export async function fetchModels(raw: AiSettingsInput): Promise<Result<string[]>> {
  const parsed = aiInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Some settings are invalid." };
  const preset = AI_PRESETS[parsed.data.preset as keyof typeof AI_PRESETS];
  let baseUrl: string | null = null;
  try {
    const saved = await readSettings(await getBrowserDb(), LOCAL_USER.id);
    const apiKey = parsed.data.clearApiKey ? null : parsed.data.apiKey || readKey(saved?.aiApiKeyEnc);
    baseUrl = preset.provider === "openai_compatible" ? checkBaseUrl(parsed.data.baseUrl || preset.baseUrl, true) : null;
    return { ok: true, data: await listModels({ provider: preset.provider, baseUrl, apiKey }) };
  } catch (error) {
    return { ok: false, error: await providerError(error, baseUrl, null) };
  }
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

/* Backups ------------------------------------------------------------------- */

// Read in the browser, not uploaded anywhere, so the limit is only there to stay responsive.
const MAX_BACKUP_BYTES = 100 * 1024 * 1024;

export async function exportData(): Promise<Result<string>> {
  const db = await getBrowserDb();
  return { ok: true, data: JSON.stringify(await exportBackup(db, await me(db))) };
}

export async function importData(formData: FormData): Promise<Result<ImportSummary>> {
  const read = await readBackupForm(formData, MAX_BACKUP_BYTES);
  if (!read.ok) return read;
  try {
    const summary = await importBackup(await getBrowserDb(), LOCAL_USER.id, read.data.backup, read.data.mode);
    await invalidate("profile", "user_settings", "job", "job_match", "application");
    return { ok: true, data: summary };
  } catch (error) {
    return { ok: false, error: importErrorMessage(error) };
  }
}

/** Lite: JobSpy runs on the user's computer and the browser calls it (lib/client/lite-jobspy.ts). */
export async function saveJobSpyEnabled(raw: { enabled: boolean }): Promise<Result> {
  const input = z.object({ enabled: z.boolean() }).safeParse(raw);
  if (!input.success) return { ok: false, error: "Invalid setting." };
  await writeSettings(await getBrowserDb(), LOCAL_USER.id, { jobspyEnabled: input.data.enabled });
  await invalidate("user_settings");
  return { ok: true, data: undefined };
}
