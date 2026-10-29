import "server-only";
import type { ApplicationKit } from "@/app/(app)/applied/view-data";
import { readCvPage } from "@/lib/cv/tailor";
import { getDb } from "@/lib/db";
import { readLetterPage } from "@/lib/letter/letter";
import { readOutreachSummary } from "@/lib/outreach/outreach";
import { readQuestionsPage } from "@/lib/questions/questions";
import { getCurrentUser } from "@/lib/session";

/** The current user's CV and cover letter for one application, as the application page shows them. */
export async function getMyApplicationKit(applicationId: string, aiEnabled: boolean): Promise<ApplicationKit> {
  const [user, db] = await Promise.all([getCurrentUser(), getDb()]);
  const [cv, letter, questions, outreach] = await Promise.all([
    readCvPage(db, user, applicationId, aiEnabled),
    readLetterPage(db, user, applicationId, aiEnabled),
    readQuestionsPage(db, user, applicationId, aiEnabled),
    readOutreachSummary(db, user.id, applicationId),
  ]);
  return { cv, letter, questions, outreach };
}
