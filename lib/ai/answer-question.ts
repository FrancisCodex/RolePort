import { z } from "zod";
import { wordCount } from "@/lib/letter/types";
import type { ProfileInput } from "@/lib/profile/schema";
import { answerSystemPrompt } from "./answer-prompt";
import { jobBlock, type EvaluationJob } from "./evaluate-job";
import type { AiConfig } from "./settings";
import { generateStructured } from "./structured";
import { candidateBlock, numbersIn, sourceOf } from "./tailor-cv";

/*
 * Application form questions: the model answers one question at a time, in the first person,
 * from the candidate's profile and CV only. The app then checks the answer for numbers the
 * source doesn't state and leftover placeholders, and passes the findings on as warnings.
 */

// Planning field first: small models stay closer to the profile once they've picked their facts.
export { answerSystemPrompt };

export const answerSchema = z.object({
  facts: z.array(z.string()),
  answer: z.string(),
  notes: z.string(),
});

export type AnswerRaw = z.infer<typeof answerSchema>;

export type AnswerInput = { profile: ProfileInput; cvText: string | null; job: EvaluationJob | null; question: string };

export function buildAnswerPrompt({ profile, cvText, job, question }: AnswerInput): string {
  return [
    "<candidate_profile>",
    `Name: ${profile.name}`,
    candidateBlock(profile, cvText),
    "</candidate_profile>",
    "",
    ...(job ? ["<job_posting>", jobBlock(job), "</job_posting>", ""] : []),
    "<question>",
    question.replace(/<\/?\s*(question|job_posting|candidate_profile)\s*>/gi, " "),
    "</question>",
    "",
    "Answer this application question for the candidate. Reply with the JSON object only.",
  ].join("\n");
}

const PLACEHOLDER = /\[[^\]]{1,40}\]|\{[^}]{1,40}\}|<[^>]{1,40}>|\bXX+\b/;

const tidy = (s: string) => s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

/** Clean the model's answer and flag what the user should check before pasting it into the form. */
export function reviewAnswer(
  raw: AnswerRaw,
  { profile, cvText }: { profile: ProfileInput; cvText: string | null },
): { answer: string; facts: string[]; notes: string; warnings: string[] } {
  const answer = tidy(raw.answer.replace(/\*\*|__|^#+\s/gm, ""));
  const facts = raw.facts.map(tidy).filter(Boolean).slice(0, 4);
  const notes = tidy(raw.notes).slice(0, 400);
  if (!answer) return { answer, facts, notes, warnings: ["The model didn't write an answer. Try again."] };

  const warnings: string[] = [];
  const sourceNumbers = new Set(numbersIn(sourceOf(profile, cvText)));
  const unknown = [...new Set(numbersIn(answer).filter((n) => !sourceNumbers.has(n)))];
  if (unknown.length) warnings.push(`The answer states ${unknown.join(", ")}, which isn't in your profile or CV. Check it or remove it.`);
  if (PLACEHOLDER.test(answer)) warnings.push("The answer has a placeholder like [Company] left in it. Fill it in before sending.");
  if (wordCount(answer) > 400) warnings.push("It's long. Application forms usually want a short answer.");
  return { answer, facts, notes, warnings };
}

/** Answer one application question on the given provider. Runs on the server and in the lite edition's browser. */
export async function answerQuestion(input: AnswerInput & { customPrompt: string | null }, config: AiConfig): Promise<ReturnType<typeof reviewAnswer>> {
  const raw = await generateStructured({
    system: answerSystemPrompt(input.customPrompt),
    prompt: buildAnswerPrompt(input),
    schema: answerSchema,
    effort: "medium",
    config,
  });
  return reviewAnswer(raw, input);
}
