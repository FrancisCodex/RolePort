"use server";

import { refresh } from "next/cache";
import { AiUnavailableError } from "@/lib/ai/client";
import { getAiConfig } from "@/lib/ai/config";
import { aiErrorMessage } from "@/lib/ai/errors";
import { getDb } from "@/lib/db";
import { setStatus, toggleSaved, type ApplicationStatus } from "@/lib/jobs/applications";
import { checkPosting, readJobLink } from "@/lib/jobs/paste/link";
import { readPaste } from "@/lib/jobs/paste/review";
import { jobCheckSchema, storePastedJob, writeJobCheck } from "@/lib/jobs/paste/store";
import { canCheckJob, pastedJobSchema, type JobCheck, type PasteReview, type PastedJob } from "@/lib/jobs/paste/types";
import { readJobRow } from "@/lib/jobs/queries";
import type { Result } from "@/lib/result";
import { runFitEvaluation } from "@/lib/jobs/evaluation";
import { vetoReason } from "@/lib/jobs/fit";
import { getCurrentUser } from "@/lib/session";

/** Save a job to the pipeline, or remove it if it's still only "saved". Returns the new saved state. */
export async function toggleSavedJob(jobId: string): Promise<{ saved: boolean }> {
  const user = await getCurrentUser();
  const { saved, changed } = await toggleSaved(await getDb(), user.id, jobId);
  if (changed) refresh();
  return { saved };
}

export async function setApplicationStatus(applicationId: string, status: ApplicationStatus): Promise<void> {
  const user = await getCurrentUser();
  if (await setStatus(await getDb(), user.id, applicationId, status)) refresh();
}

export type EvaluateResult = { ok: true; score: number | null; veto: string | null } | { ok: false; error: string; needsSetup?: boolean };

/**
 * Run the AI fit evaluation for one job and save it. Local models can take a minute.
 * The batch analyzer on the jobs list passes refreshPage=false and refreshes once at the end,
 * so the job search isn't re-run after every job.
 */
export async function evaluateJob(jobId: string, refreshPage = true): Promise<EvaluateResult> {
  try {
    const match = await runFitEvaluation(jobId);
    if (refreshPage) refresh();
    return { ok: true, score: match.overallScore, veto: vetoReason(match) };
  } catch (error) {
    if (error instanceof AiUnavailableError) return { ok: false, error: error.message, needsSetup: true };
    console.error("[evaluate] failed", error);
    return { ok: false, error: aiErrorMessage(error, "The evaluation failed. Please try again.") };
  }
}

/** "Paste a job": reads a pasted link or posting text into fields for the user to review. Nothing is stored yet. */
export async function readPastedJob(input: string): Promise<Result<PasteReview>> {
  await getCurrentUser();
  return readPaste(input, { readLink: readJobLink, config: await getAiConfig() });
}

/** Stores a reviewed pasted job and puts it on the user's list as saved. */
export async function savePastedJob(job: PastedJob, check: JobCheck | null): Promise<Result<{ jobId: string }>> {
  const user = await getCurrentUser();
  const parsed = pastedJobSchema.safeParse(job);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Some fields are invalid." };
  const lastCheck = check === null ? null : jobCheckSchema.safeParse(check).data ?? null;
  const jobId = await storePastedJob(await getDb(), user.id, parsed.data, lastCheck);
  refresh();
  return { ok: true, data: { jobId } };
}

/** "Check again": whether a company-feed job or a pasted link is still open. Saves the answer on the job. */
export async function checkJobStillOpen(jobId: string): Promise<Result<JobCheck>> {
  await getCurrentUser();
  const db = await getDb();
  const job = typeof jobId === "string" ? await readJobRow(db, jobId) : null;
  if (!job) return { ok: false, error: "This job is no longer stored." };
  if (!canCheckJob(job)) return { ok: false, error: "RolePort can't check jobs from this source." };
  const check = await checkPosting(job);
  await writeJobCheck(db, job.id, check);
  refresh();
  return { ok: true, data: check };
}
