import { eq } from "drizzle-orm";
import { answerSystemPrompt } from "@/lib/ai/answer-prompt";
import { answerQuestion, buildAnswerPrompt } from "@/lib/ai/answer-question";
import { describeAiConfig, type AiConfig } from "@/lib/ai/settings";
import * as schema from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { readAppDocument, writeAppDocument } from "@/lib/documents/queries";
import { readApplication } from "@/lib/jobs/applications";
import { evaluationJobOf } from "@/lib/jobs/fit-evaluation";
import { readCvText, readProfile } from "@/lib/profile/queries";
import { questionsSchema, type QuestionItem, type QuestionsData } from "./types";

/*
 * The application's questions and answers, shared by the server (page, actions) and the lite
 * edition's browser database. One document per application (kind "application_answers").
 * No auth here: callers pass the user.
 */

type User = { id: string; name: string };

const KIND = "application_answers";

async function readItems(db: AnyDb, userId: string, applicationId: string): Promise<QuestionItem[]> {
  const saved = await readAppDocument<{ items: unknown }>(db, userId, applicationId, KIND);
  const parsed = questionsSchema.safeParse(saved?.data.items ?? []);
  return parsed.success ? parsed.data : [];
}

export async function readAnswerPrompt(db: AnyDb, userId: string): Promise<string | null> {
  const [row] = await db.select({ prompt: schema.userSettings.answerPrompt }).from(schema.userSettings).where(eq(schema.userSettings.userId, userId));
  return row?.prompt ?? null;
}

export async function readQuestionsPage(db: AnyDb, user: User, applicationId: string, aiEnabled: boolean): Promise<QuestionsData | null> {
  const application = await readApplication(db, user.id, applicationId);
  if (!application) return null;
  const [items, { profile }, cvText, customPrompt] = await Promise.all([
    readItems(db, user.id, applicationId),
    readProfile(db, user),
    readCvText(db, user.id),
    readAnswerPrompt(db, user.id),
  ]);
  const job = application.job ? evaluationJobOf(application.job) : null;
  return {
    applicationId,
    role: application.role,
    company: application.company,
    items,
    hasPosting: Boolean(job),
    aiEnabled,
    profileEmpty: profile.experience.length === 0 && profile.skills.length === 0 && !cvText,
    prompt: {
      system: answerSystemPrompt(customPrompt),
      user: buildAnswerPrompt({ profile, cvText, job, question: items[0]?.question ?? "(The question you add goes here.)" }),
      custom: Boolean(customPrompt),
    },
  };
}

/** Replace the application's question list with the user's edits. False if the application isn't theirs. */
export async function saveQuestionList(db: AnyDb, user: User, applicationId: string, items: QuestionItem[]): Promise<boolean> {
  const application = await readApplication(db, user.id, applicationId);
  if (!application) return false;
  await writeAppDocument(db, user.id, applicationId, KIND, `Application questions for ${application.role} at ${application.company}`, { items });
  return true;
}

/** Answer one saved question from the profile, save the answer, and return the updated item. */
export async function draftQuestionAnswer(db: AnyDb, user: User, applicationId: string, questionId: string, config: AiConfig): Promise<QuestionItem> {
  const application = await readApplication(db, user.id, applicationId);
  if (!application) throw new Error("Application not found.");
  const target = (await readItems(db, user.id, applicationId)).find((i) => i.id === questionId);
  if (!target) throw new Error("That question isn't saved anymore.");

  const [{ profile }, cvText, customPrompt] = await Promise.all([readProfile(db, user), readCvText(db, user.id), readAnswerPrompt(db, user.id)]);
  const job = application.job ? evaluationJobOf(application.job) : null;
  const result = await answerQuestion({ profile, cvText, job, question: target.question, customPrompt }, config);

  const updated: QuestionItem = {
    ...target,
    answer: result.answer,
    draft: {
      model: describeAiConfig(config),
      at: new Date().toISOString(),
      customPrompt: Boolean(customPrompt),
      facts: result.facts,
      notes: result.notes,
      warnings: result.warnings,
    },
  };
  // Re-read: the list may have changed while the model was writing.
  const latest = await readItems(db, user.id, applicationId);
  if (latest.some((i) => i.id === questionId)) {
    await saveQuestionList(db, user, applicationId, latest.map((i) => (i.id === questionId ? updated : i)));
  }
  return updated;
}
