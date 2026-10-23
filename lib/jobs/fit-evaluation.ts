import { evaluateJobFit } from "@/lib/ai/evaluate-job";
import { describeAiConfig, type AiConfig } from "@/lib/ai/settings";
import type { AnyDb } from "@/lib/db/types";
import { readCvText, readProfile } from "@/lib/profile/queries";
import { todayIso } from "./fit";
import { toPlainText } from "./html";
import { extrasOf, readJobRow, writeFitMatch, type FitMatch } from "./queries";

/**
 * Evaluate one stored job against the user's profile and CV on `config`'s provider, and save
 * the result (one row per user + job). Shared by the server (lib/jobs/evaluation.ts) and the
 * lite edition. Local models can take a minute.
 */
export async function evaluateStoredJob(db: AnyDb, user: { id: string; name: string }, jobId: string, config: AiConfig): Promise<FitMatch> {
  const job = await readJobRow(db, jobId);
  if (!job) throw new Error("That job is no longer available.");
  const [{ profile }, cvText] = await Promise.all([readProfile(db, user), readCvText(db, user.id)]);

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
