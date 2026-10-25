import "server-only";
import { isAiConfigured } from "@/lib/ai/config";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { readCvPage, type CvPageData } from "./tailor";

/** The current user's CV page for one application, or null if the application isn't theirs. */
export async function getMyCvPage(applicationId: string): Promise<CvPageData | null> {
  const user = await getCurrentUser();
  return readCvPage(await getDb(), user, applicationId, await isAiConfigured());
}
