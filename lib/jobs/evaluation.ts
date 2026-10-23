import "server-only";
import { AiUnavailableError } from "@/lib/ai/client";
import { getAiConfig } from "@/lib/ai/config";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { evaluateStoredJob } from "./fit-evaluation";
import { readFitMatches, type FitMatch } from "./queries";

export type { FitMatch } from "./queries";

/** Evaluate one stored job against the current user's profile and save the result (one row per user + job). */
export async function runFitEvaluation(jobId: string): Promise<FitMatch> {
  const user = await getCurrentUser();
  const config = await getAiConfig();
  if (!config) throw new AiUnavailableError();
  return evaluateStoredJob(await getDb(), user, jobId, config);
}

/** The current user's saved evaluations for these jobs, keyed by job id. */
export async function getMyFitMatches(jobIds: string[]): Promise<Map<string, FitMatch>> {
  const user = await getCurrentUser();
  return readFitMatches(await getDb(), user.id, jobIds);
}
