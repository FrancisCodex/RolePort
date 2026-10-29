import type { SourceCredit } from "@/components/jobs/job-detail";
import type { CvPageData } from "@/lib/cv/tailor";
import type { ApplicationDetail, ApplicationStatus, PipelineItem } from "@/lib/jobs/applications";
import type { LetterPageData } from "@/lib/letter/letter";
import type { QuestionsData } from "@/lib/questions/types";
import { extrasOf, type JobListItem } from "@/lib/jobs/queries";
import { timeAgo } from "@/lib/jobs/format";

/*
 * What the Applied Jobs pages show, shaped by the server loader or the lite one. Dates are
 * formatted here so the labels match between the server and client renders.
 */

/** Longest notes an application keeps. */
export const MAX_NOTES = 10_000;

export type AppliedItem = {
  id: string;
  jobId: string | null;
  role: string;
  company: string;
  companyLogo: string | null;
  location: string | null;
  /** The posting on the employer's site or job board. */
  url: string | null;
  status: ApplicationStatus;
  /** The last check found the posting closed. */
  closed: boolean;
  appliedOn: string | null;
  updated: string | null;
};

export type ApplicationData = {
  id: string;
  role: string;
  company: string;
  status: ApplicationStatus;
  notes: string;
  url: string | null;
  appliedOn: string | null;
  /** When the interview is scheduled (ISO), or null. */
  interviewAt: string | null;
  events: { id: string; status: ApplicationStatus; on: string }[];
  /** Null when the stored posting is gone; the application keeps its role and company. */
  job: JobListItem | null;
  aiEnabled: boolean;
  source: SourceCredit | null;
  /** The documents prepared for this application, so the page can make, download and copy them in place. */
  kit: ApplicationKit;
};

export type ApplicationKit = { cv: CvPageData | null; letter: LetterPageData | null; questions: QuestionsData | null };

export function formatDay(date: Date): string {
  return date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

export function toAppliedItems(items: PipelineItem[]): AppliedItem[] {
  return items.map((i) => ({
    id: i.id,
    jobId: i.jobId,
    role: i.role,
    company: i.company,
    companyLogo: i.job?.companyLogo ?? null,
    location: i.job?.location ?? null,
    url: i.job?.url ?? null,
    status: i.status,
    closed: i.job ? extrasOf(i.job).check?.status === "closed" : false,
    appliedOn: i.appliedAt ? formatDay(i.appliedAt) : null,
    updated: timeAgo(i.updatedAt),
  }));
}

export function toApplicationData(
  application: ApplicationDetail,
  job: JobListItem | null,
  aiEnabled: boolean,
  source: SourceCredit | null,
  kit: ApplicationKit,
): ApplicationData {
  return {
    id: application.id,
    role: application.role,
    company: application.company,
    status: application.status,
    notes: application.notes ?? "",
    url: job?.url ?? null,
    appliedOn: application.appliedAt ? formatDay(application.appliedAt) : null,
    interviewAt: application.interviewAt?.toISOString() ?? null,
    // Newest first, like an activity feed.
    events: application.events.map((e) => ({ id: e.id, status: e.status, on: formatDay(e.occurredAt) })).reverse(),
    job,
    aiEnabled,
    source,
    kit,
  };
}
