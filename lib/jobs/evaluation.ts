import "server-only";
import { AiUnavailableError } from "@/lib/ai/client";
import { describeAiConfig, getAiConfig } from "@/lib/ai/config";
import { evaluateJobFit } from "@/lib/ai/evaluate-job";
import { getDb } from "@/lib/db";
import { getMyCvText, getMyProfile } from "@/lib/profile/data";
import { getCurrentUser } from "@/lib/session";
import { todayIso } from "./fit";
import { toPlainText } from "./html";
import { extrasOf, readFitMatches, readJobRow, writeFitMatch, type FitMatch } from "./queries";

export type { FitMatch } from "./queries";

/** Evaluate one stored job against the current user's profile and save the result (one row per user + job). */
export async function runFitEvaluation(jobId: string): Promise<FitMatch> {
  const user = await getCurrentUser();
  const config = await getAiConfig();
  if (!config) throw new AiUnavailableError();

  const db = await getDb();
  const job = await readJobRow(db, jobId);
  if (!job) throw new Error("That job is no longer available.");
  const [{ profile }, cvText] = await Promise.all([getMyProfile(), getMyCvText()]);

  const extras = extrasOf(job);
  const result = await evaluateJobFit(
    {
      profile,
      cvText,
      today: todayIso(),
      job: {
        title: job.title,
        company: job.company,
        location: job.location,
        workSetup: job.workSetup,
        employmentType: job.employmentType,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryCurrency: job.salaryCurrency,
        salaryPeriod: job.salaryPeriod,
        postedAt: job.postedAt,
        expiresAt: job.expiresAt,
        requirements: extras.requirements,
        description: toPlainText(job.description) || extras.summary || "",
      },
    },
    config,
  );

  return writeFitMatch(db, user.id, jobId, result, describeAiConfig(config));
}

/** The current user's saved evaluations for these jobs, keyed by job id. */
export async function getMyFitMatches(jobIds: string[]): Promise<Map<string, FitMatch>> {
  const user = await getCurrentUser();
  return readFitMatches(await getDb(), user.id, jobIds);
}
