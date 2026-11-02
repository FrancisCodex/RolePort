import { z } from "zod";
import { extractProfileFromCv } from "@/lib/ai/extract-profile";
import { detectContact } from "@/lib/profile/detect-contact";
import { readProfile, readProfilePrompt, writeCv, writeProfile } from "@/lib/profile/queries";
import { profileError, profileSchema } from "@/lib/profile/schema";
import { AI_NOT_SET_UP } from "../errors";
import { answerInput, tool, ToolError, writerFor } from "../tool";

const MAX_CV_CHARS = 60_000;

export const importCv = tool({
  name: "import_cv",
  title: "Import a CV into the profile",
  description:
    "Reads the user's CV into RolePort's profile, like Import CV on the Profile page: headline, summary, skills, experience, education, languages and contact details, only what the CV says. Pass the CV as plain text (read the user's file yourself). Read by the AI set up in RolePort, or by you: then this returns a brief to answer. Returns the draft without saving; show it to the user, and call again with save: true once they agree.",
  input: {
    cv_text: z.string().min(200, "That's too short for a CV. Pass the whole CV as text.").max(MAX_CV_CHARS),
    file_name: z.string().max(200).optional().describe('The CV file\'s name, e.g. "Juan dela Cruz CV.pdf".'),
    save: z.boolean().optional().describe("Save the draft over the profile's matching fields. Only after the user has seen it."),
    answer: answerInput,
  },
  writes: true,
  external: true,
  async run({ cv_text, file_name, save, answer }, ctx) {
    const config = await writerFor(ctx, answer, AI_NOT_SET_UP);
    const draft = await extractProfileFromCv(cv_text, config, await readProfilePrompt(ctx.db, ctx.user.id));
    // Contact lines are found in code too, like the app's import, for when the model skips them.
    const contact = detectContact(cv_text);
    const filled = { ...draft, email: draft.email || contact.email, phone: draft.phone || contact.phone, links: draft.links?.length ? draft.links : contact.links };
    if (!save) {
      return { saved: false, draft: filled, next: "Show this to the user. If they're happy with it, call import_cv again with the same cv_text, save: true and this answer (if you wrote it)." };
    }

    const { profile } = await readProfile(ctx.db, ctx.user);
    // Like the Profile page's form: the CV's fields replace what's there, the rest (desired roles, countries, salary) stays.
    const parsed = profileSchema.safeParse({ ...profile, ...filled });
    if (!parsed.success) throw new ToolError(profileError(parsed.error));
    await writeCv(ctx.db, ctx.user.id, file_name || "CV (imported by an AI agent)", cv_text);
    await writeProfile(ctx.db, ctx.user.id, parsed.data);
    return { saved: true, note: "Saved. The user can review and change it on RolePort's Profile page, and set their desired roles and countries there if they haven't." };
  },
});
