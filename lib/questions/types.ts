import { z } from "zod";

/*
 * The questions an application form asks (why do you want this job, describe a project...)
 * and the answers HireMe drafted from the candidate's profile or the user wrote themselves.
 */

export const MAX_QUESTIONS = 30;
export const MAX_QUESTION = 1000;
export const MAX_ANSWER = 6000;

export const questionItemSchema = z.object({
  id: z.string().trim().min(1).max(60),
  question: z.string().trim().min(1, "Write the question first.").max(MAX_QUESTION, `A question can be at most ${MAX_QUESTION} characters.`),
  answer: z.string().trim().max(MAX_ANSWER, `An answer can be at most ${MAX_ANSWER} characters.`),
  /** Set when the AI wrote the answer; cleared when the user edits it. */
  draft: z
    .object({
      model: z.string(),
      at: z.string(),
      warnings: z.array(z.string()),
    })
    .nullable(),
});

export const questionsSchema = z.array(questionItemSchema).max(MAX_QUESTIONS, `Keep it to ${MAX_QUESTIONS} questions per application.`);

export type QuestionItem = z.infer<typeof questionItemSchema>;

export type QuestionsData = {
  items: QuestionItem[];
  aiEnabled: boolean;
  profileEmpty: boolean;
};
