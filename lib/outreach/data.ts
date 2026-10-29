import "server-only";
import { isAiConfigured } from "@/lib/ai/config";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { readOutreachPage } from "./outreach";
import type { OutreachPageData } from "./view";

/** The current user's emails and follow-ups for one application, or null if the application isn't theirs. */
export async function getMyOutreachPage(applicationId: string): Promise<OutreachPageData | null> {
  const user = await getCurrentUser();
  return readOutreachPage(await getDb(), user, applicationId, await isAiConfigured());
}
