import "server-only";
import { isAiConfigured } from "@/lib/ai/config";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { readInterview, readInterviewList, readInterviewProgress, readInterviewSetup } from "./sessions";
import type { InterviewListItem, InterviewPageData, InterviewProgress, InterviewSetupData } from "./types";

export async function getMyInterviews(): Promise<InterviewListItem[]> {
  const user = await getCurrentUser();
  return readInterviewList(await getDb(), user.id);
}

export async function getMyInterviewProgress(): Promise<InterviewProgress> {
  const user = await getCurrentUser();
  return readInterviewProgress(await getDb(), user.id);
}

/** The current user's interview, or null if it isn't theirs. */
export async function getMyInterview(id: string): Promise<InterviewPageData | null> {
  const user = await getCurrentUser();
  const [interview, aiEnabled] = await Promise.all([readInterview(await getDb(), user.id, id), isAiConfigured()]);
  return interview && { interview, aiEnabled };
}

export async function getMyInterviewSetup(applicationId: string | null): Promise<InterviewSetupData> {
  const user = await getCurrentUser();
  return readInterviewSetup(await getDb(), user, applicationId, await isAiConfigured());
}
