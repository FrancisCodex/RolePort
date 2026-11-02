import { toPlainText } from "@/lib/jobs/html";
import type { PipelineItem } from "@/lib/jobs/applications";
import { vetoReason } from "@/lib/jobs/fit";
import type { JobListItem } from "@/lib/jobs/queries";
import { clip } from "./tool";

/*
 * What the tools send back: plain, small objects. Lists carry a summary per job; get_job adds
 * the posting's text, cut to a length small local models can hold.
 */

const DESCRIPTION_CHARS = 4_000;

export function jobSummary(job: JobListItem) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    workSetup: job.workSetup,
    employmentType: job.employmentType,
    salary:
      job.salaryMin || job.salaryMax
        ? { min: job.salaryMin, max: job.salaryMax, currency: job.salaryCurrency, period: job.salaryPeriod }
        : null,
    postedAt: job.postedAt?.toISOString() ?? null,
    source: job.source,
    url: job.url,
    quickMatch: job.match && { score: job.match.score, missing: job.match.missing.slice(0, 8) },
    fit: job.fit && { score: job.fit.overallScore, veto: vetoReason(job.fit), recommendation: job.fit.recommendation },
    application: job.application,
    closed: job.extras.check?.status === "closed" || undefined,
  };
}

export function jobDetail(job: JobListItem, full: boolean) {
  const description = clip(toPlainText(job.description), full ? 20_000 : DESCRIPTION_CHARS);
  return {
    ...jobSummary(job),
    skills: job.skills,
    postingText: {
      summary: job.extras.summary,
      requirements: job.extras.requirements,
      description: description.text,
    },
    descriptionTruncated: description.truncated || undefined,
    quickMatch: job.match,
    fit: job.fit && {
      score: job.fit.overallScore,
      veto: vetoReason(job.fit),
      scores: { skills: job.fit.skillsScore, experience: job.fit.experienceScore, culture: job.fit.cultureScore, career: job.fit.careerScore },
      strengths: job.fit.strengths,
      gaps: job.fit.gaps,
      summary: job.fit.summary,
      recommendation: job.fit.recommendation,
      deadline: job.fit.deadline,
      model: job.fit.model,
      at: job.fit.scoredAt.toISOString(),
    },
    stillOpen: job.extras.check,
  };
}

export function applicationSummary(app: PipelineItem) {
  return {
    id: app.id,
    jobId: app.jobId,
    role: app.role,
    company: app.company,
    status: app.status,
    appliedAt: app.appliedAt?.toISOString() ?? null,
    interviewAt: app.interviewAt?.toISOString() ?? null,
    nextFollowUpAt: app.nextFollowUpAt?.toISOString() ?? null,
    updatedAt: app.updatedAt.toISOString(),
  };
}
