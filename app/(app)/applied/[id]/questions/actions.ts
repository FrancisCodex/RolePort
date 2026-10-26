"use server";

import { AiUnavailableError } from "@/lib/ai/client";
import { getAiConfig } from "@/lib/ai/config";
import { aiErrorMessage } from "@/lib/ai/errors";
import { getDb } from "@/lib/db";
import { draftQuestionAnswer, saveQuestionList } from "@/lib/questions/questions";
import { questionsSchema, type QuestionItem } from "@/lib/questions/types";
import type { Result } from "@/lib/result";
import { getCurrentUser } from "@/lib/session";

export type AnswerResult = Result<QuestionItem> & { needsSetup?: boolean };

/** Save the application's questions and answers as the user left them. */
export async function saveQuestions(applicationId: string, items: QuestionItem[]): Promise<Result> {
  const parsed = questionsSchema.safeParse(items);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Some fields are too long." };
  const user = await getCurrentUser();
  if (!(await saveQuestionList(await getDb(), user, applicationId, parsed.data))) return { ok: false, error: "Application not found." };
  return { ok: true, data: undefined };
}

/** Answer one saved question with the user's AI provider. Local models can take a few minutes. */
export async function answerApplicationQuestion(applicationId: string, questionId: string): Promise<AnswerResult> {
  const user = await getCurrentUser();
  const config = await getAiConfig();
  if (!config) return { ok: false, error: new AiUnavailableError().message, needsSetup: true };
  try {
    return { ok: true, data: await draftQuestionAnswer(await getDb(), user, applicationId, questionId, config) };
  } catch (error) {
    console.error("[questions] answering failed", error);
    return { ok: false, error: aiErrorMessage(error, "Writing the answer failed. Please try again.") };
  }
}
