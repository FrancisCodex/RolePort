import "server-only";
import { isAiConfigured } from "@/lib/ai/config";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { readLetterPage, type LetterPageData } from "./letter";

/** The current user's cover letter page for one application, or null if the application isn't theirs. */
export async function getMyLetterPage(applicationId: string): Promise<LetterPageData | null> {
  const user = await getCurrentUser();
  return readLetterPage(await getDb(), user, applicationId, await isAiConfigured());
}
