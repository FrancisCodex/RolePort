import { z } from "zod";
import { MAX_NOTES } from "@/app/(app)/applied/view-data";
import type { DraftLetterResult } from "@/app/(app)/applied/[id]/cover-letter/actions";
import type { AnswerResult } from "@/app/(app)/applied/[id]/questions/actions";
import type { TailorResult } from "@/app/(app)/applied/[id]/cv/actions";
import type { InterviewResult } from "@/app/(app)/coach/actions";
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
import { MAX_ANSWER_PROMPT } from "@/lib/ai/answer-prompt";
import { MAX_INTERVIEWER_PROMPT } from "@/lib/ai/interview-prompt";
import { MAX_LETTER_PROMPT } from "@/lib/ai/letter-prompt";
import { exportBackup } from "@/lib/backup/export";
import { importErrorMessage, readBackupForm } from "@/lib/backup/form";
import { importBackup, type ImportSummary } from "@/lib/backup/import";
import { discardApplicationCv, saveEditedCv, tailorApplicationCv } from "@/lib/cv/tailor";
import { cvContentSchema, type CvContent } from "@/lib/cv/types";
import { discardApplicationLetter, draftApplicationLetter, saveEditedLetter } from "@/lib/letter/letter";
import {
  answerInterview,
  deleteInterview as removeInterview,
  endInterview as stopInterview,
  gradeInterviewStep,
  prepareInterviewBriefing,
  redoInterviewQuestion,
  skipInterviewQuestion,
  startInterview as beginInterview,
} from "@/lib/interview/sessions";
import { interviewSetupSchema, MAX_INTERVIEW_ANSWER, spokenTime, type InterviewSetup } from "@/lib/interview/types";
import { draftQuestionAnswer, saveQuestionList } from "@/lib/questions/questions";
import { questionsSchema, type QuestionItem } from "@/lib/questions/types";
import { letterContentSchema, type LetterContent } from "@/lib/letter/types";
import { deleteFollowedCompany, insertFollowedCompany, insertStarterCompanies, TOO_MANY_COMPANIES } from "@/lib/companies/queries";
import { starterKeysSchema } from "@/lib/companies/starters";
import { getBrowserDb, type BrowserDb } from "@/lib/db/browser";
import { ATS_IDS, type AtsId } from "@/lib/jobs/sources/companies/types";
import { LOCAL_USER } from "@/lib/db/local-user";
import {
  markApplied,
  removeApplication,
  setStatus,
  toggleSaved,
  writeInterviewDate,
  writeNotes,
  type ApplicationStatus,
} from "@/lib/jobs/applications";
import { vetoReason } from "@/lib/jobs/fit";
import { evaluateStoredJob } from "@/lib/jobs/fit-evaluation";
import { readPaste } from "@/lib/jobs/paste/review";
import { jobCheckSchema, storePastedJob, writeJobCheck } from "@/lib/jobs/paste/store";
import { canCheckJob, pastedJobSchema, type JobCheck, type LinkRead, type PasteReview, type PastedJob } from "@/lib/jobs/paste/types";
import { readJobRow } from "@/lib/jobs/queries";
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

export async function setInterviewDate(applicationId: string, at: string | null): Promise<Result> {
  const date = at === null ? null : new Date(at);
  if (date && Number.isNaN(date.getTime())) return { ok: false, error: "That date isn't valid." };
  if (!(await writeInterviewDate(await getBrowserDb(), LOCAL_USER.id, applicationId, date))) return { ok: false, error: "Application not found." };
  await invalidate("application");
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

/* Paste a job --------------------------------------------------------------- */

/** POSTs to a lite relay route that answers with a Result. */
async function relay<T>(path: string, body: unknown, failed: string): Promise<Result<T>> {
  try {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return (await res.json()) as Result<T>;
  } catch {
    return { ok: false, error: failed };
  }
}

/** Lite: links are read by the server relay (/api/lite/job-link); text is read by the user's AI, from this browser. */
export async function readPastedJob(input: string): Promise<Result<PasteReview>> {
  const config = await savedAiConfig(await getBrowserDb());
  const readLink = (url: string) => relay<LinkRead>("/api/lite/job-link", { url }, "Couldn't reach RolePort to read that link. Try again.");
  return readPaste(input, { readLink, config });
}

export async function savePastedJob(job: PastedJob, check: JobCheck | null): Promise<Result<{ jobId: string }>> {
  const parsed = pastedJobSchema.safeParse(job);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Some fields are invalid." };
  const lastCheck = check === null ? null : (jobCheckSchema.safeParse(check).data ?? null);
  const jobId = await storePastedJob(await getBrowserDb(), LOCAL_USER.id, parsed.data, lastCheck);
  await invalidate("job", "application");
  void requestPersistence();
  return { ok: true, data: { jobId } };
}

/** Lite: the relay (/api/lite/job-check) looks the posting up; the answer is kept in this browser. */
export async function checkJobStillOpen(jobId: string): Promise<Result<JobCheck>> {
  const db = await getBrowserDb();
  const job = typeof jobId === "string" ? await readJobRow(db, jobId) : null;
  if (!job) return { ok: false, error: "This job is no longer stored." };
  if (!canCheckJob(job)) return { ok: false, error: "RolePort can't check jobs from this source." };
  const result = await relay<JobCheck>(
    "/api/lite/job-check",
    { source: job.source, sourceId: job.sourceId, url: job.url },
    "Couldn't reach RolePort to check this job. Try again.",
  );
  if (!result.ok) return result;
  const check = jobCheckSchema.safeParse(result.data);
  if (!check.success) return { ok: false, error: "Unexpected answer from the server." };
  await writeJobCheck(db, job.id, check.data);
  await invalidate("job");
  return { ok: true, data: check.data };
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

export async function saveAnswerPrompt(prompt: string | null): Promise<Result> {
  if (prompt != null && (typeof prompt !== "string" || prompt.length > MAX_ANSWER_PROMPT)) {
    return { ok: false, error: `Keep the prompt under ${MAX_ANSWER_PROMPT} characters.` };
  }
  await writeSettings(await getBrowserDb(), LOCAL_USER.id, { answerPrompt: prompt?.trim() || null });
  await invalidate("user_settings");
  return { ok: true, data: undefined };
}

/* Interview Coach ----------------------------------------------------------- */

/** An AI call on the browser's provider config, with the lite edition's error messages. */
async function withAi<T>(run: (db: BrowserDb, config: AiConfig) => Promise<T>, fallback: string): Promise<InterviewResult<T>> {
  const db = await getBrowserDb();
  const config = await savedAiConfig(db);
  if (!config) return { ok: false, error: new AiUnavailableError().message, needsSetup: true };
  try {
    const data = await run(db, config);
    void invalidate("interview_session");
    return { ok: true, data };
  } catch (error) {
    console.error("[interview] model call failed", error);
    const baseUrl = config.provider === "openai_compatible" ? config.baseUrl : null;
    if (isUnreachable(error) && baseUrl && isLocalUrl(baseUrl)) return { ok: false, error: await explainLocalFailure(baseUrl) };
    return { ok: false, error: aiErrorMessage(error, fallback) };
  }
}

export async function startInterview(input: InterviewSetup): Promise<InterviewResult<string>> {
  const parsed = interviewSetupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  return withAi(async (db, config) => beginInterview(db, await me(db), parsed.data, config), "Preparing the interview failed. Please try again.");
}

export async function answerInterviewQuestion(id: string, answer: string, spoken: { seconds: number } | null = null): Promise<InterviewResult> {
  const text = answer.trim();
  if (!text) return { ok: false, error: "Write your answer first, or skip the question." };
  if (text.length > MAX_INTERVIEW_ANSWER) return { ok: false, error: `Keep an answer under ${MAX_INTERVIEW_ANSWER} characters.` };
  return withAi(
    (db, config) => answerInterview(db, LOCAL_USER.id, id, text, config, spokenTime(spoken)),
    "The interviewer couldn't reply. Your answer is still here; try sending it again.",
  );
}

export async function gradeInterview(id: string): Promise<InterviewResult> {
  return withAi((db, config) => gradeInterviewStep(db, LOCAL_USER.id, id, config), "Grading the interview failed. Please try again.");
}

export async function redoQuestion(id: string, q: number, answer: string): Promise<InterviewResult> {
  const text = answer.trim();
  if (!text) return { ok: false, error: "Write your answer first." };
  if (text.length > MAX_INTERVIEW_ANSWER) return { ok: false, error: `Keep an answer under ${MAX_INTERVIEW_ANSWER} characters.` };
  return withAi((db, config) => redoInterviewQuestion(db, LOCAL_USER.id, id, q, text, config), "Grading your answer failed. It's still in the box; try again.");
}

export async function saveInterviewPrompt(prompt: string | null): Promise<Result> {
  if (prompt != null && (typeof prompt !== "string" || prompt.length > MAX_INTERVIEWER_PROMPT)) {
    return { ok: false, error: `Keep the prompt under ${MAX_INTERVIEWER_PROMPT} characters.` };
  }
  await writeSettings(await getBrowserDb(), LOCAL_USER.id, { interviewPrompt: prompt?.trim() || null });
  await invalidate("user_settings");
  return { ok: true, data: undefined };
}

export async function prepareBriefing(id: string): Promise<InterviewResult> {
  return withAi(async (db, config) => prepareInterviewBriefing(db, await me(db), id, config), "Writing the briefing failed. Please try again.");
}

export async function skipInterviewTurn(id: string): Promise<InterviewResult> {
  try {
    const data = await skipInterviewQuestion(await getBrowserDb(), LOCAL_USER.id, id);
    void invalidate("interview_session");
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't skip the question." };
  }
}

export async function endInterview(id: string): Promise<InterviewResult> {
  try {
    const data = await stopInterview(await getBrowserDb(), LOCAL_USER.id, id);
    void invalidate("interview_session");
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't end the interview." };
  }
}

export async function deleteInterview(id: string): Promise<Result> {
  if (!(await removeInterview(await getBrowserDb(), LOCAL_USER.id, id))) return { ok: false, error: "Interview not found." };
  await invalidate("interview_session");
  return { ok: true, data: undefined };
}

/* Settings ------------------------------------------------------------------ */

/** Form input → provider config, reusing the saved key. Local addresses are fine: it's the user's own machine. */
async function resolve(input: AiSettingsInput) {
  const saved = await readSettings(await getBrowserDb(), LOCAL_USER.id);
  return resolveAiInput(input, readKey(saved?.aiApiKeyEnc));
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
    baseUrl = preset.provider === "openai_compatible" ? checkBaseUrl(parsed.data.baseUrl || preset.baseUrl) : null;
    return { ok: true, data: await listModels({ provider: preset.provider, baseUrl, apiKey }) };
  } catch (error) {
    return { ok: false, error: await providerError(error, baseUrl, null) };
  }
}

/** Lite: the server checks the link and the company's feed (/api/lite/company); the company is kept in this browser. */
export async function followCompany(raw: { url: string; name?: string }): Promise<Result<{ id: string; name: string; openJobs: number }>> {
  let resolved: Result<{ ats: AtsId; slug: string; name: string; careersUrl: string; openJobs: number }>;
  try {
    const res = await fetch("/api/lite/company", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(raw) });
    resolved = await res.json();
  } catch {
    return { ok: false, error: "Couldn't reach RolePort to check that link. Try again." };
  }
  if (!resolved.ok) return resolved;
  const { ats, slug, name, careersUrl, openJobs } = resolved.data;
  if (!ATS_IDS.includes(ats)) return { ok: false, error: "Unexpected answer from the server." };
  const row = await insertFollowedCompany(await getBrowserDb(), LOCAL_USER.id, { ats, slug, name, careersUrl });
  if (!row) return { ok: false, error: TOO_MANY_COMPANIES };
  await invalidate("followed_company");
  return { ok: true, data: { id: row.id, name, openJobs } };
}

export async function unfollowCompany(raw: { id: string }): Promise<Result> {
  const input = z.object({ id: z.string().min(1).max(100) }).safeParse(raw);
  if (!input.success) return { ok: false, error: "Invalid company." };
  await deleteFollowedCompany(await getBrowserDb(), LOCAL_USER.id, input.data.id);
  await invalidate("followed_company");
  return { ok: true, data: undefined };
}

/** The starter lists are part of the app, so following from them needs no server. */
export async function followStarterCompanies(raw: { keys: string[] }): Promise<Result<{ added: string[]; full: boolean }>> {
  const input = starterKeysSchema.safeParse(raw);
  if (!input.success) return { ok: false, error: "Invalid companies." };
  const result = await insertStarterCompanies(await getBrowserDb(), LOCAL_USER.id, input.data.keys);
  await invalidate("followed_company");
  return { ok: true, data: result };
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
