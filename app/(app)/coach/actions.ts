"use server";

import { refresh } from "next/cache";
import { AiUnavailableError } from "@/lib/ai/client";
import { MAX_INTERVIEWER_PROMPT } from "@/lib/ai/interview-prompt";
import { writeSettings } from "@/lib/settings/queries";
import { getAiConfig } from "@/lib/ai/config";
import { aiErrorMessage } from "@/lib/ai/errors";
import { getDb } from "@/lib/db";
import {
  answerInterview,
  deleteInterview as removeInterview,
  endInterview as stopInterview,
  gradeInterviewStep,
  prepareInterviewBriefing,
  redoInterviewQuestion,
  skipInterviewQuestion,
  startInterview as beginInterview,
} from "@/lib/interview/sessions";
import { interviewSetupSchema, MAX_INTERVIEW_ANSWER, type InterviewSetup, type InterviewView } from "@/lib/interview/types";
import type { Result } from "@/lib/result";
import { getCurrentUser } from "@/lib/session";

export type InterviewResult<T = InterviewView> = Result<T> & { needsSetup?: boolean };

/** Plan a new mock interview and save it with its first question. Returns the session id. */
export async function startInterview(input: InterviewSetup): Promise<InterviewResult<string>> {
  const parsed = interviewSetupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const user = await getCurrentUser();
  const config = await getAiConfig();
  if (!config) return { ok: false, error: new AiUnavailableError().message, needsSetup: true };
  try {
    return { ok: true, data: await beginInterview(await getDb(), user, parsed.data, config) };
  } catch (error) {
    console.error("[interview] planning failed", error);
    return { ok: false, error: aiErrorMessage(error, "Preparing the interview failed. Please try again.") };
  }
}

/** Answer the question in play; returns the session with the interviewer's next turn. */
export async function answerInterviewQuestion(id: string, answer: string): Promise<InterviewResult> {
  const text = typeof answer === "string" ? answer.trim() : "";
  if (!text) return { ok: false, error: "Write your answer first, or skip the question." };
  if (text.length > MAX_INTERVIEW_ANSWER) return { ok: false, error: `Keep an answer under ${MAX_INTERVIEW_ANSWER} characters.` };
  const user = await getCurrentUser();
  const config = await getAiConfig();
  if (!config) return { ok: false, error: new AiUnavailableError().message, needsSetup: true };
  try {
    return { ok: true, data: await answerInterview(await getDb(), user.id, id, text, config) };
  } catch (error) {
    console.error("[interview] turn failed", error);
    return { ok: false, error: aiErrorMessage(error, "The interviewer couldn't reply. Your answer is still here; try sending it again.") };
  }
}

export async function skipInterviewTurn(id: string): Promise<InterviewResult> {
  const user = await getCurrentUser();
  try {
    return { ok: true, data: await skipInterviewQuestion(await getDb(), user.id, id) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't skip the question." };
  }
}

export async function endInterview(id: string): Promise<InterviewResult> {
  const user = await getCurrentUser();
  try {
    return { ok: true, data: await stopInterview(await getDb(), user.id, id) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't end the interview." };
  }
}

/** One step of the report (one question graded, or the summary). The page calls it until the report is done. */
export async function gradeInterview(id: string): Promise<InterviewResult> {
  const user = await getCurrentUser();
  const config = await getAiConfig();
  if (!config) return { ok: false, error: new AiUnavailableError().message, needsSetup: true };
  try {
    return { ok: true, data: await gradeInterviewStep(await getDb(), user.id, id, config) };
  } catch (error) {
    console.error("[interview] grading failed", error);
    return { ok: false, error: aiErrorMessage(error, "Grading the interview failed. Please try again.") };
  }
}

/** Answer one question again from the report and grade it, to compare with the first attempt. */
export async function redoQuestion(id: string, q: number, answer: string): Promise<InterviewResult> {
  const text = typeof answer === "string" ? answer.trim() : "";
  if (!text) return { ok: false, error: "Write your answer first." };
  if (text.length > MAX_INTERVIEW_ANSWER) return { ok: false, error: `Keep an answer under ${MAX_INTERVIEW_ANSWER} characters.` };
  if (!Number.isInteger(q) || q < 0) return { ok: false, error: "That question isn't in this interview." };
  const user = await getCurrentUser();
  const config = await getAiConfig();
  if (!config) return { ok: false, error: new AiUnavailableError().message, needsSetup: true };
  try {
    return { ok: true, data: await redoInterviewQuestion(await getDb(), user.id, id, q, text, config) };
  } catch (error) {
    console.error("[interview] redo failed", error);
    return { ok: false, error: aiErrorMessage(error, "Grading your answer failed. It's still in the box; try again.") };
  }
}

/** Save the user's own interviewer instructions; null or blank goes back to the default. */
export async function saveInterviewPrompt(prompt: string | null): Promise<Result> {
  if (prompt != null && (typeof prompt !== "string" || prompt.length > MAX_INTERVIEWER_PROMPT)) {
    return { ok: false, error: `Keep the prompt under ${MAX_INTERVIEWER_PROMPT} characters.` };
  }
  const user = await getCurrentUser();
  await writeSettings(await getDb(), user.id, { interviewPrompt: prompt?.trim() || null });
  refresh();
  return { ok: true, data: undefined };
}

/** Write the pre-interview briefing for this session (or write it again). */
export async function prepareBriefing(id: string): Promise<InterviewResult> {
  const user = await getCurrentUser();
  const config = await getAiConfig();
  if (!config) return { ok: false, error: new AiUnavailableError().message, needsSetup: true };
  try {
    return { ok: true, data: await prepareInterviewBriefing(await getDb(), user, id, config) };
  } catch (error) {
    console.error("[interview] briefing failed", error);
    return { ok: false, error: aiErrorMessage(error, "Writing the briefing failed. Please try again.") };
  }
}

export async function deleteInterview(id: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!(await removeInterview(await getDb(), user.id, id))) return { ok: false, error: "Interview not found." };
  return { ok: true, data: undefined };
}
