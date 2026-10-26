"use server";

import { refresh } from "next/cache";
import { AiUnavailableError } from "@/lib/ai/client";
import { getAiConfig } from "@/lib/ai/config";
import { MAX_ANSWER_PROMPT } from "@/lib/ai/answer-prompt";
import { aiErrorMessage } from "@/lib/ai/errors";
import { getDb } from "@/lib/db";
import { draftQuestionAnswer, saveQuestionList } from "@/lib/questions/questions";
import { questionsSchema, type QuestionItem } from "@/lib/questions/types";
import type { Result } from "@/lib/result";
import { getCurrentUser } from "@/lib/session";
import { writeSettings } from "@/lib/settings/queries";

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

/** Save the user's own answer instructions; null or blank goes back to the default. */
export async function saveAnswerPrompt(prompt: string | null): Promise<Result> {
  if (prompt != null && (typeof prompt !== "string" || prompt.length > MAX_ANSWER_PROMPT)) {
    return { ok: false, error: `Keep the prompt under ${MAX_ANSWER_PROMPT} characters.` };
  }
  const user = await getCurrentUser();
  await writeSettings(await getDb(), user.id, { answerPrompt: prompt?.trim() || null });
  refresh();
  return { ok: true, data: undefined };
}
