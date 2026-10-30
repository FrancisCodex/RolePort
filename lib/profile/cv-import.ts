import { aiErrorMessage } from "@/lib/ai/errors";
import { extractProfileFromCv } from "@/lib/ai/extract-profile";
import type { AiConfig } from "@/lib/ai/settings";
import type { CvImport } from "./cv-file";
import { detectContact } from "./detect-contact";
import { detectSkills } from "./detect-skills";

/**
 * A profile draft from CV text: AI-extracted when a provider is set up, else (or when AI
 * fails) just the detected skills. Shared by the server action and the lite edition.
 */
export async function draftFromCv(fileName: string, text: string, config: AiConfig | null, customPrompt: string | null): Promise<CvImport> {
  // Contact lines are easy to find in code, so they're filled in even without AI, or when the model skips them.
  const contact = detectContact(text);
  let aiError: string | undefined;
  if (config) {
    try {
      const draft = await extractProfileFromCv(text, config, customPrompt);
      return {
        fileName,
        draft: {
          ...draft,
          email: draft.email || contact.email,
          phone: draft.phone || contact.phone,
          links: draft.links?.length ? draft.links : contact.links,
        },
        usedAi: true,
      };
    } catch (error) {
      console.error("CV extraction failed", error);
      aiError = aiErrorMessage(error, "AI extraction failed.");
      // Fall through to the free path so the import still helps.
    }
  }

  const skills = detectSkills(text).map((name) => ({ name, level: "secondary" as const }));
  return { fileName, draft: { skills, ...contact }, usedAi: false, aiError };
}
