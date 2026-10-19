import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { AiUnavailableError } from "@/lib/ai/client";
import { describeAiConfig, getAiConfig } from "@/lib/ai/config";
import { evaluateJobFit } from "@/lib/ai/evaluate-job";
import { getDb, schema } from "@/lib/db";
import { getMyCvText, getMyProfile } from "@/lib/profile/data";
import { getCurrentUser } from "@/lib/session";
import { overallFitScore, todayIso } from "./fit";
import { toPlainText } from "./html";
import type { JobExtras } from "./data";

export type FitMatch = typeof schema.jobMatch.$inferSelect;

/** Evaluate one stored job against the current user's profile and save the result (one row per user + job). */
export async function runFitEvaluation(jobId: string): Promise<FitMatch> {
  const user = await getCurrentUser();
  const config = await getAiConfig();
  if (!config) throw new AiUnavailableError();

  const db = await getDb();
  const [job] = await db.select().from(schema.job).where(eq(schema.job.id, jobId));
  if (!job) throw new Error("That job is no longer available.");
  const [{ profile }, cvText] = await Promise.all([getMyProfile(), getMyCvText()]);

  const extras = (job.raw ?? {}) as Partial<JobExtras>;
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
        requirements: extras.requirements ?? [],
        description: toPlainText(job.description) || extras.summary || "",
      },
    },
    config,
  );

  const values = {
    eligibilityGate: result.eligibility,
    eligibilityNote: result.eligibilityNote || null,
    languageGate: result.language,
    languageNote: result.languageNote || null,
    locationGate: result.location,
    locationNote: result.locationNote || null,
    gateNote: result.dealBreaker || null,
    skillsScore: result.skillsScore,
    experienceScore: result.experienceScore,
    cultureScore: result.cultureScore,
    careerScore: result.careerScore,
    overallScore: overallFitScore({
      skills: result.skillsScore,
      experience: result.experienceScore,
      culture: result.cultureScore,
      career: result.careerScore,
    }),
    strengths: result.strengths,
    gaps: result.gaps,
    summary: result.summary || null,
    recommendation: result.recommendation || null,
    deadline: result.deadline || null,
    postingClosed: result.postingClosed,
    model: describeAiConfig(config),
    scoredAt: new Date(),
  };

  const [row] = await db
    .insert(schema.jobMatch)
    .values({ userId: user.id, jobId, ...values })
    .onConflictDoUpdate({ target: [schema.jobMatch.userId, schema.jobMatch.jobId], set: values })
    .returning();
  return row;
}

/** The current user's saved evaluations for these jobs, keyed by job id. */
export async function getMyFitMatches(jobIds: string[]): Promise<Map<string, FitMatch>> {
  if (jobIds.length === 0) return new Map();
  const user = await getCurrentUser();
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.jobMatch)
    .where(and(eq(schema.jobMatch.userId, user.id), inArray(schema.jobMatch.jobId, jobIds)));
  return new Map(rows.map((r) => [r.jobId, r]));
}
