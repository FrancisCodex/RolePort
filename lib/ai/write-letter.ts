import { z } from "zod";
import { paragraphsOf, wordCount, type LetterContent, type LetterReview } from "@/lib/letter/types";
import type { ProfileInput } from "@/lib/profile/schema";
import { jobBlock, type EvaluationJob } from "./evaluate-job";
import { letterSystemPrompt } from "./letter-prompt";
import type { AiConfig } from "./settings";
import { generateStructured } from "./structured";
import { candidateBlock, mentions, numbersIn, sourceOf } from "./tailor-cv";

/*
 * Cover letters: the model writes the greeting, paragraphs and closing; the sender's lines,
 * date and recipient come from the profile and the application in code. The app then checks
 * the letter (numbers it can't back, placeholders, clichés, length, the employer's name).
 */

export { letterSystemPrompt };

// Planning field first: small models write a tighter letter once they've picked their evidence.
export const coverLetterSchema = z.object({
  keyPoints: z.array(z.string()),
  greeting: z.string(),
  paragraphs: z.array(z.string()),
  closing: z.string(),
  notes: z.string(),
});

export type CoverLetterRaw = z.infer<typeof coverLetterSchema>;

export type LetterInput = { profile: ProfileInput; cvText: string | null; job: EvaluationJob };

/** The user message of a cover letter run, shown to the user as-is on the letter page. */
export function buildLetterPrompt({ profile, cvText, job }: LetterInput): string {
  return [
    "<candidate_profile>",
    `Name: ${profile.name}`,
    candidateBlock(profile, cvText),
    "</candidate_profile>",
    "",
    "<job_posting>",
    jobBlock(job),
    "</job_posting>",
    "",
    "Write this candidate's cover letter for this posting. Reply with the JSON object only.",
  ].join("\n");
}

const tidy = (s: string) => s.replace(/[ \t]+/g, " ").trim();

const CLICHES = [
  "i am writing to express my interest",
  "i am writing to apply",
  "i believe i would be a great fit",
  "i would be a great fit",
  "perfect fit",
  "passionate",
  "results-driven",
  "team player",
  "go-getter",
  "think outside the box",
  "hit the ground running",
];

const PLACEHOLDER = /\[[^\]]{1,40}\]|\{[^}]{1,40}\}|<[^>]{1,40}>|\bXX+\b/;

/**
 * Turn the model's draft into the letter body and review it against the profile and CV:
 * numbers the source doesn't state, leftover placeholders, clichés, length, and whether the
 * employer is named at all. Problems become warnings for the user; nothing is silently changed.
 */
export function reviewLetter(
  raw: CoverLetterRaw,
  { profile, cvText, company }: { profile: ProfileInput; cvText: string | null; company: string },
): { greeting: string; body: string; closing: string; review: Omit<LetterReview, "model" | "at" | "customPrompt"> } {
  // Small models sometimes hand back bullets or markdown despite the instructions.
  const paragraphs = raw.paragraphs
    .flatMap((p) => paragraphsOf(p))
    .map((p) => tidy(p.replace(/^[\s\-–—•*·]+/, "").replace(/\*\*|__|#+\s/g, "")))
    .filter(Boolean)
    .slice(0, 6);
  const body = paragraphs.join("\n\n");
  const greeting = tidy(raw.greeting) || "Dear Hiring Manager,";
  const closing = tidy(raw.closing) || "Sincerely,";

  const warnings: string[] = [];
  const sourceNumbers = new Set(numbersIn(sourceOf(profile, cvText)));
  const unknown = [...new Set(numbersIn(body).filter((n) => !sourceNumbers.has(n)))];
  if (unknown.length) warnings.push(`The letter states ${unknown.join(", ")}, which isn't in your profile or CV. Check it or remove it.`);

  if (PLACEHOLDER.test(`${greeting} ${body}`)) warnings.push("The letter has a placeholder like [Company] left in it. Fill it in before sending.");

  const lower = body.toLowerCase();
  const cliches = CLICHES.filter((c) => lower.includes(c));
  if (cliches.length) warnings.push(`Reads like a template in places: "${cliches.join('", "')}". Consider saying it more plainly.`);

  const words = wordCount(body);
  if (words < 150) warnings.push(`It's short (${words} words). Most cover letters run 250 to 350.`);
  if (words > 450) warnings.push(`It's long (${words} words). Recruiters skim: 250 to 350 words usually reads best.`);

  if (company && !mentions(body, company)) warnings.push(`The letter never names ${company}. Mention the employer so it doesn't read as generic.`);

  return {
    greeting,
    body,
    closing,
    review: { keyPoints: raw.keyPoints.map(tidy).filter(Boolean).slice(0, 4), notes: tidy(raw.notes).slice(0, 600), warnings },
  };
}

/** Draft a cover letter on the given provider. Runs on the server and in the lite edition's browser. */
export async function writeCoverLetter(
  input: LetterInput & { base: LetterContent; company: string; customPrompt: string | null },
  config: AiConfig,
): Promise<{ content: LetterContent; review: Omit<LetterReview, "model" | "at" | "customPrompt"> }> {
  const raw = await generateStructured({
    system: letterSystemPrompt(input.customPrompt),
    prompt: buildLetterPrompt(input),
    schema: coverLetterSchema,
    effort: "medium",
    config,
  });
  const { greeting, body, closing, review } = reviewLetter(raw, input);
  return { content: { ...input.base, greeting, body, closing }, review };
}
