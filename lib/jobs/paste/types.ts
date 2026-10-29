import { z } from "zod";
import { ATS_IDS, type AtsId } from "@/lib/jobs/sources/companies/types";

/*
 * "Paste a job": a link or a posting's text becomes a job the user reviews, then saves,
 * evaluates or applies to like any other. Shared by both editions.
 */

/** The source id of jobs added from a pasted link or text that no source reads. */
export const PASTED_SOURCE = "pasted";

/** The most text RolePort takes in one paste. Longer postings are cut here. */
export const MAX_PASTE_CHARS = 30_000;

/** Whether a job is still open, from the last "Check again". */
export type JobCheck = {
  status: "open" | "closed" | "unknown";
  /** Why, in a sentence: "The page says it's no longer accepting applications." */
  reason: string | null;
  /** ISO date and time of the check. */
  at: string;
};

const httpLink = z
  .string()
  .trim()
  .max(2000)
  .refine((s) => s === "" || /^https?:\/\/\S+$/i.test(s), "The link should start with http:// or https://.");
const nullableText = (max: number) => z.string().trim().max(max).nullable();
const amount = z.number().int().nonnegative().max(1_000_000_000).nullable();

/** A job as the review screen shows it and saving stores it. Everything here may come from a third party. */
export const pastedJobSchema = z.object({
  source: z.enum([PASTED_SOURCE, ...ATS_IDS]),
  sourceId: nullableText(300),
  url: httpLink,
  title: z.string().trim().min(1, "Add the job title.").max(200),
  company: z.string().trim().min(1, "Add the company's name.").max(200),
  companyLogo: nullableText(2000),
  location: nullableText(200),
  workSetup: z.enum(["onsite", "hybrid", "remote"]).nullable(),
  employmentType: z.enum(["full_time", "part_time", "contract", "freelance", "internship"]).nullable(),
  salaryMin: amount,
  salaryMax: amount,
  salaryCurrency: z.string().trim().max(10),
  salaryPeriod: z.enum(["hour", "day", "month", "year"]).nullable(),
  /** Sanitized HTML. */
  description: z.string().max(400_000).nullable(),
  requirements: z.array(z.object({ text: z.string().trim().min(1).max(600), priority: z.enum(["required", "preferred"]) })).max(60),
  skills: z.array(z.string().trim().min(1).max(80)).max(40),
  postedAt: nullableText(40),
  /** The posting's closing date, when it states one. */
  expiresAt: nullableText(40),
});

export type PastedJob = z.infer<typeof pastedJobSchema>;

/** How the fields were filled in, so the review screen can say how much to check. */
export type PasteSource = "board" | "page" | "ai" | "manual";

/** What the review screen opens with. */
export type PasteReview = {
  job: PastedJob;
  how: PasteSource;
  /** The company's hiring system, when the link is on one RolePort can follow. */
  board: { ats: AtsId; label: string; name: string; careersUrl: string } | null;
  /** Things to tell the user before they save: fields left empty, a closing date that has passed. */
  notes: string[];
  /** Set when the link was just read: it's open, or the page says it's closed. */
  check: JobCheck | null;
};

/** A blank job for the user to fill in. */
export function emptyPastedJob(url = ""): PastedJob {
  return {
    source: PASTED_SOURCE,
    sourceId: url || null,
    url,
    title: "",
    company: "",
    companyLogo: null,
    location: null,
    workSetup: null,
    employmentType: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: "",
    salaryPeriod: null,
    description: null,
    requirements: [],
    skills: [],
    postedAt: null,
    expiresAt: null,
  };
}

/** A pasted link on its own, or null when the input is text (a description, an email). */
export function pastedLink(input: string): string | null {
  const text = input.trim();
  if (!text || /\s/.test(text)) return null;
  if (/^https?:\/\//i.test(text)) return text;
  // "careers.acme.com/jobs/123" without the scheme.
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+\/\S*$/i.test(text) ? `https://${text}` : null;
}

/** Whether "Check again" works for this job: company feeds and pasted links. */
export function canCheckJob(job: { source: string; url: string }): boolean {
  return (ATS_IDS as readonly string[]).includes(job.source) || (job.source === PASTED_SOURCE && /^https?:\/\//i.test(job.url));
}

/** What reading a link on the server gives: a job ready to review, or the page's text for the AI to read. */
export type LinkRead = { kind: "review"; review: PasteReview } | { kind: "text"; url: string; text: string; check: JobCheck | null };
