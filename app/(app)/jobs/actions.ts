"use server";

import { refresh } from "next/cache";
import { AiUnavailableError } from "@/lib/ai/client";
import { getDb } from "@/lib/db";
import { setStatus, toggleSaved, type ApplicationStatus } from "@/lib/jobs/applications";
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
    const message = error instanceof Error ? error.message : "";
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      ok: false,
      error: timedOut
        ? "The model took too long to answer. Try again, or pick a faster model in Settings."
        : /fetch failed|ECONNREFUSED/i.test(message)
          ? "Couldn't reach your AI provider. Is it running? Check Settings."
          : message || "The evaluation failed. Please try again.",
    };
  }
}
