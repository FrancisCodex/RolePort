import { z } from "zod";

/*
 * A cover letter as RolePort keeps it: the sender's lines (from the profile), the recipient,
 * and the letter itself as plain paragraphs, so it can be pasted into an application form
 * or printed as a PDF.
 */

const line = (max: number, what: string) => z.string().trim().max(max, `${what} can be at most ${max} characters.`);

export const letterContentSchema = z.object({
  name: line(120, "Your name"),
  contact: z.object({
    email: line(160, "Your email"),
    phone: line(60, "Your phone"),
    location: line(160, "Your location"),
  }),
  date: line(60, "The date"),
  /** Who it's addressed to, one line each: "Hiring Manager", the company, its city. */
  recipient: line(400, "The recipient"),
  greeting: line(120, "The greeting"),
  /** Paragraphs separated by a blank line. */
  body: line(6000, "The letter"),
  closing: line(60, "The closing"),
  pageSize: z.enum(["LETTER", "A4"]),
});

export type LetterContent = z.infer<typeof letterContentSchema>;

/** What the last AI draft said and what the app's own checks found. */
export type LetterReview = {
  model: string;
  at: string;
  customPrompt: boolean;
  /** The strongest matches between the posting and the candidate that the letter leans on. */
  keyPoints: string[];
  notes: string;
  warnings: string[];
};

export const paragraphsOf = (body: string) =>
  body
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

export const wordCount = (text: string) => (text.trim().match(/\S+/g) ?? []).length;

/** The letter as plain text, for pasting into an application form's cover letter box. */
export function letterText(letter: LetterContent): string {
  return [letter.greeting, ...paragraphsOf(letter.body), [letter.closing, letter.name].filter(Boolean).join("\n")].filter(Boolean).join("\n\n");
}
