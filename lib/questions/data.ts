import "server-only";
import { isAiConfigured } from "@/lib/ai/config";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { readQuestionsPage } from "./questions";
import type { QuestionsData } from "./types";

/** The current user's questions page for one application, or null if the application isn't theirs. */
export async function getMyQuestionsPage(applicationId: string): Promise<QuestionsData | null> {
  const user = await getCurrentUser();
  return readQuestionsPage(await getDb(), user, applicationId, await isAiConfigured());
}
