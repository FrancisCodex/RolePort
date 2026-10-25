import { z } from "zod";
import { formatMonthYear } from "@/lib/profile/dates";

/*
 * A CV as HireMe renders it: plain, single-column content that both the editor and the
 * PDF read. Employers, titles, dates and schools are copied from the profile in code;
 * tailoring only rewrites the wording (lib/ai/tailor-cv.ts).
 */

/** Most skills a CV keeps: past that, recruiters skim and parsers dilute the match. */
export const MAX_CV_SKILLS = 40;

const line = (max: number, what = "Each line") => z.string().trim().max(max, `${what} can be at most ${max} characters.`);

export const cvContentSchema = z.object({
  name: line(120, "Your name"),
  headline: line(160, "The headline"),
  contact: z.object({
    email: line(160),
    phone: line(60),
    location: line(160),
    links: z.array(line(200, "Each link")).max(4, "Keep it to 4 links."),
  }),
  summary: line(1200, "The summary"),
  skills: z.array(line(60, "Each skill")).max(MAX_CV_SKILLS, `Keep it to ${MAX_CV_SKILLS} skills or fewer.`),
  experience: z
    .array(
      z.object({
        company: line(120),
        role: line(120),
        start: line(20),
        end: line(20).nullable(),
        location: line(120).nullable(),
        bullets: z.array(line(400, "Each bullet")).max(10, "Keep each job to 10 bullets or fewer."),
      }),
    )
    .max(20),
  education: z
    .array(z.object({ school: line(160), degree: line(160), field: line(120).nullable(), year: line(20).nullable() }))
    .max(10),
  languages: z.array(line(80)).max(10),
  pageSize: z.enum(["LETTER", "A4"]),
});

export type CvContent = z.infer<typeof cvContentSchema>;

/** What the last AI tailoring said and what the app's own checks found, shown beside the editor. */
export type CvTailoring = {
  model: string;
  at: string;
  /** Whether the user's own prompt was used instead of the default. */
  customPrompt: boolean;
  keywordsCovered: string[];
  keywordsMissing: string[];
  notes: string;
  /** The app's grounding checks: claims to verify before sending. */
  warnings: string[];
};

/** A CV saved for one application (document.kind = "cv"). */
export type SavedCv = { content: CvContent; tailoring: CvTailoring | null; updatedAt: Date; version: number };

/** "Mar 2022 - Present": profile dates are stored as "2022-03". */
export const cvDates = (start: string, end: string | null) =>
  [formatMonthYear(start) ?? start, end ? (formatMonthYear(end) ?? end) : "Present"].filter(Boolean).join(" - ");

/** US Letter where it's the usual paper (incl. the Philippines' "short bond"), A4 elsewhere. */
export function defaultPageSize(country: string): CvContent["pageSize"] {
  return ["PH", "US", "CA", "MX"].includes(country) ? "LETTER" : "A4";
}
